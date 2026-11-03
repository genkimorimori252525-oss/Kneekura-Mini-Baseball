import { liveFielderBodyPoseV105, liveFielderThrowOffsetV105, createLiveBodyHandPreparationV105, liveFielderRecoverySecondsV105, liveFielderPreparationPostureSecondsV105, liveFielderHorizontalReachV105, liveFielderDesiredCrouchV105, liveFielderPreferredBodyPointV105 } from './LiveFielderBodyGeometryV105';
import type { Vec3 } from '../../model/geometry';
import type { BaseballBase } from '../../rules/PhysicalRuleFacts';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import type { Quaternion } from '../pitching/BaseballOrientation';
import type { LiveRelayActorV1 } from './LiveRelayPlanV1';
import { liveFieldArrivalSecondsV1 } from './LiveFieldRoleAssignmentV1';
import { estimateLiveReceiverArrivalV106 } from './LiveReceiverArrivalV106';
import { LIVE_THROW_EFFORT_POLICY_V103 } from './LiveThrowActionV103';
import { planLiveTransferActionV110 } from './LiveGloveTossV110';
import { estimateLivePostActionArrivalV1 } from './LivePostActionArrivalV1';
import { quantizeEventTick } from '../ExactEventTime';

/** Ready time is relative to observedAtSeconds, never the actual future catch.
 * A held source normally has readySeconds=0 and a remaining transfer delay.
 * A forecast source must come from an observer-available ball prediction. */
export type LiveDefenseControlSourceV95 = Readonly<{ playerId: string; point: Vec3;
  readySeconds: number; kind: 'held' | 'pending' | 'forecast'; holderTransferRemainingSeconds?: number;holderChargeElapsedSecondsV103?:number }>;
export type LiveDefenseControlEstimateInputV95 = Readonly<{
  observedAtSeconds: number; nowSeconds: number; snapshotKey: string;
  actors: readonly LiveRelayActorV1[]; sources: readonly LiveDefenseControlSourceV95[];
  /** position is the intended ball-reception height above the base, not y=0
   * ground/base geometry. A nonforce tagPoint is the runner body contact point. */
  target: Readonly<{ base: BaseballBase; position: Vec3; forced: boolean; tagPoint?: Vec3; tagRadiusMeters?: number }>;
  physics: AeroGroundBallPhysicsV1; materialOrientation?: Quaternion;
  limits?: Readonly<{ maximumSources?: number; maximumRelays?: number; maximumAeroSolves?: number }>;
}>;
export type LiveDefenseControlLegV95 = Readonly<{ throwerPlayerId: string; receiverPlayerId: string;
  releasePosition: Vec3; target: Vec3; transferSeconds: number; preparationSeconds: number;
  receiverArrivalSeconds: number; waitingSeconds: number; acquisitionSeconds: number;
  directionRecoverySeconds: number; flightSeconds: number; readySeconds: number;
  commandSpeedMps:number;effort:number;chargeSeconds:number;remainingChargeSeconds:number;releaseDelaySeconds:number }>;
export type LiveDefenseControlEstimateV95 = Readonly<{ kind: 'estimated' | 'unknown';
  controlSeconds: number | null; readyAtSeconds: number | null; route: 'carry' | 'direct' | 'relay' | null;
  sourcePlayerId: string | null; receiverPlayerId: string | null; tagPreparationSeconds: number;
  legs: readonly LiveDefenseControlLegV95[];
  diagnostics: Readonly<{ basis: 'OBSERVER_BOUNDED_EXECUTABLE_DEFENSE_ROUTES_V95';
    actualSourceRead: false; actualCatchGuaranteed: false; replanAfterReceiptRequired: true;
    readyTimeBasis: 'SECONDS_FROM_OBSERVED_SNAPSHOT'; controlTimeBasis: 'REMAINING_SECONDS_FROM_NOW';
    observedAtSeconds: number; snapshotAgeSeconds: number; cacheHit: boolean;
    aerodynamicSolveCount: number; aerodynamicCacheHits: number; candidateRouteCount: number;
    evaluatedRouteCount: number; cheaplyPrunedRouteCount: number; budgetExhausted: boolean; maximumSources: number;
    maximumRelays: number; maximumAeroSolves: number; omittedSourceCount: number;
    handPreparationFailures: readonly Readonly<{ throwerPlayerId: string; receiverPlayerId: string; reason: string }>[];
    aerodynamicallyUnreachableLegCount: number;
    unknownReason: 'NO_CONTROL_SOURCE' | 'INCOMPLETE_THROW_ROUTE_SEARCH' | 'UNPROVEN_THROW_HAND_PREPARATION' | null;
    fallbackCarryReadyAtSeconds: number | null }> }>;
