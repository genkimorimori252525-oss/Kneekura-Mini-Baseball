import { validateBattedWorldScheduledFieldAcquisitionPlan, validateBattedWorldScheduledFieldAcquisitionProgress, type BattedWorldScheduledFieldAcquisitionPlan, type BattedWorldScheduledFieldAcquisitionAdvance } from './BattedWorldScheduledFieldAcquisition';
import { adoptPiecewiseFieldMotionStep, clonePiecewiseReplayInput, queryPiecewiseFieldMotion, validatePiecewiseFieldActors, piecewiseFiniteData, type PiecewiseFieldMotionStep, type BattedWorldPiecewiseFieldMotionPiece } from './BattedWorldPiecewiseFieldMotion';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { CatchRetentionResolution } from '../fielding/CatchRetention';
import { quantizeEventTick } from '../ExactEventTime';
import type { AcceleratedBallWorldMotion, BallWorldMoment } from './BallWorldContinuation';
import type { BallWorldBaseBoundaryContact } from './BallWorldBaseBoundary';
import type { BattedWorldCaptureTransport } from './BattedWorldAcquisition';
import type { BattedWorldFieldAcquisition, BattedWorldFieldAcquisitionInput } from './BattedWorldFieldAcquisition';
import { respondToBattedWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { assertBattedWorldFieldExecutionScope, freezeBattedWorldField, hasBattedWorldFieldFields } from './BattedWorldFieldExecution';

/** Immutable admission metadata, never an executed capture or possession result. */
export type BattedWorldPiecewiseFieldAcquisitionPlan = Readonly<{
  input: BattedWorldFieldAcquisitionInput;
  bridge: Readonly<{ plan: BattedWorldScheduledFieldAcquisitionPlan; progress: BattedWorldScheduledFieldAcquisitionAdvance | null }> | null;
  policy: 'piecewise_original_energy_recorded_tick_fence_v1';
  acquirerPlayerId: string;
  contactMoment: BallWorldMoment;
  retention: CatchRetentionResolution;
  initialConstraintMoment: BallWorldMoment;
  contactOffset: Vec3;
  initialEnergyJ: number;
  captureDissipationPowerW: number;
  secureElapsedSeconds: number;
  candidateSecureTick: number;
  archivedCandidateSecureTick: number;
  fenceElapsedSeconds: number;
  initialCoverageThroughTick: number;
}>;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const vector = (value: Vec3) => !!value && [value.x, value.y, value.z].every(Number.isFinite);
const finiteData = (value: unknown): boolean => typeof value === 'number' ? Number.isFinite(value)
  : value !== null && typeof value === 'object' ? Object.values(value).every(finiteData) : true;
const sameVector = (a: Vec3, b: Vec3): boolean => vector(a) && vector(b) && (['x', 'y', 'z'] as const).every((axis) =>
  Number.isFinite(a[axis]) && Math.abs(a[axis] - b[axis]) <= Number.EPSILON * Math.max(1, Math.abs(a[axis]), Math.abs(b[axis])) * 32);

/** Revalidate the adopted candidate without querying any future collision interval. */
export const prepareBattedWorldPiecewiseFieldAcquisition = (raw: BattedWorldFieldAcquisitionInput): BattedWorldPiecewiseFieldAcquisitionPlan => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['response', 'geometry', 'field']) || !hasBattedWorldFieldFields(input.field, ['motion', 'baseContacts'])) {
    throw new Error('invalid actual field acquisition scope');
  }
  if (!finiteData(input)) throw new Error('nonfinite scheduled field acquisition scope');
  const { response, geometry, field } = input, { motion } = field, world = motion.world;
  assertBattedWorldFieldExecutionScope(response, geometry);
  if (!hasBattedWorldFieldFields(motion, ['actors', 'carrierPlayerId', 'world', 'response', 'cursor'])
    || !Array.isArray(motion.actors) || motion.carrierPlayerId !== null || motion.cursor !== null || motion.response.kind !== 'capture_candidate' || world.kind !== 'boundary'
    || !('phase' in world) || world.pendingReason || world.contacts.length !== 1 || !Array.isArray(field.baseContacts) || field.baseContacts.length !== 0) {
    throw new Error('actual field sole glove acquisition candidate is missing');
  }
  const contact = world.contacts[0], contactMoment = world.moment;
  if (contact.kind !== 'actor' || contact.role !== 'glove' || contact.continuing || !contact.normal
    || JSON.stringify(contact.moment) !== JSON.stringify(contactMoment)) throw new Error('actual field glove contact candidate differs');
  const acquirerPlayerId = contact.playerId;
  const primitive = motion.actors.find((actor) => actor.playerId === acquirerPlayerId && actor.primitive.role === 'glove');
  const profile = response.actors.find((actor) => actor.playerId === acquirerPlayerId && actor.profile.role === 'glove')?.profile;
  if (!primitive || profile?.role !== 'glove' || motion.actors.length !== response.actors.length
    || motion.actors.some((actor) => !response.actors.some((model) => model.playerId === actor.playerId && model.profile.role === actor.primitive.role))) {
    throw new Error('actual field acquisition actor coverage differs');
  }
  const p = response.world.parameters, s = primitive.primitive;
  const unit = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
  if (!tick(p.ticksPerSecond) || p.ticksPerSecond === 0 || !Number.isFinite(p.gravityY)
    || !Number.isFinite(p.ballRadius) || p.ballRadius <= 0 || !unit(p.groundRestitution) || !unit(p.groundFriction)
    || typeof p.groundRollingDecelerationMps2 !== 'number' || !Number.isFinite(p.groundRollingDecelerationMps2) || p.groundRollingDecelerationMps2 < 0
    || !Number.isFinite(p.restingVerticalSpeed) || p.restingVerticalSpeed < 0
    || !tick(p.integrationStepTicks) || p.integrationStepTicks === 0) throw new Error('invalid scheduled field acquisition physical parameters');
  const dt = (contactMoment.originTick - s.startTick) / p.ticksPerSecond + contactMoment.elapsedSeconds - (primitive.startElapsedSeconds ?? 0);
  const center = (axis: keyof Vec3) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
  const velocity = (axis: keyof Vec3) => s.startVelocity[axis] + s.acceleration[axis] * dt;
  const offset = { x: contactMoment.ball.position.x - contact.center.x, y: contactMoment.ball.position.y - contact.center.y,
    z: contactMoment.ball.position.z - contact.center.z }, length = Math.hypot(offset.x, offset.y, offset.z), radius = p.ballRadius + s.radius;
  if (!sameVector(contact.center, { x: center('x'), y: center('y'), z: center('z') })
    || !sameVector(contact.velocity, { x: velocity('x'), y: velocity('y'), z: velocity('z') }) || !Number.isFinite(length) || length === 0
    || length > radius + Number.EPSILON * Math.max(1, radius, ...Object.values(contact.center).map(Math.abs)) * 32
    || !sameVector(contact.normal, { x: offset.x / length, y: offset.y / length, z: offset.z / length })) {
    throw new Error('actual field acquisition contact geometry differs');
  }
  const candidate = respondToBattedWorldBoundary(response, { moment: contactMoment, previousContacts: [] }, world);
  if (candidate.kind !== 'capture_candidate' || JSON.stringify(candidate) !== JSON.stringify(motion.response)) {
    throw new Error('actual field acquisition retention candidate differs');
  }
  const retention = candidate.retention;
  if (retention.outcome.kind !== 'secured') throw new Error('actual field retention candidate is missing');
  const initialEnergyJ = retention.diagnostics.retentionLoadJ, power = profile.parameters.captureDissipationPowerW;
  const settleSeconds = initialEnergyJ / power, secureElapsedSeconds = contactMoment.elapsedSeconds + settleSeconds;
  if (!Number.isFinite(initialEnergyJ) || initialEnergyJ < 0 || !Number.isFinite(secureElapsedSeconds)
    || initialEnergyJ > 0 && (settleSeconds <= 0 || secureElapsedSeconds <= contactMoment.elapsedSeconds)) throw new Error('invalid capture interval precision');
  const candidateSecureTick = quantizeEventTick(contactMoment.originTick, secureElapsedSeconds, p.ticksPerSecond);
  const fenceElapsedSeconds = Math.max(secureElapsedSeconds, (candidateSecureTick - contactMoment.originTick) / p.ticksPerSecond);
  if (!tick(p.ticksPerSecond) || p.ticksPerSecond === 0 || !tick(contactMoment.originTick)
    || contactMoment.originTick !== response.world.flight.initialBall.tick || !Number.isFinite(contactMoment.elapsedSeconds)
    || contactMoment.elapsedSeconds < 0 || !vector(contactMoment.ball.position) || !vector(contactMoment.ball.velocity)
    || !vector(contactMoment.ball.spin) || !tick(contactMoment.ball.tick)
    || quantizeEventTick(contactMoment.originTick, contactMoment.elapsedSeconds, p.ticksPerSecond) !== contactMoment.ball.tick
    || !Number.isFinite(fenceElapsedSeconds)) throw new Error('invalid scheduled field acquisition clock');
  const actorKeys = new Set<string>();
  let initialCoverageThroughTick = Number.MAX_SAFE_INTEGER;
  for (const actor of motion.actors) {
    const primitive = actor?.primitive, key = JSON.stringify([actor?.playerId, primitive?.role]);
    const elapsed = primitive ? (contactMoment.originTick - primitive.startTick) / p.ticksPerSecond
      + contactMoment.elapsedSeconds - (actor.startElapsedSeconds ?? 0) : NaN;
    if (!primitive || actorKeys.has(key) || !tick(primitive.startTick) || !tick(primitive.endTick)
      || primitive.startTick > contactMoment.ball.tick || primitive.endTick < contactMoment.ball.tick
      || primitive.ticksPerSecond !== p.ticksPerSecond || !Number.isFinite(primitive.radius) || primitive.radius <= 0
      || !vector(primitive.startCenter) || !vector(primitive.startVelocity) || !vector(primitive.acceleration)
      || actor.startElapsedSeconds !== undefined && (!Number.isFinite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)
      || !Number.isFinite(elapsed) || elapsed < 0
      || (primitive.endTick - contactMoment.originTick) / p.ticksPerSecond < contactMoment.elapsedSeconds) {
      throw new Error('scheduled field acquisition actor coverage differs');
    }
    // Check only the actual contact-time samples here. Future collision execution belongs to advance.
    for (const axis of ['x', 'y', 'z'] as const) {
      const center = primitive.startCenter[axis] + primitive.startVelocity[axis] * elapsed + 0.5 * primitive.acceleration[axis] * elapsed * elapsed;
      const velocity = primitive.startVelocity[axis] + primitive.acceleration[axis] * elapsed;
      if (!Number.isFinite(center) || !Number.isFinite(velocity)) throw new Error('scheduled field acquisition actor arithmetic overflow');
    }
    actorKeys.add(key); initialCoverageThroughTick = Math.min(initialCoverageThroughTick, primitive.endTick);
  }
  validatePiecewiseFieldActors(response, contactMoment, motion.actors);
  const initialConstraintMoment = { ...contactMoment,
    ball: { ...contactMoment.ball, velocity: contact.velocity, spin: { x: 0, y: 0, z: 0 } } };
  const plan: BattedWorldPiecewiseFieldAcquisitionPlan = { input, bridge: null, policy: 'piecewise_original_energy_recorded_tick_fence_v1', acquirerPlayerId,
    contactMoment, retention, initialConstraintMoment, contactOffset: offset, initialEnergyJ, captureDissipationPowerW: power,
    secureElapsedSeconds, candidateSecureTick, archivedCandidateSecureTick: retention.outcome.secureTick, fenceElapsedSeconds, initialCoverageThroughTick };
  if (!finiteData(plan)) throw new Error('nonfinite scheduled field acquisition plan');
  return freezeBattedWorldField(plan);
};

