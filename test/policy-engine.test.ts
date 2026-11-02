import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, HOUR_MS, PolicyEngine, type PolicyConfig } from '../src/index.js';
import { ALICE, BOB, MALLORY, fakeClock } from './helpers.js';

const base: PolicyConfig = {
  allowlist: [],
  denylist: [],
  maxFeeStroopsPerTx: 1_000,
  hourlyCapStroopsPerAccount: 5_000,
  dailyCapStroopsPerAccount: 20_000,
};

function engine(overrides: Partial<PolicyConfig> = {}, clock = fakeClock()) {
  return { engine: new PolicyEngine({ ...base, ...overrides }, { now: clock.now }), clock };
}

describe('PolicyEngine.evaluate', () => {
  it('approves with no reason or detail keys', () => {
    const { engine: e } = engine();
    const result = e.evaluate(ALICE, 100);
    expect(result).toEqual({ approved: true });
    expect(Object.keys(result)).toEqual(['approved']);
  });

  it('approves anyone not denylisted when the allowlist is empty', () => {
    const { engine: e } = engine({ denylist: [MALLORY] });
    expect(e.evaluate(ALICE, 100).approved).toBe(true);
    expect(e.evaluate(BOB, 100).approved).toBe(true);
  });

  it('rejects denylisted accounts with DENYLISTED_ACCOUNT', () => {
    const { engine: e } = engine({ denylist: [MALLORY] });
    const result = e.evaluate(MALLORY, 100);
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('DENYLISTED_ACCOUNT');
    expect(result.detail).toContain(MALLORY);
  });

  it('gives the denylist precedence over the allowlist', () => {
    const { engine: e } = engine({ allowlist: [MALLORY], denylist: [MALLORY] });
    expect(e.evaluate(MALLORY, 100).reason).toBe('DENYLISTED_ACCOUNT');
  });

  it('rejects accounts missing from a non-empty allowlist with NOT_ALLOWLISTED', () => {
    const { engine: e } = engine({ allowlist: [ALICE] });
    expect(e.evaluate(ALICE, 100).approved).toBe(true);
    const result = e.evaluate(BOB, 100);
    expect(result.reason).toBe('NOT_ALLOWLISTED');
    expect(result.detail).toContain(BOB);
  });

  it('rejects a cost over the per-transaction maximum with FEE_EXCEEDS_MAX', () => {
    const { engine: e } = engine();
    const result = e.evaluate(ALICE, 1_001);
    expect(result.reason).toBe('FEE_EXCEEDS_MAX');
    expect(result.detail).toContain('1001');
    expect(result.detail).toContain('1000');
  });

  it('approves a cost exactly at the per-transaction maximum', () => {
    const { engine: e } = engine();
    expect(e.evaluate(ALICE, 1_000).approved).toBe(true);
  });

  it('rejects with HOURLY_CAP_EXCEEDED when the hourly cap would be exceeded', () => {
    const { engine: e } = engine();
    for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 900);
    const result = e.evaluate(ALICE, 501);
    expect(result.reason).toBe('HOURLY_CAP_EXCEEDED');
    expect(result.detail).toContain('4500');
    expect(result.detail).toContain('501');
    expect(result.detail).toContain('5001');
    expect(result.detail).toContain('5000');
  });

  it('approves when spend lands exactly on the hourly cap', () => {
    const { engine: e } = engine();
    for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 900);
    expect(e.evaluate(ALICE, 500).approved).toBe(true);
  });

  it('rejects with DAILY_CAP_EXCEEDED when the daily cap would be exceeded', () => {
    const { engine: e, clock } = engine();
    // 4 hours x 5,000 = 20,000 (exactly the daily cap), each hour separately under its cap.
    for (let h = 0; h < 4; h++) {
      for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 1_000);
      clock.advance(HOUR_MS);
    }
    const result = e.evaluate(ALICE, 1);
    expect(result.reason).toBe('DAILY_CAP_EXCEEDED');
    expect(result.detail).toContain('20000');
    expect(result.detail).toContain('20001');
  });

  it('approves when spend lands exactly on the daily cap', () => {
    const { engine: e, clock } = engine();
    for (let h = 0; h < 4; h++) {
      e.recordSponsorship(ALICE, h < 3 ? 5_000 : 4_000);
      clock.advance(HOUR_MS);
    }
    expect(e.evaluate(ALICE, 1_000).approved).toBe(true);
  });

  it('tracks caps per account', () => {
    const { engine: e } = engine();
    for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 1_000);
    expect(e.evaluate(ALICE, 1).reason).toBe('HOURLY_CAP_EXCEEDED');
    expect(e.evaluate(BOB, 1_000).approved).toBe(true);
  });

  describe('check order', () => {
    it('denylist before allowlist and fee', () => {
      const { engine: e } = engine({ allowlist: [ALICE], denylist: [MALLORY] });
      expect(e.evaluate(MALLORY, 999_999).reason).toBe('DENYLISTED_ACCOUNT');
    });

    it('allowlist before fee', () => {
      const { engine: e } = engine({ allowlist: [ALICE] });
      expect(e.evaluate(BOB, 999_999).reason).toBe('NOT_ALLOWLISTED');
    });

    it('fee before hourly cap', () => {
      const { engine: e } = engine();
      for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 1_000);
      expect(e.evaluate(ALICE, 1_001).reason).toBe('FEE_EXCEEDS_MAX');
    });

    it('hourly cap before daily cap', () => {
      const { engine: e } = engine({
        hourlyCapStroopsPerAccount: 5_000,
        dailyCapStroopsPerAccount: 5_000,
      });
      for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 1_000);
      expect(e.evaluate(ALICE, 1).reason).toBe('HOURLY_CAP_EXCEEDED');
    });
  });

  it('never changes state', () => {
    const { engine: e } = engine();
    for (let i = 0; i < 100; i++) {
      expect(e.evaluate(ALICE, 1_000).approved).toBe(true);
    }
    e.recordSponsorship(ALICE, 4_000);
    for (let i = 0; i < 100; i++) {
      expect(e.evaluate(ALICE, 1_000).approved).toBe(true);
      expect(e.evaluate(ALICE, 1_001).reason).toBe('FEE_EXCEEDS_MAX');
    }
  });

  it('is not affected by mutating the config arrays after construction', () => {
    const config: PolicyConfig = { ...base, allowlist: [ALICE], denylist: [] };
    const e = new PolicyEngine(config, { now: fakeClock().now });
    config.allowlist.push(BOB);
    config.denylist.push(ALICE);
    expect(e.evaluate(ALICE, 1).approved).toBe(true);
    expect(e.evaluate(BOB, 1).reason).toBe('NOT_ALLOWLISTED');
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('throws for cost %s', (cost) => {
    const { engine: e } = engine();
    expect(() => e.evaluate(ALICE, cost)).toThrow(cost < 0 ? RangeError : TypeError);
    expect(() => e.recordSponsorship(ALICE, cost)).toThrow(cost < 0 ? RangeError : TypeError);
  });

  it('approves a zero cost even when caps are zero', () => {
    const { engine: e } = engine({
      maxFeeStroopsPerTx: 0,
      hourlyCapStroopsPerAccount: 0,
      dailyCapStroopsPerAccount: 0,
    });
    expect(e.evaluate(ALICE, 0).approved).toBe(true);
    expect(e.evaluate(ALICE, 1).reason).toBe('FEE_EXCEEDS_MAX');
  });
});

