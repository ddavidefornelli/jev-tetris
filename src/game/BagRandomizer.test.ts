import { describe, expect, it } from 'vitest';
import { BagRandomizer } from './BagRandomizer';
import { PIECE_TYPES } from './types';

describe('BagRandomizer', () => {
  it('contains all seven pieces exactly once in each bag', () => {
    const bag = new BagRandomizer();
    for (let i = 0; i < 20; i++) {
      const draws = Array.from({ length: 7 }, () => bag.next());
      expect([...draws].sort()).toEqual([...PIECE_TYPES].sort());
    }
  });

  it('is deterministic with an injected RNG and can reset', () => {
    const bag = new BagRandomizer(() => 0);
    const first = Array.from({ length: 7 }, () => bag.next());
    bag.next();
    bag.reset();
    expect(Array.from({ length: 7 }, () => bag.next())).toEqual(first);
  });
});
