import { describe, expect, it } from 'vitest';
import { retimeClipAfterContactV1 } from './ClipImpactRetimeV1';

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