describe('PolicyEngine rolling windows', () => {
  it('expires hourly spend after exactly 60 minutes', () => {
    const { engine: e, clock } = engine();
    for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 1_000);
    clock.advance(HOUR_MS - 1);
    expect(e.evaluate(ALICE, 1).reason).toBe('HOURLY_CAP_EXCEEDED');
    clock.advance(1);
    expect(e.evaluate(ALICE, 1_000).approved).toBe(true);
  });

  it('is rolling, not calendar based: spending at 10:59 still counts at 11:00', () => {
    const clock = fakeClock(Date.UTC(2026, 0, 1, 10, 59, 0));
    const { engine: e } = engine({}, clock);
    for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 1_000);
    clock.set(Date.UTC(2026, 0, 1, 11, 0, 0));
    expect(e.evaluate(ALICE, 1).reason).toBe('HOURLY_CAP_EXCEEDED');
    clock.set(Date.UTC(2026, 0, 1, 11, 59, 0));
    expect(e.evaluate(ALICE, 1).approved).toBe(true);
  });

  it('only expires the records that have left the hourly window', () => {
    const { engine: e, clock } = engine({ maxFeeStroopsPerTx: 5_000 });
    e.recordSponsorship(ALICE, 3_000);
    clock.advance(30 * 60_000);
    e.recordSponsorship(ALICE, 2_000);
    clock.advance(30 * 60_000); // first record now 60 min old
    // Only the 2,000 from 30 minutes ago still counts: 2,000 + 3,001 > 5,000.
    expect(e.evaluate(ALICE, 3_001).reason).toBe('HOURLY_CAP_EXCEEDED');
    expect(e.evaluate(ALICE, 3_000).approved).toBe(true);
  });

  it('expires daily spend after exactly 24 hours', () => {
    const { engine: e, clock } = engine();
    for (let h = 0; h < 4; h++) {
      e.recordSponsorship(ALICE, 5_000);
      clock.advance(HOUR_MS);
    }
    // First record is now 4h old. Move to just before it is 24h old.
    clock.set(clock.now() - 4 * HOUR_MS + DAY_MS - 1);
    expect(e.evaluate(ALICE, 1).reason).toBe('DAILY_CAP_EXCEEDED');
    clock.advance(1);
    // 15,000 still counts from the last three records: 15,000 + 5,000 = 20,000 (exact cap).
    expect(e.evaluate(ALICE, 1_000).approved).toBe(true);
  });

  it('rejects on the daily cap using only records from the last 24 hours', () => {
    const { engine: e, clock } = engine({ maxFeeStroopsPerTx: 5_000 });
    for (let h = 0; h < 4; h++) {
      e.recordSponsorship(ALICE, 5_000);
      clock.advance(HOUR_MS);
    }
    clock.advance(DAY_MS - 4 * HOUR_MS); // first record exactly 24h old, 15,000 remains
    expect(e.evaluate(ALICE, 5_000).approved).toBe(true);
    expect(e.evaluate(ALICE, 5_001).reason).toBe('FEE_EXCEEDS_MAX');
    e.recordSponsorship(ALICE, 5_000); // 20,000 in the window
    clock.advance(HOUR_MS); // hourly window empty again, second record now exactly 24h old
    expect(e.evaluate(ALICE, 5_000).approved).toBe(true);
    e.recordSponsorship(ALICE, 5_000);
    clock.advance(1);
    expect(e.evaluate(ALICE, 1).approved).toBe(false);
  });

  it('works with the default clock and fake timers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const e = new PolicyEngine(base);
    for (let i = 0; i < 5; i++) e.recordSponsorship(ALICE, 1_000);
    expect(e.evaluate(ALICE, 1).reason).toBe('HOURLY_CAP_EXCEEDED');
    vi.advanceTimersByTime(HOUR_MS);
    expect(e.evaluate(ALICE, 1).approved).toBe(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('PolicyEngine pruning', () => {
  type Internals = { history: Map<string, { at: number; cost: number }[]> };

  it('prunes records older than 24 hours on every record', () => {
    const { engine: e, clock } = engine();
    e.recordSponsorship(ALICE, 100);
    clock.advance(HOUR_MS);
    e.recordSponsorship(ALICE, 200);
    const history = (e as unknown as Internals).history;
    expect(history.get(ALICE)).toHaveLength(2);

    clock.advance(DAY_MS - HOUR_MS); // first record exactly 24h old
    e.recordSponsorship(ALICE, 300);
    expect(history.get(ALICE)?.map((r) => r.cost)).toEqual([200, 300]);

    clock.advance(DAY_MS);
    e.recordSponsorship(ALICE, 400);
    expect(history.get(ALICE)?.map((r) => r.cost)).toEqual([400]);
  });

  it('does not prune on evaluate', () => {
    const { engine: e, clock } = engine();
    e.recordSponsorship(ALICE, 100);
    clock.advance(2 * DAY_MS);
    e.evaluate(ALICE, 1);
    expect((e as unknown as Internals).history.get(ALICE)).toHaveLength(1);
  });
});
