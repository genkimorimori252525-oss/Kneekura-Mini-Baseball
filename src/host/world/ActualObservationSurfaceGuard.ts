import type { Vec3 } from '../../core/model/geometry';
import type { BattedWorldSurface } from '../../core/sim/ball/BattedBallWorldContacts';
import type { BattedBallBasePrism } from '../../core/sim/ball/BattedBallBaseContact';

/** Closed-segment slab test. Numerical expansion is conservative roundoff protection, not optical calibration. */
const intersectsBox = (start: Vec3, end: Vec3, low: Vec3, high: Vec3): boolean => {
  let enter = 0, exit = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const a = start[axis], b = end[axis], delta = b - a;
    if (![a, b, delta, low[axis], high[axis]].every(Number.isFinite)) return true;
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b), Math.abs(low[axis]), Math.abs(high[axis])) * 32;
    const min = low[axis] - tolerance, max = high[axis] + tolerance;
    if (delta === 0) { if (a < min || a > max) return false; continue; }
    const first = (min - a) / delta, last = (max - a) / delta;
    if (![first, last].every(Number.isFinite)) return true;
    enter = Math.max(enter, Math.min(first, last)); exit = Math.min(exit, Math.max(first, last));
    if (enter > exit) return false;
  }
  return true;
};

/** Geometry-only availability guard. Intersection means optical policy is unknown, never that a collider is opaque. */
export const hasUnmodeledObservationSurface = (eye: Vec3, target: Vec3, walls: readonly BattedWorldSurface[],
  bases: readonly BattedBallBasePrism[]): boolean => {
  if (eye.y <= 0 || target.y <= 0) return true;
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z, length = Math.hypot(dx, dz);
    if (!Number.isFinite(length) || length === 0) return true;
    const c = dx / length, s = dz / length;
    const local = (p: Vec3): Vec3 => ({ x: (p.x - wall.start.x) * c + (p.z - wall.start.z) * s, y: p.y,
      z: -(p.x - wall.start.x) * s + (p.z - wall.start.z) * c });
    if (intersectsBox(local(eye), local(target), { x: 0, y: wall.minimumHeight, z: 0 },
      { x: length, y: wall.maximumHeight, z: 0 })) return true;
  }
  for (const base of bases) {
    const c = Math.cos(base.region.rotationRadians), s = Math.sin(base.region.rotationRadians);
    const local = (p: Vec3): Vec3 => ({ x: (p.x - base.region.center.x) * c + (p.z - base.region.center.z) * s, y: p.y,
      z: -(p.x - base.region.center.x) * s + (p.z - base.region.center.z) * c });
    if (intersectsBox(local(eye), local(target), { x: -base.region.halfSize.x, y: base.bottomY, z: -base.region.halfSize.z },
      { x: base.region.halfSize.x, y: base.topY, z: base.region.halfSize.z })) return true;
  }
  return false;
};
