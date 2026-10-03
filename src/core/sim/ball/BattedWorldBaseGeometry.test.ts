import { expect, it } from 'vitest';
import { createBattedWorldBaseGeometry } from './BattedWorldBaseGeometry';

const model = () => ({ field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
  thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } }, bases: {
  home: { region: { center: { x: 0, z: 0 }, halfSize: { x: 0.3, z: 0.2 }, rotationRadians: 0.1 }, surfaceHeightMeters: 0 },
  first: { region: { center: { x: 20, z: 20 }, halfSize: { x: 0.2, z: 0.21 }, rotationRadians: 0.4 }, surfaceHeightMeters: 0.03 },
  second: { region: { center: { x: 0, z: 40 }, halfSize: { x: 0.24, z: 0.22 }, rotationRadians: 0.2 }, surfaceHeightMeters: 0.05 },
  third: { region: { center: { x: -20, z: 20 }, halfSize: { x: 0.19, z: 0.23 }, rotationRadians: 0.7 }, surfaceHeightMeters: 0.01 } } });
it('preserves explicit actual regions and derives gates without filling dimensions', () => {
  const source = model(), result = createBattedWorldBaseGeometry(source);
  expect(result.bases).toEqual(source.bases);
  expect(result.gates).toEqual({ homePlate: source.field.homePlate, firstBase: source.bases.first.region.center,
    secondBase: source.bases.second.region.center, thirdBase: source.bases.third.region.center });
  expect(Object.isFrozen(result.bases.first.region.center)).toBe(true);
  source.bases.first.region.center.x = 21; expect(result.bases.first.region.center.x).toBe(20);
});
it('supports translated and rotated real field coordinates', () => {
  const source = model(), angle = 0.6, rotate = ({ x, z }: { x: number; z: number }) => ({ x: x * Math.cos(angle) - z * Math.sin(angle), z: x * Math.sin(angle) + z * Math.cos(angle) });
  const point = (v: { x: number; z: number }) => { const p = rotate(v); return { x: p.x + 103, z: p.z - 71 }; };
  const changed = { field: { homePlate: point(source.field.homePlate), firstBaseLineUnit: rotate(source.field.firstBaseLineUnit),
    thirdBaseLineUnit: rotate(source.field.thirdBaseLineUnit) }, bases: Object.fromEntries(Object.entries(source.bases).map(([id, base]) => [id,
      { ...base, region: { ...base.region, center: point(base.region.center), rotationRadians: base.region.rotationRadians + angle } }])) };
  expect(createBattedWorldBaseGeometry(changed as typeof source).bases.first.region.center).toEqual(point(source.bases.first.region.center));
});
it.each(['missing', 'extra', 'home', 'line', 'behind', 'second', 'half', 'height', 'rotation', 'overflow'] as const)('rejects invalid %s geometry', (kind) => {
  const source = model();
  if (kind === 'missing') delete (source.bases as Partial<typeof source.bases>).third;
  if (kind === 'extra') Object.assign(source.bases, { other: source.bases.home });
  if (kind === 'home') source.bases.home.region.center.x = 1;
  if (kind === 'line') source.bases.first.region.center.x = 19;
  if (kind === 'behind') source.bases.first.region.center = { x: -20, z: -20 };
  if (kind === 'second') source.bases.second.region.center = { x: 80, z: 0 };
  if (kind === 'half') source.bases.first.region.halfSize.x = 0;
  if (kind === 'height') source.bases.first.surfaceHeightMeters = NaN;
  if (kind === 'rotation') source.bases.first.region.rotationRadians = Infinity;
  if (kind === 'overflow') source.bases.second.region.center = { x: 0, z: Number.MAX_VALUE };
  expect(() => createBattedWorldBaseGeometry(source)).toThrow();
});
