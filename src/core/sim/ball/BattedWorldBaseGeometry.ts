import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec2 } from '../../model/geometry';
import type { BaseTouchRegion } from '../running/BaseTouch';
import { createFairFoulBaseGateGeometry, type FairFoulBaseGateGeometry } from './FairFoulBaseGateGeometry';
import { createFairTerritoryWedge, classifyPointAgainstFairTerritory, type FairTerritoryWedge } from './FairTerritoryGeometry';

export type BattedWorldBaseId = 'home' | 'first' | 'second' | 'third';
export type BattedWorldBaseSurface = Readonly<{ region: BaseTouchRegion; surfaceHeightMeters: number }>;
export type BattedWorldBaseGeometryInput = Readonly<{ field: FairTerritoryWedge;
  bases: Readonly<Record<BattedWorldBaseId, BattedWorldBaseSurface>> }>;
export type BattedWorldBaseGeometry = BattedWorldBaseGeometryInput & Readonly<{ gates: FairFoulBaseGateGeometry }>;
const fields = (value: unknown, names: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const vector = (v: Vec2) => fields(v, ['x', 'z']) && [v.x, v.z].every(Number.isFinite);
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Explicit physical calibration only: no inferred standard diamond or rule outcome. */
export const createBattedWorldBaseGeometry = (raw: BattedWorldBaseGeometryInput): BattedWorldBaseGeometry => {
  const input = cloneInert(raw);
  if (!fields(input, ['field', 'bases']) || !fields(input.field, ['homePlate', 'firstBaseLineUnit', 'thirdBaseLineUnit'])
    || ![input.field.homePlate, input.field.firstBaseLineUnit, input.field.thirdBaseLineUnit].every(vector)
    || !fields(input.bases, ['home', 'first', 'second', 'third'])) throw new Error('invalid explicit actual base geometry');
  const field = createFairTerritoryWedge(input.field);
  for (const surface of Object.values(input.bases)) {
    const r = surface?.region;
    if (!fields(surface, ['region', 'surfaceHeightMeters']) || !fields(r, ['center', 'halfSize', 'rotationRadians'])
      || !vector(r.center) || !vector(r.halfSize) || r.halfSize.x <= 0 || r.halfSize.z <= 0
      || !Number.isFinite(r.rotationRadians) || !Number.isFinite(surface.surfaceHeightMeters)) throw new Error('invalid actual base surface');
    const extent = Math.hypot(r.halfSize.x, r.halfSize.z);
    if (![extent, r.center.x - extent, r.center.x + extent, r.center.z - extent, r.center.z + extent].every(Number.isFinite)) {
      throw new Error('actual base surface geometry overflow');
    }
  }
  const home = input.bases.home.region.center;
  if (home.x !== field.homePlate.x || home.z !== field.homePlate.z) throw new Error('actual home base and original field differ');
  for (const [base, ray] of [[input.bases.first, field.firstBaseLineUnit], [input.bases.third, field.thirdBaseLineUnit]] as const) {
    const dx = base.region.center.x - home.x, dz = base.region.center.z - home.z, distance = Math.hypot(dx, dz);
    if (!Number.isFinite(distance) || distance <= 0 || Math.abs(dx / distance - ray.x) > 1e-9
      || Math.abs(dz / distance - ray.z) > 1e-9) throw new Error('actual base and original foul line differ');
  }
  const points = Object.values(input.bases).map((base) => ({ x: base.region.center.x - home.x, z: base.region.center.z - home.z }));
  if (points.some((a) => !vector(a) || points.some((b) => !Number.isFinite(a.x * b.z - a.z * b.x)))) {
    throw new Error('actual base gate arithmetic overflow');
  }
  if (classifyPointAgainstFairTerritory(field, input.bases.second.region.center).kind !== 'inside_fair_wedge') {
    throw new Error('actual second base is outside original field');
  }
  const gates = createFairFoulBaseGateGeometry({ homePlate: home, firstBase: input.bases.first.region.center,
    secondBase: input.bases.second.region.center, thirdBase: input.bases.third.region.center });
  return freeze({ field, bases: input.bases, gates });
};
