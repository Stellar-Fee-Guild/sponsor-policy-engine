/** A controllable clock for tests. */
export function fakeClock(start = 1_700_000_000_000): {
  now: () => number;
  advance: (ms: number) => void;
  set: (ms: number) => void;
} {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
    set: (ms) => {
      t = ms;
    },
  };
}

export const ALICE = 'GALICEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const BOB = 'GBOBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
export const MALLORY = 'GMALLORYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY';
