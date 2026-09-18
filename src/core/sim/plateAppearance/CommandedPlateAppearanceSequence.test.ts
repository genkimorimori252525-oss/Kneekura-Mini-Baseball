import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
} from './PlateAppearanceCommandSession';
import {
  resolveCommandedPlateAppearanceSequence,
} from './CommandedPlateAppearanceSequence';

const match = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top' as const,
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 21,
};

const session = createPlateAppearanceCommandSession({
  playId: 21,
  batterRunnerId: 'batter-21',
  acceptedAtTick: 1_000_000,
  matchSeed: 987654,
  command: createPlateAppearanceCommand({
    pitcher: {
      attackZone: 'middle',
      verticalPlan: 'middle',
      aggression: 'challenge',
    },
    batter: {
      approach: 'take',
      swingBias: 'neutral',
    },
    runners: {
      posture: 'balanced',
    },
  }),
});

const environment = (
  ordinal: number,
  startTick: number,
) => ({
  pitchStartTick: startTick,
  pitchOrdinal: ordinal,
  ticksPerSecond: 1_000_000,
  pitchDurationTicks: 400_000,
  releasePosition: { x: 0, y: 1.8, z: 18 },
  acceleration: { x: 0, y: -9.8, z: 0 },
  plateZ: 0,
  strikeZone: {
    centerX: 0,
    halfWidth: 0.22,
    lowerY: 0.55,
    upperY: 1.15,
  },
  ballRadiusMeters: 0.0366,
  insideXDirection: 1 as const,
  targetCalibration: {
    challengeHorizontalZoneFraction: 0.45,
    balancedHorizontalZoneFraction: 0.8,
    wasteHorizontalZoneFraction: 1.3,
    lowVerticalZoneFraction: 0.2,
    middleVerticalZoneFraction: 0.5,
    highVerticalZoneFraction: 0.8,
  },
  batterCalibration: {
    balancedSwingProbability: 0.5,
    aggressiveSwingProbability: 1,
    earlyTimingOffsetTicks: -30_000,
    lateTimingOffsetTicks: 30_000,
    swingWindowHalfWidthTicks: 70_000,
  },
  swingStateAtWindowStart: {
    pose: {
      grip: { x: -0.5, y: 1, z: 0.3 },
      tip: { x: 0.4, y: 1, z: 0.3 },
    },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 12, z: 0 },
  },
});

describe('CommandedPlateAppearanceSequence', () => {
  it('uses one accepted command to drive multiple canonical pitches without per-pitch command input', () => {
    const result = resolveCommandedPlateAppearanceSequence({
      match,
      session,
      startedAtTick: 1_000_000,
      environments: [
        environment(0, 1_100_000),
        environment(1, 1_700_000),
        environment(2, 2_300_000),
      ],
    });

    expect(result.pitchesGenerated).toBe(3);
    expect(result.command).toEqual(session.command);
    expect(result.timeline.events.filter(
      (event) => event.kind === 'PitchAdjudicated',
    )).toHaveLength(3);
    expect(result.timeline.status.kind).toBe('strikeout');
  });

  it('stops automatically at a terminal result even when more scheduled pitch environments exist', () => {
    const result = resolveCommandedPlateAppearanceSequence({
      match: {
        ...match,
        strikes: 2,
      },
      session,
      startedAtTick: 1_000_000,
      environments: [
        environment(0, 1_100_000),
        environment(1, 1_700_000),
        environment(2, 2_300_000),
      ],
    });

    expect(result.pitchesGenerated).toBe(1);
    expect(result.timeline.status.kind).toBe('strikeout');
    expect(result.unusedEnvironmentCount).toBe(2);
  });

  it('is deterministic for the same session and schedule', () => {
    const run = () => resolveCommandedPlateAppearanceSequence({
      match,
      session,
      startedAtTick: 1_000_000,
      environments: [
        environment(0, 1_100_000),
        environment(1, 1_700_000),
      ],
    });

    expect(run()).toEqual(run());
  });

  it('requires a strictly increasing ordinal schedule starting at zero', () => {
    expect(() => resolveCommandedPlateAppearanceSequence({
      match,
      session,
      startedAtTick: 1_000_000,
      environments: [
        environment(1, 1_100_000),
      ],
    })).toThrow(
      'commanded pitch environments must use contiguous ordinals starting at zero',
    );
  });
});
