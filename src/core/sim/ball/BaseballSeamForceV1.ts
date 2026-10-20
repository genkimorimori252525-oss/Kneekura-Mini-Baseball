import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { normalizeQuaternion, rotateVectorByQuaternion, type Quaternion } from '../pitching/BaseballOrientation';

/** Authored quasi-steady mean-force approximation, not fitted CFD or a measured ball. */
export type BaseballSeamForceV1 = Readonly<{ version: 'baseball_seam_force_v1'; coefficientScale: number }>;
export const BASEBALL_SEAM_MAX_COEFFICIENT_V1 = .25;
/** Conservative derivative bound of the dimensionless direction map on the unit sphere. */
export const BASEBALL_SEAM_DIRECTION_LIPSCHITZ_V1 = 96;
export function validateBaseballSeamForceV1(raw: unknown): BaseballSeamForceV1 {
  const value = cloneInert(raw) as BaseballSeamForceV1;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== 'coefficientScale|version' || value.version !== 'baseball_seam_force_v1'
    || typeof value.coefficientScale !== 'number' || !Number.isFinite(value.coefficientScale) || value.coefficientScale < 0 || value.coefficientScale > 2)
    throw new Error('baseball seam force: invalid version or coefficient scale');
  return Object.freeze(value);
}
export function validateBaseballMaterialOrientationV1(raw: unknown): Quaternion {
  if (raw === undefined) throw new Error('baseball seam force: explicit finite material orientation required');
  const q = cloneInert(raw) as Quaternion;
  if (!q || typeof q !== 'object' || Array.isArray(q) || Object.keys(q).sort().join('|') !== 'w|x|y|z'
    || !Object.values(q).every(v => typeof v === 'number' && Number.isFinite(v)))
    throw new Error('baseball seam force: explicit finite material orientation required');
  return normalizeQuaternion(q);
}
/** q and -q declare the same material rotation; allow only roundoff at joins. */
export function sameBaseballMaterialOrientationV1(a: Quaternion, b: Quaternion): boolean {
  const qa = validateBaseballMaterialOrientationV1(a), qb = validateBaseballMaterialOrientationV1(b);
  return Math.min(Math.hypot(qa.w - qb.w, qa.x - qb.x, qa.y - qb.y, qa.z - qb.z),
    Math.hypot(qa.w + qb.w, qa.x + qb.x, qa.y + qb.y, qa.z + qb.z)) <= 1e-10;
}
/** Same material curve and axes as BallSurface.seamAt in the approved renderer.
 * A display geometry is reused as an authored seam geometry, not certified dimensions. */
export const baseballSeamPointV1 = (t: number): Vec3 => ({ x: .75 * Math.cos(t) + .25 * Math.cos(3 * t),
  y: .75 * Math.sin(t) - .25 * Math.sin(3 * t), z: Math.sqrt(.75) * Math.sin(2 * t) });
const seams = Array.from({ length: 48 }, (_, i) => baseballSeamPointV1((i + .5) / 48 * 2 * Math.PI));
/** Transverse coefficient only. Front-side trip and near-equator spoiler windows
 * are smooth authored surrogates for measured seam-dependent separation. Their
 * centers/widths/gain are uncalibrated. No RPM cutoff removes high-spin SSW. */
export function calculateBaseballSeamCoefficientV1(direction: Vec3, orientation: Quaternion, profile: BaseballSeamForceV1): Vec3 {
  validateBaseballSeamForceV1(profile);
  if (![direction.x, direction.y, direction.z].every(Number.isFinite) || Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) > 1e-10)
    throw new Error('baseball seam force: finite unit air direction required');
  const q = validateBaseballMaterialOrientationV1(orientation), inverse = { w: q.w, x: -q.x, y: -q.y, z: -q.z },
    n = rotateVectorByQuaternion(direction, inverse);
  let gx = 0, gy = 0, gz = 0;
  for (const s of seams) {
    const mu = s.x * n.x + s.y * n.y + s.z * n.z,
      weight = Math.exp(-(((mu - .55) / .25) ** 2)) - .7 * Math.exp(-(((mu - .05) / .18) ** 2));
    gx += weight * (s.x - mu * n.x); gy += weight * (s.y - mu * n.y); gz += weight * (s.z - mu * n.z);
  }
  // Gain8/48 and soft norm saturation give a smooth map with |C| <= .25*scale.
  const gain = 8 / seams.length, length = Math.hypot(gx * gain, gy * gain, gz * gain),
    scale = BASEBALL_SEAM_MAX_COEFFICIENT_V1 * profile.coefficientScale * gain / Math.sqrt(1 + length * length);
  const world = rotateVectorByQuaternion({ x: gx * scale, y: gy * scale, z: gz * scale }, q),
    residual = world.x * direction.x + world.y * direction.y + world.z * direction.z;
  return { x: world.x - residual * direction.x, y: world.y - residual * direction.y, z: world.z - residual * direction.z };
}