type Stored = Omit<LiveDefenseControlEstimateV95, 'controlSeconds' | 'diagnostics'> & {
  diagnostics: Omit<LiveDefenseControlEstimateV95['diagnostics'], 'snapshotAgeSeconds' | 'cacheHit'> };
export type LiveDefenseControlMemoV95 = { readonly maximumEntries: number; readonly entries: Map<string, Stored>;
  readonly aerodynamicEntries: Map<string, ReturnType<typeof planLiveTransferActionV110>> };
export const LIVE_DEFENSE_CONTROL_LIMITS_V95 = Object.freeze({ maximumSources: 2, maximumRelays: 1,
  maximumAeroSolves: 3, maximumCacheEntries: 32 });
export function createLiveDefenseControlMemoV95(maximumEntries: number = LIVE_DEFENSE_CONTROL_LIMITS_V95.maximumCacheEntries): LiveDefenseControlMemoV95 {
  if (!Number.isInteger(maximumEntries) || maximumEntries < 1 || maximumEntries > 256) throw new Error('live defense estimate: invalid cache bound');
  return { maximumEntries, entries: new Map(), aerodynamicEntries: new Map() };
}
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const norm = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));
const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (p: Vec3) => !!p && [p.x, p.y, p.z].every(Number.isFinite);
const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
const freeze = <T>(p: T): T => { if (p && typeof p === 'object') { Object.values(p).forEach(freeze); Object.freeze(p); } return p; };

/** Pure tactical prediction apart from an optional caller-owned bounded memo.
 * Uses the same hand preparation, locomotion arrival and aerodynamic command
 * solver as actual defense. A candidate relay must receive an actual first
 * leg before its own shoulder can contribute to the second leg. No catch,
 * possession, tag, base contact or outcome fact is produced.
 *
 * snapshotKey identifies an immutable observed state. The complete material
 * input is also included in the cache key, so reusing a key after an edit
 * cannot reuse an incompatible solve. nowSeconds only ages that hypothesis;
 * a newly observed error/receipt must supply a new snapshot. Search is bounded
 * to two sources and two one-cutoff routes by default, not an optimality claim. */
