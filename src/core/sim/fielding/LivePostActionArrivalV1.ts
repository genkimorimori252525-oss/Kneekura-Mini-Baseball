import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import { estimateLiveFieldArrivalV84 } from './LiveFieldArrivalV84';
import { estimateLiveReceiverArrivalV106 } from './LiveReceiverArrivalV106';

export type LivePostActionClockV1 = Readonly<{ originTick: number; ticksPerSecond: number }>;
export type LivePostActionActorV1 = Readonly<{ position: Vec3; velocity: Vec3; accelerationMps2: number;
  topSpeedMps: number; remainingReactionSeconds: number }>;
export type LivePostActionProvenanceV1 = Readonly<{ kind: 'self' | 'observed' | 'received'; scopeId: string;
  actorId: string; sourceId: string; revision: number; observedSeconds: number; observedTick: number;
  validThroughSeconds: number; receivedSeconds?: number; receivedTick?: number }>;
export type LiveKnownPostActionV1 = Readonly<{ readySeconds: number; readyTick: number; position: Vec3; velocity: Vec3;
  uncertaintySeconds: number; provenance: LivePostActionProvenanceV1 }>;
/** Immutable actor-snapshot clock. Route elapsed time advances this boundary
 * once; aging a stored estimate does not rewrite this observed snapshot. */
export type LivePostActionContextV120 = Readonly<{ clock: LivePostActionClockV1; scopeId: string;
  nowSeconds: number; nowTick: number; knownAction: LiveKnownPostActionV1 }>;
export type LivePostActionArrivalInputV1 = Readonly<{ clock: LivePostActionClockV1; scopeId: string; actorId: string;
  nowSeconds: number; nowTick: number; actor: LivePostActionActorV1; target: Vec3;
  arrivalMode: 'first_entry' | 'receiver'; radiusMeters?: number; notBeforeSeconds?: number;
  knownAction?: LiveKnownPostActionV1; expectedActionRevision?: number }>;
export type LivePostActionArrivalEstimateV1 = Readonly<{ knowledge: 'not_provided' | LivePostActionProvenanceV1['kind'];
  actionReadySeconds: number | null; actionReadyTick: number | null; estimateFromSeconds: number;
  stateAtReady: Readonly<{ position: Vec3; velocity: Vec3 }>; locomotionSeconds: number; remainingSeconds: number;
  arrivalSeconds: number; arrivalTick: number; uncertaintySeconds: number | null }>;
export type LiveObservedPostActionInputV1 = Readonly<{ clock: LivePostActionClockV1; provenance: LivePostActionProvenanceV1;
  recoveryRemainingSeconds: number; position: Vec3; velocity: Vec3; uncertaintySeconds: number }>;
export type LivePostActionReadinessInputV1 = Readonly<{ clock: LivePostActionClockV1; nowSeconds: number; nowTick: number;
  recoveryReadySeconds?: number; recognitionReadySeconds?: number; transferReadySeconds?: number;
  controlReadySeconds?: number; postureReadySeconds?: number; handReadySeconds?: number;
  charge?: Readonly<{ durationSeconds: number; startsAfter: 'transfer' | 'recovery_and_transfer' }> }>;
export type LivePostActionReadinessV1 = Readonly<{ movementReadySeconds: number; movementReadyTick: number;
  chargeReadySeconds: number | null; chargeReadyTick: number | null; releaseReadySeconds: number; releaseReadyTick: number }>;

const requireValue = (condition: unknown, message: string): void => {
  if (!condition) throw new Error('live post action V1: ' + message);
};
const nonnegative = (n: number): boolean => Number.isFinite(n) && n >= 0;
const identifier = (s: string): boolean => typeof s === 'string' && s.trim().length > 0;
const vector = (p: Vec3): boolean => !!p && [p.x, p.y, p.z].every(Number.isFinite);
const copy = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });
const atTick = (clock: LivePostActionClockV1, seconds: number): number =>
  quantizeEventTick(clock.originTick, seconds, clock.ticksPerSecond);