export const validateBattedWorldPiecewiseFieldAcquisitionPlan = (raw: BattedWorldPiecewiseFieldAcquisitionPlan): void => {
  const plan = cloneInert(raw);
  if (!hasBattedWorldFieldFields(plan, ['input', 'policy', 'acquirerPlayerId', 'contactMoment', 'retention', 'initialConstraintMoment',
    'contactOffset', 'initialEnergyJ', 'captureDissipationPowerW', 'secureElapsedSeconds', 'candidateSecureTick', 'archivedCandidateSecureTick',
    'fenceElapsedSeconds', 'initialCoverageThroughTick', 'bridge']) || !equal(plan, plan.bridge === null
      ? prepareBattedWorldPiecewiseFieldAcquisition(plan.input) : bridgeBattedWorldPiecewiseFieldAcquisitionPlan(plan.bridge))) {
    throw new Error('scheduled field acquisition plan differs from original scope');
  }
};


/** Explicit adapter preserves the original admitted evidence and actually executed legacy cut. */
export const bridgeBattedWorldPiecewiseFieldAcquisitionPlan = (raw: Readonly<{
  plan: BattedWorldScheduledFieldAcquisitionPlan; progress: BattedWorldScheduledFieldAcquisitionAdvance | null;
}>): BattedWorldPiecewiseFieldAcquisitionPlan => {
  const bridge = cloneInert(raw);
  if (!hasBattedWorldFieldFields(bridge, ['plan', 'progress'])) throw new Error('invalid piecewise acquisition bridge');
  validateBattedWorldScheduledFieldAcquisitionPlan(bridge.plan);
  if (bridge.progress !== null) {
    validateBattedWorldScheduledFieldAcquisitionProgress(bridge.plan, bridge.progress);
    if (bridge.progress.kind !== 'capturing' && bridge.progress.kind !== 'fence_pending') throw new Error('legacy acquisition bridge is terminal');
  }
  const { policy: _policy, coverageThroughTick, ...original } = bridge.plan;
  return freezeBattedWorldField({ ...original, policy: 'piecewise_original_energy_recorded_tick_fence_v1',
    initialCoverageThroughTick: coverageThroughTick, bridge });
};

