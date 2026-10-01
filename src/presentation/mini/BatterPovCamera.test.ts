import { describe, expect, it } from 'vitest';
import { createBatterPovCamera, projectBatPoseToBatterPov, projectWorldToBatterPov } from './BatterPovCamera';

describe('BatterPovCamera', () => {
  it('mirrors only the batter eye position for right and left hitters', () => {
    const right = createBatterPovCamera('R');
    const left = createBatterPovCamera('L');

    expect(right.eye.x).toBe(-left.eye.x);
    expect(right.eye.y).toBe(left.eye.y);
    expect(right.eye.z).toBe(left.eye.z);
  });

  it('projects mirrored world points symmetrically for mirrored batter eyes', () => {
    const right = projectWorldToBatterPov({ x: 1, y: 1, z: 10 }, 'R');
    const left = projectWorldToBatterPov({ x: -1, y: 1, z: 10 }, 'L');

    expect(right).not.toBeNull();
    expect(left).not.toBeNull();
    expect(right!.x + left!.x).toBe(150);
    expect(right!.y).toBe(left!.y);
  });

  it('uses the same bat projector for a near-horizontal bunt pose', () => {
    const projected = projectBatPoseToBatterPov(
      {
        grip: { x: -0.5, y: 1.0, z: 0.0 },
        tip: { x: 0.5, y: 1.05, z: 0.2 },
      },
      'R',
    );

    expect(projected.grip).not.toBeNull();
    expect(projected.tip).not.toBeNull();
    expect(projected.grip!.x).not.toBe(projected.tip!.x);
  });
});
