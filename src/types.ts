/**
 * A Stellar account public key (G...). Treated as an opaque string: this package does not
 * parse or checksum-validate keys, so it stays free of the Stellar SDK.
 */
export type StellarPublicKey = string;

/** An amount of lumens in stroops. 1 XLM = 10,000,000 stroops. */
export type Stroops = number;

/** A function returning the current time in milliseconds since the Unix epoch. */
export type Clock = () => number;

/** Configuration for {@link PolicyEngine}. */
export interface PolicyConfig {
  /** Accounts allowed to be sponsored. Empty = allow anyone not denylisted. */
  allowlist: StellarPublicKey[];
  /** Accounts that are always rejected, even if they are also allowlisted. */
  denylist: StellarPublicKey[];
  /** Max cost sponsored for one transaction, in stroops. */
  maxFeeStroopsPerTx: Stroops;
  /** Max sponsored per account over a rolling 1 hour window, in stroops. */
  hourlyCapStroopsPerAccount: Stroops;
  /** Max sponsored per account over a rolling 24 hour window, in stroops. */
  dailyCapStroopsPerAccount: Stroops;
}

/** Configuration for {@link RateLimiter}. */
export interface RateLimiterConfig {
  /** Max requests per source account per fixed one-minute window. */
  perAccountPerMinute: number;
  /** Max requests per source IP per fixed one-minute window. */
  perIpPerMinute: number;
}

/** Why {@link PolicyEngine.evaluate} rejected a sponsorship request. */
export type PolicyRejectionReason =
  | 'DENYLISTED_ACCOUNT'
  | 'NOT_ALLOWLISTED'
  | 'FEE_EXCEEDS_MAX'
  | 'HOURLY_CAP_EXCEEDED'
  | 'DAILY_CAP_EXCEEDED';

/** The result of {@link PolicyEngine.evaluate}. */
export interface PolicyEvaluation {
  /** `true` when the request may be sponsored. */
  approved: boolean;
  /** Set only when `approved` is `false`. */
  reason?: PolicyRejectionReason;
  /** Human-readable explanation including the numbers involved. Set only on rejection. */
  detail?: string;
}

/** Options shared by {@link PolicyEngine} and {@link RateLimiter}. */
export interface EngineOptions {
  /** Clock used for all time reads. Defaults to `Date.now`. */
  now?: Clock;
}
