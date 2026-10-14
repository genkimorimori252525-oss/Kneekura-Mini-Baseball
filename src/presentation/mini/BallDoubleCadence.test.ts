import { describe, expect, it } from 'vitest';
import { buildDoubleRateBallVisualSamples, MINI_BALL_DOUBLE_CADENCE_MICROS } from './BallDoubleCadence';

const world = (tick: number, x: number | null) => ({
  world: { tick, ball: x === null ? null : { position: { x, y: 1, z: 12 } } },
});

describe('Double-rate ball-only presentation', () => {
  it('adds one 27.5ms position between 55ms canonical presentation observations', () => {
    const samples = [world(0, 0), world(55_000, 10), world(110_000, 20)];
    const frames = buildDoubleRateBallVisualSamples(samples, []);
    expect(MINI_BALL_DOUBLE_CADENCE_MICROS).toBe(27_500);
    expect(frames.map(f => f.atMicros)).toEqual([0, 27_500, 55_000, 82_500, 110_000]);
    expect(frames[1].ballPosition).toEqual({ x: 5, y: 1, z: 12 });
    expect(frames[0].ballPosition).toBe(samples[0].world.ball?.position);
  });
  it('does not invent a ball when absent, interpolate missing samples or cross actual contact', () => {
    const gap = buildDoubleRateBallVisualSamples([world(0, 0), world(55_000, null), world(110_000, 5)], []);
    expect(gap.every(f => !f.interpolated)).toBe(true);
    const missing = buildDoubleRateBallVisualSamples([world(0, 0), world(110_000, 5)], []);
    expect(missing.every(f => !f.interpolated)).toBe(true);
    const events = [{ tick: 55_000, sequence: 0, kind: 'BatBallContact', payload: { liveBattedBall: true } }];
    expect(buildDoubleRateBallVisualSamples([world(0, 0), world(55_000, 10), world(110_000, 20)], events)
      .map(f => f.atMicros)).toEqual([0, 55_000, 82_500, 110_000]);
  });
  it('never mutates authority and rejects invalid order', () => {
    const inputs = [world(0, 0), world(55_000, 10)];
    const before = JSON.stringify(inputs);
    buildDoubleRateBallVisualSamples(inputs, []);
    expect(JSON.stringify(inputs)).toBe(before);
    expect(() => buildDoubleRateBallVisualSamples([world(0, 0), world(0, 2)], []))
      .toThrow('strictly increase');
  });
});
