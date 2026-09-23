import { describe, expect, it } from 'vitest';
import { samplePitchTrajectorySegment } from '../pitching/PitchTrajectory';
import { createCanonicalPitchRelease, createPitchTrajectoryFromRelease } from './CanonicalPitchRelease';
import type { PitchMotionTimeline } from './PitchMotionTimeline';

const timeline = { releaseUs: 1_000_000 } as PitchMotionTimeline;
const physics = { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 0, z: 0 } };

describe('canonical pitch release', () => {
  it('joins time, position and physics without changing the fixed position', () => {
    const position = { x: 0.1, y: 1.6, z: 17.8 };
    const release = createCanonicalPitchRelease(timeline, position, physics);
    expect(release).toEqual({ releaseAtUs: 1_000_000, position, ...physics });
    expect(createCanonicalPitchRelease({ ...timeline, releaseUs: 1_200_000 }, position, physics).position)
      .toEqual(position);
  });

  it('starts real ball flight at the release point', () => {
    const high = createCanonicalPitchRelease(timeline, { x: 0, y: 1.7, z: 18 }, physics);
    const low = createCanonicalPitchRelease(timeline, { x: 0, y: 1.2, z: 18 }, physics);
    const acceleration = { x: 0, y: -9.8, z: 0 };
    const highSegment = createPitchTrajectoryFromRelease(high, acceleration, 1_500_000);
    const lowSegment = createPitchTrajectoryFromRelease(low, acceleration, 1_500_000);
    expect(highSegment.start.position.y).toBe(1.7);
    expect(samplePitchTrajectorySegment(highSegment, 1_100_000).position.y
      - samplePitchTrajectorySegment(lowSegment, 1_100_000).position.y).toBeCloseTo(0.5);
  });
});
