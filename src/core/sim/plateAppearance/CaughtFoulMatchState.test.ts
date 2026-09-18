import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createPlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFoulBattedBall,
  recordLiveBallPlayEnd,
} from './CanonicalPlateAppearanceTimeline';
import {
  applyCaughtFoulPlateAppearanceToMatchState,
} from './CaughtFoulMatchState';

const match = (
  outs: number,
  half: 'top' | 'bottom' = 'top',
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 5,
  half,
  outs,
  balls: 1,
  strikes: 1,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 2,
    home: 1,
  },
  playId: 12,
});

const caughtFoulTimeline = (
  state: CanonicalMatchState,
) => {
  const pitch: PitchWorldState = {
    tick: 10_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: 0, z: 22 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const contact = resolveBatBallContact(pitch, swing);
  if (contact === null) {
    throw new Error('fixture must produce contact');
  }

  const contacted = recordBatBallContact(
    createCanonicalPlateAppearanceTimeline(
      state,
      9_900_000,
    ),
    contact,
  );
  const caught = recordFoulBattedBall(
    contacted,
    10_100_000,
    false,
    {
      kind: 'caught',
      batterRunnerId: 'batter',
      firstFielderTouchTick: 10_050_000,
      outTick: 10_100_000,
      secureCatchTick: 10_100_000,
    },
  );

  return recordLiveBallPlayEnd(
    caught,
    createPlayEndFact(
      10_400_000,
      'live_action_complete',
    ),
  );
};

describe('CaughtFoulMatchState', () => {
  it('adds the caught-foul batter out and applies finalized runner state', () => {
    const before = match(1, 'top');
    const after = applyCaughtFoulPlateAppearanceToMatchState(
      before,
      caughtFoulTimeline(before),
      {
        basesAfter: {
          first: 'r1',
          second: null,
          third: null,
        },
        scoredRunnerIds: ['r3'],
      },
    );

    expect(after).toEqual({
      ...before,
      outs: 2,
      balls: 0,
      strikes: 0,
      bases: {
        first: 'r1',
        second: null,
        third: null,
      },
      score: {
        away: 3,
        home: 1,
      },
      playId: 13,
    });
  });

  it('turns a two-out caught foul into the third out and clears the half inning', () => {
    const before = match(2, 'bottom');
    const after = applyCaughtFoulPlateAppearanceToMatchState(
      before,
      caughtFoulTimeline(before),
      {
        basesAfter: {
          first: 'r1',
          second: null,
          third: 'r3',
        },
        scoredRunnerIds: [],
      },
    );

    expect(after).toEqual({
      ruleProfileId: before.ruleProfileId,
      inning: 6,
      half: 'top',
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: {
        first: null,
        second: null,
        third: null,
      },
      score: before.score,
      playId: 13,
    });
  });

  it('rejects runs on a caught-foul third out', () => {
    const before = match(2);

    expect(() => applyCaughtFoulPlateAppearanceToMatchState(
      before,
      caughtFoulTimeline(before),
      {
        basesAfter: before.bases,
        scoredRunnerIds: ['r3'],
      },
    )).toThrow(
      'caught-foul third out cannot score runs',
    );
  });

  it('rejects a completed fair-ball timeline', () => {
    const before = match(1);
    const timeline = caughtFoulTimeline(before);
    const wrong = {
      ...timeline,
      status: {
        ...timeline.status,
        disposition: {
          kind: 'fair' as const,
          fairDeterminationTick: 10_050_000,
        },
      },
    };

    expect(() => applyCaughtFoulPlateAppearanceToMatchState(
      before,
      wrong,
      {
        basesAfter: before.bases,
        scoredRunnerIds: [],
      },
    )).toThrow(
      'caught-foul match-state application requires a completed caught-foul timeline',
    );
  });
});
