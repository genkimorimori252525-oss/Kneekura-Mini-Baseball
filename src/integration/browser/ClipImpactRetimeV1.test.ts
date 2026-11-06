import { describe, expect, it } from 'vitest';
import { extendHandsAfterContactV1, holdSweetSpotAfterContactV1, retimeClipAfterContactV1 } from './ClipImpactRetimeV1';

// A bat turning about a fixed grip: 0.1 rad per 2,800-tick key before the contact at tick 28,000, a third slower after it.
const frames = Array.from({ length: 21 }, (_, i) => {
  const angle = i <= 10 ? i * .1 : 1 + (i - 10) * .1 * 2 / 3;
  return { tick: i * 2800, grip: { x: 0, y: 1, z: 0 }, orientation: { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) } };
});

describe('retimeClipAfterContactV1', () => {
  it('keeps every pose and the timing up to the contact', () => {
    const out = retimeClipAfterContactV1(frames, 28000, .7, .05);
    expect(out.map(f => f.orientation)).toEqual(frames.map(f => f.orientation));
    expect(out.slice(0, 11).map(f => f.tick)).toEqual(frames.slice(0, 11).map(f => f.tick));
  });
  it('leaves the contact pose at the contact speed and returns to the clip speed after the window', () => {
    const out = retimeClipAfterContactV1(frames, 28000, .7, .02);
    expect(out[11].tick - out[10].tick).toBeCloseTo(2800 * 2 / 3, -2);
    expect(out[20].tick - out[19].tick).toBe(2800);
    for (let i = 1; i < out.length; i++) expect(out[i].tick).toBeGreaterThan(out[i - 1].tick);
  });
  it('rejects a window outside 0.01..0.3 s', () => {
    expect(() => retimeClipAfterContactV1(frames, 28000, .7, .5)).toThrow();
  });
});

describe('extendHandsAfterContactV1', () => {
  // Hands drawing back sideways at 1 m/s (x) after the contact at tick 28,000.
  const moving = frames.map((f, i) => ({ ...f, grip: { x: i > 10 ? -(i - 10) * .0028 : 0, y: 1, z: 0 } }));
  it('keeps everything up to the contact and every orientation and time', () => {
    const out = extendHandsAfterContactV1(moving, 28000, 0, 3, .02);
    expect(out.slice(0, 11)).toEqual(moving.slice(0, 11));
    expect(out.map(f => f.tick)).toEqual(moving.map(f => f.tick));
    expect(out.map(f => f.orientation)).toEqual(moving.map(f => f.orientation));
  });
  it('cancels the sideways motion and moves the hands toward the pitcher inside the window', () => {
    const out = extendHandsAfterContactV1(moving, 28000, 0, 3, .02);
    expect(out[14].grip.x).toBeCloseTo(0, 9);
    expect(out[14].grip.z).toBeCloseTo(3 * .0112, 9);
  });
  it('turns the bat at the kept share inside the window and catches up after the return', () => {
    const out = extendHandsAfterContactV1(moving, 28000, 1, 0, .02, .005, 1e6, .5);
    for (const k of ['w', 'x', 'y', 'z'] as const) expect(out[12].orientation[k]).toBeCloseTo(moving[11].orientation[k], 9);
    expect(out[11].orientation).not.toEqual(moving[11].orientation);
    expect(out[20].orientation).toEqual(moving[20].orientation);
  });
  it('returns to the measured follow-through after the return time', () => {
    const out = extendHandsAfterContactV1(moving, 28000, 0, 3, .02, .005);
    expect(out[20].grip).toEqual(moving[20].grip);
  });
});

describe('holdSweetSpotAfterContactV1', () => {
  const r = .7, sweetOf = (f: typeof frames[number]) => {
    const q = f.orientation, ax = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
    return { x: f.grip.x + ax.x * r, y: f.grip.y + ax.y * r, z: f.grip.z + ax.z * r };
  };
  it('carries the sweet spot straight on at the contact velocity inside the window, turning about it', () => {
    const out = holdSweetSpotAfterContactV1(frames, 28000, r, .016, .01);
    expect(out.slice(0, 11)).toEqual(frames.slice(0, 11));
    expect(out.map(f => f.orientation)).toEqual(frames.map(f => f.orientation));
    const s0 = sweetOf(frames[10]), sb = sweetOf(frames[9]), dt = .0028;
    for (const i of [11, 12, 13, 14, 15]) {
      const tau = (frames[i].tick - frames[10].tick) / 1e6, s = sweetOf(out[i]);
      expect(s.x).toBeCloseTo(s0.x + (s0.x - sb.x) / dt * tau, 6);
      expect(s.y).toBeCloseTo(s0.y + (s0.y - sb.y) / dt * tau, 6);
    }
  });
  it('returns to the measured grip after the window and the return', () => {
    const out = holdSweetSpotAfterContactV1(frames, 28000, r, .016, .01);
    expect(out[20].grip).toEqual(frames[20].grip);
  });
});
