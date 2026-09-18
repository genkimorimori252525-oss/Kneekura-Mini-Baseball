import { describe, expect, it } from 'vitest';
import {
  projectDefenderWorldState,
} from './DefenderWorldProjection';

describe('DefenderWorldProjection', () => {
  it('projects physical defender motion into canonical world state', () => {
    expect(projectDefenderWorldState(
      'pitcher',
      'P',
      {
        tick: 1_500_000,
        position: { x: 0.1568, z: 0 },
        velocity: { x: 1.12, z: 0 },
      },
      { kind: 'base_cover', base: 1 },
    )).toEqual({
      playerId: 'pitcher',
      registeredPosition: 'P',
      position: { x: 0.1568, z: 0 },
      velocity: { x: 1.12, z: 0 },
      assignment: { kind: 'base_cover', base: 1 },
    });
  });

  it('preserves a locally selected ball-handler assignment', () => {
    expect(projectDefenderWorldState(
      'shortstop',
      'SS',
      {
        tick: 2_000_000,
        position: { x: 13, z: 17 },
        velocity: { x: -2, z: 3 },
      },
      { kind: 'ball_handler' },
    ).assignment).toEqual({ kind: 'ball_handler' });
  });

  it('normalizes negative zero at the canonical boundary', () => {
    const projected = projectDefenderWorldState(
      'center',
      'CF',
      {
        tick: 2_000_000,
        position: { x: -0, z: 33 },
        velocity: { x: 0, z: -0 },
      },
      { kind: 'hold' },
    );

    expect(Object.is(projected.position.x, -0)).toBe(false);
    expect(Object.is(projected.velocity.z, -0)).toBe(false);
    expect(projected.position.x).toBe(0);
    expect(projected.velocity.z).toBe(0);
  });
});
