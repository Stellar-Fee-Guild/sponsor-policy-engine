import { afterEach, describe, expect, it, vi } from 'vitest';
import { MINUTE_MS, RateLimiter } from '../src/index.js';
import { ALICE, BOB, fakeClock } from './helpers.js';

function limiter(perAccountPerMinute = 3, perIpPerMinute = 2) {
  const clock = fakeClock();
  return {
    limiter: new RateLimiter({ perAccountPerMinute, perIpPerMinute }, { now: clock.now }),
    clock,
  };
}

describe('RateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('limits requests per account', () => {
    const { limiter: l } = limiter(3);
    expect([1, 2, 3, 4].map(() => l.tryConsumeAccount(ALICE))).toEqual([true, true, true, false]);
  });

  it('limits requests per IP', () => {
    const { limiter: l } = limiter(3, 2);
    expect([1, 2, 3].map(() => l.tryConsumeIp('203.0.113.7'))).toEqual([true, true, false]);
  });

  it('keeps a separate counter per key', () => {
    const { limiter: l } = limiter(1, 1);
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
    expect(l.tryConsumeAccount(BOB)).toBe(true);
    expect(l.tryConsumeAccount(ALICE)).toBe(false);
    expect(l.tryConsumeIp('203.0.113.7')).toBe(true);
    expect(l.tryConsumeIp('198.51.100.1')).toBe(true);
  });

  it('keeps account and IP counters in independent maps', () => {
    const { limiter: l } = limiter(1, 1);
    const key = 'same-string';
    expect(l.tryConsumeAccount(key)).toBe(true);
    expect(l.tryConsumeIp(key)).toBe(true);
    expect(l.tryConsumeAccount(key)).toBe(false);
    expect(l.tryConsumeIp(key)).toBe(false);
  });

  it('uses a fixed window that starts at the first request and resets after a minute', () => {
    const { limiter: l, clock } = limiter(2);
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
    clock.advance(30_000);
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
    clock.advance(29_999); // 59.999s after the first request
    expect(l.tryConsumeAccount(ALICE)).toBe(false);
    clock.advance(1); // exactly one minute after the first request
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
    expect(l.tryConsumeAccount(ALICE)).toBe(false);
  });

  it('starts a fresh window for a key whose window has long expired', () => {
    const { limiter: l, clock } = limiter(1, 1);
    expect(l.tryConsumeIp('203.0.113.7')).toBe(true);
    clock.advance(10 * MINUTE_MS);
    expect(l.tryConsumeIp('203.0.113.7')).toBe(true);
    expect(l.tryConsumeIp('203.0.113.7')).toBe(false);
  });

  it('does not count rejected requests', () => {
    const { limiter: l, clock } = limiter(2);
    l.tryConsumeAccount(ALICE);
    l.tryConsumeAccount(ALICE);
    for (let i = 0; i < 50; i++) expect(l.tryConsumeAccount(ALICE)).toBe(false);
    const window = (l as unknown as { accounts: Map<string, { count: number }> }).accounts.get(
      ALICE,
    );
    expect(window?.count).toBe(2);
    clock.advance(MINUTE_MS);
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
  });

  it('rejects everything when a limit is zero', () => {
    const { limiter: l } = limiter(0, 0);
    expect(l.tryConsumeAccount(ALICE)).toBe(false);
    expect(l.tryConsumeIp('203.0.113.7')).toBe(false);
  });

  it('works with the default clock and fake timers', () => {
    vi.useFakeTimers();
    const l = new RateLimiter({ perAccountPerMinute: 1, perIpPerMinute: 1 });
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
    expect(l.tryConsumeAccount(ALICE)).toBe(false);
    vi.advanceTimersByTime(MINUTE_MS);
    expect(l.tryConsumeAccount(ALICE)).toBe(true);
  });
});