const validateClock = (clock: LivePostActionClockV1): void => {
  requireValue(clock && Number.isSafeInteger(clock.originTick) && clock.originTick >= 0
    && Number.isSafeInteger(clock.ticksPerSecond) && clock.ticksPerSecond > 0, 'invalid clock');
};
const validateTime = (clock: LivePostActionClockV1, seconds: number, tick: number): void => {
  requireValue(nonnegative(seconds) && Number.isSafeInteger(tick) && atTick(clock, seconds) === tick, 'inconsistent seconds/tick');
};
const validateProvenance = (clock: LivePostActionClockV1, p: LivePostActionProvenanceV1): void => {
  requireValue(p && ['self', 'observed', 'received'].includes(p.kind) && identifier(p.scopeId)
    && identifier(p.actorId) && identifier(p.sourceId) && Number.isSafeInteger(p.revision) && p.revision >= 0,
  'unknown action source');
  validateTime(clock, p.observedSeconds, p.observedTick);
  requireValue(nonnegative(p.validThroughSeconds) && p.validThroughSeconds >= p.observedSeconds, 'invalid source validity');
  // Check representability even though validity is compared in exact seconds.
  atTick(clock, p.validThroughSeconds);
  if (p.kind === 'received') {
    validateTime(clock, p.receivedSeconds!, p.receivedTick!);
    requireValue(p.receivedSeconds! >= p.observedSeconds && p.receivedSeconds! <= p.validThroughSeconds, 'invalid delivery time');
  } else requireValue(p.receivedSeconds === undefined && p.receivedTick === undefined, 'unexpected delivery time');
};

/** Tactical estimate only. The caller supplies its own committed endpoint or a
 * personally observed/received estimate; this module never reads world truth.
 * Missing action data means not_provided, not a confirmed unrestricted actor.
 * A future endpoint is used only until ready; an elapsed action cannot rewind
 * the supplied current state. All seconds are exact elapsed time from origin.
 * No contact, possession, release or adjudication event is generated here. */
export function estimateLivePostActionArrivalV1(input: LivePostActionArrivalInputV1): LivePostActionArrivalEstimateV1 {
  requireValue(input, 'input required');
  validateClock(input.clock);
  validateTime(input.clock, input.nowSeconds, input.nowTick);
  requireValue(identifier(input.scopeId) && identifier(input.actorId), 'scope/actor required');
  const actor = input.actor, known = input.knownAction;
  requireValue(actor && vector(actor.position) && vector(actor.velocity) && vector(input.target)
    && Number.isFinite(actor.topSpeedMps) && actor.topSpeedMps > 0
    && Number.isFinite(actor.accelerationMps2) && actor.accelerationMps2 > 0
    && nonnegative(actor.remainingReactionSeconds), 'invalid actor/target');
  requireValue(input.arrivalMode === 'first_entry' || input.arrivalMode === 'receiver', 'invalid arrival mode');
  requireValue(input.radiusMeters === undefined || nonnegative(input.radiusMeters), 'invalid radius');
  requireValue(input.notBeforeSeconds === undefined || nonnegative(input.notBeforeSeconds), 'invalid availability');
  if (input.expectedActionRevision !== undefined) requireValue(known && Number.isSafeInteger(input.expectedActionRevision)
    && input.expectedActionRevision >= 0, 'revision without action');
  if (known) {
    validateTime(input.clock, known.readySeconds, known.readyTick);
    requireValue(vector(known.position) && vector(known.velocity) && nonnegative(known.uncertaintySeconds), 'invalid action boundary');
    validateProvenance(input.clock, known.provenance);
    const p = known.provenance;
    requireValue(p.scopeId === input.scopeId && p.actorId === input.actorId, 'action scope/actor differs');
    requireValue(p.observedSeconds <= input.nowSeconds && (p.receivedSeconds ?? p.observedSeconds) <= input.nowSeconds,
      'action knowledge not yet available');
    requireValue(input.nowSeconds <= p.validThroughSeconds, 'stale action knowledge');
    requireValue(input.expectedActionRevision === undefined || input.expectedActionRevision === p.revision, 'stale action revision');
  }
  const future = !!known && known.readySeconds > input.nowSeconds,
    estimateFromSeconds = future ? known.readySeconds : input.nowSeconds,
    delay = estimateFromSeconds - input.nowSeconds,
    notBefore = Math.max(estimateFromSeconds, input.notBeforeSeconds ?? estimateFromSeconds),
    position = future ? known.position : actor.position, velocity = future ? known.velocity : actor.velocity;
  // Additional availability waits use the existing motor's reaction/braking
  // model at the ready boundary, rather than freezing a moving endpoint until
  // another timestamp. Recognition elapsed during the action is removed once.
  const motorActor = delay > 0 || notBefore > estimateFromSeconds ? { ...actor, position, velocity,
    remainingReactionSeconds: Math.max(0, actor.remainingReactionSeconds - delay, notBefore - estimateFromSeconds) } : actor;
  const locomotionSeconds = input.arrivalMode === 'receiver'
    ? estimateLiveReceiverArrivalV106(motorActor, input.target, input.radiusMeters)
    : estimateLiveFieldArrivalV84(motorActor, input.target, input.radiusMeters);
  // Old helpers return zero inside the radius before checking reaction. Keep
  // that legacy arithmetic when unrestricted, but never bypass a known gate.
  const afterReadySeconds = Math.max(locomotionSeconds, notBefore - estimateFromSeconds),
    remainingSeconds = delay + afterReadySeconds, arrivalSeconds = estimateFromSeconds + afterReadySeconds;
  requireValue(nonnegative(remainingSeconds), 'nonfinite arrival');
  return { knowledge: known?.provenance.kind ?? 'not_provided', actionReadySeconds: known?.readySeconds ?? null,
    actionReadyTick: known?.readyTick ?? null, estimateFromSeconds,
    stateAtReady: { position: copy(position), velocity: copy(velocity) }, locomotionSeconds, remainingSeconds, arrivalSeconds,
    arrivalTick: atTick(input.clock, arrivalSeconds), uncertaintySeconds: known?.uncertaintySeconds ?? null };
}

