import { describe, expect, it } from 'vitest';
import {
  resolveFoulBallRule,
} from './FoulBallRule';
import {
  createFlyBallFirstFielderTouchFact,
} from './PhysicalRuleFacts';

const caughtFly = {
  kind: 'caught' as const,
  batterRunnerId: 'batter',
  firstFielderTouchTick: 2_000_000,
  outTick: 2_100_000,
  secureCatchTick: 2_100_000,
};

const droppedFly = {
  kind: 'not_caught' as const,
  batterRunnerId: 'batter',
  firstFielderTouchTick: 2_000_000,
  firstGroundContactTick: 2_050_000,
  secureCatchTick: 2_100_000,
};

describe('FoulBallRule', () => {
  it('turns a secured foul fly into a batter out while keeping the ball live for tag-up play', () => {
    expect(resolveFoulBallRule({
      territory: 'foul',
      buntAttempt: false,
      count: { balls: 1, strikes: 1 },
      flyCatch: caughtFly,
    })).toEqual({
      kind: 'caught_foul_fly',
      batterRunnerId: 'batter',
      outTick: 2_100_000,
      ballRemainsLive: true,
      runnerState: 'tag_up_required_if_advancing',
    });
  });

  it('turns an uncaught foul into a dead-ball foul count transition', () => {
    expect(resolveFoulBallRule({
      territory: 'foul',
      buntAttempt: false,
      count: { balls: 1, strikes: 1 },
      flyCatch: droppedFly,
    })).toEqual({
      kind: 'uncaught_foul',
      ballDead: true,
      countResult: {
        kind: 'continue',
        count: { balls: 1, strikes: 2 },
        cause: 'foul',
      },
    });

    expect(resolveFoulBallRule({
      territory: 'foul',
      buntAttempt: false,
      count: { balls: 1, strikes: 2 },
      flyCatch: droppedFly,
    })).toEqual({
      kind: 'uncaught_foul',
      ballDead: true,
      countResult: {
        kind: 'continue',
        count: { balls: 1, strikes: 2 },
        cause: 'foul',
      },
    });
  });

  it('uses foul-bunt strike-three semantics for an uncaught bunt foul', () => {
    expect(resolveFoulBallRule({
      territory: 'foul',
      buntAttempt: true,
      count: { balls: 0, strikes: 2 },
      flyCatch: droppedFly,
    })).toEqual({
      kind: 'uncaught_foul',
      ballDead: true,
      countResult: {
        kind: 'strikeout',
        terminalCount: { balls: 0, strikes: 3 },
        cause: 'foul_bunt',
      },
    });
  });

  it('does not treat a fair fly as a foul-ball rule result', () => {
    expect(resolveFoulBallRule({
      territory: 'fair',
      buntAttempt: false,
      count: { balls: 1, strikes: 2 },
      flyCatch: caughtFly,
    })).toEqual({
      kind: 'not_foul',
    });
  });

  it('preserves unresolved catch state instead of guessing whether the foul fly was caught', () => {
    expect(resolveFoulBallRule({
      territory: 'foul',
      buntAttempt: false,
      count: { balls: 0, strikes: 1 },
      flyCatch: {
        kind: 'unresolved',
        batterRunnerId: 'batter',
        firstFielderTouchTick:
          createFlyBallFirstFielderTouchFact('third-baseman', 2_000_000).tick,
      },
    })).toEqual({
      kind: 'unresolved_foul_fly',
      batterRunnerId: 'batter',
      firstFielderTouchTick: 2_000_000,
    });
  });
});