export function estimateLiveDefenseControlV95(input: LiveDefenseControlEstimateInputV95,
  memo?: LiveDefenseControlMemoV95): LiveDefenseControlEstimateV95 {
  const limits = { ...LIVE_DEFENSE_CONTROL_LIMITS_V95, ...input.limits }, target = input.target;
  if (!input.snapshotKey || !nonnegative(input.observedAtSeconds) || !nonnegative(input.nowSeconds)
    || input.nowSeconds < input.observedAtSeconds || !finite(target?.position) || ![1, 2, 3, 4].includes(target.base)
    || typeof target.forced !== 'boolean' || target.tagPoint !== undefined && !finite(target.tagPoint)
    || !nonnegative(target.tagRadiusMeters ?? .28) || !Array.isArray(input.actors) || input.actors.length > 9
    || new Set(input.actors.map(a => a.playerId)).size !== input.actors.length
    || !Array.isArray(input.sources) || input.sources.length > 9
    || !Number.isInteger(limits.maximumSources) || limits.maximumSources < 1 || limits.maximumSources > 3
    || !Number.isInteger(limits.maximumRelays) || limits.maximumRelays < 0 || limits.maximumRelays > 3
    || !Number.isInteger(limits.maximumAeroSolves) || limits.maximumAeroSolves < 0 || limits.maximumAeroSolves > 12
    || input.actors.some(a => !a.playerId || ![a.position, a.velocity, a.homePosition, a.glovePosition, a.gloveVelocity].every(finite)
      || ![a.topSpeedMps, a.accelerationMps2, a.throwSpeedMps, a.gloveSpeedMps, a.gloveReachMeters, a.gloveRadiusMeters].every(n => Number.isFinite(n) && n > 0)
      || ![a.remainingReactionSeconds, a.transferSeconds,a.throwEffortBuildSecondsV103??LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds,a.athleticRecoverySecondsV116??0].every(nonnegative)
      || (a.throwEffortBuildSecondsV103??0)>5)
    || input.actors.some(a => !nonnegative(a.throwDirectionStdRadians ?? 0) || (a.throwDirectionStdRadians ?? 0) > .12
      || !nonnegative(a.throwBackspinRadPerSecond ?? 0) || a.throwSpinRadPerSecond !== undefined && !finite(a.throwSpinRadPerSecond))
    || input.sources.some(s => !input.actors.some(a => a.playerId === s.playerId) || !finite(s.point) || !nonnegative(s.readySeconds)
      || !['held', 'pending', 'forecast'].includes(s.kind) || !nonnegative(s.holderTransferRemainingSeconds ?? 0)||!nonnegative(s.holderChargeElapsedSecondsV103??0)))
    throw new Error('live defense estimate: invalid observer snapshot, actor, source or bound');
  const radius = input.physics?.ground?.radiusM;
  if (!(Number.isFinite(radius) && radius > 0) || target.position.y < radius
    || input.sources.some(s => s.point.y < radius)) throw new Error('live defense estimate: airborne endpoint below floor');
  const postStates = new Map<string, ReturnType<typeof estimateLivePostActionArrivalV1>>();
  const contextBasis = input.actors.find(a => a.postActionV120)?.postActionV120;
  for (const a of input.actors) if (a.postActionV120) {
    const c = a.postActionV120;
    if (c.nowSeconds !== input.observedAtSeconds || c.clock.ticksPerSecond !== input.physics.air.ticksPerSecond
      || c.scopeId !== contextBasis!.scopeId || c.clock.originTick !== contextBasis!.clock.originTick)
      throw new Error('live defense estimate: inconsistent post action observation');
    const initial = estimateLivePostActionArrivalV1({ ...c, actorId: a.playerId,
      actor: { ...a, remainingReactionSeconds: 0 }, target: c.knownAction.readySeconds > c.nowSeconds ? c.knownAction.position : a.position,
      arrivalMode: 'first_entry', radiusMeters: 0 });
    postStates.set(a.playerId, initial);
    // Validate freshness even on a memo hit. now only ages an immutable route;
    // it is not added again to that route's snapshot-relative timestamps.
    if (input.nowSeconds !== input.observedAtSeconds) estimateLivePostActionArrivalV1({ ...c,
      nowSeconds: input.nowSeconds, nowTick: quantizeEventTick(c.clock.originTick, input.nowSeconds, c.clock.ticksPerSecond),
      actorId: a.playerId, actor: { ...a, ...initial.stateAtReady, remainingReactionSeconds: 0 },
      target: c.knownAction.readySeconds > input.nowSeconds ? c.knownAction.position : initial.stateAtReady.position,
      arrivalMode: 'first_entry', radiusMeters: 0 });
  }
  const postState = (a: LiveRelayActorV1) => a.postActionV120 && a.postActionV120.knownAction.readySeconds > a.postActionV120.nowSeconds
      ? postStates.get(a.playerId)!.stateAtReady : a,
    postQuery = (a: LiveRelayActorV1, point: Vec3, arrivalMode: 'first_entry' | 'receiver', touchRadius: number, seconds = 0,
      suppliedState = false) => {
      const c = a.postActionV120!, nowSeconds = c.nowSeconds + seconds;
      return estimateLivePostActionArrivalV1({ ...c, nowSeconds,
        nowTick: seconds === 0 ? c.nowTick : quantizeEventTick(c.clock.originTick, nowSeconds, c.clock.ticksPerSecond),
        actorId: a.playerId, actor: { ...a, ...(suppliedState ? {} : postState(a)), remainingReactionSeconds: Math.max(0, a.remainingReactionSeconds - seconds) },
        target: point, arrivalMode, radiusMeters: touchRadius });
    }, postWait = (a: LiveRelayActorV1, seconds: number): number => {
      const c = a.postActionV120!, nowSeconds = c.nowSeconds + seconds;
      return postQuery({ ...a, remainingReactionSeconds: 0 }, c.knownAction.readySeconds > nowSeconds
        ? c.knownAction.position : postState(a).position, 'first_entry', 0, seconds).remainingSeconds;
    };
  const age = input.nowSeconds - input.observedAtSeconds,
    key = JSON.stringify({ ...input, nowSeconds: undefined }),
    materialize = (stored: Stored, cacheHit: boolean): LiveDefenseControlEstimateV95 => freeze({ ...stored,
      controlSeconds: stored.readyAtSeconds === null ? null : Math.max(0, stored.readyAtSeconds - input.nowSeconds),
      diagnostics: { ...stored.diagnostics, snapshotAgeSeconds: age, cacheHit,
        aerodynamicSolveCount: cacheHit ? 0 : stored.diagnostics.aerodynamicSolveCount,
        aerodynamicCacheHits: cacheHit ? 0 : stored.diagnostics.aerodynamicCacheHits } });
  const cached = memo?.entries.get(key); if (cached) return materialize(cached, true);
  const sources = input.sources.slice().sort((a, b) => a.readySeconds - b.readySeconds || a.playerId.localeCompare(b.playerId))
    .slice(0, limits.maximumSources);
  let solves = 0, hits = 0, candidateRoutes = 0, evaluatedRoutes = 0, cheaplyPrunedRoutes = 0, budgetExhausted = false;
  let aerodynamicallyUnreachableLegCount = 0;
  const handPreparationFailures: { throwerPlayerId: string; receiverPlayerId: string; reason: string }[] = [];
  type Route = { seconds: number; kind: 'carry' | 'direct' | 'relay'; source: string; receiver: string; tag: number; legs: LiveDefenseControlLegV95[] };
  let best: Route | null = null;
  const consider = (route: Route) => { if (Number.isFinite(route.seconds) && (!best || route.seconds < best.seconds)) best = route; };
  // A committed action's remaining time belongs to its immutable observation.
  // Ordinary receiver movement begins after that wait, without reusing the
  // action's sliding/airborne velocity as a running command.
  const receiverArrival = (actor: LiveRelayActorV1, point: Vec3, touchRadius: number) => {
    if (actor.postActionV120) return postQuery(actor, point, 'receiver', touchRadius).remainingSeconds;
    const recovery = actor.athleticRecoverySecondsV116 ?? 0;
    return recovery > 0 ? recovery + estimateLiveReceiverArrivalV106({ ...actor, velocity: { x: 0, y: 0, z: 0 },
      remainingReactionSeconds: Math.max(0,actor.remainingReactionSeconds-recovery) }, point, touchRadius)
      : estimateLiveReceiverArrivalV106(actor, point, touchRadius);
  };
  const targetBody = (actor: LiveRelayActorV1): Vec3 => ({ x: target.position.x, y: postState(actor).position.y, z: target.position.z }),
    tagPoint = target.tagPoint ?? { x: target.position.x, y: .9, z: target.position.z },
    tagSeconds = (actor: LiveRelayActorV1, grip: Vec3) => {
      if (target.forced) return 0;
      const reach = (actor.bodyModelV105 ? Math.max(0,liveFielderHorizontalReachV105(actor.bodyModelV105,targetBody(actor),tagPoint.y)) : actor.gloveReachMeters) + (target.tagRadiusMeters ?? .28),
        body = targetBody(actor), bodyMove = distance(body, tagPoint) <= reach ? 0
          : liveFieldArrivalSecondsV1({ ...actor, position: body, velocity: { x: 0, y: 0, z: 0 }, remainingReactionSeconds: 0 }, tagPoint, reach);
      return bodyMove + Math.max(0, distance(grip, tagPoint) - (target.tagRadiusMeters ?? .28)) / actor.gloveSpeedMps;
    };
  const aeroCache = new Map<string, ReturnType<typeof planLiveTransferActionV110>>(), physicsKey = JSON.stringify(input.physics),
    seamActive = (input.physics.air.aerodynamics.seamForce?.coefficientScale ?? 0) > 0;
  const sourceStates = sources.map(source => {
    const original = input.actors.find(a => a.playerId === source.playerId)!, forecast = source.kind === 'forecast',
      forecastPosition = original.bodyModelV105 ? liveFielderPreferredBodyPointV105(original.bodyModelV105, original.position, source.point, original.bodyPoseV105?.forward??{x:0,y:0,z:-1}) : { x: source.point.x, y: original.position.y, z: source.point.z },
      crouch = original.bodyModelV105 ? liveFielderDesiredCrouchV105(original.bodyModelV105,forecastPosition,source.point) : 0,
      yaw = Math.atan2(original.bodyPoseV105?.forward.x??0,original.bodyPoseV105?.forward.z??-1),
      forecastPose = original.bodyModelV105 ? liveFielderBodyPoseV105(original.bodyModelV105,forecastPosition,{x:0,y:0,z:0},
        {from:0,through:0,crouchFrom:crouch,crouchTo:crouch,yawFrom:yaw,yawTo:yaw},0,source.point) : undefined,
      holder: LiveRelayActorV1 = forecast ? { ...original, position: forecastPosition, ...(forecastPose?{bodyPoseV105:forecastPose}:{}),
        velocity: { x: 0, y: 0, z: 0 }, glovePosition: source.point, gloveVelocity: { x: 0, y: 0, z: 0 }, remainingReactionSeconds: 0 } : original,
      forecastAfterAction = !!holder.postActionV120 && forecast
        && input.observedAtSeconds + source.readySeconds >= holder.postActionV120.knownAction.readySeconds,
      holderPosition = forecastAfterAction ? holder.position : postState(holder).position,
      transfer = holder.bodyModelV105 ? Math.max(source.holderTransferRemainingSeconds ?? holder.transferSeconds, forecast ? liveFielderDesiredCrouchV105(holder.bodyModelV105,holder.position,source.point)/holder.bodyModelV105.postureSpeedMps : liveFielderRecoverySecondsV105(holder.bodyModelV105,holder.bodyPoseV105)) : source.holderTransferRemainingSeconds ?? holder.transferSeconds,
      carry = holder.postActionV120 ? source.readySeconds + postQuery({ ...holder, remainingReactionSeconds: 0 },
        targetBody(holder), 'first_entry', .28, source.readySeconds, forecastAfterAction).remainingSeconds : (holder.athleticRecoverySecondsV116 ?? 0) > 0
        ? Math.max(source.readySeconds,holder.athleticRecoverySecondsV116!) + liveFieldArrivalSecondsV1({ ...holder,
          velocity: { x: 0, y: 0, z: 0 }, remainingReactionSeconds: 0 }, targetBody(holder), .28)
        : source.readySeconds + liveFieldArrivalSecondsV1({ ...holder, remainingReactionSeconds: 0 }, targetBody(holder), .28),
      carryGrip = add(targetBody(holder), sub(holder.glovePosition, holder.position)), carryTag = tagSeconds(holder, carryGrip);
    candidateRoutes++; evaluatedRoutes++;
    consider({ seconds: carry + carryTag, kind: 'carry', source: holder.playerId, receiver: holder.playerId, tag: carryTag, legs: [] });
    return { source, holder, transfer, holderPosition };
  });
  for (const { source, holder, transfer, holderPosition } of sourceStates) {
    const receiver = input.actors.filter(a => a.playerId !== holder.playerId).map(a => ({ actor: a,
      arrival: receiverArrival(a, targetBody(a), .28) }))
      .sort((a, b) => a.arrival - b.arrival || a.actor.playerId.localeCompare(b.actor.playerId))[0]?.actor;
    if (!receiver || (receiver.bodyModelV105 ? liveFielderHorizontalReachV105(receiver.bodyModelV105,receiver.position,target.position.y)<0 : Math.abs(target.position.y - receiver.position.y) > receiver.gloveReachMeters + receiver.gloveRadiusMeters)) continue;
    const brakePoint = (a: LiveRelayActorV1): Vec3 => {
      if (a.postActionV120) {
        const state = postState(a), speed = Math.hypot(state.velocity.x, state.velocity.z), factor = speed / (2 * a.accelerationMps2);
        return { x: state.position.x + state.velocity.x * factor, y: state.position.y, z: state.position.z + state.velocity.z * factor };
      }
      if ((a.athleticRecoverySecondsV116 ?? 0) > 0) return a.position;
      const speed = Math.hypot(a.velocity.x, a.velocity.z), factor = speed / (2 * a.accelerationMps2);
      return { x: a.position.x + a.velocity.x * factor, y: a.position.y, z: a.position.z + a.velocity.z * factor };
    };
    const relays = input.actors.filter(a => a.playerId !== holder.playerId && a.playerId !== receiver.playerId
      && flatDistance(brakePoint(a), target.position) + .28 < flatDistance(holder.position, target.position))
      .map(a => ({ actor: a, cost: distance(holder.glovePosition, a.glovePosition) / Math.min(holder.throwSpeedMps,LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps)
        + a.transferSeconds + distance(a.glovePosition, target.position) / Math.min(a.throwSpeedMps,LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps) }))
      .sort((a, b) => a.cost - b.cost || a.actor.playerId.localeCompare(b.actor.playerId))
      .slice(0, limits.maximumRelays).map(a => a.actor);
    const cheapRouteCost = (route: readonly LiveRelayActorV1[]) => {
      let seconds = source.readySeconds;
      for (let i = 1; i < route.length; i++) {
        const from = route[i - 1], to = route[i], first = i === 1,
          fromBody = first ? holderPosition : brakePoint(from),
          endpoint = i === route.length - 1 ? target.position : add(brakePoint(to), sub(to.glovePosition, to.position)),
          bodyEnd = i === route.length - 1 ? targetBody(to) : brakePoint(to),
          // Search ordering only. This speed-only screen is not a global
          // lower-bound proof in wind; every returned throw still has a full
          // aerodynamic solve. Omitted faster paths are a bounded-model limit.
          flight = Math.max(0, distance(fromBody, endpoint) - from.gloveReachMeters)
            / (Math.min(from.throwSpeedMps,LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps) + (first ? norm(from.velocity) : 0));
        seconds = Math.max(from.postActionV120
          ? Math.max(seconds + (first ? transfer : from.transferSeconds), seconds + postWait(from, seconds)) + flight
          : (from.athleticRecoverySecondsV116 ?? 0) > 0
          ? Math.max(seconds + (first ? transfer : from.transferSeconds),from.athleticRecoverySecondsV116!) + flight
          : seconds + (first ? transfer : from.transferSeconds) + flight,
          receiverArrival(to, bodyEnd, .28));
      }
      return seconds;
    };
    const routes = [[holder, receiver], ...relays.map(a => [holder, a, receiver])]
      .map((route, index) => ({ route, cost: cheapRouteCost(route), index }))
      .sort((a, b) => a.cost - b.cost || a.index - b.index);
    candidateRoutes += routes.length;
    for (const candidate of routes) {
      if (best && candidate.cost >= (best as Route).seconds) { cheaplyPrunedRoutes++; continue; }
      const route = candidate.route;
      evaluatedRoutes++; let seconds = source.readySeconds, material = input.materialOrientation, feasible = true;
      const legs: LiveDefenseControlLegV95[] = [];
      for (let i = 1; i < route.length; i++) {
        const from = route[i - 1], to = route[i], first = i === 1,
          origin = first ? holderPosition : brakePoint(from),
          bodyEnd = i === route.length - 1 ? targetBody(to) : brakePoint(to),
          endpoint = i === route.length - 1 ? target.position : add(bodyEnd, sub(to.glovePosition, to.position)),
          dx = endpoint.x - origin.x, dz = endpoint.z - origin.z, length = Math.hypot(dx, dz),
          offsetLength = Math.hypot(.5, .7), scale = Math.min(1, from.gloveReachMeters / offsetLength),
          offset = from.bodyModelV105 ? liveFielderThrowOffsetV105(from.bodyModelV105,origin,endpoint) : { x: (length ? dx / length * .5 : 0) * scale, y: .7 * scale, z: (length ? dz / length * .5 : 0) * scale },
          preparation = createLiveBodyHandPreparationV105({ fromElapsedSeconds: 0,
            initialOffset: from.bodyModelV105 ? add(sub(from.glovePosition, from.position),{x:0,y:from.bodyPoseV105?.crouchMeters??0,z:0}) : sub(from.glovePosition, from.position),
            initialRelativeVelocity: first ? sub(from.gloveVelocity, from.velocity) : { x: 0, y: 0, z: 0 },
            targetOffset: offset, maximumRelativeSpeedMps: from.gloveSpeedMps, maximumReachMeters: from.gloveReachMeters },from.bodyModelV105);
        if (preparation.kind !== 'planned'&&!from.gloveTossV110) {
          handPreparationFailures.push({ throwerPlayerId: from.playerId, receiverPlayerId: to.playerId, reason: preparation.reason });
          feasible = false; break;
        }
        const releasePosition = add(origin, offset), bodyVelocity = { x: 0, y: 0, z: 0 },
          d = sub(endpoint, releasePosition), h = Math.hypot(d.x, d.z), spin = from.throwSpinRadPerSecond ?? {
            x: h ? -d.z / h * (from.throwBackspinRadPerSecond ?? 0) : 0, y: 0,
            z: h ? d.x / h * (from.throwBackspinRadPerSecond ?? 0) : 0 },
          relevantMaterial = seamActive ? material : undefined,transferSeconds=first?transfer:from.transferSeconds,
          preparationSeconds=(preparation.kind==='planned'?preparation.durationSeconds:0)+(from.bodyModelV105?liveFielderPreparationPostureSecondsV105(from.bodyModelV105,from.bodyPoseV105,origin,endpoint):0),
          chargeElapsedSeconds=first&&source.kind==='held'?(source.holderChargeElapsedSecondsV103??0):0,
          receiverArrivalSeconds = Math.max(receiverArrival(to, bodyEnd, .28),
            i === route.length - 1 ? 0 : (to.postActionV120 ? postWait(to, 0) : 0)
              + Math.hypot(postState(to).velocity.x, postState(to).velocity.z) / to.accelerationMps2),
          receiverReadySeconds=Math.max(0,receiverArrivalSeconds-seconds),
          aeroKey = physicsKey + ':' + JSON.stringify({ releasePosition, bodyVelocity, speed: from.throwSpeedMps, spin, endpoint, material: relevantMaterial,
            transferSeconds,preparationSeconds,gloveTossV110:from.gloveTossV110,chargeElapsedSeconds,receiverReadySeconds,buildSeconds:from.throwEffortBuildSecondsV103??LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds });
        let action = aeroCache.get(aeroKey) ?? memo?.aerodynamicEntries.get(aeroKey);
        if (action) hits++;
        else {
          if (solves >= limits.maximumAeroSolves) { budgetExhausted = true; feasible = false; break; }
          if (seamActive && !material) { feasible = false; break; }
          action = planLiveTransferActionV110({ releasePosition, bodyVelocity, capacityMps: from.throwSpeedMps,
            spin, physics: input.physics, target: endpoint,remainingTransferSeconds:transferSeconds,handPreparationSeconds:Math.max(0,preparationSeconds-transferSeconds),
            chargeElapsedSeconds,receiverReadySeconds,deadlineSeconds:0,
            ...(from.throwEffortBuildSecondsV103===undefined?{}:{throwEffortBuildSecondsV103:from.throwEffortBuildSecondsV103}),
            ...(relevantMaterial ? { materialOrientationAtRelease: relevantMaterial } : {}) },{...from,position:origin,velocity:bodyVelocity,
              glovePosition:add(origin,sub(from.glovePosition,from.position)),gloveVelocity:first?from.gloveVelocity:bodyVelocity},limits.maximumAeroSolves-solves,preparation.kind==='planned');
          solves+=action.transferVariantSolvesV110;
          aeroCache.set(aeroKey, action);
          if (memo) {
            if (memo.aerodynamicEntries.size >= memo.maximumEntries * 4)
              memo.aerodynamicEntries.delete(memo.aerodynamicEntries.keys().next().value!);
            memo.aerodynamicEntries.set(aeroKey, action);
          }
        }
        if (action.kind !== 'planned') {
          // Glove eligibility is not a certified alternative. If the actual
          // toss also fails, retain the normal hand's unresolved C1 boundary
          // rather than certifying a slow carry as the only possible return.
          if (preparation.kind !== 'planned') handPreparationFailures.push({
            throwerPlayerId: from.playerId, receiverPlayerId: to.playerId, reason: preparation.reason });
          else aerodynamicallyUnreachableLegCount++;
          feasible = false; break;
        }
        const aero=action.forecast;
        material = aero.predictedMaterialOrientation ?? material;
        // Transfer, charge and recovery can run concurrently. Gate the solved
        // release rather than adding recovery serially to transfer/charge.
        const releaseDelaySeconds = from.postActionV120 ? Math.max(action.releaseDelaySeconds,postWait(from, seconds))
          : (from.athleticRecoverySecondsV116 ?? 0) > 0
          ? Math.max(action.releaseDelaySeconds,from.athleticRecoverySecondsV116! - seconds) : action.releaseDelaySeconds,
          earliest = seconds + releaseDelaySeconds + aero.flightSeconds,
          waitingSeconds = Math.max(0, receiverArrivalSeconds - earliest),
          acquisitionSeconds = (to.gloveRadiusMeters + radius) / to.gloveSpeedMps,
          directionRecoverySeconds = distance(releasePosition, endpoint) * Math.tan(from.throwDirectionStdRadians ?? 0) / to.gloveSpeedMps;
        seconds = earliest + waitingSeconds + acquisitionSeconds + directionRecoverySeconds;
        legs.push({ throwerPlayerId: from.playerId, receiverPlayerId: to.playerId, releasePosition:action.releasePositionV110, target: { ...endpoint },
          transferSeconds, preparationSeconds:preparation.kind==='planned'?preparation.durationSeconds:0, receiverArrivalSeconds, waitingSeconds,
          acquisitionSeconds, directionRecoverySeconds, flightSeconds: aero.flightSeconds, readySeconds: seconds,
          commandSpeedMps:action.commandSpeedMps,effort:action.effort,chargeSeconds:action.chargeSeconds,
          remainingChargeSeconds:action.remainingChargeSeconds,releaseDelaySeconds });
      }
      if (feasible) { const tag = tagSeconds(receiver, target.position);
        consider({ seconds: seconds + tag, kind: route.length === 2 ? 'direct' : 'relay', source: holder.playerId,
          receiver: receiver.playerId, tag, legs }); }
    }
  }
  const candidate = best as Route | null,
    // A known carry route is an achievable upper bound, not evidence that a
    // faster throw cannot arrive. In particular, a failed direct solve plus
    // the first leg of a relay must not exhaust the budget and make a runner
    // believe the still-unexamined second relay leg is impossible. Likewise,
    // failure to certify a hand transition does not prove a faster throw is
    // physically impossible; retain that uncertainty without relaxing C1 bounds.
    incompleteCarry = candidate?.kind === 'carry' && budgetExhausted,
    uncertifiedCarry = candidate?.kind === 'carry' && handPreparationFailures.length > 0,
    chosen = incompleteCarry || uncertifiedCarry ? null : candidate;
  const stored: Stored = freeze({ kind: chosen ? 'estimated' : 'unknown',
    readyAtSeconds: chosen ? input.observedAtSeconds + chosen.seconds : null, route: chosen?.kind ?? null,
    sourcePlayerId: chosen?.source ?? null, receiverPlayerId: chosen?.receiver ?? null,
    tagPreparationSeconds: chosen?.tag ?? 0, legs: chosen?.legs ?? [],
    diagnostics: { basis: 'OBSERVER_BOUNDED_EXECUTABLE_DEFENSE_ROUTES_V95', actualSourceRead: false,
      actualCatchGuaranteed: false, replanAfterReceiptRequired: true, observedAtSeconds: input.observedAtSeconds,
      readyTimeBasis: 'SECONDS_FROM_OBSERVED_SNAPSHOT', controlTimeBasis: 'REMAINING_SECONDS_FROM_NOW',
      aerodynamicSolveCount: solves, aerodynamicCacheHits: hits, candidateRouteCount: candidateRoutes,
      evaluatedRouteCount: evaluatedRoutes, cheaplyPrunedRouteCount: cheaplyPrunedRoutes, budgetExhausted, maximumSources: limits.maximumSources,
      maximumRelays: limits.maximumRelays, maximumAeroSolves: limits.maximumAeroSolves,
      omittedSourceCount: input.sources.length - sources.length, handPreparationFailures, aerodynamicallyUnreachableLegCount,
      unknownReason: incompleteCarry ? 'INCOMPLETE_THROW_ROUTE_SEARCH' : uncertifiedCarry ? 'UNPROVEN_THROW_HAND_PREPARATION'
        : chosen ? null : 'NO_CONTROL_SOURCE',
      fallbackCarryReadyAtSeconds: candidate?.kind === 'carry' ? input.observedAtSeconds + candidate.seconds : null } });
  if (memo) { if (memo.entries.size >= memo.maximumEntries) memo.entries.delete(memo.entries.keys().next().value!); memo.entries.set(key, stored); }
  return materialize(stored, false);
}