/** Convert an observation-relative residual exactly once. Requeries consume
 * the returned absolute ready time; they must not subtract observation age
 * again. position/velocity describe the estimated ready boundary, not the
 * observation's airborne/sliding state. No endpoint is invented by this API. */
export function createLiveObservedPostActionV1(input: LiveObservedPostActionInputV1): LiveKnownPostActionV1 {
  requireValue(input, 'observation input required');
  validateClock(input.clock);
  validateProvenance(input.clock, input.provenance);
  requireValue(input.provenance.kind !== 'self', 'observation adapter requires observed/received source');
  requireValue(nonnegative(input.recoveryRemainingSeconds) && nonnegative(input.uncertaintySeconds)
    && vector(input.position) && vector(input.velocity), 'invalid observation boundary');
  const readySeconds = input.provenance.observedSeconds + input.recoveryRemainingSeconds;
  return { readySeconds, readyTick: atTick(input.clock, readySeconds), position: copy(input.position), velocity: copy(input.velocity),
    uncertaintySeconds: input.uncertaintySeconds, provenance: { ...input.provenance } };
}

/** Absolute dependency gates. Transfer/hand readiness do not stop locomotion;
 * release needs all gates. Charge depends on the explicitly selected profile.
 * Past absolute transfer/charge starts stay past when this estimate is queried
 * again. The existing throw law still owns actual preparation and release. */
export function resolveLivePostActionReadinessV1(input: LivePostActionReadinessInputV1): LivePostActionReadinessV1 {
  requireValue(input, 'readiness input required');
  validateClock(input.clock);
  validateTime(input.clock, input.nowSeconds, input.nowTick);
  for (const seconds of [input.recoveryReadySeconds, input.recognitionReadySeconds, input.transferReadySeconds,
    input.controlReadySeconds, input.postureReadySeconds, input.handReadySeconds])
    requireValue(seconds === undefined || nonnegative(seconds), 'invalid ready gate');
  const recovery = input.recoveryReadySeconds ?? 0, transfer = input.transferReadySeconds ?? input.nowSeconds,
    movementReadySeconds = Math.max(input.nowSeconds, recovery, input.recognitionReadySeconds ?? input.nowSeconds,
      input.controlReadySeconds ?? input.nowSeconds, input.postureReadySeconds ?? input.nowSeconds);
  let chargeReadySeconds: number | null = null;
  if (input.charge) {
    requireValue(input.transferReadySeconds !== undefined && nonnegative(input.charge.durationSeconds)
      && ['transfer', 'recovery_and_transfer'].includes(input.charge.startsAfter),
      'invalid charge dependency');
    chargeReadySeconds = (input.charge.startsAfter === 'transfer' ? transfer : Math.max(transfer, recovery)) + input.charge.durationSeconds;
  }
  const releaseReadySeconds = Math.max(movementReadySeconds, transfer, input.handReadySeconds ?? input.nowSeconds,
    chargeReadySeconds ?? input.nowSeconds);
  return { movementReadySeconds, movementReadyTick: atTick(input.clock, movementReadySeconds), chargeReadySeconds,
    chargeReadyTick: chargeReadySeconds === null ? null : atTick(input.clock, chargeReadySeconds),
    releaseReadySeconds, releaseReadyTick: atTick(input.clock, releaseReadySeconds) };
}
