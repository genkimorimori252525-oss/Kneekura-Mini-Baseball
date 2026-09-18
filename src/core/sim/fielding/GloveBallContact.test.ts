import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import {
  findAcceleratedGloveBallContactTick,
  findGloveBallContactTick,
  type GloveBallContactParameters,
  type GloveWorldState,
  type LiveBallState,
} from './GloveBallContact';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const parameters: GloveBallContactParameters = {
  ticksPerSecond: 1_000_000,
  ballRadius: 0.0366,
  gloveContactRadius: 0.0334,
};

const ball = (overrides: Partial<LiveBallState> = {}): LiveBallState => ({
  tick: 2_000_000,
  position: v(0, 1.2, 0.2),
  velocity: v(0, 0, -60),
  spin: v(0, 0, 0),
  ...overrides,
});

const glove = (overrides: Partial<GloveWorldState> = {}): GloveWorldState => ({
  tick: 2_000_000,
  position: v(0, 1.2, 0),
  velocity: v(0, 0, 0),
  ...overrides,
});

describe('findGloveBallContactTick', () => {
  it('finds contact that begins and ends inside one coarse interval', () => {
    const contactTick = findGloveBallContactTick(
      ball(),
      glove(),
      5_000,
      parameters,
    );

    expect(contactTick).toBe(2_002_167);
  });

  it('includes glove motion in the authoritative contact time', () => {
    const contactTick = findGloveBallContactTick(
      ball({ velocity: v(0, 0, -35) }),
      glove({ velocity: v(0, 0, 16) }),
      5_000,
      parameters,
    );

    expect(contactTick).toBe(2_002_550);
  });

  it('returns null when the moving ball cannot reach the glove in the interval', () => {
    const contactTick = findGloveBallContactTick(
      ball({ position: v(0.4, 1.2, 0.2) }),
      glove(),
      5_000,
      parameters,
    );

    expect(contactTick).toBeNull();
  });
});


describe('findAcceleratedGloveBallContactTick', () => {
  it('matches the existing glove contact time when both accelerations are zero', () => {
    const existing = findGloveBallContactTick(
      ball(),
      glove(),
      5_000,
      parameters,
    );
    const accelerated = findAcceleratedGloveBallContactTick(
      ball(),
      v(0, 0, 0),
      glove(),
      v(0, 0, 0),
      5_000,
      parameters,
    );

    expect(accelerated).toBe(existing);
  });

  it('accounts for ball gravity in the physical contact time', () => {
    const contactTick = findAcceleratedGloveBallContactTick(
      ball({
        position: v(0, 1.2, 0),
        velocity: v(0, 0, 0),
      }),
      v(0, -9.81, 0),
      glove({
        position: v(0, 1, 0),
        velocity: v(0, 0, 0),
      }),
      v(0, 0, 0),
      200_000,
      parameters,
    );

    expect(contactTick).toBe(2_162_800);
  });

  it('accounts for an accelerating glove without converting contact into possession', () => {
    const contactTick = findAcceleratedGloveBallContactTick(
      ball({
        position: v(0, 1.2, 0.2),
        velocity: v(0, 0, -20),
      }),
      v(0, 0, 0),
      glove({
        position: v(0, 1.2, 0),
        velocity: v(0, 0, 0),
      }),
      v(0, 0, 2_000),
      10_000,
      parameters,
    );

    expect(contactTick).toBe(2_005_166);
  });
});
