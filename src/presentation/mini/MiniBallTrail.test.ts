import { describe, expect, it } from 'vitest';
import type {
  CanonicalPresentationSample,
} from './model';
import {
  buildMiniBallTrail,
} from './MiniBallTrail';

const sample = (
  tick: number,
  x: number,
  y: number,
  z: number,
): CanonicalPresentationSample => ({
  world: {
    tick,
    defenders: [],
    runners: [],
    ball: {
      position: { x, y, z },
      velocity: { x: 1, y: 0, z: 1 },
      spin: { x: 0, y: 0, z: 0 },
    },
  },
  batter: {
    handedness: 'R',
    action: 'idle',
    bat: null,
  },
});

describe('MiniBallTrail', () => {
  it('projects only canonical historical samples as discrete trail points', () => {
    const history = [
      sample(1_000_000, 0, 0.1, 10),
      sample(1_050_000, 1, 0.5, 11),
      sample(1_100_000, 2, 1.5, 12),
      sample(1_150_000, 3, 2.5, 13),
    ];

    const result = buildMiniBallTrail({
      history,
      currentTick: 1_200_000,
      camera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
      maximumTrailPoints: 3,
    });

    expect(result).toEqual([
      {
        tick: 1_050_000,
        worldPosition: { x: 1, y: 0.5, z: 11 },
        screenPosition: { x: 77, y: 74 },
        altitudeMeters: 0.5,
      },
      {
        tick: 1_100_000,
        worldPosition: { x: 2, y: 1.5, z: 12 },
        screenPosition: { x: 79, y: 72 },
        altitudeMeters: 1.5,
      },
      {
        tick: 1_150_000,
        worldPosition: { x: 3, y: 2.5, z: 13 },
        screenPosition: { x: 81, y: 70 },
        altitudeMeters: 2.5,
      },
    ]);
  });

  it('never includes a sample at or after currentTick', () => {
    const result = buildMiniBallTrail({
      history: [
        sample(1_150_000, 3, 2.5, 13),
        sample(1_200_000, 4, 2, 14),
        sample(1_250_000, 5, 1, 15),
      ],
      currentTick: 1_200_000,
      camera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
      maximumTrailPoints: 5,
    });

    expect(result.map((point) => point.tick))
      .toEqual([1_150_000]);
  });

  it('skips historical samples that have no canonical ball state', () => {
    const withoutBall: CanonicalPresentationSample = {
      ...sample(1_100_000, 2, 1, 12),
      world: {
        tick: 1_100_000,
        defenders: [],
        runners: [],
        ball: null,
      },
    };

    const result = buildMiniBallTrail({
      history: [
        sample(1_050_000, 1, 0.5, 11),
        withoutBall,
      ],
      currentTick: 1_200_000,
      camera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
      maximumTrailPoints: 5,
    });

    expect(result.map((point) => point.tick))
      .toEqual([1_050_000]);
  });

  it('rejects invalid point counts instead of silently changing trail semantics', () => {
    expect(() => buildMiniBallTrail({
      history: [],
      currentTick: 1_200_000,
      camera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
      maximumTrailPoints: -1,
    })).toThrow(
      'maximumTrailPoints must be a non-negative safe integer',
    );
  });
});
