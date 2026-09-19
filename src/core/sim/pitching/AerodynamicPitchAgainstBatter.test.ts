import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  createCanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  resolveAndRecordAerodynamicPitchAgainstBatter,
} from './AerodynamicPitchAgainstBatter';

const trajectory = (): AerodynamicPitchTrajectory => ({
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
  endTick: 1_006_000,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 100,
    gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
  },
});

describe('aerodynamic pitch against batter', () => {
  it('records a taken aerodynamic plate crossing through the canonical timeline', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        900_000,
      );
    const result =
      resolveAndRecordAerodynamicPitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'take',
          },
          trajectory: trajectory(),
          plateZ: 0,
          strikeZone: {
            centerX: 0,
            halfWidth: 0.25,
            lowerY: 0.5,
            upperY: 1.5,
          },
          ballRadiusMeters: 0.0366,
        },
      );

    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') {
      throw new Error('fixture must record');
    }
    expect(result.physical.kind).toBe('taken');
    expect(result.timeline.events.length)
      .toBeGreaterThan(0);
  });

  it('records aerodynamic swing contact through the existing canonical adapter', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        900_000,
      );
    const result =
      resolveAndRecordAerodynamicPitchAgainstBatter(
        timeline,
        {
          action: {
            kind: 'swing',
            swing: {
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
            },
          },
          trajectory: trajectory(),
        },
      );

    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') {
      throw new Error('fixture must record');
    }
    expect(result.physical.kind).toBe('swing');
    if (result.physical.kind !== 'swing') {
      throw new Error('fixture must be swing');
    }
    expect(result.physical.result.kind)
      .toBe('contact');
  });
});
