import { describe, expect, it } from 'vitest';
import {
  IDENTITY_QUATERNION,
  advanceBaseballOrientation,
  quaternionFromAxisAngle,
  rotateVectorByQuaternion,
} from './BaseballOrientation';

describe('baseball orientation', () => {
  it('rotates a body-space vector into world space', () => {
    const quarterTurn = quaternionFromAxisAngle(
      { x: 0, y: 0, z: 1 },
      Math.PI / 2,
    );
    const rotated = rotateVectorByQuaternion(
      { x: 1, y: 0, z: 0 },
      quarterTurn,
    );

    expect(rotated.x).toBeCloseTo(0, 12);
    expect(rotated.y).toBeCloseTo(1, 12);
    expect(rotated.z).toBeCloseTo(0, 12);
  });

  it('advances seam/material orientation from angular velocity', () => {
    const orientation = advanceBaseballOrientation(
      IDENTITY_QUATERNION,
      { x: 0, y: 0, z: Math.PI },
      0.5,
    );
    const rotated = rotateVectorByQuaternion(
      { x: 1, y: 0, z: 0 },
      orientation,
    );

    expect(rotated.x).toBeCloseTo(0, 12);
    expect(rotated.y).toBeCloseTo(1, 12);
  });

  it('is deterministic', () => {
    const input = quaternionFromAxisAngle(
      { x: 1, y: 2, z: 3 },
      0.7,
    );

    const a = advanceBaseballOrientation(
      input,
      { x: 120, y: -20, z: 35 },
      0.31,
    );
    const b = advanceBaseballOrientation(
      input,
      { x: 120, y: -20, z: 35 },
      0.31,
    );

    expect(a).toEqual(b);
  });
});
