import { expect, it } from 'vitest';
import { hasUnmodeledObservationSurface } from './ActualObservationSurfaceGuard';

const a = { x: -2, y: 1, z: 0 }, b = { x: 2, y: 1, z: 0 };
const wall = { surfaceId: 'owned-wall', start: { x: 0, z: -1 }, end: { x: 0, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
const bag = { region: { center: { x: 0, z: 0 }, halfSize: { x: 0.5, z: 0.5 }, rotationRadians: Math.PI / 4 }, bottomY: 0, topY: 2 };

it('reports owned wall crossings, endpoints and coplanar overlap as optically unavailable', () => {
  expect(hasUnmodeledObservationSurface(a, b, [wall], [])).toBe(true);
  expect(hasUnmodeledObservationSurface(a, { x: 0, y: 1, z: 0 }, [wall], [])).toBe(true);
  expect(hasUnmodeledObservationSurface({ ...a, z: 1 }, { ...b, z: 1 }, [wall], [])).toBe(true);
  expect(hasUnmodeledObservationSurface({ ...a, y: 2 }, { ...b, y: 2 }, [wall], [])).toBe(true);
  expect(hasUnmodeledObservationSurface({ x: 0, y: 1, z: -2 }, { x: 0, y: 1, z: 2 }, [wall], [])).toBe(true);
});
it('does not obstruct sightlines above or beyond finite wall extents', () => {
  expect(hasUnmodeledObservationSurface({ ...a, y: 3 }, { ...b, y: 3 }, [wall], [])).toBe(false);
  expect(hasUnmodeledObservationSurface({ ...a, z: 2 }, { ...b, z: 2 }, [wall], [])).toBe(false);
});
it('checks rotated base prisms and starting inside a prism without inventing opacity', () => {
  expect(hasUnmodeledObservationSurface(a, b, [], [bag])).toBe(true);
  expect(hasUnmodeledObservationSurface({ x: 0, y: 1, z: 0 }, b, [], [bag])).toBe(true);
  expect(hasUnmodeledObservationSurface({ ...a, y: 3 }, { ...b, y: 3 }, [], [bag])).toBe(false);
  expect(hasUnmodeledObservationSurface({ ...a, y: 2 }, { ...b, y: 2 }, [], [bag])).toBe(true);
  expect(hasUnmodeledObservationSurface({ ...a, z: 2 }, { ...b, z: 2 }, [], [bag])).toBe(false);
});
it('rejects below-ground sensing instead of seeing through the playing surface', () => {
  expect(hasUnmodeledObservationSurface({ ...a, y: -1 }, b, [], [])).toBe(true);
  expect(hasUnmodeledObservationSurface(a, { ...b, y: 0 }, [], [])).toBe(true);
  expect(hasUnmodeledObservationSurface(a, b, [], [])).toBe(false);
});
