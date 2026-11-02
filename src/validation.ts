import type { Clock, PolicyConfig, RateLimiterConfig } from './types.js';

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object, received ${describe(value)}.`);
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'string') return `string ${JSON.stringify(value)}`;
  return `${typeof value} ${String(value)}`;
}

/**
 * Asserts that `value` is a finite, non-negative integer.
 *
 * @throws {TypeError} if `value` is not a number, or is `NaN`, infinite or not an integer.
 * @throws {RangeError} if `value` is negative.
 */
export function assertNonNegativeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number, received ${describe(value)}.`);
  }
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number, received ${value}.`);
  }
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer, received ${value}.`);
  }
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative, received ${value}.`);
  }
}

function assertStringArray(value: unknown, name: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array of strings, received ${describe(value)}.`);
  }
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      throw new TypeError(`${name}[${index}] must be a string, received ${describe(entry)}.`);
    }
  });
}

/**
 * Validates a {@link PolicyConfig}.
 *
 * @throws {TypeError} for a missing or wrongly typed field, or an amount that is `NaN`,
 * infinite or not an integer.
 * @throws {RangeError} for a negative amount, or a daily cap lower than the hourly cap.
 */
export function validatePolicyConfig(config: PolicyConfig): void {
  assertObject(config, 'PolicyConfig');
  assertStringArray(config.allowlist, 'PolicyConfig.allowlist');
  assertStringArray(config.denylist, 'PolicyConfig.denylist');
  assertNonNegativeInteger(config.maxFeeStroopsPerTx, 'PolicyConfig.maxFeeStroopsPerTx');
  assertNonNegativeInteger(
    config.hourlyCapStroopsPerAccount,
    'PolicyConfig.hourlyCapStroopsPerAccount',
  );
  assertNonNegativeInteger(
    config.dailyCapStroopsPerAccount,
    'PolicyConfig.dailyCapStroopsPerAccount',
  );
  if (config.dailyCapStroopsPerAccount < config.hourlyCapStroopsPerAccount) {
    throw new RangeError(
      `PolicyConfig.dailyCapStroopsPerAccount (${config.dailyCapStroopsPerAccount}) must be ` +
        `greater than or equal to hourlyCapStroopsPerAccount (${config.hourlyCapStroopsPerAccount}).`,
    );
  }
}

/**
 * Validates a {@link RateLimiterConfig}.
 *
 * @throws {TypeError} for a missing or wrongly typed field, or a limit that is `NaN`,
 * infinite or not an integer.
 * @throws {RangeError} for a negative limit.
 */
export function validateRateLimiterConfig(config: RateLimiterConfig): void {
  assertObject(config, 'RateLimiterConfig');
  assertNonNegativeInteger(config.perAccountPerMinute, 'RateLimiterConfig.perAccountPerMinute');
  assertNonNegativeInteger(config.perIpPerMinute, 'RateLimiterConfig.perIpPerMinute');
}

/** @internal Validates the `now` option shared by both constructors. */
export function validateClock(now: unknown): asserts now is Clock | undefined {
  if (now !== undefined && typeof now !== 'function') {
    throw new TypeError(`options.now must be a function, received ${describe(now)}.`);
  }
}
