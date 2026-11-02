# Planned issues

These issues are tracked on [GitHub](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/issues). Numbers below match the GitHub issue numbers. Trivial issues come first and are good first issues.

| #   | Title                                                                          | Size    | Labels                        | Depends on                                                                          |
| --- | ------------------------------------------------------------------------------ | ------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Add TSDoc with examples to every public export                                 | trivial | good first issue, docs        | Blocks #13 (TypeDoc site).                                                          |
| 2   | Add a test that locks the public export surface                                | trivial | good first issue, testing     |                                                                                     |
| 3   | Add a feeBumpCostStroops helper                                                | trivial | good first issue, enhancement |                                                                                     |
| 4   | Write a guide for using the engine with fee-sponsor-relay                      | trivial | good first issue, docs        | Easier after #3 (`feeBumpCostStroops`), but not blocked by it.                      |
| 5   | Add an example for a Soroban sponsorship service                               | trivial | good first issue, docs        |                                                                                     |
| 6   | Add a CI check that rejects runtime dependencies                               | trivial | good first issue, testing     |                                                                                     |
| 7   | Add SECURITY.md and Dependabot for dev dependencies and Actions                | trivial | good first issue, docs        |                                                                                     |
| 8   | Report remaining allowance in PolicyEvaluation                                 | medium  | enhancement                   | Coordinate with #9 so both use the same result shape.                               |
| 9   | Return retryAfterMs from rejections and rate-limit checks                      | medium  | enhancement                   | Soft dependency on #8 (shared result-shape decisions).                              |
| 10  | Bound memory by sweeping expired keys and capping key count                    | medium  | enhancement, bug              |                                                                                     |
| 11  | Add property-based tests proving caps are never exceeded                       | medium  | testing                       |                                                                                     |
| 12  | Add a benchmark for evaluate, recordSponsorship and the rate limiter           | medium  | testing                       |                                                                                     |
| 13  | Publish a TypeDoc API site to GitHub Pages                                     | medium  | docs                          | Depends on #1 (TSDoc on every export).                                              |
| 14  | Ship a CommonJS build alongside ESM                                            | medium  | enhancement                   | Should land before #15 (npm publishing).                                            |
| 15  | Publish to npm with provenance from a release workflow                         | medium  | enhancement                   | After #14 (CommonJS build); #2 (export surface test) recommended first.             |
| 16  | Design a pluggable storage interface for spend history and rate-limit counters | high    | enhancement                   | Blocks #17 (Redis adapter). #18 and #20 should build on it if it lands first.       |
| 17  | Add a Redis storage adapter                                                    | high    | enhancement                   | Depends on #16.                                                                     |
| 18  | Add a sliding-window rate limiter                                              | high    | enhancement                   | Should use the store interface from #16 if it has landed; benchmarks from #12 help. |
| 19  | Support per-account policy tiers                                               | high    | enhancement                   |                                                                                     |
| 20  | Add a global sponsor budget across all accounts                                | high    | enhancement                   | Should use the store interface from #16 if it has landed; #11 helps verify it.      |

## #1 Add TSDoc with examples to every public export

**Labels:** `trivial`, `good first issue`, `docs`

### Context

