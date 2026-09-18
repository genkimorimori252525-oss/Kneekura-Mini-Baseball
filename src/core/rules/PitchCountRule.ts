export type PitchCountState = Readonly<{
  balls: number;
  strikes: number;
}>;

export type PitchCountAdjudication =
  | Readonly<{ kind: 'ball' }>
  | Readonly<{ kind: 'called_strike' }>
  | Readonly<{ kind: 'swinging_strike' }>
  | Readonly<{ kind: 'foul' }>
  | Readonly<{ kind: 'foul_bunt' }>
  | Readonly<{ kind: 'ball_in_play' }>;

export type PitchCountRuleResult =
  | Readonly<{
    kind: 'continue';
    count: PitchCountState;
    cause:
      | 'ball'
      | 'called_strike'
      | 'swinging_strike'
      | 'foul';
  }>
  | Readonly<{
    kind: 'walk';
    terminalCount: Readonly<{
      balls: 4;
      strikes: number;
    }>;
    cause: 'ball';
  }>
  | Readonly<{
    kind: 'strikeout';
    terminalCount: Readonly<{
      balls: number;
      strikes: 3;
    }>;
    cause:
      | 'called_strike'
      | 'swinging_strike'
      | 'foul_bunt';
  }>
  | Readonly<{
    kind: 'ball_in_play';
    count: PitchCountState;
  }>;

const validatePrePitchCount = (
  count: PitchCountState,
): void => {
  if (
    !Number.isInteger(count.balls)
    || count.balls < 0
    || count.balls > 3
  ) {
    throw new Error(
      'pre-pitch balls must be an integer from 0 through 3',
    );
  }
  if (
    !Number.isInteger(count.strikes)
    || count.strikes < 0
    || count.strikes > 2
  ) {
    throw new Error(
      'pre-pitch strikes must be an integer from 0 through 2',
    );
  }
};

const addStrike = (
  count: PitchCountState,
  cause: 'called_strike' | 'swinging_strike' | 'foul_bunt',
): PitchCountRuleResult => {
  const strikes = count.strikes + 1;
  if (strikes >= 3) {
    return {
      kind: 'strikeout',
      terminalCount: {
        balls: count.balls,
        strikes: 3,
      },
      cause,
    };
  }

  return {
    kind: 'continue',
    count: {
      balls: count.balls,
      strikes,
    },
    cause,
  };
};

export const resolvePitchCountRule = (
  count: PitchCountState,
  adjudication: PitchCountAdjudication,
): PitchCountRuleResult => {
  validatePrePitchCount(count);

  switch (adjudication.kind) {
    case 'ball': {
      const balls = count.balls + 1;
      if (balls >= 4) {
        return {
          kind: 'walk',
          terminalCount: {
            balls: 4,
            strikes: count.strikes,
          },
          cause: 'ball',
        };
      }
      return {
        kind: 'continue',
        count: {
          balls,
          strikes: count.strikes,
        },
        cause: 'ball',
      };
    }

    case 'called_strike':
      return addStrike(count, 'called_strike');

    case 'swinging_strike':
      return addStrike(count, 'swinging_strike');

    case 'foul':
      return {
        kind: 'continue',
        count: {
          balls: count.balls,
          strikes: Math.min(2, count.strikes + 1),
        },
        cause: 'foul',
      };

    case 'foul_bunt':
      return addStrike(count, 'foul_bunt');

    case 'ball_in_play':
      return {
        kind: 'ball_in_play',
        count,
      };
  }
};
