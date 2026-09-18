import { describe, expect, it } from 'vitest';
import {
  resolveHalfInningTransition,
} from './HalfInningTransitionRule';

describe('HalfInningTransitionRule', () => {
  it('keeps the half inning active before the third out', () => {
    expect(resolveHalfInningTransition({
      inning: 5,
      half: 'top',
      outsAfterPlay: 2,
    })).toEqual({
      kind: 'half_inning_continues',
      inning: 5,
      half: 'top',
      outs: 2,
    });
  });

  it('moves top to bottom of the same inning after the third out', () => {
    expect(resolveHalfInningTransition({
      inning: 5,
      half: 'top',
      outsAfterPlay: 3,
    })).toEqual({
      kind: 'half_inning_ended',
      nextInning: 5,
      nextHalf: 'bottom',
      reset: {
        outs: 0,
        balls: 0,
        strikes: 0,
        bases: {
          first: null,
          second: null,
          third: null,
        },
      },
    });
  });

  it('moves bottom to top of the next inning after the third out', () => {
    expect(resolveHalfInningTransition({
      inning: 5,
      half: 'bottom',
      outsAfterPlay: 3,
    })).toEqual({
      kind: 'half_inning_ended',
      nextInning: 6,
      nextHalf: 'top',
      reset: {
        outs: 0,
        balls: 0,
        strikes: 0,
        bases: {
          first: null,
          second: null,
          third: null,
        },
      },
    });
  });

  it('rejects impossible inning and out states', () => {
    expect(() => resolveHalfInningTransition({
      inning: 0,
      half: 'top',
      outsAfterPlay: 3,
    })).toThrow('inning must be a positive integer');

    expect(() => resolveHalfInningTransition({
      inning: 1,
      half: 'top',
      outsAfterPlay: 4,
    })).toThrow(
      'outsAfterPlay must be an integer from 0 through 3',
    );
  });
});
