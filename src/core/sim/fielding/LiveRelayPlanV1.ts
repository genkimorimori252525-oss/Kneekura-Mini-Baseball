import { liveFielderThrowOffsetV105, createLiveBodyHandPreparationV105, liveFielderPreparationPostureSecondsV105, type LiveFielderBodyModelV105, type LiveFielderBodyPoseV105 } from './LiveFielderBodyGeometryV105';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { estimateLiveReceiverArrivalV106 } from './LiveReceiverArrivalV106';
import type { Vec3 } from '../../model/geometry';
import type { BaseballBase } from '../../rules/PhysicalRuleFacts';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import { liveFieldArrivalSecondsV1, type LiveFieldRoleActorV1 } from './LiveFieldRoleAssignmentV1';
import { LIVE_THROW_EFFORT_POLICY_V103 } from './LiveThrowActionV103';
import { planLiveTransferActionV110,type LiveGloveTossCapabilityV110 } from './LiveGloveTossV110';
import type { Quaternion } from '../pitching/BaseballOrientation';
import { estimateLivePostActionArrivalV1, type LivePostActionContextV120 } from './LivePostActionArrivalV1';
import { quantizeEventTick } from '../ExactEventTime';

export type LiveRelayActorV1 = LiveFieldRoleActorV1 & Readonly<{
  glovePosition: Vec3; gloveVelocity: Vec3; gloveSpeedMps: number; gloveReachMeters: number; gloveRadiusMeters: number;
  transferSeconds: number; throwDirectionStdRadians?: number; throwBackspinRadPerSecond?: number; throwSpinRadPerSecond?: Vec3;
  throwEffortBuildSecondsV103?: number; bodyModelV105?: LiveFielderBodyModelV105; bodyPoseV105?: LiveFielderBodyPoseV105;
  gloveTossV110?: LiveGloveTossCapabilityV110;
  /** Observed remaining committed action, relative to this actor snapshot.
   * Tactical consumers cannot issue ordinary movement/release during it. */
  athleticRecoverySecondsV116?: number;
  postActionV120?: LivePostActionContextV120;
}>;
export type LiveRelayPlanInputV1 = Readonly<{
  actors: readonly LiveRelayActorV1[]; holderPlayerId: string; receiverPlayerId: string;
  finalBase: BaseballBase; runnerId: string; target: Vec3; runnerArrivalSeconds: number;
  holderTransferRemainingSeconds: number; physics: AeroGroundBallPhysicsV1;
  throwHandOffset: Readonly<{ forwardMeters: number; heightAboveHipMeters: number }>;
  maximumIntermediateReceivers?: 0 | 1 | 2; minimumMarginSeconds?: number; excludedRelayPlayerIds?: readonly string[];
  /** Keep the best route even when it loses the race, for a throw made anyway. Omission keeps 'hold' without legs. */
  keepLateRouteV1?: true;
  materialOrientationAtRelease?: Quaternion;
  holderChargeElapsedSecondsV103?: number;
  preferStrongestFeasibleV103?: boolean;
  holderReleaseBodyVelocityV110?:Vec3;
}>;
export type LiveRelayLegV1 = Readonly<{
  throwerPlayerId: string; receiverPlayerId: string; target: Vec3; receiverPoint: Vec3;
  intent: 'relay' | 'base_cover'; releasePosition: Vec3; bodyVelocity: Vec3; spin: Vec3;
  transferSeconds: number; preparationSeconds: number; receiverArrivalSeconds: number; waitingSeconds: number;
  flightSeconds: number; readySeconds: number; directionRecoveryCostSeconds: number;
  initialVelocity: Vec3;
  commandSpeedMps: number; effort: number; chargeSeconds: number; remainingChargeSeconds: number; releaseDelaySeconds: number;
  selectionReason:Extract<ReturnType<typeof planLiveTransferActionV110>,{kind:'planned'}>['selectionReason'];outputSearchLimitApplied:boolean;
  releaseStyleV110:'hand_throw'|'glove_toss';capacityMps:number;fullChargeSecondsV110:number;
}>;
export type LiveRelayPlanV1 = Readonly<{
  kind: 'carry' | 'direct' | 'relay' | 'hold'; finalBase: BaseballBase; runnerId: string;
  readySeconds: number; marginSeconds: number; costSeconds: number; carrySeconds: number; directSeconds: number;
  firstHop: Readonly<{ receiverPlayerId: string; target: Vec3; receiverPoint: Vec3; intent: 'relay' | 'base_cover' }> | null;
  legs: readonly LiveRelayLegV1[];
  diagnostics: Readonly<{ basis: 'BOUNDED_AERO_RELAY_COMMAND_PREDICTION_V1'; actualSourceRead: false;
    actualCatchGuaranteed: false; replanAfterReceiptRequired: true; candidateRouteCount: number;
    evaluatedRouteCount: number; aerodynamicSolveCount: number; aerodynamicCacheHits: number;
    earliestFallbackRouteCount: number; earliestFallbackSolveCount: number;
    maximumIntermediateReceivers: number; maximumEvaluatedRoutes: number; directReachable: boolean }>;
}>;

