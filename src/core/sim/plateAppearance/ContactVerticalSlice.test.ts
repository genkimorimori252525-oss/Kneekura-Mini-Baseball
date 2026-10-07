import { describe, expect, it } from 'vitest';
import type {
  BaserunnerWorldState,
  DefenderWorldState,
} from '../../model/CanonicalWorldSnapshot';
import type { Vec3 } from '../../model/geometry';
import type { BatterSwingState, PitchWorldState } from '../contact/BatBallContact';
import { simulateContactVerticalSlice } from './ContactVerticalSlice';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const pitch: PitchWorldState = {
  tick: 1_463_000,
  position: v(0, 1, 0.06),
  velocity: v(0, -1.5, -35),
  spin: v(0, 0, 0),
};

const swing = (batSpeedZ: number): BatterSwingState => ({
  pose: {
    grip: v(-0.42, 1, 0),
    tip: v(0.42, 1, 0),
  },
  linearVelocity: v(0, 0, batSpeedZ),
  angularVelocity: v(0, 0, 0),
});

const defenders: readonly DefenderWorldState[] = [
  {
    playerId: 'pitcher',
    registeredPosition: 'P',
    position: { x: 0, z: 18.44 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'first',
    registeredPosition: '1B',
    position: { x: 14, z: 17 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
];

const runners: readonly BaserunnerWorldState[] = [
  {
    playerId: 'runner',
    position: { x: 0, z: 0 },
    velocity: { x: 0, z: 0 },
  },
];

const run = (batSpeedZ: number) => simulateContactVerticalSlice({
  pitch,
  swing: swing(batSpeedZ),
  defenders,
  runners,
  durationTicks: 110_000,
  cadenceTicks: 55_000,
});

const speed = (velocity: Vec3): number => Math.hypot(velocity.x, velocity.y, velocity.z);

describe('simulateContactVerticalSlice', () => {
  it('creates an exact contact snapshot and live BatBallContact event', () => {
    const result = run(22);

    expect(result.snapshots.map((snapshot) => snapshot.tick)).toEqual([
      1_463_000,
      1_518_000,
      1_573_000,
    ]);
    expect(result.snapshots[0]?.ball?.position).toEqual(pitch.position);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      tick: pitch.tick,
      sequence: 0,
      kind: 'BatBallContact',
      payload: {
        liveBattedBall: true,
      },
    });
  });

  it('preserves defender and runner canonical state in this physics-only slice', () => {
    const result = run(22);

    for (const snapshot of result.snapshots) {
      expect(snapshot.defenders).toEqual(defenders);
      expect(snapshot.runners).toEqual(runners);
    }
  });

  it('is deterministic and keeps normal swing faster than a bunt through the public slice', () => {
    const normalA = run(22);
    const normalB = run(22);
    const bunt = run(2);

    expect(normalA).toEqual(normalB);
    expect(speed(normalA.initialBall.velocity)).toBeGreaterThan(speed(bunt.initialBall.velocity));
  });
});
