import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../model/geometry';
import type { RuleProfileId } from '../model/RuleProfileRef';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { findPiecewiseAcceleratedSphereContactSeconds } from '../sim/collision/AcceleratedSphereContact';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { getRuleProfile } from './RuleProfile';

export type VenueLegalClassification = 'inside_playable_region' | 'out_of_play';
/** These boxes certify interior space under accepted venue ground rules. Their
 * faces are not claimed to be the venue's legal boundary. Unknown space stays
 * unknown; this version deliberately has no legal-edge or tolerance setting. */
export type BallWorldVenueLegalPolicy = Readonly<{
  version: 'closed_interior_venue_legal_regions_v1'; ruleProfileId: RuleProfileId; rulesRevision: string;
  regions: readonly Readonly<{ regionId: string; classification: VenueLegalClassification; minimum: Vec3; maximum: Vec3 }>[];
}>;
export type BallWorldVenueLegalSegment = Readonly<{
  startElapsedSeconds: number; endElapsedSeconds: number; basis: BallWorldMoment; endpoint: BallWorldMoment;
  /** null preserves an actual endpoint without pretending to know its curve. */
  acceleration: Vec3 | null;
}>;
export type BallWorldVenueLegalCoverageInput = Readonly<{
  policy: BallWorldVenueLegalPolicy; originTick: number; ticksPerSecond: number; ballRadiusMeters: number;
  segments: readonly BallWorldVenueLegalSegment[];
}>;
export type VenueLegalPointCoverage = Readonly<{ classification: VenueLegalClassification | 'unresolved'; regionIds: readonly string[] }>;
export type VenueLegalCertainMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number; regionIds: readonly string[] }>;
const axes = ['x', 'y', 'z'] as const;
const zero = Object.freeze({ x: 0, y: 0, z: 0 });
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const vector = (v: unknown): v is Vec3 => fields(v, axes) && Object.values(v as Vec3).every(Number.isFinite);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const tick = (v: number) => Number.isSafeInteger(v) && v >= 0;
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
export const ballWorldVenueLegalPolicyInput = (raw: BallWorldVenueLegalPolicy): BallWorldVenueLegalPolicy => {
  const p = cloneInert(raw);
  if (!fields(p, ['version', 'ruleProfileId', 'rulesRevision', 'regions']) || p.version !== 'closed_interior_venue_legal_regions_v1'
    || !text(p.ruleProfileId) || !text(p.rulesRevision) || !Array.isArray(p.regions) || !p.regions.length
    || p.regions.some(r => !fields(r, ['regionId', 'classification', 'minimum', 'maximum']) || !text(r.regionId)
      || !['inside_playable_region', 'out_of_play'].includes(r.classification) || !vector(r.minimum) || !vector(r.maximum)
      || axes.some(axis => r.minimum[axis] >= r.maximum[axis]))
    || new Set(p.regions.map(r => r.regionId)).size !== p.regions.length) throw new Error('invalid accepted venue legal interior policy');
  if (getRuleProfile(p.ruleProfileId).rulesRevision !== p.rulesRevision) throw new Error('venue legal RuleProfile revision differs');
  for (let i = 0; i < p.regions.length; i++) for (const second of p.regions.slice(i + 1)) {
    const first = p.regions[i];
    if (first.classification !== second.classification && axes.every(axis => first.minimum[axis] <= second.maximum[axis]
      && second.minimum[axis] <= first.maximum[axis])) throw new Error('contradictory venue legal interior regions overlap');
  }
  return freeze(p);
};
const unknownPoint = (): VenueLegalPointCoverage => ({ classification: 'unresolved', regionIds: [] });
const contains = (region: BallWorldVenueLegalPolicy['regions'][number], position: Vec3, radius: number) => axes.every(axis =>
  position[axis] > region.minimum[axis] && position[axis] < region.maximum[axis]
  && position[axis] - region.minimum[axis] > radius && region.maximum[axis] - position[axis] > radius);
const classify = (policy: BallWorldVenueLegalPolicy, position: Vec3, radius: number): VenueLegalPointCoverage => {
  const regions = policy.regions.filter(r => contains(r, position, radius));
  return regions.length ? { classification: regions[0].classification, regionIds: regions.map(r => r.regionId) } : unknownPoint();
};
/** A strictly contained sphere cannot leave this convex box without touching
 * one of its six planes. Each plane query is the existing exact 1-D sphere
 * projection; no physical collider or collision result grants legal meaning. */
