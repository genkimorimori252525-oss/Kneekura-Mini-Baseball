import type { HalfInning } from '../model/CanonicalMatchState';

export type HalfInningTransitionInput = Readonly<{
  inning: number;
  half: HalfInning;
  outsAfterPlay: number;
}>;

export type HalfInningTransitionResult =
  | Readonly<{
    kind: 'half_inning_continues';
    inning: number;
    half: HalfInning;
    outs: 0 | 1 | 2;
  }>
  | Readonly<{
    kind: 'half_inning_ended';
    nextInning: number;
    nextHalf: HalfInning;
    reset: Readonly<{
      outs: 0;
      balls: 0;
      strikes: 0;
      bases: Readonly<{
        first: null;
        second: null;
        third: null;
      }>;
    }>;
  }>;

export const resolveHalfInningTransition = (
  input: HalfInningTransitionInput,
): HalfInningTransitionResult => {
  if (!Number.isInteger(input.inning) || input.inning <= 0) {
    throw new Error('inning must be a positive integer');
  }
  if (
    !Number.isInteger(input.outsAfterPlay)
    || input.outsAfterPlay < 0
    || input.outsAfterPlay > 3
  ) {
    throw new Error(
      'outsAfterPlay must be an integer from 0 through 3',
    );
  }

  if (input.outsAfterPlay < 3) {
    return {
      kind: 'half_inning_continues',
      inning: input.inning,
      half: input.half,
      outs: input.outsAfterPlay as 0 | 1 | 2,
    };
  }

  return {
    kind: 'half_inning_ended',
    nextInning: input.half === 'top'
      ? input.inning
      : input.inning + 1,
    nextHalf: input.half === 'top'
      ? 'bottom'
      : 'top',
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
  };
};
