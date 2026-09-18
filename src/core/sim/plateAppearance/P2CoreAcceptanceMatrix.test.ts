import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  SeedRoot,
} from '../../rng/SeedRoot';
import {
  createControlledBaseContactFact,
  createPlayEndFact,
  createRunnerBaseTouchFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveGroundBallFirstBaseRule,
} from '../../rules/RuleEngine';
import type {
  PitchAgainstBatterInput,
} from '../pitching/PitchAgainstBatter';
import type {
  BatBallContactResult,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFairBattedBall,
  recordFoulBattedBall,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolvePlateAppearancePitchSequence,
} from './PlateAppearancePitchSequence';
import {
  advancePlateAppearancePitchSequenceToMatchState,
  resolvePlateAppearancePitchSequenceToMatchState,
} from './PlateAppearanceSequenceCoordinator';
import {
  completeGroundBallFirstBasePlateAppearance,
} from './GroundBallPlateAppearanceCoordinator';

const match = (
  balls = 0,
  strikes = 0,
  outs = 1,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 6,
  half: 'top',
  outs,
  balls,
  strikes,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 2,
    home: 1,
  },
  playId: 50,
});

const zone = {
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.5,
  upperY: 1.5,
} as const;

const taken = (
  startTick: number,
  x: number,
): PitchAgainstBatterInput => ({
  action: { kind: 'take' },
  trajectory: {
    start: {
      tick: startTick,
      position: { x, y: 1, z: 10 },
      velocity: { x: 0, y: 0, z: -20 },
      spin: { x: 0, y: 0, z: 0 },
    },
    acceleration: { x: 0, y: 0, z: 0 },
    endTick: startTick + 600_000,
    ticksPerSecond: 1_000_000,
  },
  plateZ: 0,
  strikeZone: zone,
  ballRadiusMeters: 0.0366,
});

const swing = (
  startTick: number,
  xOffset: number,
): PitchAgainstBatterInput => ({
  action: {
    kind: 'swing',
    swing: {
      startTick,
      endTick: startTick + 5_000,
      ticksPerSecond: 1_000_000,
      stateAtStart: {
        pose: {
          grip: {
            x: -0.42 + xOffset,
            y: 1,
            z: 0,
          },
          tip: {
            x: 0.42 + xOffset,
            y: 1,
            z: 0,
          },
        },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      },
    },
  },
  trajectory: {
    start: {
      tick: startTick,
      position: { x: 0, y: 1, z: 0.2 },
      velocity: { x: 0, y: 0, z: -60 },
      spin: { x: 0, y: 0, z: 0 },
    },
    acceleration: { x: 0, y: 0, z: 0 },
    endTick: startTick + 5_000,
    ticksPerSecond: 1_000_000,
  },
});

const manualContact: BatBallContactResult = {
  tick: 10_000_000,
  ballCenter: { x: 0, y: 1, z: 0.06 },
  point: { x: 0, y: 1, z: 0.03 },
  batPoint: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  segmentT: 0.5,
  exitVelocity: { x: 4, y: 1, z: 20 },
  exitSpin: { x: 0, y: 0, z: 0 },
};

describe('P2 Core acceptance matrix', () => {
  it('replays the same seeded multi-pitch plate appearance into identical canonical state', () => {
    const run = () => {
      const before = match(0, 0, 1);
      const rng = new SeedRoot(20260918)
        .streamRng(
          before.playId,
          'pitch',
          'p2-acceptance-matrix',
        );
      const pitches = Array.from(
        { length: 4 },
        (_, index) => taken(
          1_000_000 + index * 1_000_000,
          0.3 + rng.nextFloat() * 0.1,
        ),
      );

      return resolvePlateAppearancePitchSequenceToMatchState({
        match: before,
        batterRunnerId: 'batter',
        startedAtTick: 900_000,
        pitches,
      });
    };

    expect(run()).toEqual(run());
    expect(run()).toMatchObject({
      kind: 'complete',
      terminalKind: 'walk',
      pitchesConsumed: 4,
    });
  });

  it('keeps one canonical ledger across physical contact, foul, resumed pitch, and terminal strikeout', () => {
    const before = match(0, 1, 1);
    const contacted = resolvePlateAppearancePitchSequence({
      match: before,
      startedAtTick: 4_900_000,
      pitches: [swing(5_000_000, 0)],
    });
    if (contacted.kind !== 'batted_ball_pending') {
      throw new Error(
        'P2 acceptance fixture must produce contact',
      );
    }

    const afterFoul = recordFoulBattedBall(
      contacted.timeline,
      5_010_000,
      false,
      null,
    );

    const result =
      advancePlateAppearancePitchSequenceToMatchState({
        match: before,
        batterRunnerId: 'batter',
        timeline: afterFoul,
        pitches: [swing(6_000_000, 1)],
      });

    expect(result.kind).toBe('complete');
    if (result.kind !== 'complete') {
      throw new Error(
        'P2 acceptance fixture must end in strikeout',
      );
    }
    expect(result.timeline.events.map(
      (event) => event.kind,
    )).toEqual([
      'BatBallContact',
      'FoulBattedBallResolved',
      'SwingCompletedWithoutContact',
      'PitchAdjudicated',
    ]);
    expect(result.nextMatchState).toMatchObject({
      outs: 2,
      balls: 0,
      strikes: 0,
      playId: 51,
    });
  });

  it('closes a fair live-ball play through RuleEngine play end into the next CanonicalMatchState', () => {
    const before = match(1, 1, 1);
    const fairTimeline = recordFairBattedBall(
      recordBatBallContact(
        createCanonicalPlateAppearanceTimeline(
          before,
          9_900_000,
        ),
        manualContact,
      ),
      10_010_000,
    );

    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      10_200_000,
    );
    const rule = resolveGroundBallFirstBaseRule({
      outsAtStart: 1,
      batterRunnerId: 'batter',
      defenderControl:
        createControlledBaseContactFact(
          'first-baseman',
          1,
          10_400_000,
        ),
      batterRunnerTouch:
        createRunnerBaseTouchFact(
          'batter',
          1,
          10_350_000,
        ),
      homeTouches: [homeTouch],
    });
    const playEnd = createPlayEndFact(
      10_500_000,
      'live_action_complete',
    );

    const completed =
      completeGroundBallFirstBasePlateAppearance({
        match: before,
        timeline: fairTimeline,
        rule,
        playEnd,
        basesAfter: {
          first: 'batter',
          second: 'r1',
          third: null,
        },
      });

    expect(completed.timeline.status.kind)
      .toBe('live_ball_complete');
    expect(completed.resolution).toMatchObject({
      outsAfter: 1,
      scoredRunnerIds: ['r3'],
    });
    expect(completed.nextMatchState).toMatchObject({
      score: {
        away: 3,
        home: 1,
      },
      bases: {
        first: 'batter',
        second: 'r1',
        third: null,
      },
      balls: 0,
      strikes: 0,
      playId: 51,
    });
  });
});
