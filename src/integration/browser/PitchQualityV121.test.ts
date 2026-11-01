import { expect, it } from 'vitest';
import { observePitchQualityV121 } from './PitchQualityV121';

const release = { position: { x: 0, y: 2, z: 16 }, velocity: { x: 0, y: 0, z: -40 }, spin: { x: 100, y: 0, z: 100 } };
it('derives active spin from air-relative velocity without changing the stored spin', () => {
  const before = JSON.stringify(release), result = observePitchQualityV121({ release, plate: { ...release, velocity: { x: 0, y: 0, z: -35 } },
    windVelocityMps: { x: 0, y: 0, z: 0 }, gravityY: -10, measurementPlaneZ: 0 });
  expect(result.release.activeSpinFraction).toBeCloseTo(Math.SQRT1_2, 12);
  expect(result.release.activeSpinRpm).toBeCloseTo(100 * 60 / (2 * Math.PI), 10);
  expect(result.releaseToPlateSpeedLossKmh).toBeCloseTo(18, 12);
  expect(JSON.stringify(release)).toBe(before);
});

it('uses an airless gravity-only trajectory at the same plane and keeps it distinct from the legacy zero-spin comparison', () => {
  const plate = { ...release, position: { x: .1, y: 1.3, z: 0 } }, result = observePitchQualityV121({ release, plate,
    windVelocityMps: { x: 0, y: 0, z: 0 }, gravityY: -10, measurementPlaneZ: 0 });
  expect(result.gravityOnly.flightSeconds).toBe(.4);
  expect(result.gravityOnly.platePosition.y).toBeCloseTo(1.2, 12);
  expect(result.gravityOnly.horizontalDifferenceCm).toBeCloseTo(10, 12);
  expect(result.gravityOnly.verticalDifferenceCm).toBeCloseTo(10, 12);
  expect(result.gravityOnly.basis).toBe('SAME_RELEASE_AIRLESS_GRAVITY_ONLY_SAME_PLANE');
});

it('recognizes pure gyro relative to the actual air direction and rejects invalid observations', () => {
  const gyro = { ...release, velocity: { x: 4, y: 0, z: -40 }, spin: { x: 0, y: 0, z: 100 } },
    request = { release: gyro, plate: gyro, windVelocityMps: { x: 4, y: 0, z: 0 }, gravityY: -10, measurementPlaneZ: 0 };
  expect(observePitchQualityV121(request).release.activeSpinRpm).toBe(0);
  expect(() => observePitchQualityV121({ ...request, gravityY: NaN })).toThrow();
});
