import { describe, expect, it } from 'vitest';
import {
  resolveWalkForcedAdvancement,
} from './WalkAdvancementRule';

describe('WalkAdvancementRule', () => {
  it('places the batter at first without moving unforced runners', () => {
    expect(resolveWalkForcedAdvancement({
      batterRunnerId: 'batter',
      bases: {
        first: null,
        second: 'r2',
        third: 'r3',
      },
    })).toEqual({
      bases: {
        first: 'batter',
        second: 'r2',
        third: 'r3',
      },
      scoredRunnerIds: [],
    });
  });

  it('pushes only the contiguous forced chain from first base', () => {
    expect(resolveWalkForcedAdvancement({
      batterRunnerId: 'batter',
      bases: {
        first: 'r1',
        second: null,
        third: 'r3',
      },
    })).toEqual({
      bases: {
        first: 'batter',
        second: 'r1',
        third: 'r3',
      },
      scoredRunnerIds: [],
    });

    expect(resolveWalkForcedAdvancement({
      batterRunnerId: 'batter',
      bases: {
        first: 'r1',
        second: 'r2',
        third: null,
      },
    })).toEqual({
      bases: {
        first: 'batter',
        second: 'r1',
        third: 'r2',
      },
      scoredRunnerIds: [],
    });
  });

  it('forces the runner from third home on a bases-loaded walk', () => {
    expect(resolveWalkForcedAdvancement({
      batterRunnerId: 'batter',
      bases: {
        first: 'r1',
        second: 'r2',
        third: 'r3',
      },
    })).toEqual({
      bases: {
        first: 'batter',
        second: 'r1',
        third: 'r2',
      },
      scoredRunnerIds: ['r3'],
    });
  });

  it('rejects duplicate or empty runner identities', () => {
    expect(() => resolveWalkForcedAdvancement({
      batterRunnerId: '',
      bases: {
        first: null,
        second: null,
        third: null,
      },
    })).toThrow('batterRunnerId must not be empty');

    expect(() => resolveWalkForcedAdvancement({
      batterRunnerId: 'batter',
      bases: {
        first: 'r1',
        second: 'r1',
        third: null,
      },
    })).toThrow(
      'walk advancement requires unique occupied runner ids',
    );
  });
});
