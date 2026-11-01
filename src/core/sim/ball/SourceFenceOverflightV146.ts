import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from './BallWorldContinuation';
import type { BattedWorldSurface } from './BattedBallWorldContacts';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2, type SourceFreeBallKernel } from './SourceFreeBallKernel';

/** An explicit conservative physical transit definition, not a baseball rule. */
export type SourceFenceTransitPolicyV146 = Readonly<{
  version: 'finite_fence_sphere_transit_v1'; crossing: 'whole_ball_outside';
  endpoints: 'strict_sphere_inside_else_unresolved';
  top: 'strict_sphere_above_during_transit_else_unresolved'; ground: 'stop_at_first_ground';
}>;
export type SourceFenceOverflightQueryInputV146 = Readonly<{
  descriptor: SourceFreeBallDescriptorV2; moment: BallWorldMoment; side: 'incoming' | 'outgoing';
  /** The caller must cap this at its independently authenticated uninterrupted
   * World prefix for this exact physical basis. This free-Source query cannot
   * authenticate actors, earlier field impacts, response history or Native rows. */
  throughElapsedSeconds: number;
  fence: Readonly<{ boundaryId: string; surface: BattedWorldSurface; interiorPoint: Readonly<{ x: number; z: number }> }>;
  policy: SourceFenceTransitPolicyV146;
}>;
type Transition = Readonly<{ firstPossibleElapsedSeconds: number; witnessElapsedSeconds: number; moment: BallWorldMoment }>;
type Clearance = Readonly<{ minimumStartEndpointMeters: number; minimumEndEndpointMeters: number; minimumTopMeters: number }>;
type Common = Readonly<{
  /** Research identity only. Neither Native adoption nor any official fact. */
  authority: 'SOURCE_NONLINEAR_FENCE_TRANSIT_RESEARCH'; boundaryId: string;
  window: Readonly<{ fromElapsedSeconds: number; throughElapsedSeconds: number }>;
}>;
export type SourceFenceOverflightQueryResultV146 = Common & (Readonly<{
  kind: 'witness'; entry: Transition; exit: Transition; radiusM: number; clearance: Clearance;
  numericalResolution: Readonly<{ transitionBracketSeconds: number }>;
}> | Readonly<{ kind: 'no_crossing' }> | Readonly<{ kind: 'blocked_by_ground'; moment: BallWorldMoment }>
  | Readonly<{ kind: 'unresolved'; reason: 'fence_orientation_unproved' | 'initial_inside_unproved'
    | 'directed_crossing_unproved' | 'finite_fence_clearance_unproved' | 'ground_crossing_order_unresolved';
    interval: Readonly<{ from: number; through: number }> }>);

const exact = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const canonical = (v: unknown): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);

// Directed rounding encloses each elementary geometry operation. These bounds
// only subtract from provable clearance; they never permit physical overlap.
type Interval = Readonly<{ lo: number; hi: number }>;
const bits = new DataView(new ArrayBuffer(8));
const up = (n: number): number => {
  if (Number.isNaN(n) || n === Infinity) return n;
  if (n === 0) return Number.MIN_VALUE;
  bits.setFloat64(0, n); bits.setBigUint64(0, bits.getBigUint64(0) + (n > 0 ? 1n : -1n));
  return bits.getFloat64(0);
};
const down = (n: number) => -up(-n);
const point = (v: number): Interval => ({ lo: v, hi: v });
const add = (a: Interval, b: Interval): Interval => ({ lo: down(a.lo + b.lo), hi: up(a.hi + b.hi) });
const sub = (a: Interval, b: Interval): Interval => ({ lo: down(a.lo - b.hi), hi: up(a.hi - b.lo) });
const mul = (a: Interval, b: Interval): Interval => {
  const values = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
  return { lo: down(Math.min(...values)), hi: up(Math.max(...values)) };
};
const square = (a: Interval): Interval => ({ lo: a.lo <= 0 && a.hi >= 0 ? 0 : down(Math.min(a.lo * a.lo, a.hi * a.hi)),
  hi: up(Math.max(a.lo * a.lo, a.hi * a.hi)) });
