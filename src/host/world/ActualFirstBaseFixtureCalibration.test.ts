import { expect, it } from 'vitest';
import { firstBaseFixtureFootAcceleration } from './ActualFirstBaseFixtureCalibration.test-support';
it.each([0.24, 0.28])('positions only the explicit synthetic motor at the accepted future target after %s seconds', seconds => {
  const position = { x: -1, y: 0.05, z: 18 }, velocity = { x: 2, y: -0.1, z: 1 }, body = { x: 0.5, y: 0, z: -0.2 };
  const target = { x: 27, y: 0.1, z: 27 }, acceleration = firstBaseFixtureFootAcceleration(position, velocity, body, target, seconds);
  for (const axis of ['x', 'y', 'z'] as const) expect(position[axis] + velocity[axis] * seconds
    + 0.5 * (body[axis] + acceleration[axis]) * seconds ** 2).toBeCloseTo(target[axis], 12);
  expect(position).toEqual({ x: -1, y: 0.05, z: 18 });
});
it.each([0, -1, NaN, Infinity])('refuses invalid fixture timing %s before constructing an accepted input', seconds => {
  const v = { x: 0, y: 0, z: 0 };
  expect(() => firstBaseFixtureFootAcceleration(v, v, v, v, seconds)).toThrow();
});
