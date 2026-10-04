import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { CatchRetentionResolution } from '../fielding/CatchRetention';
import { quantizeEventTick } from '../ExactEventTime';
import { deriveAcceleratedBallWorldFieldMotion, type AcceleratedBallWorldMotion, type BallWorldMoment } from './BallWorldContinuation';
import type { BallWorldBaseBoundaryContact } from './BallWorldBaseBoundary';
import type { BattedWorldCaptureTransport } from './BattedWorldAcquisition';
import type { BattedWorldFieldAcquisition, BattedWorldFieldAcquisitionInput } from './BattedWorldFieldAcquisition';
import { respondToBattedWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { assertBattedWorldFieldExecutionScope, battedWorldFieldExecutionBoundary, freezeBattedWorldField, hasBattedWorldFieldFields } from './BattedWorldFieldExecution';

/** Immutable admission metadata, never an executed capture or possession result. */
export type BattedWorldScheduledFieldAcquisitionPlan = Readonly<{
  input: BattedWorldFieldAcquisitionInput;
  policy: 'original_energy_recorded_tick_fence_v1';
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
  coverageThroughTick: number;
}>;
type CaptureAdvanceBase = Readonly<{
  planIdentity: string;
  checkpointElapsedSeconds: readonly number[];
  startMoment: BallWorldMoment;
  world: AcceleratedBallWorldMotion;
  baseContacts: readonly BallWorldBaseBoundaryContact[];
  transport: BattedWorldCaptureTransport;
  /** Reached energy completion is evidence, not possession authority. */
  dissipationMoment: BallWorldMoment | null;
}>;
export type BattedWorldScheduledFieldAcquisitionAdvance = CaptureAdvanceBase & (
  Readonly<{ kind: 'capturing' | 'fence_pending'; cursor: null; acquisition: null }>
  | Readonly<{ kind: 'secured'; cursor: BattedWorldBallCursor; acquisition: Extract<BattedWorldFieldAcquisition, { kind: 'secured' }> }>
  | Readonly<{ kind: 'interrupted'; cursor: null; acquisition: Extract<BattedWorldFieldAcquisition, { kind: 'interrupted' }> }>
);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const vector = (value: Vec3) => !!value && [value.x, value.y, value.z].every(Number.isFinite);
const finiteData = (value: unknown): boolean => typeof value === 'number' ? Number.isFinite(value)
  : value !== null && typeof value === 'object' ? Object.values(value).every(finiteData) : true;
const sameVector = (a: Vec3, b: Vec3): boolean => vector(a) && vector(b) && (['x', 'y', 'z'] as const).every((axis) =>
  Number.isFinite(a[axis]) && Math.abs(a[axis] - b[axis]) <= Number.EPSILON * Math.max(1, Math.abs(a[axis]), Math.abs(b[axis])) * 32);

/** Revalidate the adopted candidate without querying any future collision interval. */
export const prepareBattedWorldScheduledFieldAcquisition = (raw: BattedWorldFieldAcquisitionInput): BattedWorldScheduledFieldAcquisitionPlan => {
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
  let coverageThroughTick = Number.MAX_SAFE_INTEGER;
  for (const actor of motion.actors) {
    const primitive = actor?.primitive, key = JSON.stringify([actor?.playerId, primitive?.role]);
    const elapsed = primitive ? (contactMoment.originTick - primitive.startTick) / p.ticksPerSecond
      + contactMoment.elapsedSeconds - (actor.startElapsedSeconds ?? 0) : NaN;
    if (!primitive || actorKeys.has(key) || !tick(primitive.startTick) || !tick(primitive.endTick)
      || primitive.startTick > contactMoment.ball.tick || primitive.endTick < candidateSecureTick
      || primitive.ticksPerSecond !== p.ticksPerSecond || !Number.isFinite(primitive.radius) || primitive.radius <= 0
      || !vector(primitive.startCenter) || !vector(primitive.startVelocity) || !vector(primitive.acceleration)
      || actor.startElapsedSeconds !== undefined && (!Number.isFinite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)
      || !Number.isFinite(elapsed) || elapsed < 0
      || (primitive.endTick - contactMoment.originTick) / p.ticksPerSecond < fenceElapsedSeconds) {
      throw new Error('scheduled field acquisition actor coverage differs');
    }
    // Check only the actual contact-time samples here. Future collision execution belongs to advance.
    for (const axis of ['x', 'y', 'z'] as const) {
      const center = primitive.startCenter[axis] + primitive.startVelocity[axis] * elapsed + 0.5 * primitive.acceleration[axis] * elapsed * elapsed;
      const velocity = primitive.startVelocity[axis] + primitive.acceleration[axis] * elapsed;
      if (!Number.isFinite(center) || !Number.isFinite(velocity)) throw new Error('scheduled field acquisition actor arithmetic overflow');
    }
    actorKeys.add(key); coverageThroughTick = Math.min(coverageThroughTick, primitive.endTick);
  }
  const initialConstraintMoment = { ...contactMoment,
    ball: { ...contactMoment.ball, velocity: contact.velocity, spin: { x: 0, y: 0, z: 0 } } };
  const plan: BattedWorldScheduledFieldAcquisitionPlan = { input, policy: 'original_energy_recorded_tick_fence_v1', acquirerPlayerId,
    contactMoment, retention, initialConstraintMoment, contactOffset: offset, initialEnergyJ, captureDissipationPowerW: power,
    secureElapsedSeconds, candidateSecureTick, archivedCandidateSecureTick: retention.outcome.secureTick, fenceElapsedSeconds, coverageThroughTick };
  if (!finiteData(plan)) throw new Error('nonfinite scheduled field acquisition plan');
  return freezeBattedWorldField(plan);
};

export const validateBattedWorldScheduledFieldAcquisitionPlan = (raw: BattedWorldScheduledFieldAcquisitionPlan): void => {
  const plan = cloneInert(raw);
  if (!hasBattedWorldFieldFields(plan, ['input', 'policy', 'acquirerPlayerId', 'contactMoment', 'retention', 'initialConstraintMoment',
    'contactOffset', 'initialEnergyJ', 'captureDissipationPowerW', 'secureElapsedSeconds', 'candidateSecureTick', 'archivedCandidateSecureTick',
    'fenceElapsedSeconds', 'coverageThroughTick']) || !equal(plan, prepareBattedWorldScheduledFieldAcquisition(plan.input))) {
    throw new Error('scheduled field acquisition plan differs from original scope');
  }
};

/** Replay the accepted original curve; only the newly reached delta is adopted. */
const executeAdvance = (plan: BattedWorldScheduledFieldAcquisitionPlan, previous: BattedWorldScheduledFieldAcquisitionAdvance | null,
  throughElapsedSeconds: number): BattedWorldScheduledFieldAcquisitionAdvance => {
  if (previous && previous.kind !== 'capturing' && previous.kind !== 'fence_pending') throw new Error('scheduled field acquisition prior is terminal');
  const startMoment = previous?.world.moment ?? plan.contactMoment;
  const { input, contactMoment, acquirerPlayerId } = plan, p = input.response.world.parameters;
  if (!Number.isFinite(throughElapsedSeconds)
    || throughElapsedSeconds > (plan.coverageThroughTick - contactMoment.originTick) / p.ticksPerSecond) {
    throw new Error('scheduled field acquisition checkpoint exceeds accepted coverage horizon');
  }
  if (throughElapsedSeconds < startMoment.elapsedSeconds || throughElapsedSeconds === startMoment.elapsedSeconds
    && (previous !== null || plan.initialEnergyJ !== 0)) throw new Error('scheduled field acquisition checkpoint makes no actual progress');
  const primitive = input.field.motion.actors.find((actor) => actor.playerId === acquirerPlayerId && actor.primitive.role === 'glove')!.primitive;
  const previousContacts = [{ kind: 'actor' as const, playerId: acquirerPlayerId, role: 'glove' as const }];
  const query = (bound: number) => {
    const executed = battedWorldFieldExecutionBoundary(deriveAcceleratedBallWorldFieldMotion({
      moment: plan.initialConstraintMoment, throughElapsedSeconds: bound, acceleration: primitive.acceleration, parameters: p,
      actors: input.field.motion.actors, surfaces: input.response.world.surfaces, previousContacts, bases: input.geometry.bases, previousBaseContacts: [],
    }));
    if (executed.world.kind === 'boundary') return executed;
    // A contact-free query proves the requested endpoint. The original curve was
    // sampled at bound - contact; reconstructing contact + duration can round to
    // either neighboring value. Keep exact endpoint ownership without changing
    // that sampled trajectory or normalizing any actual collision occurrence.
    const moment = { ...executed.world.moment, elapsedSeconds: bound,
      ball: { ...executed.world.moment.ball, tick: quantizeEventTick(contactMoment.originTick, bound, p.ticksPerSecond) } };
    return { ...executed, world: { ...executed.world, moment } };
  };
  const executed = query(Math.min(throughElapsedSeconds, plan.fenceElapsedSeconds)), moment = executed.world.moment;
  if (moment.elapsedSeconds < startMoment.elapsedSeconds) throw new Error('scheduled field acquisition prior crosses an earlier contact');
  const dissipated = moment.elapsedSeconds >= plan.secureElapsedSeconds;
  const dissipationMoment = dissipated ? previous?.dissipationMoment ?? query(plan.secureElapsedSeconds).world.moment : null;
  const energySpent = plan.captureDissipationPowerW * (moment.elapsedSeconds - contactMoment.elapsedSeconds);
  if (!Number.isFinite(energySpent)) throw new Error('scheduled field acquisition energy arithmetic overflow');
  const transport: BattedWorldCaptureTransport = { kind: 'glove_constraint', contactOffset: plan.contactOffset,
    initialEnergyJ: plan.initialEnergyJ, remainingEnergyJ: Math.max(0, plan.initialEnergyJ - energySpent) };
  const common = { planIdentity: JSON.stringify(plan), checkpointElapsedSeconds: [...(previous?.checkpointElapsedSeconds ?? []), throughElapsedSeconds],
    startMoment, world: executed.world, baseContacts: executed.baseContacts, transport, dissipationMoment };
  const basis = { acquirerPlayerId, contactMoment, candidateSecureTick: plan.candidateSecureTick,
    archivedCandidateSecureTick: plan.archivedCandidateSecureTick, retention: plan.retention };
  let result: BattedWorldScheduledFieldAcquisitionAdvance;
  if (executed.world.kind === 'boundary') {
    const reason = moment.elapsedSeconds <= plan.secureElapsedSeconds ? 'contact' : 'same_tick_competition';
    const actualTransport = reason === 'same_tick_competition' ? { ...transport, remainingEnergyJ: 0 } : transport;
    result = { ...common, kind: 'interrupted', cursor: null, transport: actualTransport,
      acquisition: { ...basis, kind: 'interrupted', reason, world: executed.world, baseContacts: executed.baseContacts, transport: actualTransport } };
  } else if (moment.elapsedSeconds < plan.fenceElapsedSeconds) {
    result = { ...common, kind: dissipated ? 'fence_pending' : 'capturing', cursor: null, acquisition: null,
      transport: dissipated ? { ...transport, remainingEnergyJ: 0 } : transport };
  } else {
    if (!dissipationMoment || dissipationMoment.elapsedSeconds !== plan.secureElapsedSeconds) throw new Error('scheduled acquisition dissipation evidence differs');
    const securedTransport = { ...transport, remainingEnergyJ: 0 };
    result = { ...common, kind: 'secured', transport: securedTransport, cursor: { moment, previousContacts },
      acquisition: { ...basis, kind: 'secured', secureTick: plan.candidateSecureTick, moment: dissipationMoment,
        transport: securedTransport, baseContacts: [] } };
  }
  if (!finiteData(result)) throw new Error('nonfinite scheduled field acquisition progress');
  return freezeBattedWorldField(result);
};

const replayProgress = (plan: BattedWorldScheduledFieldAcquisitionPlan,
  progress: BattedWorldScheduledFieldAcquisitionAdvance): BattedWorldScheduledFieldAcquisitionAdvance => {
  if (!progress || !Array.isArray(progress.checkpointElapsedSeconds) || !progress.checkpointElapsedSeconds.length) {
    throw new Error('invalid scheduled field acquisition progress');
  }
  let actual: BattedWorldScheduledFieldAcquisitionAdvance | null = null;
  for (const checkpoint of progress.checkpointElapsedSeconds) actual = executeAdvance(plan, actual, checkpoint);
  if (!equal(actual, progress)) throw new Error('scheduled field acquisition progress differs from executed deltas');
  return actual!;
};
export const validateBattedWorldScheduledFieldAcquisitionProgress = (plan: BattedWorldScheduledFieldAcquisitionPlan,
  progress: BattedWorldScheduledFieldAcquisitionAdvance): void => {
  validateBattedWorldScheduledFieldAcquisitionPlan(plan);
  replayProgress(cloneInert(plan), cloneInert(progress));
};
export const advanceBattedWorldScheduledFieldAcquisition = (raw: Readonly<{
  plan: BattedWorldScheduledFieldAcquisitionPlan; previous: BattedWorldScheduledFieldAcquisitionAdvance | null; throughElapsedSeconds: number;
}>): BattedWorldScheduledFieldAcquisitionAdvance => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['plan', 'previous', 'throughElapsedSeconds'])) throw new Error('invalid scheduled field acquisition advance scope');
  validateBattedWorldScheduledFieldAcquisitionPlan(input.plan);
  const previous = input.previous === null ? null : replayProgress(input.plan, input.previous);
  return executeAdvance(input.plan, previous, input.throughElapsedSeconds);
};
