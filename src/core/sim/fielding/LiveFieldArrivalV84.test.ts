import { expect, it } from 'vitest';
import { estimateLiveFieldArrivalV84 } from './LiveFieldArrivalV84';
import { liveFieldArrivalSecondsV1 } from './LiveFieldRoleAssignmentV1';
import { createLiveLocomotionProfileV84, liveAccelerationDistanceV84, liveAccelerationTimeV84 } from '../locomotion/LiveLocomotionV84';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const actor = { playerId: 'a', position: v(), velocity: v(), homePosition: v(),
  accelerationMps2: 6, topSpeedMps: 8, throwSpeedMps: 30, remainingReactionSeconds: .2 };

it('uses the live speed bands for first-entry ranking and shares them with role costs', () => {
  const profile = createLiveLocomotionProfileV84(actor), d = liveAccelerationDistanceV84(profile, 0, 8),
    expected = .2 + liveAccelerationTimeV84(profile, 0, 8) + 2;
  expect(estimateLiveFieldArrivalV84(actor, v(d + 16), 0)).toBeCloseTo(expected, 10);
  expect(liveFieldArrivalSecondsV1(actor, v(d + 16), 0)).toBeCloseTo(expected, 10);
  expect(expected).toBeGreaterThan(.2 + 8 / 6 + (d + 16 - 64 / 12) / 8);
});
it('brakes actual backward momentum before accelerating toward the target', () => {
  const backward = { ...actor, velocity: v(-6) }, braking = 10.8, stopDistance = 36 / (2 * braking),
    fromRest = estimateLiveFieldArrivalV84(actor, v(10 + stopDistance), 0);
  expect(estimateLiveFieldArrivalV84(backward, v(10), 0)).toBeCloseTo(6 / braking + fromRest, 10);
  expect(estimateLiveFieldArrivalV84({ ...actor, velocity: v(0, 0, 6) }, v(10), 0))
    .toBeGreaterThan(estimateLiveFieldArrivalV84(actor, v(10), 0));
});
it('keeps zero-distance holds, mirror symmetry and rejects invalid SI input', () => {
  expect(estimateLiveFieldArrivalV84(actor, v(.1), .2)).toBe(0);
  expect(estimateLiveFieldArrivalV84({ ...actor, velocity: v(2, 0, 1) }, v(6, 0, 8), 0))
    .toBeCloseTo(estimateLiveFieldArrivalV84({ ...actor, velocity: v(-2, 0, 1) }, v(-6, 0, 8), 0), 12);
  expect(() => estimateLiveFieldArrivalV84({ ...actor, accelerationMps2: 0 }, v(1), 0)).toThrow();
  expect(() => estimateLiveFieldArrivalV84(actor, v(1), -1)).toThrow();
});