/** Controller search limits, not measured player intelligence. The shortlist is
 * provisional tactical calibration; it is not an exhaustive optimality claim.
 * Each route has at most three throws; the direct route is always validated. */
export const LIVE_RELAY_PLAN_POLICY_V1 = Object.freeze({ maximumIntermediateReceivers: 2,
  maximumEvaluatedRoutes: 8, minimumProgressMeters: .28, baseTouchRadiusMeters: .28 });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (p: Vec3, scale: number): Vec3 => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale });
const norm = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (p: Vec3) => !!p && [p.x, p.y, p.z].every(Number.isFinite);
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const allowedInputKeys = ['actors', 'holderPlayerId', 'receiverPlayerId', 'finalBase', 'runnerId', 'target', 'runnerArrivalSeconds',
  'holderTransferRemainingSeconds', 'physics', 'throwHandOffset', 'maximumIntermediateReceivers', 'minimumMarginSeconds', 'excludedRelayPlayerIds', 'keepLateRouteV1', 'materialOrientationAtRelease','holderChargeElapsedSecondsV103','preferStrongestFeasibleV103','holderReleaseBodyVelocityV110'];

/** Routes an intended throw using only present actor state and an explicit
 * runner estimate. Intermediate receivers are actual actors at their current
 * braking point with the measured body-relative glove offset, never an
 * invented midpoint or possession. Future relay poses are stationary tactical
 * estimates after receipt; only a new plan from the
 * actual secured catch may issue the next command. No actor, ball, base-touch,
 * catch, custody or out fact is created by this function. */
