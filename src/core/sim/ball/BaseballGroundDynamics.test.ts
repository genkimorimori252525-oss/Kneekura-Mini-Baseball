import { describe, expect, it } from 'vitest';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import {
  advanceBaseballGroundMotion,
  resolveBaseballGroundImpact,
  type BaseballGroundMaterial,
} from './BaseballGroundDynamics';

// Explicit synthetic materials, not measured stadium coefficients.
const material: BaseballGroundMaterial = {
  restitution: 0.45, slidingFriction: 0.3,
  rollingDecelerationMps2: 0.6, normalSpinDecayPerSecond: 0.4,
};
const parameters = {
  radiusM: 0.0366, inertiaRatio: 0.4, gravityMps2: 9.81,
  ticksPerSecond: 1_000_000, restingVerticalSpeedMps: 0.1, material,
};
const ball = (overrides: Partial<BattedBallInitialState> = {}): BattedBallInitialState => ({
  tick: 0, position: { x: 0, y: parameters.radiusM, z: 0 },
  velocity: { x: 10, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 },
  ...overrides,
});

describe('source-clock ground dynamics', () => {
  it('sliding friction transfers translation into spin and reaches no-slip rolling', () => {
    const result = advanceBaseballGroundMotion(ball(), 1_100_000, parameters);
    expect(result.phase).toBe('rolling');
    expect(result.ball.velocity.x).toBeLessThan(10);
    expect(result.ball.velocity.x).toBeGreaterThan(6);
    expect(result.ball.velocity.x + parameters.radiusM * result.ball.spin.z).toBeCloseTo(0, 10);
    expect(result.ball.spin.z).toBeLessThan(0);
    expect(result.transitions[0]).toMatchObject({ kind: 'rolling_started' });
  });

  it('a spinning ball can move from rest without inventing energy', () => {
    const initial = ball({ velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: -100 } });
    const result = advanceBaseballGroundMotion(initial, 500_000, parameters);
    expect(result.ball.velocity.x).toBeGreaterThan(0);
    const energy = (b: BattedBallInitialState) => b.velocity.x ** 2
      + parameters.inertiaRatio * parameters.radiusM ** 2 * b.spin.z ** 2;
    expect(energy(result.ball)).toBeLessThan(energy(initial));
  });

  it('rolling stops without reversing and its material spin stops with it', () => {
    const initial = ball({ velocity: { x: 1, y: 0, z: 0 }, spin: { x: 0, y: 12, z: -1 / parameters.radiusM } });
    const result = advanceBaseballGroundMotion(initial, 3_000_000, parameters);
    expect(result.phase).toBe('resting');
    expect(result.ball.position.x).toBeCloseTo(1 / (2 * material.rollingDecelerationMps2), 10);
    expect(result.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.ball.spin.x).toBe(0);
    expect(result.ball.spin.z).toBe(0);
    expect(result.ball.spin.y).toBeCloseTo(12 * Math.exp(-1.2), 10);
  });

  it('bounce reflects vertical speed and couples a bounded ground impulse to spin', () => {
    const result = resolveBaseballGroundImpact(ball({ velocity: { x: 10, y: -5, z: 0 } }), parameters);
    expect(result.velocity.y).toBeCloseTo(2.25, 12);
    expect(result.velocity.x).toBeCloseTo(10 - material.slidingFriction * 7.25, 12);
    expect(result.spin.z).toBeLessThan(0);
    expect(result.position.y).toBe(parameters.radiusM);
  });

  it('surface coefficients change actual rebound, sliding and rolling', () => {
    const soft = { ...parameters, material: { ...material, restitution: 0.2, slidingFriction: 0.1, rollingDecelerationMps2: 1.2 } };
    const initial = ball({ velocity: { x: 10, y: -5, z: 0 } });
    expect(resolveBaseballGroundImpact(initial, soft).velocity.y)
      .toBeLessThan(resolveBaseballGroundImpact(initial, parameters).velocity.y);
    expect(advanceBaseballGroundMotion(ball(), 500_000, soft).ball.velocity.x)
      .toBeGreaterThan(advanceBaseballGroundMotion(ball(), 500_000, parameters).ball.velocity.x);
  });

  it('uses the same physical trajectory for fine and coarse observation cadence', () => {
    const initial = ball({ velocity: { x: 6, y: 0, z: 8 }, spin: { x: 8, y: 20, z: -4 } });
    const coarse = advanceBaseballGroundMotion(initial, 4_000_000, parameters).ball;
    let fine = initial;
    for (let tick = 0; tick < 4_000_000; tick += 20_000) {
      fine = advanceBaseballGroundMotion(fine, 20_000, parameters).ball;
    }
    for (const field of ['position', 'velocity', 'spin'] as const) {
      for (const axis of ['x', 'y', 'z'] as const) expect(fine[field][axis]).toBeCloseTo(coarse[field][axis], 8);
    }
  });

  it('rejects airborne input, non-finite parameters and clock overflow', () => {
    expect(() => advanceBaseballGroundMotion(ball({ position: { x: 0, y: 1, z: 0 } }), 1, parameters)).toThrow();
    expect(() => advanceBaseballGroundMotion(ball(), 1, { ...parameters, radiusM: Infinity })).toThrow();
    expect(() => advanceBaseballGroundMotion(ball({ tick: Number.MAX_SAFE_INTEGER }), 1, parameters)).toThrow();
  });
});
