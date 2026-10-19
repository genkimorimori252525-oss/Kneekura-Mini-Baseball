import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BaseballBase } from '../../rules/PhysicalRuleFacts';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import { liveFieldArrivalSecondsV1, type LiveFieldRoleActorV1 } from './LiveFieldRoleAssignmentV1';
import { createLiveHandPreparationV1 } from './LiveHandPreparationV1';
import { planLiveThrowV1 } from './LiveThrowPlanV1';
import type { Quaternion } from '../pitching/BaseballOrientation';

export type LiveRelayActorV1 = LiveFieldRoleActorV1 & Readonly<{
  glovePosition: Vec3; gloveVelocity: Vec3; gloveSpeedMps: number; gloveReachMeters: number; gloveRadiusMeters: number;
  transferSeconds: number; throwDirectionStdRadians?: number; throwBackspinRadPerSecond?: number; throwSpinRadPerSecond?: Vec3;
}>;
export type LiveRelayPlanInputV1 = Readonly<{
  actors: readonly LiveRelayActorV1[]; holderPlayerId: string; receiverPlayerId: string;
  finalBase: BaseballBase; runnerId: string; target: Vec3; runnerArrivalSeconds: number;
  holderTransferRemainingSeconds: number; physics: AeroGroundBallPhysicsV1;
  throwHandOffset: Readonly<{ forwardMeters: number; heightAboveHipMeters: number }>;
  maximumIntermediateReceivers?: 0 | 1 | 2; minimumMarginSeconds?: number; excludedRelayPlayerIds?: readonly string[];
  materialOrientationAtRelease?: Quaternion;
}>;
export type LiveRelayLegV1 = Readonly<{
  throwerPlayerId: string; receiverPlayerId: string; target: Vec3; receiverPoint: Vec3;
  intent: 'relay' | 'base_cover'; releasePosition: Vec3; bodyVelocity: Vec3; spin: Vec3;
  transferSeconds: number; preparationSeconds: number; receiverArrivalSeconds: number; waitingSeconds: number;
  flightSeconds: number; readySeconds: number; directionRecoveryCostSeconds: number;
  initialVelocity: Vec3;
}>;
export type LiveRelayPlanV1 = Readonly<{
  kind: 'carry' | 'direct' | 'relay' | 'hold'; finalBase: BaseballBase; runnerId: string;
  readySeconds: number; marginSeconds: number; costSeconds: number; carrySeconds: number; directSeconds: number;
  firstHop: Readonly<{ receiverPlayerId: string; target: Vec3; receiverPoint: Vec3; intent: 'relay' | 'base_cover' }> | null;
  legs: readonly LiveRelayLegV1[];
  diagnostics: Readonly<{ basis: 'BOUNDED_AERO_RELAY_COMMAND_PREDICTION_V1'; actualSourceRead: false;
    actualCatchGuaranteed: false; replanAfterReceiptRequired: true; candidateRouteCount: number;
    evaluatedRouteCount: number; aerodynamicSolveCount: number; aerodynamicCacheHits: number;
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
  'holderTransferRemainingSeconds', 'physics', 'throwHandOffset', 'maximumIntermediateReceivers', 'minimumMarginSeconds', 'excludedRelayPlayerIds', 'materialOrientationAtRelease'];

/** Routes an intended throw using only present actor state and an explicit
 * runner estimate. Intermediate receivers are actual actors at their current
 * braking point with the measured body-relative glove offset, never an
 * invented midpoint or possession. Future relay poses are stationary tactical
 * estimates after receipt; only a new plan from the
 * actual secured catch may issue the next command. No actor, ball, base-touch,
 * catch, custody or out fact is created by this function. */
export function planLiveRelayV1(raw: LiveRelayPlanInputV1): LiveRelayPlanV1 {
  const input = cloneInert(raw), policy = LIVE_RELAY_PLAN_POLICY_V1,
    maximumIntermediateReceivers = input.maximumIntermediateReceivers ?? policy.maximumIntermediateReceivers,
    minimumMargin = input.minimumMarginSeconds ?? 0;
  if (!input || Object.keys(input).some(key => !allowedInputKeys.includes(key)) || !Array.isArray(input.actors)
    || input.actors.length < 2 || input.actors.length > 9 || new Set(input.actors.map(a => a.playerId)).size !== input.actors.length
    || ![1, 2, 3, 4].includes(input.finalBase) || !input.runnerId || !finite(input.target)
    || ![input.runnerArrivalSeconds, input.holderTransferRemainingSeconds, minimumMargin].every(n => Number.isFinite(n) && n >= 0)
    || ![0, 1, 2].includes(maximumIntermediateReceivers)
    || input.excludedRelayPlayerIds !== undefined && (!Array.isArray(input.excludedRelayPlayerIds)
      || input.excludedRelayPlayerIds.some(id => typeof id !== 'string' || !id))
    || !input.throwHandOffset || ![input.throwHandOffset.forwardMeters, input.throwHandOffset.heightAboveHipMeters].every(n => Number.isFinite(n) && n >= 0)
    || input.actors.some(a => !a.playerId || ![a.position, a.velocity, a.homePosition, a.glovePosition, a.gloveVelocity].every(finite)
      || ![a.topSpeedMps, a.accelerationMps2, a.throwSpeedMps, a.gloveSpeedMps, a.gloveReachMeters, a.gloveRadiusMeters].every(n => Number.isFinite(n) && n > 0)
      || a.throwSpeedMps > 120 || ![a.remainingReactionSeconds, a.transferSeconds].every(n => Number.isFinite(n) && n >= 0)
      || !Number.isFinite(a.throwDirectionStdRadians ?? 0) || (a.throwDirectionStdRadians ?? 0) < 0 || (a.throwDirectionStdRadians ?? 0) > .12
      || !Number.isFinite(a.throwBackspinRadPerSecond ?? 0) || (a.throwBackspinRadPerSecond ?? 0) < 0
      || a.throwSpinRadPerSecond !== undefined && !finite(a.throwSpinRadPerSecond))) throw new Error('invalid live relay plan actors, target or policy');
  const holder = input.actors.find(a => a.playerId === input.holderPlayerId), receiver = input.actors.find(a => a.playerId === input.receiverPlayerId);
  if (!holder || !receiver || holder === receiver || !Number.isFinite(input.physics?.ground?.radiusM)
    || input.target.y < input.physics.ground.radiusM || input.actors.some(a => a.glovePosition.y < input.physics.ground.radiusM))
    throw new Error('invalid live relay holder, receiver or airborne target');
  // Stopping destinations retain actual momentum: v*|v|/(2a). The live motor
  // must still reach them; this forecast neither moves nor brakes an actor.
  const relayBodyPoint = (a: LiveRelayActorV1): Vec3 => {
    const speed = Math.hypot(a.velocity.x, a.velocity.z), factor = speed / (2 * a.accelerationMps2);
    return { x: a.position.x + a.velocity.x * factor, y: a.position.y, z: a.position.z + a.velocity.z * factor };
  }, bodyPoint = (a: LiveRelayActorV1) => a === holder ? a.position : relayBodyPoint(a),
    point = (a: LiveRelayActorV1): Vec3 => a === receiver ? input.target : add(relayBodyPoint(a), sub(a.glovePosition, a.position)),
    receiverPoint = (a: LiveRelayActorV1): Vec3 => a === receiver ? { x: input.target.x, y: a.position.y, z: input.target.z } : relayBodyPoint(a),
    remainingDistance = (a: LiveRelayActorV1) => flatDistance(bodyPoint(a), input.target),
    progresses = (from: LiveRelayActorV1, to: LiveRelayActorV1) => to === receiver
      || remainingDistance(to) + policy.minimumProgressMeters < remainingDistance(from);
  const handOffset = (from: LiveRelayActorV1, target: Vec3): Vec3 => {
    const origin = bodyPoint(from), direction = { x: target.x - origin.x, y: 0, z: target.z - origin.z }, length = norm(direction),
      desired = add(mul(direction, input.throwHandOffset.forwardMeters / Math.max(length, 1e-30)),
        { x: 0, y: input.throwHandOffset.heightAboveHipMeters, z: 0 });
    return mul(desired, Math.min(1, from.gloveReachMeters / Math.max(norm(desired), 1e-30)));
  };
  const edgeGeometry = (from: LiveRelayActorV1, to: LiveRelayActorV1) => {
    const target = point(to), offset = handOffset(from, target),
      // The current holder's measured hand boundary is retained. For a future
      // secured relay, this offset is a hypothesis, not a custody assignment.
      preparation = createLiveHandPreparationV1({ fromElapsedSeconds: 0, initialOffset: sub(from.glovePosition, from.position),
        initialRelativeVelocity: from === holder ? sub(from.gloveVelocity, from.velocity) : { x: 0, y: 0, z: 0 },
        targetOffset: offset, maximumRelativeSpeedMps: from.gloveSpeedMps, maximumReachMeters: from.gloveReachMeters }),
      releasePosition = add(bodyPoint(from), offset), bodyVelocity = from === holder ? from.velocity : { x: 0, y: 0, z: 0 },
      d = sub(target, releasePosition), horizontal = Math.hypot(d.x, d.z), backspin = from.throwBackspinRadPerSecond ?? 0,
      spin = from.throwSpinRadPerSecond ?? (horizontal > 0 ? { x: -d.z / horizontal * backspin, y: 0, z: d.x / horizontal * backspin } : { x: 0, y: 0, z: 0 });
    return { target, receiverPoint: receiverPoint(to), releasePosition, bodyVelocity, spin,
      preparationSeconds: preparation.kind === 'planned' ? preparation.durationSeconds : Infinity,
      transferSeconds: from === holder ? input.holderTransferRemainingSeconds : from.transferSeconds,
      receiverArrivalSeconds: Math.max(liveFieldArrivalSecondsV1(to, receiverPoint(to), policy.baseTouchRadiusMeters),
        to === receiver ? 0 : Math.hypot(to.velocity.x, to.velocity.z) / to.accelerationMps2),
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
        flight = Math.max(.05, norm(sub(g.target, g.releasePosition)) / (from.throwSpeedMps + norm(g.bodyVelocity)));
      seconds = Math.max(seconds + g.transferSeconds + g.preparationSeconds + flight, g.receiverArrivalSeconds) + g.acquisitionSeconds;
      risk += g.directionRecoveryCostSeconds;
    }
    return seconds + risk;
  };
  // Always include direct, then the fastest cheap estimates. These estimates
  // only order a bounded search; they never certify an aerodynamic leg.
  const selected = [{ route: routes[0], cost: cheapCost(routes[0]) }, ...routes.slice(1).map((route, index) => ({ route, index, cost: cheapCost(route) }))
    .sort((a, b) => a.cost - b.cost || a.route.length - b.route.length || a.index - b.index)
    .slice(0, policy.maximumEvaluatedRoutes - 1)];
  const aeroCache = new Map<string, ReturnType<typeof planLiveThrowV1>>();
  let aerodynamicSolveCount = 0, aerodynamicCacheHits = 0, evaluatedRouteCount = 0, directSeconds = Infinity;
  type Route = { legs: LiveRelayLegV1[]; readySeconds: number; costSeconds: number };
  let best: Route | null = null;
  for (const candidate of selected) {
    // Direct is evaluated first. The cheap command-time estimate prunes relay
    // work which cannot improve its control cost under this tactical model.
    // Wind-driven acceleration can violate the speed-only optimistic estimate;
    // this remains a bounded heuristic, never a global optimality certificate.
    if (best && candidate.cost >= best.costSeconds) continue;
    const route = candidate.route;
    evaluatedRouteCount++; let seconds = 0, risk = 0, feasible = true, material = input.materialOrientationAtRelease; const legs: LiveRelayLegV1[] = [];
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1], to = route[i], g = geometry(from, to);
      if (!Number.isFinite(g.preparationSeconds)) { feasible = false; break; }
      const key = input.actors.indexOf(from) + ':' + input.actors.indexOf(to) + (material ? ':' + JSON.stringify(material) : '');
      let aero = aeroCache.get(key);
      if (!aero) {
        aerodynamicSolveCount++; aero = planLiveThrowV1({ releasePosition: g.releasePosition, bodyVelocity: g.bodyVelocity,
          maximumThrowSpeedMps: from.throwSpeedMps, spin: g.spin, physics: input.physics, target: g.target,
          ...(material ? { materialOrientationAtRelease: material } : {}) }); aeroCache.set(key, aero);
      } else aerodynamicCacheHits++;
      if (aero.kind !== 'planned') { feasible = false; break; }
      // Future receipt is still a tactical hypothesis; actual secure custody replans.
      material = aero.predictedMaterialOrientation ?? material;
      const earliestArrival = seconds + g.transferSeconds + g.preparationSeconds + aero.flightSeconds,
        waitingSeconds = Math.max(0, g.receiverArrivalSeconds - earliestArrival);
      seconds = earliestArrival + waitingSeconds + g.acquisitionSeconds; risk += g.directionRecoveryCostSeconds;
      legs.push({ throwerPlayerId: from.playerId, receiverPlayerId: to.playerId, target: g.target, receiverPoint: g.receiverPoint,
        intent: to === receiver ? 'base_cover' : 'relay', releasePosition: g.releasePosition, bodyVelocity: g.bodyVelocity, spin: g.spin,
        transferSeconds: g.transferSeconds, preparationSeconds: g.preparationSeconds, receiverArrivalSeconds: g.receiverArrivalSeconds,
        waitingSeconds, flightSeconds: aero.flightSeconds, readySeconds: seconds, directionRecoveryCostSeconds: g.directionRecoveryCostSeconds,
        initialVelocity: aero.initialVelocity });
    }
    if (!feasible) continue;
    if (route.length === 2) directSeconds = seconds;
    const costSeconds = seconds + risk;
    if (!best || costSeconds < best.costSeconds) best = { legs, readySeconds: seconds, costSeconds };
  }
  const carrySeconds = liveFieldArrivalSecondsV1({ ...holder, remainingReactionSeconds: 0 }, input.target, policy.baseTouchRadiusMeters),
    carryPreferred = !best || carrySeconds <= best.costSeconds,
    readySeconds = carryPreferred ? carrySeconds : best!.readySeconds,
    costSeconds = carryPreferred ? carrySeconds : best!.costSeconds,
    marginSeconds = input.runnerArrivalSeconds - costSeconds - minimumMargin,
    legs = !carryPreferred && marginSeconds > 0 ? best!.legs : [], first = legs[0],
    kind = marginSeconds <= 0 ? 'hold' : carryPreferred ? 'carry' : legs.length === 1 ? 'direct' : 'relay';
  return freeze({ kind, finalBase: input.finalBase, runnerId: input.runnerId, readySeconds, marginSeconds, costSeconds, carrySeconds, directSeconds,
    firstHop: first ? { receiverPlayerId: first.receiverPlayerId, target: first.target, receiverPoint: first.receiverPoint, intent: first.intent } : null,
    legs, diagnostics: { basis: 'BOUNDED_AERO_RELAY_COMMAND_PREDICTION_V1', actualSourceRead: false, actualCatchGuaranteed: false,
      replanAfterReceiptRequired: true, candidateRouteCount: routes.length, evaluatedRouteCount, aerodynamicSolveCount, aerodynamicCacheHits,
      maximumIntermediateReceivers, maximumEvaluatedRoutes: policy.maximumEvaluatedRoutes, directReachable: Number.isFinite(directSeconds) } });
}
