# sponsor-policy-engine

[![CI](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A small, dependency-free TypeScript library that decides **which Stellar transactions a sponsor
should pay for, and how much**.

On Stellar, an app can pay a user's transaction fees by wrapping the user's signed transaction in a
[`FeeBumpTransaction`](https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/fee-bump-transactions)
whose fee is paid by a sponsor account. That makes onboarding smooth (users don't need XLM), but a
sponsor that pays for anything will be drained: one script can submit thousands of expensive
transactions. Every sponsorship service needs a policy layer that says _no_ to the wrong requests.
This package is that layer. It takes plain inputs (account public keys, IP strings, fee amounts in
stroops) and returns decisions. It has no Stellar SDK, no HTTP framework and no database, so a
relay, a wallet backend, an anchor or a Soroban fee-sponsor can all use it.

Its first consumer is [**fee-sponsor-relay**](https://github.com/Stellar-Fee-Guild/fee-sponsor-relay),
an Express-based relay in the same organisation.

## Features

- **Allowlist and denylist** of source accounts, with the denylist always winning.
- **Per-transaction fee ceiling**, so one request can't spend a fortune.
- **Rolling hourly and daily spend caps per account**, which can't be gamed at the top of the hour.
- **Fixed-window rate limiter** per account and per IP, kept in separate counters.
- **Side-effect-free `evaluate`**: spend is only recorded once a sponsorship actually happened.
- **Descriptive rejections** with a machine-readable `reason` and a human-readable `detail`.
- **Injectable clock** for deterministic tests and simulations.
- **Strict config validation** with clear `TypeError` / `RangeError` messages.
- **Zero runtime dependencies**, ESM, full type declarations, Node 18+.

## Install

The package is not on npm yet. Install it from GitHub (the `prepare` script builds it on install):

```bash
npm install github:Stellar-Fee-Guild/sponsor-policy-engine
```

## Quick start

```ts
import { PolicyEngine, RateLimiter } from '@stellar-fee-guild/sponsor-policy-engine';

const policy = new PolicyEngine({
  allowlist: [], // empty = anyone not denylisted
  denylist: ['GBAD...'],
  maxFeeStroopsPerTx: 10_000, // 0.001 XLM
  hourlyCapStroopsPerAccount: 100_000, // 0.01 XLM
  dailyCapStroopsPerAccount: 1_000_000, // 0.1 XLM
});

const limiter = new RateLimiter({ perAccountPerMinute: 10, perIpPerMinute: 60 });

async function sponsor(sourceAccount: string, sourceIp: string, innerOperationCount: number) {
  // 1. Rate limit
  if (!limiter.tryConsumeIp(sourceIp) || !limiter.tryConsumeAccount(sourceAccount)) {
    return { status: 429 };
  }

  // 2. Evaluate (never changes state)
  const cost = baseFee * (innerOperationCount + 1);
  const decision = policy.evaluate(sourceAccount, cost);
  if (!decision.approved) {
    return { status: 403, reason: decision.reason, detail: decision.detail };
  }

  // 3. Sponsor: build, sign and submit the FeeBumpTransaction with your Stellar SDK
  await submitFeeBump(/* ... */);

  // 4. Record, only after it succeeded
  policy.recordSponsorship(sourceAccount, cost);
  return { status: 200 };
}
```

A runnable version is in [`examples/relay-flow.mjs`](examples/relay-flow.mjs): `npm run example`.

## API reference

Everything is exported from the package root.

### Types

```ts
type StellarPublicKey = string; // treated as an opaque string, not parsed or checksummed
type Stroops = number; // 1 XLM = 10,000,000 stroops
type Clock = () => number; // milliseconds since the epoch
interface EngineOptions {
  now?: Clock;
}
```

### `PolicyConfig`

| Field                        | Type                 | Description                                                          |
| ---------------------------- | -------------------- | -------------------------------------------------------------------- |
| `allowlist`                  | `StellarPublicKey[]` | Accounts that may be sponsored. **Empty = anyone not denylisted.**   |
| `denylist`                   | `StellarPublicKey[]` | Accounts that are always rejected, even if allowlisted.              |
| `maxFeeStroopsPerTx`         | `Stroops`            | Max cost sponsored for one transaction.                              |
| `hourlyCapStroopsPerAccount` | `Stroops`            | Max sponsored per account in any rolling 60 minutes.                 |
| `dailyCapStroopsPerAccount`  | `Stroops`            | Max sponsored per account in any rolling 24 hours. Must be ≥ hourly. |

All amounts must be non-negative integers. Zero is allowed and means "nothing above zero cost".

### `RateLimiterConfig`

| Field                 | Type     | Description                                            |
| --------------------- | -------- | ------------------------------------------------------ |
| `perAccountPerMinute` | `number` | Max requests per source account per one-minute window. |
| `perIpPerMinute`      | `number` | Max requests per source IP per one-minute window.      |

Limits must be non-negative integers. `0` blocks every request for that key type.

### `new PolicyEngine(config, options?)`

Validates `config` (see `validatePolicyConfig`) and copies the allowlist and denylist into `Set`s,
so later changes to your arrays have no effect and lookups are O(1). `options.now` replaces the
clock (default `Date.now`).

#### `evaluate(sourceAccount, costStroops): PolicyEvaluation`

Runs these checks in order and returns the **first** failure. It never changes state, so you can
call it as often as you like.

| #   | Reason                | Rejected when                                              |
| --- | --------------------- | ---------------------------------------------------------- |
| 1   | `DENYLISTED_ACCOUNT`  | The account is on the denylist (wins over the allowlist).  |
| 2   | `NOT_ALLOWLISTED`     | The allowlist is non-empty and the account is not on it.   |
| 3   | `FEE_EXCEEDS_MAX`     | `costStroops > maxFeeStroopsPerTx`.                        |
| 4   | `HOURLY_CAP_EXCEEDED` | Spend in the last 60 minutes + `costStroops` > hourly cap. |
| 5   | `DAILY_CAP_EXCEEDED`  | Spend in the last 24 hours + `costStroops` > daily cap.    |

Landing **exactly** on a limit is approved; only going over it is rejected.

```ts
interface PolicyEvaluation {
  approved: boolean;
  reason?: PolicyRejectionReason; // only on rejection
  detail?: string; // only on rejection, includes the numbers involved
}
```

An approval is exactly `{ approved: true }` with no `reason` or `detail` keys. A rejection looks
like:

```js
{
  approved: false,
  reason: 'HOURLY_CAP_EXCEEDED',
  detail: 'Account GA... has been sponsored 900 stroops in the last hour; adding 200 stroops would total 1100, over the hourly cap of 1000 stroops.'
}
```

Throws `TypeError` / `RangeError` if `costStroops` is not a non-negative integer. This guards
against `NaN`, which would otherwise slip past every `>` comparison.

#### `recordSponsorship(sourceAccount, costStroops): void`

Records spend at the current clock time. Call it **only after a sponsorship actually happened**
(the fee bump was submitted successfully), so rejected or failed attempts never count. Each call
also prunes that account's records older than 24 hours. Throws like `evaluate` on an invalid cost.

### `new RateLimiter(config, options?)`

Validates `config` (see `validateRateLimiterConfig`). `options.now` replaces the clock.

#### `tryConsumeAccount(sourceAccount): boolean` / `tryConsumeIp(sourceIp): boolean`

Returns `true` and counts the request if the key is under its limit; otherwise returns `false`
**without counting**. Accounts and IPs live in separate maps, so the same string used as both does
not share a counter.

### `validatePolicyConfig(config)` / `validateRateLimiterConfig(config)`

Throw the same errors the constructors would, so you can validate config at startup (for example
from environment variables) before building anything:

- `TypeError`: config is not an object, a field is missing or has the wrong type, a list contains a
  non-string, or an amount is `NaN`, infinite or not an integer.
- `RangeError`: an amount is negative, or `dailyCapStroopsPerAccount < hourlyCapStroopsPerAccount`.

Messages name the field and the value, e.g.
`RangeError: PolicyConfig.maxFeeStroopsPerTx must be non-negative, received -1.`

### Constants

`MINUTE_MS`, `HOUR_MS` and `DAY_MS` are exported for use in tests and simulations.

## How the windows work

The two classes deliberately use different windows.

**Spend caps are rolling.** When you call `evaluate`, the engine adds up what the account was
sponsored in the 60 minutes (or 24 hours) _immediately before now_. A record stops counting once it
is exactly 60 minutes (or 24 hours) old. With calendar windows that reset on the hour, an attacker
could spend the full hourly cap at 10:59 and again at 11:00, doubling it. Rolling windows make the
cap a true bound: **no 60-minute span ever contains more than the hourly cap**. Money is at stake,
so precision matters more than the small cost of keeping timestamps.

**The rate limiter is a fixed window per key.** Each key's window starts at its first request and
lasts one minute; the next request after it expires opens a fresh window. A burst at the boundary
can therefore let through up to twice the limit in a short span. That is acceptable here: the rate
limiter protects against request floods and is cheap (one counter per key), while the rolling caps
are what protect the sponsor's balance. A sliding-window limiter is on the roadmap.

## What cost to pass in

Pass what the sponsor **actually pays**. For a fee bump, the sponsor pays for the inner operations
plus the fee bump itself:

```
costStroops = baseFee * (innerOperationCount + 1)
```

For example, with a 100-stroop base fee and a 2-operation inner transaction, the cost is 300
stroops. If you set a higher fee during surge pricing, use that fee. For Soroban transactions,
include the resource fee the sponsor pays. Passing the inner transaction's own fee, or the
operation count, will make the caps meaningless.

## Limitations

- **In-memory and per process.** All history and counters live in the process's memory.
  - If you run **multiple instances** (several pods, PM2 cluster mode, serverless), each has its
    own state, so the effective limits are **multiplied by the number of instances**.
  - **Restarts reset history**, so an account's caps start again from zero after a deploy.
  - Until pluggable storage lands, run a single instance or set limits divided by instance count.
- **Memory grows with distinct keys.** Spend records are pruned per account on each record, and
  rate-limit windows are replaced when they expire, but keys that are never seen again are not
  swept. Under an attack with many random keys this grows unbounded. Put the IP rate limit first
  and keep an upstream limit (reverse proxy / WAF) in place.
- **Keys are opaque strings.** Public keys and IPs are not validated or normalised. Normalise
  IPv6 and `X-Forwarded-For` values before passing them in.
- **No global budget.** Caps are per account; a sponsor-wide budget is on the roadmap.

## Roadmap

Planned work is tracked as [GitHub issues](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/issues)
(also listed in [`ISSUES.md`](ISSUES.md)). Highlights:

- Pluggable storage interface and a Redis adapter for multi-instance deployments
- Expired-key sweeping and max-key eviction to bound memory
- Sliding-window rate limiter
- Per-account tiers and a global sponsor budget
- `remaining` allowance and `retryAfterMs` in results
- CommonJS build, npm publishing and a TypeDoc site
- Property-based tests, benchmarks, and guides for fee-sponsor-relay and Soroban sponsors

## Development

```bash
npm ci
```

| Script                 | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run build`        | Compile `src/` to `dist/` with type declarations |
| `npm run lint`         | ESLint                                           |
| `npm run lint:fix`     | ESLint with autofix                              |
| `npm run format`       | Prettier write                                   |
| `npm run format:check` | Prettier check                                   |
| `npm run typecheck`    | Type-check sources and tests                     |
| `npm test`             | Vitest with coverage (thresholds enforced)       |
| `npm run test:watch`   | Vitest in watch mode                             |
| `npm run example`      | Build, then run `examples/relay-flow.mjs`        |

## Contributing

Contributions are welcome, including through the Drips Wave Stellar Program. Read
[CONTRIBUTING.md](CONTRIBUTING.md) for labels, branch names and the PR checklist, and follow the
[Code of Conduct](CODE_OF_CONDUCT.md). The one hard rule: **no runtime dependencies**.

## License

[MIT](LICENSE) © Stellar Fee Guild
