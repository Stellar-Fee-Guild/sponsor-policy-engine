/** One minute in milliseconds. */
export const MINUTE_MS = 60_000;

/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;

/** One day (24 hours) in milliseconds. */
export const DAY_MS = 24 * HOUR_MS;

/** The default clock. Wrapped so `Date.now` is read at call time (works with fake timers). */
// eslint-disable-next-line no-restricted-properties
export const systemClock = (): number => Date.now();