const containsCurve = (region: BallWorldVenueLegalPolicy['regions'][number], s: BallWorldVenueLegalSegment, radius: number): boolean => {
  if (!s.acceleration || !contains(region, s.basis.ball.position, radius) || !contains(region, s.endpoint.ball.position, radius)) return false;
  const duration = s.endElapsedSeconds - s.basis.elapsedSeconds;
  for (const axis of axes) for (const edge of [region.minimum[axis], region.maximum[axis]]) {
    const at = findPiecewiseAcceleratedSphereContactSeconds({ tick: s.basis.ball.tick,
      center: { x: s.basis.ball.position[axis], y: 0, z: 0 }, velocity: { x: s.basis.ball.velocity[axis], y: 0, z: 0 },
      acceleration: { x: s.acceleration[axis], y: 0, z: 0 }, radius: radius / 2 },
    { tick: s.basis.ball.tick, center: { x: edge, y: 0, z: 0 }, velocity: zero, acceleration: zero, radius: radius / 2 }, duration, 'include');
    if (at !== null) return false;
  }
  return true;
};
/** Raw physical values are authenticated by Native. Replay recomputes every
 * legal classification; neither endpoint labels nor precomputed flags enter. */
export const deriveBallWorldVenueLegalCoverage = (raw: BallWorldVenueLegalCoverageInput) => {
  const input = cloneInert(raw), policy = ballWorldVenueLegalPolicyInput(input.policy);
  if (!fields(input, ['policy', 'originTick', 'ticksPerSecond', 'ballRadiusMeters', 'segments']) || !tick(input.originTick)
    || !tick(input.ticksPerSecond) || input.ticksPerSecond === 0 || !Number.isFinite(input.ballRadiusMeters) || input.ballRadiusMeters <= 0
    || !Array.isArray(input.segments) || !input.segments.length) throw new Error('invalid original venue legal physical coverage');
  const moment = (m: BallWorldMoment) => fields(m, ['originTick', 'elapsedSeconds', 'ball']) && m.originTick === input.originTick
    && Number.isFinite(m.elapsedSeconds) && m.elapsedSeconds >= 0 && fields(m.ball, ['tick', 'position', 'velocity', 'spin'])
    && tick(m.ball.tick) && vector(m.ball.position) && vector(m.ball.velocity) && vector(m.ball.spin)
    && quantizeEventTick(m.originTick, m.elapsedSeconds, input.ticksPerSecond) === m.ball.tick;
  let previousEnd: number | null = null;
  let firstCertainOutOfPlay: VenueLegalCertainMoment | null = null;
  const intervals = input.segments.map((s, segmentIndex) => {
    if (!fields(s, ['startElapsedSeconds', 'endElapsedSeconds', 'basis', 'endpoint', 'acceleration'])
      || !moment(s.basis) || !moment(s.endpoint) || s.acceleration !== null && !vector(s.acceleration)
      || !Number.isFinite(s.startElapsedSeconds) || !Number.isFinite(s.endElapsedSeconds)
      || s.startElapsedSeconds < s.basis.elapsedSeconds || s.endElapsedSeconds < s.startElapsedSeconds
      || s.endpoint.elapsedSeconds !== s.endElapsedSeconds || previousEnd !== null && s.startElapsedSeconds !== previousEnd)
      throw new Error('original venue legal physical coverage has a gap or invalid curve');
    previousEnd = s.endElapsedSeconds;
    const start = s.startElapsedSeconds === s.basis.elapsedSeconds ? classify(policy, s.basis.ball.position, input.ballRadiusMeters) : unknownPoint();
    const end = classify(policy, s.endpoint.ball.position, input.ballRadiusMeters);
    for (const [at, point] of [[s.startElapsedSeconds, start], [s.endElapsedSeconds, end]] as const) if (!firstCertainOutOfPlay && point.classification === 'out_of_play')
      firstCertainOutOfPlay = { originTick: input.originTick, elapsedSeconds: at, tick: quantizeEventTick(input.originTick, at, input.ticksPerSecond), regionIds: point.regionIds };
    const regions = policy.regions.filter(r => containsCurve(r, s, input.ballRadiusMeters));
    const classification: VenueLegalClassification | 'unresolved' = regions.length ? regions[0].classification : 'unresolved';
    return { segmentIndex, startElapsedSeconds: s.startElapsedSeconds, endElapsedSeconds: s.endElapsedSeconds,
      classification, regionIds: regions.map(r => r.regionId), start, end };
  });
  const uncertainSpans = intervals.filter(i => i.classification === 'unresolved').map(i => ({ segmentIndex: i.segmentIndex,
    startElapsedSeconds: i.startElapsedSeconds, endElapsedSeconds: i.endElapsedSeconds, reason: 'legal_region_coverage_unresolved' as const }));
  return freeze({ kind: uncertainSpans.length ? 'pending' as const : 'complete' as const,
    intervals, uncertainSpans, firstCertainOutOfPlay: firstCertainOutOfPlay as VenueLegalCertainMoment | null });
};
export type BallWorldVenueLegalCoverage = ReturnType<typeof deriveBallWorldVenueLegalCoverage>;
