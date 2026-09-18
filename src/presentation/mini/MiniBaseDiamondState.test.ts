import { describe, expect, it } from 'vitest';
import type {
  MiniHudState,
} from './MiniHudState';
import {
  buildMiniBaseDiamondState,
} from './MiniBaseDiamondState';

const bases: MiniHudState['bases'] = {
  first: {
    occupied: true,
    runnerId: 'r1',
  },
  second: {
    occupied: false,
    runnerId: null,
  },
  third: {
    occupied: true,
    runnerId: 'r3',
  },
};

describe('MiniBaseDiamondState', () => {
  it('creates exactly three base markers and lights occupied bases red', () => {
    expect(buildMiniBaseDiamondState(
      bases,
    )).toEqual([
      {
        base: 1,
        label: '一塁',
        occupied: true,
        runnerId: 'r1',
        accent: 'red',
      },
      {
        base: 2,
        label: '二塁',
        occupied: false,
        runnerId: null,
        accent: 'inactive',
      },
      {
        base: 3,
        label: '三塁',
        occupied: true,
        runnerId: 'r3',
        accent: 'red',
      },
    ]);
  });

  it('never creates a fourth home marker', () => {
    const result = buildMiniBaseDiamondState(
      bases,
    );

    expect(result).toHaveLength(3);
    expect(result.map((marker) => marker.base))
      .toEqual([1, 2, 3]);
  });
});
