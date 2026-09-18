import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createControlledBaseContactFact,
  createPlayEndFact,
  createRunnerBaseTouchFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveGroundBallFirstBaseRule,
} from '../../rules/RuleEngine';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFairBattedBall,
} from './CanonicalPlateAppearanceTimeline';
import {
  completeGroundBallFirstBasePlateAppearance,
} from './GroundBallPlateAppearanceCoordinator';

const match = (
  outs: number,
  half: 'top' | 'bottom' = 'top',
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 8,
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
    home: 2,
  },
  playId: 31,
});

const fairTimeline = (
  state: CanonicalMatchState,
) => {
  const pitch: PitchWorldState = {
    tick: 80_000_000,
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
    throw new Error('fixture must create contact');
  }

  return recordFairBattedBall(
    recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        state,
        79_900_000,
      ),
      contact,
    ),
    80_010_000,
  );
};

describe('GroundBallPlateAppearanceCoordinator', () => {
  it('closes a two-out first-base third out with suppressed run and advances the half inning', () => {
    const before = match(2, 'top');
    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      80_300_000,
    );
    const rule = resolveGroundBallFirstBaseRule({
      outsAtStart: 2,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        80_350_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        80_400_000,
      ),
      homeTouches: [homeTouch],
    });
    const playEnd = createPlayEndFact(
      80_500_000,
      'live_action_complete',
    );

    const result = completeGroundBallFirstBasePlateAppearance({
      match: before,
      timeline: fairTimeline(before),
      rule,
      playEnd,
      basesAfter: {
        first: null,
        second: 'r1',
        third: null,
      },
    });

    expect(result.resolution).toEqual({
      playEnd,
      outsAfter: 3,
      basesAfter: {
        first: null,
        second: 'r1',
        third: null,
      },
      scoredRunnerIds: [],
    });
    expect(result.timeline.status).toMatchObject({
      kind: 'live_ball_complete',
      playEndTick: 80_500_000,
    });
    expect(result.nextMatchState).toEqual({
      ruleProfileId: before.ruleProfileId,
      inning: 8,
      half: 'bottom',
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: {
        first: null,
        second: null,
        third: null,
      },
      score: before.score,
      playId: 32,
    });
  });

  it('finalizes an earlier home touch when the batter-runner is safe and preserves the supplied final bases', () => {
    const before = match(1, 'bottom');
    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      81_300_000,
    );
    const rule = resolveGroundBallFirstBaseRule({
      outsAtStart: 1,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        81_450_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        81_400_000,
      ),
      homeTouches: [homeTouch],
    });
    const playEnd = createPlayEndFact(
      81_500_000,
      'live_action_complete',
    );
    const stateTimeline = fairTimeline({
      ...before,
      playId: 31,
    });

    const result = completeGroundBallFirstBasePlateAppearance({
      match: before,
      timeline: stateTimeline,
      rule,
      playEnd,
      basesAfter: {
        first: 'batter',
        second: 'r1',
        third: null,
      },
    });

    expect(result.resolution.scoredRunnerIds).toEqual(['r3']);
    expect(result.nextMatchState).toEqual({
      ...before,
      outs: 1,
      balls: 0,
      strikes: 0,
      bases: {
        first: 'batter',
        second: 'r1',
        third: null,
      },
      score: {
        away: 2,
        home: 3,
      },
      playId: 32,
    });
  });

  it('rejects a RuleEngine result that belongs to a different starting out state', () => {
    const before = match(1);
    const rule = resolveGroundBallFirstBaseRule({
      outsAtStart: 0,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        82_300_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        82_350_000,
      ),
      homeTouches: [],
    });

    expect(() => completeGroundBallFirstBasePlateAppearance({
      match: before,
      timeline: fairTimeline(before),
      rule,
      playEnd: createPlayEndFact(
        82_500_000,
        'live_action_complete',
      ),
      basesAfter: before.bases,
    })).toThrow(
      'ground-ball rule outsAtStart must match CanonicalMatchState.outs',
    );
  });
});
