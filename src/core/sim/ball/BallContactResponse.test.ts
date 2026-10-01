import { expect, it } from 'vitest';
import { respondToBallContact } from './BallContactResponse';

const ball = { tick: 12, position: { x: 1, y: 2, z: 3 }, velocity: { x: 4, y: -10, z: 6 }, spin: { x: 2, y: 4, z: 6 } };
const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.5 };
it('reflects incoming velocity relative to the actual moving surface and damps tangent/spin', () => {
  expect(respondToBallContact({ ball, surfaceVelocity: { x: 2, y: 1, z: 0 }, normal: { x: 0, y: 2, z: 0 }, material })).toEqual({
    ...ball, velocity: { x: 3.5, y: 6.5, z: 4.5 }, spin: { x: 1, y: 2, z: 3 },
  });
});
it('does not reflect a separating ball back into the surface', () => {
  expect(respondToBallContact({ ball: { ...ball, velocity: { x: 4, y: 10, z: 6 } },
    surfaceVelocity: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, material }).velocity.y).toBe(10);
});
it.each([
  { normal: { x: 0, y: 0, z: 0 } },
  { normal: { x: Infinity, y: 0, z: 0 } },
  { material: { ...material, restitution: 1.1 } },
  { material: { ...material, tangentialDamping: -1 } },
  { material: { ...material, spinDamping: NaN } },
  { surfaceVelocity: { x: NaN, y: 0, z: 0 } },
  { ball: { ...ball, tick: -1 } },
])('rejects invalid actual physical response input %j', (change) => {
  expect(() => respondToBallContact({ ball, surfaceVelocity: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, material, ...change })).toThrow();
});
