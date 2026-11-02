import { MINUTE_MS, systemClock } from './time.js';
import type { Clock, EngineOptions, RateLimiterConfig } from './types.js';
import { validateClock, validateRateLimiterConfig } from './validation.js';

interface Window {
  start: number;
  count: number;
}

/**
 * Fixed-window request limiter, keyed separately by source account and by source IP.
 *
 * Each key gets a one-minute window starting at its first request. State is held in memory and
 * is per process. See the README "Limitations" section.
 */
export class RateLimiter {
  private readonly perAccountPerMinute: number;
  private readonly perIpPerMinute: number;
  private readonly now: Clock;
  private readonly accounts = new Map<string, Window>();
  private readonly ips = new Map<string, Window>();

  /**
   * @param config - Limits per minute. Validated with {@link validateRateLimiterConfig}.
   * @param options - `now` overrides the clock (defaults to `Date.now`).
   * @throws {TypeError | RangeError} if the config or options are invalid.
   */
  constructor(config: RateLimiterConfig, options?: EngineOptions) {
    validateRateLimiterConfig(config);
    validateClock(options?.now);
    this.perAccountPerMinute = config.perAccountPerMinute;
    this.perIpPerMinute = config.perIpPerMinute;
    this.now = options?.now ?? systemClock;
  }

  /**
   * Counts one request for `sourceAccount` if it is under the per-account limit.
   *
   * @returns `true` if the request is allowed (and was counted), `false` otherwise (not counted).
   */
  tryConsumeAccount(sourceAccount: string): boolean {
    return this.tryConsume(this.accounts, sourceAccount, this.perAccountPerMinute);
  }

  /**
   * Counts one request for `sourceIp` if it is under the per-IP limit.
   *
   * @returns `true` if the request is allowed (and was counted), `false` otherwise (not counted).
   */
  tryConsumeIp(sourceIp: string): boolean {
    return this.tryConsume(this.ips, sourceIp, this.perIpPerMinute);
  }

  private tryConsume(windows: Map<string, Window>, key: string, limit: number): boolean {
    const now = this.now();
    let window = windows.get(key);
    if (window === undefined || now - window.start >= MINUTE_MS) {
      window = { start: now, count: 0 };
      windows.set(key, window);
    }
    if (window.count >= limit) {
      return false;
    }
    window.count += 1;
    return true;
  }
}
