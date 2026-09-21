import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  resolveAnticipationAwareAerodynamicSwing,
} from './AnticipationAwareAerodynamicSwing';

const trajectory:
  AerodynamicPitchTrajectory = {
    start: {
      tick: 1_000_000,
      position: {
        x: 0,
        y: 1,
        z: 0.2,
      },
      velocity: {
        x: 0,
        y: 0,
        z: -60,
      },
      spin: {
        x: 0,
        y: 0,
        z: 0,
      },
    },
    endTick: 1_010_000,
    parameters: {
      ticksPerSecond: 1_000_000,
      integrationStepTicks: 100,
      gravityY: -9.81,
      aerodynamics:
        REFERENCE_BASEBALL_AERODYNAMICS,
    },
  };

const swing = {
  startTick: 1_000_000,
  endTick: 1_006_000,
  ticksPerSecond: 1_000_000,
  stateAtStart: {
    pose: {
      grip: {
        x: -0.42,
        y: 1,
        z: 0,
      },
      tip: {
        x: 0.42,
        y: 1,
        z: 0,
      },
    },
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
    angularVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
} as const;

describe('anticipation-aware aerodynamic swing', () => {
  it('lets correct anticipation keep the original physical contact opportunity', () => {
    const result =
      resolveAnticipationAwareAerodynamicSwing({
        trajectory,
        swing,
        anticipation: {
          confidence: 1,
          comparedDimensions: 3,
          mismatchedDimensions: 0,
          mismatchFraction: 0,
          confidenceWeightedSurprise: 0,
          pitchSkillMatched: true,
          attackZoneMatched: true,
          verticalPlanMatched: true,
        },
        timingCalibration: {
          maxRecognitionDelayTicks:
            5_000,
        },
      });

    expect(result.timing.recognitionDelayTicks)
      .toBe(0);
    expect(result.physical.kind)
      .toBe('contact');
  });

  it('can turn the same physical pitch into a miss when a contradicted high-confidence read delays recognition', () => {
    const result =
      resolveAnticipationAwareAerodynamicSwing({
        trajectory,
        swing,
        anticipation: {
          confidence: 1,
          comparedDimensions: 3,
          mismatchedDimensions: 3,
          mismatchFraction: 1,
          confidenceWeightedSurprise: 1,
          pitchSkillMatched: false,
          attackZoneMatched: false,
          verticalPlanMatched: false,
        },
        timingCalibration: {
          maxRecognitionDelayTicks:
            5_000,
        },
      });

    expect(result.timing.recognitionDelayTicks)
      .toBe(4_000);
    expect(result.physical.kind)
      .toBe('swinging_miss');
  });
});
