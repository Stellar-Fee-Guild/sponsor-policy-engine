import { describe, expect, it } from 'vitest';
import {
  PolicyEngine,
  RateLimiter,
  validatePolicyConfig,
  validateRateLimiterConfig,
  type PolicyConfig,
  type RateLimiterConfig,
} from '../src/index.js';

const policy: PolicyConfig = {
  allowlist: [],
  denylist: [],
  maxFeeStroopsPerTx: 1_000,
  hourlyCapStroopsPerAccount: 5_000,
  dailyCapStroopsPerAccount: 20_000,
};

const limits: RateLimiterConfig = { perAccountPerMinute: 10, perIpPerMinute: 30 };

type Ctor = new () => unknown;
const amountFields = [
  'maxFeeStroopsPerTx',
  'hourlyCapStroopsPerAccount',
  'dailyCapStroopsPerAccount',
] as const;

const badNumbers: [string, unknown, Ctor, RegExp][] = [
  ['negative', -1, RangeError, /must be non-negative, received -1/],
  ['NaN', Number.NaN, TypeError, /must be a finite number, received NaN/],
  ['Infinity', Number.POSITIVE_INFINITY, TypeError, /must be a finite number, received Infinity/],
  ['-Infinity', Number.NEGATIVE_INFINITY, TypeError, /must be a finite number/],
  ['non-integer', 1.5, TypeError, /must be an integer, received 1.5/],
  ['string', '100', TypeError, /must be a number, received string "100"/],
  ['undefined', undefined, TypeError, /must be a number, received undefined/],
  ['null', null, TypeError, /must be a number, received null/],
];

describe('validatePolicyConfig', () => {
  it('accepts a valid config', () => {
    expect(() => validatePolicyConfig(policy)).not.toThrow();
    expect(() => new PolicyEngine(policy)).not.toThrow();
  });

  it('accepts zero amounts and equal hourly and daily caps', () => {
    const zero = {
      ...policy,
      maxFeeStroopsPerTx: 0,
      hourlyCapStroopsPerAccount: 0,
      dailyCapStroopsPerAccount: 0,
    };
    expect(() => validatePolicyConfig(zero)).not.toThrow();
  });

  for (const field of amountFields) {
    it.each(badNumbers)(`rejects ${field} that is %s`, (_label, value, Err, message) => {
      // Keep daily >= hourly so only the field under test is invalid.
      const config = {
        ...policy,
        dailyCapStroopsPerAccount: 20_000,
        [field]: value,
      } as PolicyConfig;
      expect(() => validatePolicyConfig(config)).toThrow(Err);
      expect(() => validatePolicyConfig(config)).toThrow(new RegExp(`PolicyConfig.${field}`));
      expect(() => validatePolicyConfig(config)).toThrow(message);
      expect(() => new PolicyEngine(config)).toThrow(Err);
    });
  }

  it('rejects a daily cap lower than the hourly cap', () => {
    const config = {
      ...policy,
      hourlyCapStroopsPerAccount: 5_000,
      dailyCapStroopsPerAccount: 4_999,
    };
    expect(() => validatePolicyConfig(config)).toThrow(RangeError);
    expect(() => validatePolicyConfig(config)).toThrow(
      /dailyCapStroopsPerAccount \(4999\).*hourlyCapStroopsPerAccount \(5000\)/,
    );
    expect(() => new PolicyEngine(config)).toThrow(RangeError);
  });

  it.each([
    ['null', null, /PolicyConfig must be an object, received null/],
    ['undefined', undefined, /PolicyConfig must be an object, received undefined/],
    ['an array', [], /PolicyConfig must be an object, received an array/],
    ['a number', 5, /PolicyConfig must be an object, received number 5/],
  ])('rejects a config that is %s', (_label, value, message) => {
    expect(() => validatePolicyConfig(value as unknown as PolicyConfig)).toThrow(TypeError);
    expect(() => validatePolicyConfig(value as unknown as PolicyConfig)).toThrow(message);
  });

  it.each(['allowlist', 'denylist'] as const)('rejects a %s that is not an array', (field) => {
    const config = { ...policy, [field]: 'GABC' } as unknown as PolicyConfig;
    expect(() => validatePolicyConfig(config)).toThrow(TypeError);
    expect(() => validatePolicyConfig(config)).toThrow(
      `PolicyConfig.${field} must be an array of strings`,
    );
  });

  it.each(['allowlist', 'denylist'] as const)('rejects a %s with a non-string entry', (field) => {
    const config = { ...policy, [field]: ['GABC', 42] } as unknown as PolicyConfig;
    expect(() => validatePolicyConfig(config)).toThrow(TypeError);
    expect(() => validatePolicyConfig(config)).toThrow(
      `PolicyConfig.${field}[1] must be a string, received number 42`,
    );
  });
});

describe('validateRateLimiterConfig', () => {
  it('accepts a valid config, including zero limits', () => {
    expect(() => validateRateLimiterConfig(limits)).not.toThrow();
    expect(() =>
      validateRateLimiterConfig({ perAccountPerMinute: 0, perIpPerMinute: 0 }),
    ).not.toThrow();
    expect(() => new RateLimiter(limits)).not.toThrow();
  });

  for (const field of ['perAccountPerMinute', 'perIpPerMinute'] as const) {
    it.each(badNumbers)(`rejects ${field} that is %s`, (_label, value, Err, message) => {
      const config = { ...limits, [field]: value } as RateLimiterConfig;
      expect(() => validateRateLimiterConfig(config)).toThrow(Err);
      expect(() => validateRateLimiterConfig(config)).toThrow(
        new RegExp(`RateLimiterConfig.${field}`),
      );
      expect(() => validateRateLimiterConfig(config)).toThrow(message);
      expect(() => new RateLimiter(config)).toThrow(Err);
    });
  }

  it('rejects a config that is not an object', () => {
    expect(() => validateRateLimiterConfig(null as unknown as RateLimiterConfig)).toThrow(
      /RateLimiterConfig must be an object/,
    );
  });
});

describe('options.now validation', () => {
  it('rejects a non-function clock in both constructors', () => {
    const bad = { now: 123 as unknown as () => number };
    expect(() => new PolicyEngine(policy, bad)).toThrow(
      /options.now must be a function, received number 123/,
    );
    expect(() => new RateLimiter(limits, bad)).toThrow(TypeError);
  });

  it('accepts an omitted or undefined clock', () => {
    expect(() => new PolicyEngine(policy, {})).not.toThrow();
    expect(() => new RateLimiter(limits, { now: undefined })).not.toThrow();
  });
});
