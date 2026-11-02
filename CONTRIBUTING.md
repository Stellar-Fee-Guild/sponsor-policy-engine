# Contributing to sponsor-policy-engine

Thanks for helping make Stellar fee sponsorship safer. This project takes part in the
**Drips Wave Stellar Program**, so most work is organised as small, well-scoped GitHub issues.

## Ground rules

- **No runtime dependencies.** The package must stay dependency-free so any sponsorship service
  can use it. Dev dependencies are fine when they earn their place. Adapters that need a client
  library (for example Redis) must accept the client from the caller instead of importing it.
- **Keep the public API stable.** `fee-sponsor-relay` depends on the exports in `src/index.ts`.
  Additions are welcome; renames or behaviour changes are breaking and need discussion first.
- **Never call `Date.now()` directly.** Use the injected clock (`options.now`). ESLint enforces this.
- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Issue labels

| Label              | Meaning                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `trivial`          | Small and self-contained, usually a few hours. Great first contribution |
| `medium`           | A focused feature or refactor touching a few files, with tests          |
| `high`             | Design work or a larger feature; discuss your approach before coding    |
| `good first issue` | Suitable for newcomers to the codebase                                  |
| `enhancement`      | New functionality                                                       |
| `bug`              | Behaviour that does not match the documentation                         |
| `docs`             | Documentation only                                                      |
| `testing`          | Tests, benchmarks or test tooling                                       |

Comment on an issue to ask for it to be assigned before you start, so work isn't duplicated. If
an issue lists dependencies on other issues, wait until those are merged.

## Getting started

```bash
git clone https://github.com/Stellar-Fee-Guild/sponsor-policy-engine.git
cd sponsor-policy-engine
npm ci
npm test
```

Node 18 or newer is required.

## Branches

Branch from `main` using one of these prefixes:

- `feat/` — new functionality, e.g. `feat/retry-after-ms`
- `fix/` — bug fixes, e.g. `fix/hourly-window-boundary`
- `docs/` — documentation only, e.g. `docs/soroban-example`
- `chore/` — tooling, CI, dependencies, refactors with no behaviour change

## Before opening a PR

Run every check that CI runs:

```bash
npm run lint
npm run format:check   # or `npm run format` to fix
npm run typecheck
npm test               # includes coverage thresholds (90% statements/functions/lines, 85% branches)
npm run build
```

New behaviour needs tests. Use the injected clock (see `test/helpers.ts`) rather than real time,
so tests are fast and deterministic.

## Pull request process

1. Open the PR against `main` and fill in the template, linking the issue (`Closes #123`).
2. Keep PRs focused on one issue. Small PRs are reviewed faster.
3. Update `README.md` and the `Unreleased` section of `CHANGELOG.md` if you change behaviour or API.
4. CI must be green. A maintainer will review, may ask for changes, and will squash-merge.
5. Commit messages should be short and imperative, e.g. `feat: add retryAfterMs to rate limit results`.

## Reporting security issues

Please do not open public issues for vulnerabilities that let someone drain a sponsor account.
Use GitHub's private vulnerability reporting on this repository instead.