const lengthInterval = (x: Interval, z: Interval): Interval => {
  const squared = add(square(x), square(z));
  return { lo: down(Math.sqrt(Math.max(0, squared.lo))), hi: up(Math.sqrt(squared.hi)) };
};
const divPositive = (a: Interval, b: Interval) => mul(a, { lo: down(1 / b.hi), hi: up(1 / b.lo) });
const negate = (a: Interval): Interval => ({ lo: -a.hi, hi: -a.lo });
const bounded = (a: Interval) => finite(a.lo) && finite(a.hi) && a.lo <= a.hi;
type Cell = SourceFreeBallKernel['cells'][number];
type Search = Readonly<{ kind: 'hit'; from: number; time: number }> | Readonly<{ kind: 'clear' }>
  | Readonly<{ kind: 'unresolved'; from: number; through: number }>;

/** A witness on the original dense numerical Source only. The full ball must
 * transit from the inside half-space to the outside half-space while remaining
 * strictly above the finite top and within both finite endpoints throughout.
 * The first ground since this descriptor's basis is retained even when the
 * caller starts at a later observation. Pre-basis history remains caller-owned.
 * No field collider is invented and no contact/impulse capability is issued. */
export const querySourceFenceOverflightV146 = (raw: SourceFenceOverflightQueryInputV146): SourceFenceOverflightQueryResultV146 => {
  const q = cloneInert(raw), f = q?.fence, s = f?.surface, policy = q?.policy;
  if (!exact(q, ['descriptor', 'moment', 'side', 'throughElapsedSeconds', 'fence', 'policy'])
    || !exact(f, ['boundaryId', 'surface', 'interiorPoint']) || !id(f.boundaryId)
    || !exact(s, ['surfaceId', 'start', 'end', 'minimumHeight', 'maximumHeight']) || !id(s.surfaceId)
    || !exact(s.start, ['x', 'z']) || !exact(s.end, ['x', 'z']) || !exact(f.interiorPoint, ['x', 'z'])
    || ![s.start.x, s.start.z, s.end.x, s.end.z, s.minimumHeight, s.maximumHeight, f.interiorPoint.x, f.interiorPoint.z].every(finite)
    || s.minimumHeight < 0 || s.maximumHeight <= s.minimumHeight || s.start.x === s.end.x && s.start.z === s.end.z
    || !exact(policy, ['version', 'crossing', 'endpoints', 'top', 'ground']) || policy.version !== 'finite_fence_sphere_transit_v1'
    || policy.crossing !== 'whole_ball_outside' || policy.endpoints !== 'strict_sphere_inside_else_unresolved'
    || policy.top !== 'strict_sphere_above_during_transit_else_unresolved' || policy.ground !== 'stop_at_first_ground'
    || !['incoming', 'outgoing'].includes(q.side) || !finite(q.moment?.elapsedSeconds) || !finite(q.throughElapsedSeconds)
    || q.throughElapsedSeconds < q.moment.elapsedSeconds) throw Error('invalid explicit finite fence transit query/policy');
  const kernel = createSourceFreeBallKernel(q.descriptor), radius = q.descriptor.profile.ground.radiusM;
  if (q.throughElapsedSeconds > q.descriptor.throughElapsedSeconds
    || canonical(kernel.evaluateAt(q.moment.elapsedSeconds, q.side).moment) !== canonical(q.moment))
    throw Error('finite fence transit differs from its original Source moment or horizon');
  const common: Common = { authority: 'SOURCE_NONLINEAR_FENCE_TRANSIT_RESEARCH', boundaryId: f.boundaryId,
    window: { fromElapsedSeconds: q.moment.elapsedSeconds, throughElapsedSeconds: q.throughElapsedSeconds } };
  const unresolved = (reason: Extract<SourceFenceOverflightQueryResultV146, { kind: 'unresolved' }>['reason'], from: number, through: number) =>
    freeze({ ...common, kind: 'unresolved' as const, reason, interval: { from, through } });
  const dx = sub(point(s.end.x), point(s.start.x)), dz = sub(point(s.end.z), point(s.start.z)), length = lengthInterval(dx, dz);
  if (!bounded(length) || length.lo <= 0) return unresolved('fence_orientation_unproved', q.moment.elapsedSeconds, q.throughElapsedSeconds);
  const tx = divPositive(dx, length), tz = divPositive(dz, length);
  let nx = negate(tz), nz = tx;
  const projection = (x: Interval, z: Interval, xAxis: Interval, zAxis: Interval) =>
    add(mul(sub(x, point(s.start.x)), xAxis), mul(sub(z, point(s.start.z)), zAxis));
  const interior = projection(point(f.interiorPoint.x), point(f.interiorPoint.z), nx, nz);
  if (!bounded(interior) || interior.lo <= 0 && interior.hi >= 0)
    return unresolved('fence_orientation_unproved', q.moment.elapsedSeconds, q.throughElapsedSeconds);
  if (interior.lo > 0) { nx = negate(nx); nz = negate(nz); }
  const ground = kernel.boundaries.find(b => b.kind === 'ground' && b.elapsedSeconds <= q.throughElapsedSeconds);
  const blocked = () => freeze({ ...common, kind: 'blocked_by_ground' as const, moment: kernel.evaluateAt(ground!.elapsedSeconds, 'incoming').moment });
  if (ground && ground.elapsedSeconds <= q.moment.elapsedSeconds) return blocked();
  const horizon = ground?.elapsedSeconds ?? q.throughElapsedSeconds, bracketWidth = 1e-12;
  let work = 0;
  const metrics = (time: number, cell: Cell | undefined, travel = 0) => {
    if (++work > 200_000) return null;
    const p = kernel.evaluateAt(time, time === q.moment.elapsedSeconds ? q.side : 'incoming').moment.ball.position;
    const uncertainty = up((cell?.positionRoundingBoundMeters ?? 0) + travel);
    const box = (n: number): Interval => ({ lo: down(n - uncertainty), hi: up(n + uncertainty) });
    const signed = projection(box(p.x), box(p.z), nx, nz), span = projection(box(p.x), box(p.z), tx, tz);
    const start = sub(span, point(radius)), end = sub(sub(length, span), point(radius));
    const top = sub(sub(box(p.y), point(radius)), point(s.maximumHeight));
    return [signed, start, end, top].every(bounded) ? { signed, start, end, top } : null;
  };
  const startCell = kernel.cells.find(c => c.fromElapsedSeconds <= q.moment.elapsedSeconds && c.throughElapsedSeconds >= q.moment.elapsedSeconds);
  const initial = metrics(q.moment.elapsedSeconds, startCell);
  if (!initial || add(initial.signed, point(radius)).hi >= 0)
    return unresolved('initial_inside_unproved', q.moment.elapsedSeconds, q.moment.elapsedSeconds);
  const scan = (threshold: number, from: number): Search => {
    let pending: Extract<Search, { kind: 'unresolved' }> | undefined;
    for (const cell of kernel.cells) {
      const a = Math.max(from, cell.fromElapsedSeconds), b = Math.min(horizon, cell.throughElapsedSeconds);
      if (b <= a) continue;
      const gap = (time: number): Interval | null => { const m = metrics(time, cell); return m ? sub(point(threshold), m.signed) : null; };
      const search = (lo: number, hi: number, left: Interval, right: Interval): Search => {
        if (left.hi < 0) return { kind: 'hit', from: lo, time: lo };
        const travel = up(cell.maximumPositionSpeedMps * sub(point(hi), point(lo)).hi);
        if (Math.min(left.lo, right.lo) > travel) return { kind: 'clear' };
        const middle = (lo + hi) / 2;
        if (hi - lo <= 1e-15 || middle === lo || middle === hi)
          return right.hi < 0 ? { kind: 'hit', from: lo, time: hi } : { kind: 'unresolved', from: lo, through: hi };
        const mid = gap(middle);
        if (!mid) return { kind: 'unresolved', from: lo, through: hi };
        const first = search(lo, middle, left, mid);
        if (first.kind === 'hit') return first;
        if (first.kind === 'unresolved' && middle - first.from > bracketWidth) return first;
        const second = search(middle, hi, mid, right);
        if (first.kind === 'clear') return second;
        if (second.kind === 'hit' && second.time - first.from <= bracketWidth) return { ...second, from: first.from };
        return second.kind === 'unresolved' ? { kind: 'unresolved', from: first.from, through: second.through } : first;
      };
      const left = gap(a), right = gap(b), result: Search = left && right ? search(a, b, left, right) : { kind: 'unresolved', from: a, through: b };
      if (result.kind === 'hit') return pending ? result.time - pending.from <= bracketWidth
        ? { ...result, from: pending.from } : pending : result;
      if (result.kind === 'clear') { if (pending) return pending; continue; }
      pending = { kind: 'unresolved', from: pending?.from ?? result.from, through: result.through };
      if (pending.through - pending.from > bracketWidth) return pending;
    }
    return pending ?? { kind: 'clear' };
  };
  const entry = scan(-radius, q.moment.elapsedSeconds);
  if (entry.kind === 'unresolved') return unresolved('directed_crossing_unproved', entry.from, entry.through);
  if (entry.kind === 'clear') return ground ? blocked() : freeze({ ...common, kind: 'no_crossing' });
  const exit = scan(radius, entry.from);
  if (exit.kind === 'unresolved') return unresolved('directed_crossing_unproved', exit.from, exit.through);
  if (exit.kind === 'clear') return ground ? blocked() : freeze({ ...common, kind: 'no_crossing' });
  if (ground && exit.time >= ground.elapsedSeconds) return unresolved('ground_crossing_order_unresolved', exit.from, exit.time);
  const clearance: { -readonly [K in keyof Clearance]: Clearance[K] } = {
    minimumStartEndpointMeters: Infinity, minimumEndEndpointMeters: Infinity, minimumTopMeters: Infinity };
  const certify = (a: number, b: number, cell: Cell): Readonly<{ from: number; through: number }> | null => {
    const mid = (a + b) / 2, travel = up(cell.maximumPositionSpeedMps * Math.max(sub(point(mid), point(a)).hi, sub(point(b), point(mid)).hi));
    const bounds = metrics(mid, cell, travel);
    if (bounds && bounds.start.lo > 0 && bounds.end.lo > 0 && bounds.top.lo > 0) {
      clearance.minimumStartEndpointMeters = Math.min(clearance.minimumStartEndpointMeters, bounds.start.lo);
      clearance.minimumEndEndpointMeters = Math.min(clearance.minimumEndEndpointMeters, bounds.end.lo);
      clearance.minimumTopMeters = Math.min(clearance.minimumTopMeters, bounds.top.lo);
      return null;
    }
    const at = metrics(mid, cell);
    if (!at || at.start.hi <= 0 || at.end.hi <= 0 || at.top.hi <= 0 || b - a <= bracketWidth || mid === a || mid === b)
      return { from: a, through: b };
    return certify(a, mid, cell) ?? certify(mid, b, cell);
  };
  for (const cell of kernel.cells) {
    const a = Math.max(entry.from, cell.fromElapsedSeconds), b = Math.min(exit.time, cell.throughElapsedSeconds);
    if (b <= a) continue;
    const failure = certify(a, b, cell);
    if (failure) return unresolved('finite_fence_clearance_unproved', failure.from, failure.through);
  }
  if (!Object.values(clearance).every(n => finite(n) && n > 0)) return unresolved('finite_fence_clearance_unproved', entry.from, exit.time);
  const transition = (hit: Extract<Search, { kind: 'hit' }>): Transition => ({ firstPossibleElapsedSeconds: hit.from,
    witnessElapsedSeconds: hit.time, moment: kernel.evaluateAt(hit.time, 'incoming').moment });
  return freeze({ ...common, kind: 'witness', entry: transition(entry), exit: transition(exit), radiusM: radius, clearance,
    numericalResolution: { transitionBracketSeconds: bracketWidth } });
};