Most exports in `src/index.ts` have short doc comments (`PolicyEngine`, `RateLimiter`, `validatePolicyConfig` in `src/validation.ts`, the interfaces in `src/types.ts`), but none have `@example` blocks, the constants in `src/time.ts` are terse, and there is no check that keeps it that way. Good TSDoc shows up in editors for every consumer and is the input for the TypeDoc site (#13).

### Acceptance criteria

- [ ] Every symbol exported from `src/index.ts` has a TSDoc summary.
- [ ] `PolicyEngine`, `PolicyEngine.evaluate`, `PolicyEngine.recordSponsorship`, `RateLimiter`, `tryConsumeAccount`, `tryConsumeIp`, `validatePolicyConfig` and `validateRateLimiterConfig` each have an `@example`.
- [ ] Every `PolicyConfig` and `RateLimiterConfig` field documents its unit (stroops / requests) and edge cases (empty allowlist, zero limits).
- [ ] `@throws` tags list `TypeError` / `RangeError` where relevant.
- [ ] Add `eslint-plugin-tsdoc` (dev dependency) with `tsdoc/syntax` as an error in `.eslintrc.cjs`.
- [ ] `npm run lint` passes.

### Files to touch

- `src/types.ts`
- `src/policy-engine.ts`
- `src/rate-limiter.ts`
- `src/validation.ts`
- `src/time.ts`
- `.eslintrc.cjs`
- `package.json`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (comments only).

### Dependencies

Blocks #13 (TypeDoc site).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #2 Add a test that locks the public export surface

**Labels:** `trivial`, `good first issue`, `testing`

### Context

`fee-sponsor-relay` depends on the exact exports of `src/index.ts`. Nothing stops a PR from accidentally removing or renaming one. A small test that imports the package root and asserts the runtime export names would catch it in CI.

### Acceptance criteria

- [ ] New `test/exports.test.ts` imports `../src/index.js` and asserts the sorted list of runtime export names equals `['DAY_MS', 'HOUR_MS', 'MINUTE_MS', 'PolicyEngine', 'RateLimiter', 'validatePolicyConfig', 'validateRateLimiterConfig']`.
- [ ] Add type-level assertions with Vitest's `expectTypeOf` for `PolicyConfig`, `RateLimiterConfig`, `PolicyEvaluation` and the `PolicyRejectionReason` union so a type change also fails.
- [ ] A comment explains that changing this test means a breaking change and a CHANGELOG entry.
- [ ] `npm test` passes with coverage thresholds unchanged.

### Files to touch

- `test/exports.test.ts` (new)
- `src/index.ts` (read only)

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (tests only).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #3 Add a feeBumpCostStroops helper

**Labels:** `trivial`, `good first issue`, `enhancement`

### Context

The README section "What cost to pass in" tells consumers to compute `baseFee * (innerOperationCount + 1)` themselves, and `examples/relay-flow.mjs` re-implements it as `feeBumpCost`. Getting this wrong makes the caps in `PolicyEngine.evaluate` meaningless, so the package should export a tested helper.

### Acceptance criteria

- [ ] Export `feeBumpCostStroops(baseFeeStroops: Stroops, innerOperationCount: number): Stroops` from a new `src/cost.ts` and from `src/index.ts`.
- [ ] It validates both arguments with `assertNonNegativeInteger` from `src/validation.ts` and throws the same error types.
- [ ] Tests cover 0 operations, typical values, invalid input and results above `Number.MAX_SAFE_INTEGER` (throw a `RangeError`).
- [ ] `examples/relay-flow.mjs` and the README quick start use the helper.
- [ ] TSDoc explains that Soroban resource fees are not included.

### Files to touch

- `src/cost.ts` (new)
- `src/index.ts`
- `test/cost.test.ts` (new)
- `examples/relay-flow.mjs`
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (new export).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #4 Write a guide for using the engine with fee-sponsor-relay

**Labels:** `trivial`, `good first issue`, `docs`

### Context

fee-sponsor-relay (https://github.com/Stellar-Fee-Guild/fee-sponsor-relay) is the first consumer and will switch to importing this package. A guide showing where `RateLimiter` and `PolicyEngine` sit in an Express request handler, how to map `PolicyRejectionReason` to HTTP status codes, and how to load config from environment variables with `validatePolicyConfig` will make the migration and other integrations easier.

### Acceptance criteria

- [ ] New `docs/fee-sponsor-relay.md` covering: install from GitHub, building config from env vars and validating it at startup, an Express middleware for `tryConsumeIp` / `tryConsumeAccount` (429), `evaluate` (403 with `reason` and `detail`), and calling `recordSponsorship` only after a successful submit.
- [ ] Explains how to get the client IP correctly behind a proxy (`trust proxy`).
- [ ] Repeats the multi-instance limitation from the README with a concrete recommendation.
- [ ] Linked from the README.
- [ ] Code snippets are TypeScript and pass `npm run format:check` (Prettier formats Markdown).

### Files to touch

- `docs/fee-sponsor-relay.md` (new)
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- Do not add Express as a dependency; snippets are documentation only.
- **Compatibility:** Non-breaking (docs only).

### Dependencies

Easier after #3 (`feeBumpCostStroops`), but not blocked by it.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #5 Add an example for a Soroban sponsorship service

**Labels:** `trivial`, `good first issue`, `docs`

### Context

`examples/relay-flow.mjs` shows a classic fee bump. Soroban transactions have a resource fee on top of the inclusion fee, and the sponsor pays both, so the `costStroops` passed to `PolicyEngine.evaluate` must include it. An example makes that explicit for Soroban fee-sponsor services.

### Acceptance criteria

- [ ] New `examples/soroban-sponsor.mjs` that simulates a Soroban sponsorship: takes an inclusion fee and a simulated `minResourceFee`, computes the sponsor's total cost, runs rate limit -> evaluate -> sponsor -> record.
- [ ] Comments explain where the numbers come from in a real service (RPC `simulateTransaction`) without importing the Stellar SDK.
- [ ] Runs with `node examples/soroban-sponsor.mjs` after `npm run build`, and CI runs it in the `build` job of `.github/workflows/ci.yml`.
- [ ] README links to it.

### Files to touch

- `examples/soroban-sponsor.mjs` (new)
- `.github/workflows/ci.yml`
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- The example must not import `@stellar/stellar-sdk`; simulate the RPC values.
- **Compatibility:** Non-breaking (example only).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #6 Add a CI check that rejects runtime dependencies

**Labels:** `trivial`, `good first issue`, `testing`

### Context

"No runtime dependencies" is the project's main rule (see `CONTRIBUTING.md`), but only reviewers enforce it. A tiny script can fail CI if `package.json` gains `dependencies`, `peerDependencies` or `optionalDependencies`.

### Acceptance criteria

- [ ] New `scripts/check-no-runtime-deps.mjs` reads `package.json` and exits non-zero with a clear message if any of those fields is non-empty.
- [ ] New npm script `check:deps`, run in the `lint` job of `.github/workflows/ci.yml`.
- [ ] `CONTRIBUTING.md` mentions the script under "Before opening a PR".

### Files to touch

- `scripts/check-no-runtime-deps.mjs` (new)
- `package.json`
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (tooling only).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #7 Add SECURITY.md and Dependabot for dev dependencies and Actions

**Labels:** `trivial`, `good first issue`, `docs`

### Context

This library protects sponsor balances, so it needs a clear private reporting path. `CONTRIBUTING.md` mentions GitHub private vulnerability reporting but there is no `SECURITY.md`, and dev dependencies and the Actions in `.github/workflows/ci.yml` are not kept up to date automatically.

### Acceptance criteria

- [ ] `SECURITY.md` with supported versions, how to report privately (GitHub advisories), what counts as a vulnerability (e.g. a way to exceed a cap or bypass the denylist), and expected response times.
- [ ] `.github/dependabot.yml` with weekly updates for `npm` (grouped dev dependencies) and `github-actions`.
- [ ] README links to `SECURITY.md`.

### Files to touch

- `SECURITY.md` (new)
- `.github/dependabot.yml` (new)
- `README.md`
- `CONTRIBUTING.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #8 Report remaining allowance in PolicyEvaluation

**Labels:** `medium`, `enhancement`

### Context

Clients want to show users how much sponsorship they have left, and relays want to log it. `PolicyEngine.evaluate` in `src/policy-engine.ts` already computes the hourly and daily spend in `spendSince`, but `PolicyEvaluation` in `src/types.ts` only returns `approved`, `reason` and `detail`.

### Acceptance criteria

- [ ] Add an optional `remaining?: { hourlyStroops: Stroops; dailyStroops: Stroops }` to `PolicyEvaluation`: what the account could still be sponsored right now, after this cost if approved, never negative.
- [ ] Decide and document whether `remaining` is present on approvals, rejections or both. Note: the spec currently requires approvals to be exactly `{ approved: true }`, so either gate it behind a constructor option (e.g. `includeRemaining: true`) or add a separate `getAllowance(sourceAccount)` method. Recommended: the method, to keep `evaluate` output stable.
- [ ] `evaluate` stays side-effect free (existing test still passes).
- [ ] Tests cover fresh accounts, partially spent, exactly at cap, and after window expiry.
- [ ] README API reference and CHANGELOG updated.

### Files to touch

- `src/types.ts`
- `src/policy-engine.ts`
- `test/policy-engine.test.ts`
- `README.md`
- `CHANGELOG.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking if added as a new method or an opt-in option. Changing the default shape of an approval would be breaking.

### Dependencies

Coordinate with #9 so both use the same result shape.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #9 Return retryAfterMs from rejections and rate-limit checks

**Labels:** `medium`, `enhancement`

### Context

When a request is rejected for `HOURLY_CAP_EXCEEDED`, `DAILY_CAP_EXCEEDED` or by the `RateLimiter`, the caller can't tell users when to retry or set a `Retry-After` header. `RateLimiter.tryConsume` in `src/rate-limiter.ts` knows the window start, and `PolicyEngine` knows the timestamps in its `history` map.

### Acceptance criteria

- [ ] Add `retryAfterMs?: number` to cap rejections: the smallest wait after which the same `costStroops` would fit (computed from the oldest records that must expire).
- [ ] `FEE_EXCEEDS_MAX`, `DENYLISTED_ACCOUNT` and `NOT_ALLOWLISTED` never get `retryAfterMs` (waiting won't help).
- [ ] Add `RateLimiter.consumeAccount(key)` / `consumeIp(key)` returning `{ allowed: boolean; remaining: number; retryAfterMs?: number }`, keeping the boolean `tryConsume*` methods unchanged.
- [ ] Tests with the injected clock prove that waiting exactly `retryAfterMs` makes the request pass and waiting 1 ms less does not.
- [ ] README documents mapping to the HTTP `Retry-After` header (seconds, rounded up).

### Files to touch

- `src/types.ts`
- `src/policy-engine.ts`
- `src/rate-limiter.ts`
- `test/policy-engine.test.ts`
- `test/rate-limiter.test.ts`
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (new optional field and new methods).

### Dependencies

Soft dependency on #8 (shared result-shape decisions).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #10 Bound memory by sweeping expired keys and capping key count

**Labels:** `medium`, `enhancement`, `bug`

### Context

The README "Limitations" section notes that memory grows with distinct keys. `PolicyEngine.recordSponsorship` only prunes the account being recorded, and `RateLimiter.tryConsume` only replaces a window when the same key returns, so the `history`, `accounts` and `ips` maps keep entries for keys that are never seen again. An attacker rotating IPs or random account strings can grow memory without bound.

### Acceptance criteria

- [ ] Add a public `sweep(): number` to `PolicyEngine` (removes accounts whose records are all older than 24h) and `RateLimiter` (removes expired windows). Returns the number of keys removed.
- [ ] Add an optional `maxKeys` option to both constructors. When a new key would exceed it, evict the least recently used key (a `Map` keeps insertion order; re-insert on access).
- [ ] Document the security trade-off of eviction: an evicted rate-limit key gets a fresh window, so choose `maxKeys` well above normal traffic.
- [ ] No timers are started inside the library (keeps `sideEffects: false` and tests deterministic); the README shows calling `sweep()` from `setInterval` with `.unref()`.
- [ ] Tests cover sweep counts, LRU order, and that sweeping never changes any decision for keys still in their window.
- [ ] `validatePolicyConfig`-style validation for `maxKeys` (positive integer).

### Files to touch

- `src/policy-engine.ts`
- `src/rate-limiter.ts`
- `src/validation.ts`
- `src/types.ts`
- `test/policy-engine.test.ts`
- `test/rate-limiter.test.ts`
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (new methods and options; defaults unchanged).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #11 Add property-based tests proving caps are never exceeded

**Labels:** `medium`, `testing`

### Context

Example-based tests in `test/policy-engine.test.ts` check specific boundaries. The core safety promise, that no rolling 60 minutes or 24 hours ever contains more approved-and-recorded spend than the cap, deserves a property-based test using random sequences of requests and clock advances.

### Acceptance criteria

- [ ] Add `fast-check` as a dev dependency.
- [ ] New `test/properties.test.ts`: generate random configs (valid per `validatePolicyConfig`), random accounts, costs and clock advances; for each step call `evaluate` and, if approved, `recordSponsorship`.
- [ ] Property 1: for every account and every recorded timestamp `t`, the sum of records in `(t - 1h, t]` is <= the hourly cap and in `(t - 24h, t]` is <= the daily cap.
- [ ] Property 2: every recorded cost is <= `maxFeeStroopsPerTx`; denylisted accounts are never approved; with a non-empty allowlist only allowlisted accounts are approved.
- [ ] Property 3: calling `evaluate` any number of extra times never changes later results.
- [ ] Property 4 (`RateLimiter`): no key gets more than its limit of `true` results within any single window.
- [ ] Runs in under ~5s in CI with a fixed seed option documented for reproducing failures.

### Files to touch

- `test/properties.test.ts` (new)
- `package.json`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (tests only).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #12 Add a benchmark for evaluate, recordSponsorship and the rate limiter

**Labels:** `medium`, `testing`

### Context

`PolicyEngine.spendSince` in `src/policy-engine.ts` scans an account's full 24h history on every `evaluate`. That is fine for normal use, but nobody has measured it for accounts with thousands of records or for many keys. A benchmark gives a baseline before changes such as #10, #16 or #18.

### Acceptance criteria

- [ ] Benchmarks using `vitest bench` in `bench/*.bench.ts` (no new dependency needed), with an `npm run bench` script.
- [ ] Scenarios: `evaluate` with 0, 100, 10,000 records for one account; `recordSponsorship` throughput; `tryConsumeAccount` / `tryConsumeIp` with 1 and 100,000 distinct keys.
- [ ] Use the injected clock so runs are deterministic.
- [ ] Results table and the machine used are recorded in `bench/README.md`.
- [ ] Benchmarks are excluded from `npm test` and coverage, and are not run in CI by default.

### Files to touch

- `bench/` (new)
- `package.json`
- `vitest.config.ts`
- `tsconfig.json`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (tooling only).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #13 Publish a TypeDoc API site to GitHub Pages

**Labels:** `medium`, `docs`

### Context

The README API reference is hand-written and can drift. A TypeDoc site generated from the TSDoc in `src/` and deployed on every push to `main` gives contributors and consumers an always current reference.

### Acceptance criteria

- [ ] Add `typedoc` as a dev dependency with `typedoc.json` (entry point `src/index.ts`, `README.md` as the landing page).
- [ ] New `npm run docs` script outputting to `docs-site/` (gitignored).
- [ ] New workflow `.github/workflows/docs.yml` building and deploying with `actions/upload-pages-artifact` and `actions/deploy-pages` on push to `main`.
- [ ] TypeDoc runs with `treatWarningsAsErrors` so missing docs fail the build.
- [ ] README links to the site.

### Files to touch

- `typedoc.json` (new)
- `.github/workflows/docs.yml` (new)
- `package.json`
- `.gitignore`
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- A maintainer must enable GitHub Pages (source: GitHub Actions) in repo settings.
- **Compatibility:** Non-breaking.

### Dependencies

Depends on #1 (TSDoc on every export).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #14 Ship a CommonJS build alongside ESM

**Labels:** `medium`, `enhancement`

### Context

The package is ESM only (`"type": "module"` and an `import`-only `exports` map in `package.json`). Some sponsorship services still run CommonJS and can't `require()` it on Node 18/20 without dynamic `import()`.

### Acceptance criteria

- [ ] Add a CJS build to `dist/cjs/` (e.g. a second `tsconfig.cjs.json` with `module: CommonJS`, plus a `dist/cjs/package.json` containing `{"type": "commonjs"}`), keeping ESM in `dist/`.
- [ ] `exports` map gains `require` conditions with their own `.d.cts` / `types`, checked with `@arethetypeswrong/cli` (dev dependency) in CI.
- [ ] Avoid the dual-package hazard: the classes hold state, so document that one process should load only one format.
- [ ] A smoke test in CI runs `require('@stellar-fee-guild/sponsor-policy-engine')` from a packed tarball (`npm pack`).
- [ ] README install section updated.

### Files to touch

- `package.json`
- `tsconfig.build.json`
- `tsconfig.cjs.json` (new)
- `.github/workflows/ci.yml`
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking for ESM consumers.

### Dependencies

Should land before #15 (npm publishing).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #15 Publish to npm with provenance from a release workflow

**Labels:** `medium`, `enhancement`

### Context

Today consumers install with `npm install github:Stellar-Fee-Guild/sponsor-policy-engine`, which runs `prepare` and needs dev dependencies at install time. Publishing `@stellar-fee-guild/sponsor-policy-engine` to npm makes installs faster and versioned.

### Acceptance criteria

- [ ] New `.github/workflows/release.yml` triggered by pushing a `v*` tag: runs all checks, then `npm publish --provenance --access public` using an `NPM_TOKEN` secret.
- [ ] Verifies the tag matches `package.json` `version` before publishing.
- [ ] `npm pack --dry-run` output reviewed: only `dist`, `LICENSE`, `README.md` and `package.json`.
- [ ] README install section switches to `npm install @stellar-fee-guild/sponsor-policy-engine`, keeping the GitHub install as an alternative.
- [ ] `CONTRIBUTING.md` gains a short "Releasing" section (bump version, update CHANGELOG, tag).

### Files to touch

- `.github/workflows/release.yml` (new)
- `package.json`
- `README.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- A maintainer must create the npm org scope and add the `NPM_TOKEN` secret.
- **Compatibility:** Non-breaking.

### Dependencies

After #14 (CommonJS build); #2 (export surface test) recommended first.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #16 Design a pluggable storage interface for spend history and rate-limit counters

**Labels:** `high`, `enhancement`

### Context

`PolicyEngine` keeps spend in a private `history` `Map` and `RateLimiter` keeps windows in private `accounts` / `ips` maps (`src/policy-engine.ts`, `src/rate-limiter.ts`). As the README "Limitations" section explains, multiple instances multiply effective limits and restarts reset history. Shared storage needs an interface first. The hard part is that `evaluate` and `tryConsume*` are synchronous while network stores are asynchronous, and check-then-record must be atomic across instances to avoid races that exceed caps.

### Acceptance criteria

- [ ] Write a short design doc in the issue or `docs/storage-design.md` before coding, covering sync vs async, atomicity (e.g. an atomic `reserve`/`commit` or check-and-record operation), and failure behaviour (fail closed by default).
- [ ] Define `SpendStore` and `RateLimitStore` interfaces in `src/storage.ts`.
- [ ] Add `AsyncPolicyEngine` and `AsyncRateLimiter` (or equivalent) that take a store and return Promises, sharing the check logic with the sync classes (extract pure functions).
- [ ] Provide `MemorySpendStore` / `MemoryRateLimitStore` implementations; the existing sync classes keep working unchanged and keep passing all current tests.
- [ ] A shared conformance test suite (`test/store-conformance.ts`) that any store implementation can run.
- [ ] Coverage thresholds still met; README Limitations updated.

### Files to touch

- `src/storage.ts` (new)
- `src/policy-engine.ts`
- `src/rate-limiter.ts`
- `src/index.ts`
- `test/store-conformance.ts` (new)
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Must be non-breaking: the sync `PolicyEngine` and `RateLimiter` API used by fee-sponsor-relay stays exactly as is.

### Dependencies

Blocks #17 (Redis adapter). #18 and #20 should build on it if it lands first.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #17 Add a Redis storage adapter

**Labels:** `high`, `enhancement`

### Context

With the storage interface from #16, multi-instance sponsorship services need a shared store. Redis is the common choice. To keep this package dependency-free, the adapter must accept a client the caller already created (node-redis or ioredis) through a minimal structural type.

### Acceptance criteria

- [ ] New `src/adapters/redis.ts` exported from a subpath `./redis` in the `exports` map.
- [ ] Defines a minimal `RedisLike` interface (e.g. `eval` / `evalsha`) satisfied by both node-redis v4 and ioredis, without importing either.
- [ ] Spend history uses a sorted set per account (score = timestamp); check-and-record is a single Lua script so concurrent instances can't exceed a cap.
- [ ] Rate limiting uses `INCR` + `PEXPIRE` (fixed window) in a Lua script; keys are prefixed and the prefix is configurable.
- [ ] Keys have TTLs (24h for spend, 1 min for windows) so Redis memory is bounded.
- [ ] Passes the conformance suite from #16 against a real Redis in CI (service container), with `redis` / `ioredis` only as dev dependencies.
- [ ] README section on deploying multiple instances with Redis.

### Files to touch

- `src/adapters/redis.ts` (new)
- `package.json`
- `.github/workflows/ci.yml`
- `test/redis.test.ts` (new)
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- `redis` and `ioredis` may only be dev dependencies; never import them from `src/`.
- **Compatibility:** Non-breaking (new subpath export).

### Dependencies

Depends on #16.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #18 Add a sliding-window rate limiter

**Labels:** `high`, `enhancement`

### Context

`RateLimiter` in `src/rate-limiter.ts` uses a fixed one-minute window per key starting at the first request. As the README "How the windows work" section notes, a burst at a window boundary can let through up to twice the limit within a few seconds. Some deployments need a smoother limit.

### Acceptance criteria

- [ ] Add `SlidingWindowRateLimiter` with the same `tryConsumeAccount` / `tryConsumeIp` interface (or an `algorithm: 'fixed' | 'sliding'` option whose default stays `'fixed'`).
- [ ] Choose and justify the algorithm: sliding log (exact, O(limit) memory per key) or sliding window counter (approximate, O(1)). Document the error bound if approximate.
- [ ] Tests with the injected clock prove no 60-second span ever admits more than the limit (for the exact variant) and cover the boundary burst that the fixed window allows.
- [ ] Rejected requests are still not counted; accounts and IPs remain in separate maps.
- [ ] Benchmark against the fixed window (see #12).
- [ ] README explains when to choose which.

### Files to touch

- `src/sliding-rate-limiter.ts` (new)
- `src/rate-limiter.ts`
- `src/index.ts`
- `test/sliding-rate-limiter.test.ts` (new)
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking: `RateLimiter` default behaviour must not change.

### Dependencies

Should use the store interface from #16 if it has landed; benchmarks from #12 help.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #19 Support per-account policy tiers

**Labels:** `high`, `enhancement`

### Context

`PolicyConfig` applies one `maxFeeStroopsPerTx`, hourly cap and daily cap to every account. Real services want tiers: verified users or paying partners get higher limits, new accounts get lower ones. Today the only option is running several `PolicyEngine` instances and routing manually, which splits history.

### Acceptance criteria

- [ ] Add optional `tiers?: Record<string, TierLimits>` and `accountTiers?: Record<StellarPublicKey, string>` (or a `resolveTier(account) => string | undefined` callback) to `PolicyConfig`; accounts without a tier use the top-level limits.
- [ ] `validatePolicyConfig` validates every tier (same rules, daily >= hourly) and rejects unknown tier names with a descriptive error.
- [ ] `evaluate` uses the account's tier limits; `detail` names the tier.
- [ ] Decide and document how history carries over when an account changes tier (recommended: history is per account, limits are looked up at evaluation time).
- [ ] Add `setAccountTier(account, tier)` for runtime changes, or document that config is immutable.
- [ ] Check order from the README stays the same; all existing tests pass unchanged.

### Files to touch

- `src/types.ts`
- `src/validation.ts`
- `src/policy-engine.ts`
- `test/policy-engine.test.ts`
- `test/validation.test.ts`
- `README.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Non-breaking (optional config fields; defaults unchanged).

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.

## #20 Add a global sponsor budget across all accounts

**Labels:** `high`, `enhancement`

### Context

Per-account caps don't stop a Sybil attack: many fresh accounts each spending up to their cap can still drain the sponsor. `PolicyEngine` in `src/policy-engine.ts` has no notion of total spend. Services need a sponsor-wide rolling hourly/daily budget.

### Acceptance criteria

- [ ] Add optional `globalHourlyCapStroops` and `globalDailyCapStroops` to `PolicyConfig`, validated in `validatePolicyConfig` (and each global cap >= the matching per-account cap).
- [ ] New rejection reasons `GLOBAL_HOURLY_CAP_EXCEEDED` and `GLOBAL_DAILY_CAP_EXCEEDED`, checked after the per-account caps. `detail` includes the numbers.
- [ ] Total spend is tracked efficiently: no full scan of every account on each `evaluate` (e.g. a time-bucketed running total or a global record queue pruned in `recordSponsorship`).
- [ ] `evaluate` stays side-effect free; exact-cap approval rule applies.
- [ ] Tests for each new reason, check order, expiry, and that the property tests from #11 cover the global cap if they exist.
- [ ] README rejection-reason table, CHANGELOG and the `PolicyRejectionReason` union updated.

### Files to touch

- `src/types.ts`
- `src/validation.ts`
- `src/policy-engine.ts`
- `test/policy-engine.test.ts`
- `test/validation.test.ts`
- `README.md`
- `CHANGELOG.md`

### Constraints

- Must not add runtime dependencies (`dependencies` in `package.json` stays empty).
- **Compatibility:** Adding members to the exported `PolicyRejectionReason` union is a **minor breaking change for TypeScript consumers** with exhaustive `switch` statements; call it out in the CHANGELOG. Runtime behaviour is unchanged when the new fields are omitted.

### Dependencies

Should use the store interface from #16 if it has landed; #11 helps verify it.

---

See [CONTRIBUTING.md](https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/blob/main/CONTRIBUTING.md) for branch names and the checks to run before opening a PR.