export type BattedWorldPiecewiseFieldAcquisitionProgress = Readonly<{
  startMoment: BallWorldMoment; activePiece: BattedWorldPiecewiseFieldMotionPiece;
  world: AcceleratedBallWorldMotion; baseContacts: readonly BallWorldBaseBoundaryContact[];
  transport: BattedWorldCaptureTransport; dissipationMoment: BallWorldMoment | null;
}> & (Readonly<{ kind: 'capturing' | 'fence_pending'; cursor: null; acquisition: null }>
  | Readonly<{ kind: 'secured'; cursor: BattedWorldBallCursor; acquisition: Extract<BattedWorldFieldAcquisition, { kind: 'secured' }> }>
  | Readonly<{ kind: 'interrupted'; cursor: null; acquisition: Extract<BattedWorldFieldAcquisition, { kind: 'interrupted' }> }>);

const executeStep = (plan: BattedWorldPiecewiseFieldAcquisitionPlan, previous: BattedWorldPiecewiseFieldAcquisitionProgress | null,
  step: PiecewiseFieldMotionStep): BattedWorldPiecewiseFieldAcquisitionProgress => {
  if (previous && previous.kind !== 'capturing' && previous.kind !== 'fence_pending') throw new Error('piecewise acquisition prior is terminal');
  const startMoment = previous?.world.moment ?? plan.bridge?.progress?.world.moment ?? plan.contactMoment;
  const priorDissipation = previous?.dissipationMoment ?? plan.bridge?.progress?.dissipationMoment ?? null;
  if (!previous && plan.bridge && step.throughElapsedSeconds !== startMoment.elapsedSeconds) throw new Error('piecewise legacy bridge requires a zero-time first step');
  const original: BattedWorldPiecewiseFieldMotionPiece = { anchorMoment: plan.bridge?.progress?.world.moment ?? plan.initialConstraintMoment, actors: plan.input.field.motion.actors,
    constraint: { playerId: plan.acquirerPlayerId, contactOffset: plan.contactOffset },
    previousContacts: [{ kind: 'actor', playerId: plan.acquirerPlayerId, role: 'glove' }] };
  // The first constraint transition precedes any new command composition at the same cut.
  if (!previous && step.actors.kind !== 'retained') throw new Error('piecewise acquisition must initialize original constraint before adoption');
  const activePiece = adoptPiecewiseFieldMotionStep(plan.input.response, previous?.activePiece ?? original,
    previous?.world.moment ?? plan.bridge?.progress?.world.moment ?? plan.initialConstraintMoment, step);
  const p = plan.input.response.world.parameters, coverage = validatePiecewiseFieldActors(plan.input.response, startMoment, activePiece.actors);
  const milestone = priorDissipation ? plan.fenceElapsedSeconds : plan.secureElapsedSeconds;
  const bound = Math.min(step.throughElapsedSeconds, milestone, (coverage - startMoment.originTick) / p.ticksPerSecond);
  if (bound < startMoment.elapsedSeconds || bound === startMoment.elapsedSeconds && previous && step.actors.kind === 'retained') {
    throw new Error('piecewise acquisition step makes no actual progress or coverage is exhausted');
  }
  const legacyFirst = !previous ? plan.bridge?.progress : null;
  // The bridge adopts a new numerical capability at the already validated cut,
  // without reinterpreting any old contact-free prefix or its endpoint.
  const executed = legacyFirst ? { world: legacyFirst.world, baseContacts: legacyFirst.baseContacts }
    : queryPiecewiseFieldMotion(plan.input.response, plan.input.geometry, activePiece, bound);
  const moment = executed.world.moment;
  if (moment.elapsedSeconds < startMoment.elapsedSeconds) throw new Error('piecewise acquisition crosses an earlier contact');
  const dissipated = moment.elapsedSeconds >= plan.secureElapsedSeconds;
  const dissipationMoment = priorDissipation ?? (dissipated ? moment : null);
  const energySpent = plan.captureDissipationPowerW * (moment.elapsedSeconds - plan.contactMoment.elapsedSeconds);
  const transport: BattedWorldCaptureTransport = { kind: 'glove_constraint', contactOffset: plan.contactOffset,
    initialEnergyJ: plan.initialEnergyJ, remainingEnergyJ: dissipated ? 0 : Math.max(0, plan.initialEnergyJ - energySpent) };
  const common = { startMoment, activePiece, world: executed.world, baseContacts: executed.baseContacts, transport, dissipationMoment };
  const basis = { acquirerPlayerId: plan.acquirerPlayerId, contactMoment: plan.contactMoment, candidateSecureTick: plan.candidateSecureTick,
    archivedCandidateSecureTick: plan.archivedCandidateSecureTick, retention: plan.retention };
  let result: BattedWorldPiecewiseFieldAcquisitionProgress;
  if (executed.world.kind === 'boundary') {
    const reason = moment.elapsedSeconds <= plan.secureElapsedSeconds ? 'contact' : 'same_tick_competition';
    result = { ...common, kind: 'interrupted', cursor: null,
      acquisition: { ...basis, kind: 'interrupted', reason, world: executed.world, baseContacts: executed.baseContacts, transport } };
  } else if (moment.elapsedSeconds < plan.fenceElapsedSeconds) {
    result = { ...common, kind: dissipated ? 'fence_pending' : 'capturing', cursor: null, acquisition: null };
  } else {
    if (!dissipationMoment || dissipationMoment.elapsedSeconds !== plan.secureElapsedSeconds) throw new Error('piecewise acquisition dissipation evidence differs');
    result = { ...common, kind: 'secured', transport: { ...transport, remainingEnergyJ: 0 }, cursor: { moment, previousContacts: activePiece.previousContacts },
      acquisition: { ...basis, kind: 'secured', secureTick: plan.candidateSecureTick, moment: dissipationMoment,
        transport: { ...transport, remainingEnergyJ: 0 }, baseContacts: [] } };
  }
  if (!piecewiseFiniteData(result)) throw new Error('nonfinite piecewise acquisition progress');
  return freezeBattedWorldField(result);
};
export const deriveBattedWorldPiecewiseFieldAcquisitionProgress = (raw: Readonly<{
  plan: BattedWorldPiecewiseFieldAcquisitionPlan; steps: readonly PiecewiseFieldMotionStep[];
}>): BattedWorldPiecewiseFieldAcquisitionProgress => {
  const input = clonePiecewiseReplayInput(raw, ['plan', 'steps']);
  if (!hasBattedWorldFieldFields(input, ['plan', 'steps']) || !Array.isArray(input.steps) || !input.steps.length) throw new Error('invalid piecewise acquisition replay scope');
  validateBattedWorldPiecewiseFieldAcquisitionPlan(input.plan);
  let previous: BattedWorldPiecewiseFieldAcquisitionProgress | null = null;
  for (const step of input.steps) previous = executeStep(input.plan, previous, step);
  return previous!;
};
export const validateBattedWorldPiecewiseFieldAcquisitionProgress = (raw: Readonly<{
  plan: BattedWorldPiecewiseFieldAcquisitionPlan; steps: readonly PiecewiseFieldMotionStep[]; progress: BattedWorldPiecewiseFieldAcquisitionProgress;
}>): void => {
  const input = clonePiecewiseReplayInput(raw, ['plan', 'steps', 'progress']);
  if (!hasBattedWorldFieldFields(input, ['plan', 'steps', 'progress']) || !equal(input.progress,
    deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan: input.plan, steps: input.steps }))) throw new Error('piecewise acquisition progress differs from recorded steps');
};
