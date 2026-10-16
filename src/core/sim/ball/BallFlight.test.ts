import { describe, expect, it } from 'vitest';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  advanceBallState,
  sampleBallFlight,
} from './BallFlight';

const initial = (overrides: Partial<BattedBallInitialState> = {}): BattedBallInitialState => ({
  tick: 1_463_000,
  position: { x: 0, y: 1, z: 0.42 },
  velocity: { x: 10, y: 5, z: 30 },
  spin: { x: 0, y: 0, z: 0 },
  ...overrides,
});

describe('minimal ball flight', () => {
  it('advances position and applies gravity deterministically', () => {
    const state = initial();
    const a = advanceBallState(state, 100_000, DEFAULT_BALL_FLIGHT_PARAMETERS);
    const b = advanceBallState(state, 100_000, DEFAULT_BALL_FLIGHT_PARAMETERS);

    expect(a).toEqual(b);
    expect(a.tick).toBe(state.tick + 100_000);
    expect(a.position.z).toBeGreaterThan(state.position.z);
    expect(a.velocity.y).toBeLessThan(state.velocity.y);
  });

  it('keeps the ball above the ground and damps horizontal speed on impact', () => {
    const state = initial({
      position: { x: 0, y: 0.04, z: 0 },
      velocity: { x: 8, y: -1, z: 12 },
    });

    const result = advanceBallState(state, 120_000, DEFAULT_BALL_FLIGHT_PARAMETERS);

    expect(result.position.y).toBeGreaterThanOrEqual(DEFAULT_BALL_FLIGHT_PARAMETERS.ballRadius);
    expect(Math.abs(result.velocity.x)).toBeLessThan(8);
    expect(Math.abs(result.velocity.z)).toBeLessThan(12);
  });

  it('samples an exact deterministic sequence at the requested cadence', () => {
    const samples = sampleBallFlight(initial(), 220_000, 55_000, DEFAULT_BALL_FLIGHT_PARAMETERS);
    const repeated = sampleBallFlight(initial(), 220_000, 55_000, DEFAULT_BALL_FLIGHT_PARAMETERS);

    expect(samples.map((sample) => sample.tick)).toEqual([
      1_463_000,
      1_518_000,
      1_573_000,
      1_628_000,
      1_683_000,
    ]);
    expect(samples).toEqual(repeated);
  });
});