export function planLiveRelayV1(raw: LiveRelayPlanInputV1,compareReadyReceiverTossV118=false): LiveRelayPlanV1 {
  const input = cloneInert(raw), policy = LIVE_RELAY_PLAN_POLICY_V1,
    maximumIntermediateReceivers = input.maximumIntermediateReceivers ?? policy.maximumIntermediateReceivers,
    minimumMargin = input.minimumMarginSeconds ?? 0;
  if (!input || Object.keys(input).some(key => !allowedInputKeys.includes(key)) || !Array.isArray(input.actors)
    || input.actors.length < 2 || input.actors.length > 9 || new Set(input.actors.map(a => a.playerId)).size !== input.actors.length
    || ![1, 2, 3, 4].includes(input.finalBase) || !input.runnerId || !finite(input.target)
    || ![input.runnerArrivalSeconds, input.holderTransferRemainingSeconds, minimumMargin].every(n => Number.isFinite(n) && n >= 0)
    || !Number.isFinite(input.holderChargeElapsedSecondsV103??0)||(input.holderChargeElapsedSecondsV103??0)<0
    || input.preferStrongestFeasibleV103!==undefined&&typeof input.preferStrongestFeasibleV103!=='boolean'
    || input.holderReleaseBodyVelocityV110!==undefined&&!finite(input.holderReleaseBodyVelocityV110)
    || ![0, 1, 2].includes(maximumIntermediateReceivers)
    || input.excludedRelayPlayerIds !== undefined && (!Array.isArray(input.excludedRelayPlayerIds)
      || input.excludedRelayPlayerIds.some(id => typeof id !== 'string' || !id))
    || !input.throwHandOffset || ![input.throwHandOffset.forwardMeters, input.throwHandOffset.heightAboveHipMeters].every(n => Number.isFinite(n) && n >= 0)
    || input.actors.some(a => !a.playerId || ![a.position, a.velocity, a.homePosition, a.glovePosition, a.gloveVelocity].every(finite)
      || ![a.topSpeedMps, a.accelerationMps2, a.throwSpeedMps, a.gloveSpeedMps, a.gloveReachMeters, a.gloveRadiusMeters].every(n => Number.isFinite(n) && n > 0)
      || ![a.remainingReactionSeconds, a.transferSeconds,a.throwEffortBuildSecondsV103??LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds].every(n => Number.isFinite(n) && n >= 0)
      || (a.throwEffortBuildSecondsV103??0)>5
      || a.gloveTossV110!==undefined&&(!Number.isFinite(a.gloveTossV110.capacityMps)||a.gloveTossV110.capacityMps<=0
        ||a.gloveTossV110.capacityMps>Math.min(a.throwSpeedMps,a.gloveSpeedMps)
        ||!Number.isFinite(a.gloveTossV110.buildSeconds)||a.gloveTossV110.buildSeconds<0||a.gloveTossV110.buildSeconds>5)
      || !Number.isFinite(a.throwDirectionStdRadians ?? 0) || (a.throwDirectionStdRadians ?? 0) < 0 || (a.throwDirectionStdRadians ?? 0) > .12
      || !Number.isFinite(a.throwBackspinRadPerSecond ?? 0) || (a.throwBackspinRadPerSecond ?? 0) < 0
      || a.throwSpinRadPerSecond !== undefined && !finite(a.throwSpinRadPerSecond))) throw new Error('invalid live relay plan actors, target or policy');
  const holder = input.actors.find(a => a.playerId === input.holderPlayerId), receiver = input.actors.find(a => a.playerId === input.receiverPlayerId);
  if (!holder || !receiver || holder === receiver || !Number.isFinite(input.physics?.ground?.radiusM)
    || input.target.y < input.physics.ground.radiusM || input.actors.some(a => a.glovePosition.y < input.physics.ground.radiusM))
    throw new Error('invalid live relay holder, receiver or airborne target');
  const postStates = new Map<string, ReturnType<typeof estimateLivePostActionArrivalV1>>();
  const contextBasis = input.actors.find(a => a.postActionV120)?.postActionV120;
  for (const a of input.actors) if (a.postActionV120) {
    const c = a.postActionV120;
    if (c.clock.ticksPerSecond !== input.physics.air.ticksPerSecond || c.scopeId !== contextBasis!.scopeId
      || c.nowSeconds !== contextBasis!.nowSeconds || c.clock.originTick !== contextBasis!.clock.originTick)
      throw new Error('live relay: inconsistent post action snapshot');
    postStates.set(a.playerId, estimateLivePostActionArrivalV1({ ...c, actorId: a.playerId,
      actor: { ...a, remainingReactionSeconds: 0 }, target: c.knownAction.readySeconds > c.nowSeconds ? c.knownAction.position : a.position,
      arrivalMode: 'first_entry', radiusMeters: 0 }));
  }
  const postState = (a: LiveRelayActorV1) => a.postActionV120 && a.postActionV120.knownAction.readySeconds > a.postActionV120.nowSeconds
      ? postStates.get(a.playerId)!.stateAtReady : a,
    postWait = (a: LiveRelayActorV1, seconds: number): number => {
      const c = a.postActionV120!;
      const nowSeconds = c.nowSeconds + seconds, state = postState(a);
      return estimateLivePostActionArrivalV1({ ...c, nowSeconds,
        nowTick: quantizeEventTick(c.clock.originTick, nowSeconds, c.clock.ticksPerSecond), actorId: a.playerId,
        actor: { ...a, ...state, remainingReactionSeconds: 0 },
        target: c.knownAction.readySeconds > nowSeconds ? c.knownAction.position : state.position,
        arrivalMode: 'first_entry', radiusMeters: 0 }).remainingSeconds;
    }, receiverArrival = (a: LiveRelayActorV1, target: Vec3): number => a.postActionV120
      ? estimateLivePostActionArrivalV1({ ...a.postActionV120, actorId: a.playerId, actor: a, target,
        arrivalMode: 'receiver', radiusMeters: policy.baseTouchRadiusMeters }).remainingSeconds
      : estimateLiveReceiverArrivalV106(a, target, policy.baseTouchRadiusMeters);
  // Stopping destinations retain actual momentum: v*|v|/(2a). The live motor
  // must still reach them; this forecast neither moves nor brakes an actor.
  const relayBodyPoint = (a: LiveRelayActorV1): Vec3 => {
    const state = postState(a), speed = Math.hypot(state.velocity.x, state.velocity.z), factor = speed / (2 * a.accelerationMps2);
    return { x: state.position.x + state.velocity.x * factor, y: state.position.y, z: state.position.z + state.velocity.z * factor };
  }, bodyPoint = (a: LiveRelayActorV1) => a === holder ? postState(a).position : relayBodyPoint(a),
    point = (a: LiveRelayActorV1): Vec3 => a === receiver ? input.target : add(relayBodyPoint(a), sub(a.glovePosition, a.position)),
    receiverPoint = (a: LiveRelayActorV1): Vec3 => a === receiver ? { x: input.target.x, y: postState(a).position.y, z: input.target.z } : relayBodyPoint(a),
    remainingDistance = (a: LiveRelayActorV1) => flatDistance(bodyPoint(a), input.target),
    progresses = (from: LiveRelayActorV1, to: LiveRelayActorV1) => to === receiver
      || remainingDistance(to) + policy.minimumProgressMeters < remainingDistance(from);
  const handOffset = (from: LiveRelayActorV1, target: Vec3): Vec3 => {
    if (from.bodyModelV105) return liveFielderThrowOffsetV105(from.bodyModelV105, bodyPoint(from), target);
    const origin = bodyPoint(from), direction = { x: target.x - origin.x, y: 0, z: target.z - origin.z }, length = norm(direction),
      desired = add(mul(direction, input.throwHandOffset.forwardMeters / Math.max(length, 1e-30)),
        { x: 0, y: input.throwHandOffset.heightAboveHipMeters, z: 0 });
    return mul(desired, Math.min(1, from.gloveReachMeters / Math.max(norm(desired), 1e-30)));
  };
  const edgeGeometry = (from: LiveRelayActorV1, to: LiveRelayActorV1) => {
    const target = point(to), offset = handOffset(from, target),
      // The current holder's measured hand boundary is retained. For a future
      // secured relay, this offset is a hypothesis, not a custody assignment.
      preparation = createLiveBodyHandPreparationV105({ fromElapsedSeconds: 0, initialOffset: from.bodyModelV105 ? add(sub(from.glovePosition, from.position), { x:0,y:from.bodyPoseV105?.crouchMeters??0,z:0 }) : sub(from.glovePosition, from.position),
        initialRelativeVelocity: from === holder ? sub(from.gloveVelocity, from.velocity) : { x: 0, y: 0, z: 0 },
        targetOffset: offset, maximumRelativeSpeedMps: from.gloveSpeedMps, maximumReachMeters: from.gloveReachMeters }, from.bodyModelV105),
      releasePosition = add(bodyPoint(from), offset), bodyVelocity = from === holder ? input.holderReleaseBodyVelocityV110??postState(from).velocity : { x: 0, y: 0, z: 0 },
      d = sub(target, releasePosition), horizontal = Math.hypot(d.x, d.z), backspin = from.throwBackspinRadPerSecond ?? 0,
      spin = from.throwSpinRadPerSecond ?? (horizontal > 0 ? { x: -d.z / horizontal * backspin, y: 0, z: d.x / horizontal * backspin } : { x: 0, y: 0, z: 0 });
    return { target, receiverPoint: receiverPoint(to), releasePosition, bodyVelocity, spin,
      // After transfer, turning then hand preparation share time with charge.
      // The live motor still performs all three; this only aligns its forecast.
      normalPreparationAvailable:preparation.kind==='planned',
      preparationSeconds: (preparation.kind === 'planned'?preparation.durationSeconds:from.gloveTossV110?0:Infinity)
        +(from.bodyModelV105 ? liveFielderPreparationPostureSecondsV105(from.bodyModelV105,from.bodyPoseV105,bodyPoint(from),target) : 0),
      transferSeconds: from === holder ? input.holderTransferRemainingSeconds : from.transferSeconds,
      receiverArrivalSeconds: Math.max(receiverArrival(to, receiverPoint(to)),
        to === receiver ? 0 : (to.postActionV120 ? postWait(to, 0) : 0)
          + Math.hypot(postState(to).velocity.x, postState(to).velocity.z) / to.accelerationMps2),
      acquisitionSeconds: (to.gloveRadiusMeters + input.physics.ground.radiusM) / to.gloveSpeedMps,
      // An inspectable correction-time cost, not a calibrated success chance.
      directionRecoveryCostSeconds: flatDistance(releasePosition, target) * Math.tan(from.throwDirectionStdRadians ?? 0) / to.gloveSpeedMps };
  };
  const geometryCache = new Map<string, ReturnType<typeof edgeGeometry>>(),
    geometry = (from: LiveRelayActorV1, to: LiveRelayActorV1) => {
      const key = input.actors.indexOf(from) + ':' + input.actors.indexOf(to);
      let result = geometryCache.get(key); if (!result) { result = edgeGeometry(from, to); geometryCache.set(key, result); } return result;
    };
  const intermediates = input.actors.filter(a => a !== holder && a !== receiver
    && !input.excludedRelayPlayerIds?.includes(a.playerId) && progresses(holder, a));
  const routes: LiveRelayActorV1[][] = [[holder, receiver]];
  if (maximumIntermediateReceivers > 0) for (const a of intermediates) {
    routes.push([holder, a, receiver]);
    if (maximumIntermediateReceivers > 1) for (const b of intermediates) if (b !== a && progresses(a, b)) routes.push([holder, a, b, receiver]);
  }
  const cheapCost = (route: readonly LiveRelayActorV1[]) => {
    let seconds = 0, risk = 0;
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1], to = route[i], g = geometry(from, to),
        flight = Math.max(.05, norm(sub(g.target, g.releasePosition)) / (Math.min(from.throwSpeedMps,LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps) + norm(g.bodyVelocity)));
      seconds = Math.max((from.postActionV120 ? Math.max(seconds + Math.max(g.transferSeconds,g.preparationSeconds), seconds + postWait(from, seconds))
        : seconds + Math.max(g.transferSeconds,g.preparationSeconds)) + flight, g.receiverArrivalSeconds) + g.acquisitionSeconds;
      risk += g.directionRecoveryCostSeconds;
    }
    return seconds + risk;
  };
  // Always include direct, then the fastest cheap estimates. These estimates
  // only order a bounded search; they never certify an aerodynamic leg.
  const selected = [{ route: routes[0], cost: cheapCost(routes[0]) }, ...routes.slice(1).map((route, index) => ({ route, index, cost: cheapCost(route) }))
    .sort((a, b) => a.cost - b.cost || a.route.length - b.route.length || a.index - b.index)
    .slice(0, policy.maximumEvaluatedRoutes - 1)];
  const aeroCache = new Map<string, ReturnType<typeof planLiveTransferActionV110>>();
  let aerodynamicSolveCount = 0, aerodynamicCacheHits = 0, evaluatedRouteCount = 0, directSeconds = Infinity,
    earliestFallbackRouteCount=0,earliestFallbackSolveCount=0;
  type Route = { legs: LiveRelayLegV1[]; readySeconds: number; costSeconds: number };
  let best: Route | null = null;
  for (const candidate of selected) {
    // Direct is evaluated first. The cheap command-time estimate prunes relay
    // work which cannot improve its control cost under this tactical model.
    // Wind-driven acceleration can violate the speed-only optimistic estimate;
    // this remains a bounded heuristic, never a global optimality certificate.
    if (best && candidate.cost >= best.costSeconds) continue;
    const route = candidate.route;
    evaluatedRouteCount++;
    const evaluateTiming=(earliest:boolean):Route|null=>{
    let seconds = 0, risk = 0, feasible = true, material = input.materialOrientationAtRelease; const legs: LiveRelayLegV1[] = [];
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1], to = route[i], g = geometry(from, to);
      if (!Number.isFinite(g.preparationSeconds)) { feasible = false; break; }
      const receiverReadySeconds=Math.max(0,g.receiverArrivalSeconds-seconds),deadlineSeconds=earliest?0:Math.max(0,input.runnerArrivalSeconds-minimumMargin-seconds-g.acquisitionSeconds),
        chargeElapsedSeconds=i===1?(input.holderChargeElapsedSecondsV103??0):0,
        key = input.actors.indexOf(from) + ':' + input.actors.indexOf(to) + ':'+JSON.stringify({material:material??null,receiverReadySeconds,deadlineSeconds,chargeElapsedSeconds});
      let action = aeroCache.get(key);
      if (!action) {
        action = planLiveTransferActionV110({ releasePosition: g.releasePosition, bodyVelocity: g.bodyVelocity,
          capacityMps: from.throwSpeedMps, spin: g.spin, physics: input.physics, target: g.target,
          remainingTransferSeconds:g.transferSeconds,handPreparationSeconds:Math.max(0,g.preparationSeconds-g.transferSeconds),chargeElapsedSeconds,
          ...(from.throwEffortBuildSecondsV103===undefined?{}:{throwEffortBuildSecondsV103:from.throwEffortBuildSecondsV103}),receiverReadySeconds,deadlineSeconds,
          ...(input.preferStrongestFeasibleV103===undefined?{}:{preferStrongestFeasibleV103:input.preferStrongestFeasibleV103}),
          ...(material ? { materialOrientationAtRelease: material } : {}) },{...from,position:bodyPoint(from),velocity:g.bodyVelocity,
          glovePosition:add(bodyPoint(from),sub(from.glovePosition,from.position)),gloveVelocity:from===holder?from.gloveVelocity:g.bodyVelocity},2,g.normalPreparationAvailable,compareReadyReceiverTossV118);
        aerodynamicSolveCount+=action.transferVariantSolvesV110;aeroCache.set(key, action);
      } else aerodynamicCacheHits++;
      if (action.kind !== 'planned') { feasible = false; break; }
      const aero=action.forecast;
      // Future receipt is still a tactical hypothesis; actual secure custody replans.
      material = aero.predictedMaterialOrientation ?? material;
      // Any waiting belongs BEFORE release. The flight is never extended or
      // paused in mid-air to allow a late receiver to acquire possession.
      const releaseDelaySeconds = from.postActionV120 ? Math.max(action.releaseDelaySeconds, postWait(from, seconds)) : action.releaseDelaySeconds,
        earliestArrival = seconds + releaseDelaySeconds + aero.flightSeconds,
        waitingSeconds = Math.max(0, g.receiverArrivalSeconds - earliestArrival);
      seconds = earliestArrival + waitingSeconds + g.acquisitionSeconds; risk += g.directionRecoveryCostSeconds;
      legs.push({ throwerPlayerId: from.playerId, receiverPlayerId: to.playerId, target: g.target, receiverPoint: g.receiverPoint,
        intent: to === receiver ? 'base_cover' : 'relay', releasePosition: action.releasePositionV110, bodyVelocity: g.bodyVelocity, spin: action.spinV110,
        transferSeconds: g.transferSeconds, preparationSeconds: g.preparationSeconds, receiverArrivalSeconds: g.receiverArrivalSeconds,
        waitingSeconds, flightSeconds: aero.flightSeconds, readySeconds: seconds, directionRecoveryCostSeconds: g.directionRecoveryCostSeconds,
        initialVelocity: aero.initialVelocity,commandSpeedMps:action.commandSpeedMps,effort:action.effort,chargeSeconds:action.chargeSeconds,
        remainingChargeSeconds:action.remainingChargeSeconds,releaseDelaySeconds,
        selectionReason:action.selectionReason,outputSearchLimitApplied:action.outputSearchLimitApplied,
        releaseStyleV110:action.releaseStyleV110,capacityMps:action.capacityMps,fullChargeSecondsV110:action.fullChargeSecondsV110 });
    }
    return feasible?{legs,readySeconds:seconds,costSeconds:seconds+risk}:null;
    };
    let timed=evaluateTiming(false);
    // A greedy first-hop deadline cannot spend the time needed by later hops
    // and thereby certify that a real relay is too late. Re-evaluate this same
    // physical route once with earliest-control commands at every hop before
    // dropping it. Both passes share the edge cache and per-solve limits.
    if(timed&&timed.costSeconds+minimumMargin>=input.runnerArrivalSeconds){
      earliestFallbackRouteCount++;const solvesBefore=aerodynamicSolveCount,earliest=evaluateTiming(true);
      earliestFallbackSolveCount+=aerodynamicSolveCount-solvesBefore;
      if(earliest&&earliest.costSeconds<timed.costSeconds)timed=earliest;
    }
    if(!timed)continue;
    if(route.length===2)directSeconds=timed.readySeconds;
    if(!best||timed.costSeconds<best.costSeconds)best=timed;
  }
  const carrySeconds = holder.postActionV120 ? estimateLivePostActionArrivalV1({ ...holder.postActionV120, actorId: holder.playerId,
    actor: { ...holder, remainingReactionSeconds: 0 }, target: input.target, arrivalMode: 'first_entry', radiusMeters: policy.baseTouchRadiusMeters }).remainingSeconds
    : liveFieldArrivalSecondsV1({ ...holder, remainingReactionSeconds: 0 }, input.target, policy.baseTouchRadiusMeters),
    carryPreferred = !best || carrySeconds <= best.costSeconds,
    readySeconds = carryPreferred ? carrySeconds : best!.readySeconds,
    costSeconds = carryPreferred ? carrySeconds : best!.costSeconds,
    marginSeconds = input.runnerArrivalSeconds - costSeconds - minimumMargin,
    legs = !carryPreferred && marginSeconds > 0 ? best!.legs : input.keepLateRouteV1 && best ? best.legs : [], first = legs[0],
    kind = marginSeconds <= 0 ? 'hold' : carryPreferred ? 'carry' : legs.length === 1 ? 'direct' : 'relay';
  return freeze({ kind, finalBase: input.finalBase, runnerId: input.runnerId, readySeconds, marginSeconds, costSeconds, carrySeconds, directSeconds,
    firstHop: first ? { receiverPlayerId: first.receiverPlayerId, target: first.target, receiverPoint: first.receiverPoint, intent: first.intent } : null,
    legs, diagnostics: { basis: 'BOUNDED_AERO_RELAY_COMMAND_PREDICTION_V1', actualSourceRead: false, actualCatchGuaranteed: false,
      replanAfterReceiptRequired: true, candidateRouteCount: routes.length, evaluatedRouteCount, aerodynamicSolveCount, aerodynamicCacheHits,
      earliestFallbackRouteCount,earliestFallbackSolveCount,
      maximumIntermediateReceivers, maximumEvaluatedRoutes: policy.maximumEvaluatedRoutes, directReachable: Number.isFinite(directSeconds) } });
}
