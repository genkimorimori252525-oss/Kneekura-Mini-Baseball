import { describe, expect, it } from 'vitest';
import type { DefenderMotionSegment } from './DefenderMotion';
import {
  projectDefenderBodyKinematicsSegment,
  sampleDefenderBodyKinematicsSegment,
} from './DefenderBodyKinematics';
import { sampleDefenderMotionSegment } from './DefenderMotion';

const segment = (): DefenderMotionSegment => ({
  startTick: 1_000_000,
  endTick: 1_100_000,
  ticksPerSecond: 1_000_000,
  startPosition: { x: 4, z: 7 },
  startVelocity: { x: 2, z: -1 },
  acceleration: { x: 3, z: 4 },
  target: { x: 20, z: 10 },
});

describe('DefenderBodyKinematics', () => {
  it('projects canonical XZ defender motion into a 3D body-origin segment', () => {
    expect(projectDefenderBodyKinematicsSegment(segment(), 0.95)).toEqual({
      startTick: 1_000_000,
      endTick: 1_100_000,
      ticksPerSecond: 1_000_000,
      startPosition: { x: 4, y: 0.95, z: 7 },
      startVelocity: { x: 2, y: 0, z: -1 },
      acceleration: { x: 3, y: 0, z: 4 },
    });
  });

  it('samples XZ exactly from the underlying defender motion segment', () => {
    const body = projectDefenderBodyKinematicsSegment(segment(), 0.95);
    const bodySample = sampleDefenderBodyKinematicsSegment(body, 1_075_000);
    const motionSample = sampleDefenderMotionSegment(segment(), 1_075_000);

    expect(bodySample.tick).toBe(motionSample.tick);
    expect(bodySample.position.x).toBeCloseTo(motionSample.position.x, 12);
    expect(bodySample.position.z).toBeCloseTo(motionSample.position.z, 12);
    expect(bodySample.velocity.x).toBeCloseTo(motionSample.velocity.x, 12);
    expect(bodySample.velocity.z).toBeCloseTo(motionSample.velocity.z, 12);
    expect(bodySample.position.y).toBe(0.95);
    expect(bodySample.velocity.y).toBe(0);
  });

  it('rejects an invalid body-origin height instead of silently inventing geometry', () => {
    expect(() => projectDefenderBodyKinematicsSegment(segment(), -0.1)).toThrow(
      'bodyOriginHeightMeters must be finite and non-negative',
    );
  });

  it('rejects sampling outside the authoritative body segment', () => {
    const body = projectDefenderBodyKinematicsSegment(segment(), 0.95);

    expect(() => sampleDefenderBodyKinematicsSegment(
      body,
      1_100_001,
    )).toThrow('tick must be inside the defender body kinematics segment');
  });
});
