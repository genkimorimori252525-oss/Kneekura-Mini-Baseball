import type { Vec2, Vec3 } from '../../model/geometry';
import type { SourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import type { StrikeZoneRegion } from './TakenPitchPhysicalResult';

/** Separate from the frozen four-key Native StrikeZoneRegion Source. +z is
 * toward the pitcher; the plate's rear tip is the field origin. */
export type StrikeZoneVolumeV94 = Readonly<{
  version: 94;
  platePolygon: readonly Vec2[];
  lowerY: number;
  upperY: number;
}>;
export type ContinuousContactSearchV94 = Readonly<{ kind: 'hit'; from: number; at: number }>
  | Readonly<{ kind: 'unresolved'; from: number; through: number }> | null;

export function createStrikeZoneVolumeV94(region: StrikeZoneRegion): StrikeZoneVolumeV94 {
  if (!Object.values(region).every(Number.isFinite) || region.halfWidth <= 0 || region.upperY <= region.lowerY)
    throw Error('invalid V94 strike-zone region');
  const x = region.centerX, w = region.halfWidth;
  return { version: 94, platePolygon: [{ x, z: 0 }, { x: x + w, z: w }, { x: x + w, z: 2 * w },
    { x: x - w, z: 2 * w }, { x: x - w, z: w }], lowerY: region.lowerY, upperY: region.upperY };
}

function validateVolume(volume: StrikeZoneVolumeV94): void {
  const points = volume.platePolygon;
  if (volume.version !== 94 || !Array.isArray(points) || points.length !== 5
    || !points.every(p => Number.isFinite(p.x) && Number.isFinite(p.z))
    || !Number.isFinite(volume.lowerY) || !Number.isFinite(volume.upperY) || volume.upperY <= volume.lowerY)
    throw Error('invalid V94 strike-zone volume');
  // The admitted footprint must be a strictly convex, counterclockwise plate.
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    if ((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x) <= 0)
      throw Error('invalid V94 convex plate footprint');
  }
}

function distanceToVolume(point: Vec3, volume: StrikeZoneVolumeV94): number {
  let inside = true, closestSquared = Infinity;
  const polygon = volume.platePolygon;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dz = b.z - a.z,
      px = point.x - a.x, pz = point.z - a.z;
    if (dx * pz - dz * px < 0) inside = false;
    const t = Math.max(0, Math.min(1, (px * dx + pz * dz) / (dx * dx + dz * dz)));
    closestSquared = Math.min(closestSquared, (px - t * dx) ** 2 + (pz - t * dz) ** 2);
  }
  const vertical = Math.max(volume.lowerY - point.y, point.y - volume.upperY, 0);
  return Math.sqrt((inside ? 0 : closestSquared) + vertical * vertical);
}

/** Euclidean distance to the actual prism, including diagonal and 3D corners. */
export function distanceToStrikeZoneVolumeV94(point: Vec3, volume: StrikeZoneVolumeV94): number {
  validateVolume(volume);
  if (![point.x, point.y, point.z].every(Number.isFinite)) throw Error('invalid V94 zone query point');
  return distanceToVolume(point, volume);
}

/** Existing live collision algorithm, shared by bat/glove and the new static
 * prism. A 1-Lipschitz distance plus original Source speed/rounding bounds
 * excludes intervals without replacing the Source or using render samples. */
export function findFirstSourceContactV94(kernel: SourceFreeBallKernel, gap: (seconds: number) => number,
  colliderSpeed: number, through: number, retainBudgetBoundary = false): ContinuousContactSearchV94 {
  let budget = 200000;
  const search = (lo: number, hi: number, speed: number, rounding: number, depth = 0): ContinuousContactSearchV94 => {
    if (--budget < 0) {
      if (retainBudgetBoundary) return { kind: 'unresolved', from: lo, through: hi };
      throw Error('live pitch: continuous collision proof budget exhausted');
    }
    const a = gap(lo), b = gap(hi);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw Error('live pitch: nonfinite collision gap');
    if (a <= 0) return { kind: 'hit', from: lo, at: lo };
    if (Math.min(a, b) > speed * (hi - lo) + rounding) return null;
    const mid = (lo + hi) / 2;
    if (depth === 60 || mid === lo || mid === hi || hi - lo <= 1e-15)
      return b <= 0 ? { kind: 'hit', from: lo, at: hi } : { kind: 'unresolved', from: lo, through: hi };
    const left = search(lo, mid, speed, rounding, depth + 1);
    if (left?.kind === 'hit' || left && mid - left.from > 1e-12) return left;
    const right = search(mid, hi, speed, rounding, depth + 1);
    if (!left) return right;
    if (right?.kind === 'hit' && right.at - left.from <= 1e-12) return { ...right, from: left.from };
    return right?.kind === 'unresolved' ? { kind: 'unresolved', from: left.from, through: right.through } : left;
  };
  for (const cell of kernel.cells) {
    const lo = cell.fromElapsedSeconds, hi = Math.min(through, cell.throughElapsedSeconds);
    if (hi <= lo) continue;
    const result = search(lo, hi, cell.maximumPositionSpeedMps + colliderSpeed, cell.positionRoundingBoundMeters + 128 * Number.EPSILON);
    if (result) return result;
  }
  return null;
}

export function findSourceStrikeZoneContactV94(input: Readonly<{ kernel: SourceFreeBallKernel; volume: StrikeZoneVolumeV94;
  ballRadiusMeters: number; throughElapsedSeconds: number }>) {
  validateVolume(input.volume);
  if (!Number.isFinite(input.ballRadiusMeters) || input.ballRadiusMeters <= 0 || !Number.isFinite(input.throughElapsedSeconds) || input.throughElapsedSeconds < 0)
    throw Error('invalid V94 zone contact interval or ball radius');
  const groundAt = input.kernel.boundaries.find(boundary => boundary.kind === 'ground')?.elapsedSeconds ?? Infinity,
    through = Math.min(input.throughElapsedSeconds, groundAt), firstCell = input.kernel.cells[0];
  if (!firstCell || input.kernel.evaluateAt(firstCell.fromElapsedSeconds, 'incoming').phase !== 'airborne') return null;
  const gap = (seconds: number) => distanceToVolume(input.kernel.evaluateAt(seconds, 'incoming').moment.ball.position, input.volume) - input.ballRadiusMeters,
    witness = (from: number, at: number) => ({ kind: 'hit' as const, from, at, position: input.kernel.evaluateAt(at, 'incoming').moment.ball.position,
      timingBasis: 'CERTIFIED_SOURCE_CONTACT_WITNESS_NOT_EARLIEST_CONTACT_TIME' as const });
  // A strike needs the existence of a contact, not a certified earliest impact
  // time. An exact face/corner tangent can have a rounding-uncertain approach
  // interval yet a definite later contact. Accept that actual Source witness;
  // absence of these witnesses still requires the continuous exclusion search.
  for (const cell of input.kernel.cells) {
    const lo = cell.fromElapsedSeconds, hi = Math.min(cell.throughElapsedSeconds, through);
    if (hi < lo) break;
    for (const at of [lo, (lo + hi) / 2, hi]) if (at < groundAt && gap(at) <= 0) return witness(at, at);
    if (hi === through) break;
  }
  const result = findFirstSourceContactV94(input.kernel, gap, 0, through, true);
  if (result?.kind === 'hit') return result.at >= groundAt ? null : witness(result.from, result.at);
  return result;
}
