# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-02

### Added

- `PolicyEngine` with denylist, allowlist, per-transaction maximum and rolling hourly and daily
  per-account caps. `evaluate` is side-effect free; `recordSponsorship` records spend and prunes
  records older than 24 hours.
- `RateLimiter` with fixed one-minute windows per account and per IP, in separate maps.
- `validatePolicyConfig` and `validateRateLimiterConfig`, also run by the constructors.
- Clock injection through `options.now` on both classes.
- Exported `MINUTE_MS`, `HOUR_MS` and `DAY_MS` constants and the `Clock` and `EngineOptions` types.
- Runnable example in `examples/relay-flow.mjs`.

[Unreleased]: https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Stellar-Fee-Guild/sponsor-policy-engine/releases/tag/v0.1.0
