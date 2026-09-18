import { describe, expect, it } from 'vitest';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
} from './PlateAppearanceCommandSession';
import {
  createCommandedPitchAgainstBatterInput,
} from './PlateAppearanceCommandPitchAdapter';

const session = createPlateAppearanceCommandSession({
  playId: 17,
  batterRunnerId: 'batter-17',
  acceptedAtTick: 1_000_000,
  matchSeed: 12345,
  command: createPlateAppearanceCommand({
    pitcher: {
      attackZone: 'outside',
      verticalPlan: 'low',
      aggression: 'balanced',
    },
    batter: {
      approach: 'aggressive',
      swingBias: 'early',
    },
    runners: {
      posture: 'balanced',
    },
  }),
});

const environment = {
  pitchStartTick: 1_100_000,
  pitchOrdinal: 0,
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
} as const;

describe('PlateAppearanceCommandPitchAdapter', () => {
  it('maps pitcher instructions into a deterministic physical plate target and pitch trajectory', () => {
    const result = createCommandedPitchAgainstBatterInput({
      session,
      environment,
    });

    expect(result.pitchOrdinal).toBe(0);
    expect(result.targetPlatePosition.z).toBe(0);
    expect(result.targetPlatePosition.x).toBeLessThan(0);
    expect(result.targetPlatePosition.y)
      .toBeGreaterThan(environment.strikeZone.lowerY);
    expect(result.targetPlatePosition.y)
      .toBeLessThan(environment.strikeZone.upperY);

    expect(result.input.trajectory.start.tick)
      .toBe(environment.pitchStartTick);
    expect(result.input.trajectory.endTick)
      .toBe(
        environment.pitchStartTick
        + environment.pitchDurationTicks,
      );
  });

  it('maps aggressive batter approach into a swing without declaring contact', () => {
    const result = createCommandedPitchAgainstBatterInput({
      session,
      environment,
    });

    expect(result.input.action.kind).toBe('swing');
    if (result.input.action.kind !== 'swing') {
      throw new Error('fixture must generate swing');
    }

    expect(result.input.action.swing.startTick)
      .toBeLessThan(
        environment.pitchStartTick
        + environment.pitchDurationTicks,
      );
    expect(result.input.action.swing.endTick)
      .toBeGreaterThan(
        result.input.action.swing.startTick,
      );
  });

  it('maps take approach into the existing take input without changing pitch physics', () => {
    const takeSession =
      createPlateAppearanceCommandSession({
        ...session,
        command: createPlateAppearanceCommand({
          ...session.command,
          batter: {
            approach: 'take',
            swingBias: 'neutral',
          },
        }),
      });

    const swingResult =
      createCommandedPitchAgainstBatterInput({
        session,
        environment,
      });
    const takeResult =
      createCommandedPitchAgainstBatterInput({
        session: takeSession,
        environment,
      });

    expect(takeResult.input.action.kind).toBe('take');
    expect(takeResult.input.trajectory)
      .toEqual(swingResult.input.trajectory);
    expect(takeResult.targetPlatePosition)
      .toEqual(swingResult.targetPlatePosition);
  });

  it('uses independent deterministic pitch streams by ordinal', () => {
    const balancedSession =
      createPlateAppearanceCommandSession({
        ...session,
        command: createPlateAppearanceCommand({
          ...session.command,
          batter: {
            approach: 'balanced',
            swingBias: 'neutral',
          },
        }),
      });

    const run = (pitchOrdinal: number) => (
      createCommandedPitchAgainstBatterInput({
        session: balancedSession,
        environment: {
          ...environment,
          pitchOrdinal,
        },
      })
    );

    expect(run(2)).toEqual(run(2));
    expect(run(2).batterDecisionRoll)
      .not.toBe(run(3).batterDecisionRoll);
  });

  it('makes early and late swing bias change timing rather than pitch trajectory', () => {
    const early = createCommandedPitchAgainstBatterInput({
      session,
      environment,
    });
    const late = createCommandedPitchAgainstBatterInput({
      session: createPlateAppearanceCommandSession({
        ...session,
        command: createPlateAppearanceCommand({
          ...session.command,
          batter: {
            approach: 'aggressive',
            swingBias: 'late',
          },
        }),
      }),
      environment,
    });

    expect(early.input.trajectory)
      .toEqual(late.input.trajectory);
    expect(early.input.action.kind).toBe('swing');
    expect(late.input.action.kind).toBe('swing');

    if (
      early.input.action.kind !== 'swing'
      || late.input.action.kind !== 'swing'
    ) {
      throw new Error('fixtures must swing');
    }

    expect(early.input.action.swing.startTick)
      .toBeLessThan(late.input.action.swing.startTick);
  });
});
