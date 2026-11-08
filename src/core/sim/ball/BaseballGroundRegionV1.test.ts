import { describe, expect, it } from 'vitest';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import {
  advanceBaseballGroundMotion,
  resolveBaseballGroundImpact,
  sampleBaseballGroundMotionAtElapsedSeconds,
  type BaseballGroundMaterial,
} from './BaseballGroundDynamics';

// Explicit synthetic materials, not measured stadium coefficients.
const dirt: BaseballGroundMaterial = { restitution: 0.45, slidingFriction: 0.3, rollingDecelerationMps2: 2, normalSpinDecayPerSecond: 0.4 };
const grass: BaseballGroundMaterial = { ...dirt, restitution: 0.3, rollingDecelerationMps2: 8 };
const oneFloor = { radiusM: 0.0366, inertiaRatio: 0.4, gravityMps2: 9.81, ticksPerSecond: 1_000_000, restingVerticalSpeedMps: 0.1, material: dirt };
const arc = { centerX: 0, centerZ: 0, radiusM: 20 };
const twoFloors = { ...oneFloor, grassBeyondV1: { ...arc, material: grass } };
const rolling = (z: number, speed: number): BattedBallInitialState => ({
  tick: 0, position: { x: 0, y: oneFloor.radiusM, z }, velocity: { x: 0, y: 0, z: speed }, spin: { x: speed / oneFloor.radiusM, y: 0, z: 0 },
});

describe('ground regions', () => {
  it('moves exactly as one floor while the ball stays inside the arc', () => {
    const start = rolling(0, 6);
    const one = advanceBaseballGroundMotion(start, 5_000_000, oneFloor), two = advanceBaseballGroundMotion(start, 5_000_000, twoFloors);
    expect(one.ball.position.z).toBeLessThan(arc.radiusM);
    expect(two).toEqual(one);
  });

  it('switches to the grass rolling deceleration where the ball crosses the arc', () => {
    const start = rolling(0, 20), dirtStop = 20 ** 2 / (2 * dirt.rollingDecelerationMps2);
    const rest = advanceBaseballGroundMotion(start, 30_000_000, twoFloors);
    // Over the first 20 m on dirt it keeps v^2 = 400 - 2*2*20 = 320, then grass stops it in 320 / 16 = 20 m more.
    expect(rest.phase).toBe('resting');
    expect(rest.ball.position.z).toBeCloseTo(40, 6);
    expect(rest.ball.position.z).toBeLessThan(dirtStop);
    expect(rest.transitions.at(-1)).toMatchObject({ kind: 'rolling_stopped' });
    expect(rest.transitions.at(-1)!.elapsedSeconds).toBeCloseTo((20 - Math.sqrt(320)) / 2 + Math.sqrt(320) / 8, 6);
  });

  it('gives the same state whichever instants a caller samples', () => {
    const start = rolling(0, 20), at = (t: number) => sampleBaseballGroundMotionAtElapsedSeconds(start, t, twoFloors).ball.position.z;
    const fresh = sampleBaseballGroundMotionAtElapsedSeconds({ ...start }, 2.5, twoFloors).ball.position.z;
    expect([at(0.5), at(2.5), at(1.2)][1]).toBe(fresh);
    expect(at(0.5)).toBeLessThan(at(1.2));
  });

  it('bounces off the floor under the ball', () => {
    const falling = (z: number): BattedBallInitialState => ({
      tick: 0, position: { x: 0, y: oneFloor.radiusM, z }, velocity: { x: 0, y: -10, z: 0 }, spin: { x: 0, y: 0, z: 0 } });
    expect(resolveBaseballGroundImpact(falling(10), twoFloors).velocity.y).toBeCloseTo(4.5, 10);
    expect(resolveBaseballGroundImpact(falling(30), twoFloors).velocity.y).toBeCloseTo(3, 10);
  });
});
