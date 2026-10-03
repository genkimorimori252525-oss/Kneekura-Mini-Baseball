import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { createDefensiveRatings } from '../../model/DefensiveRatings';
import type { Vec3 } from '../../model/geometry';
import { SeedRoot } from '../../rng/SeedRoot';
import { createDefensiveRatedThrowLaunch, resolveRatedBallTransferTiming } from '../fielding/DefensiveRatingAdapters';
import type { BallTransferTiming } from '../fielding/BallTransferTiming';
import type { ThrowLaunch } from '../fielding/ThrowLaunch';
import { deriveAcceleratedBallWorldFieldMotion, deriveBallWorldFieldContinuation, type BallWorldMotionActor } from './BallWorldContinuation';
import { respondToBattedWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { assertBattedWorldFieldExecutionScope, battedWorldFieldExecutionBoundary, battedWorldFieldExecutionPrevious,
  battedWorldFieldExecutionResponse, freezeBattedWorldField, hasBattedWorldFieldFields } from './BattedWorldFieldExecution';
import type { BattedWorldFieldMotion } from './BattedWorldFieldMotion';
import type { BattedWorldFieldThrowInput } from './BattedWorldFieldThrow';
import { deriveBattedWorldMotionActors } from './BattedWorldMotion';

/** The original accepted scope owns due time, motor coverage, and RNG identity. It contains no future physical result. */
export type BattedWorldScheduledFieldThrowPlan = Readonly<{
  input: BattedWorldFieldThrowInput; actors: readonly BallWorldMotionActor[]; transfer: BallTransferTiming; releaseElapsedSeconds: number;
}>;
type AdvanceBase = Readonly<{
  transfer: BallTransferTiming; startCursor: BattedWorldBallCursor; field: BattedWorldFieldMotion;
  checkpointElapsedSeconds: readonly number[]; planIdentity: string;
}>;
export type BattedWorldScheduledFieldThrowAdvance = AdvanceBase & (Readonly<{ kind: 'transfer' | 'interrupted' }>
  | Readonly<{ kind: 'released'; releaseCursor: BattedWorldBallCursor; launch: ThrowLaunch }>);
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const previousContacts = (cursor: BattedWorldBallCursor, carrierPlayerId: string) => cursor.previousContacts.some((c) =>
  c.kind === 'actor' && c.playerId === carrierPlayerId && c.role === 'glove') ? cursor.previousContacts
  : [...cursor.previousContacts, { kind: 'actor' as const, playerId: carrierPlayerId, role: 'glove' as const }];

export const prepareBattedWorldScheduledFieldThrow = (raw: BattedWorldFieldThrowInput): BattedWorldScheduledFieldThrowPlan => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'availableAtTick', 'throughTick', 'commands',
    'receiverPlayerId', 'ratings', 'transferParameters', 'throwCalibration', 'seed']) || !id(input.carrierPlayerId)
    || !id(input.receiverPlayerId) || input.receiverPlayerId === input.carrierPlayerId || !hasBattedWorldFieldFields(input.seed, ['matchSeed', 'playId', 'streamKey'])
    || !tick(input.seed.matchSeed) || !tick(input.seed.playId) || !id(input.seed.streamKey)) throw new Error('invalid scheduled field throw intent');
  assertBattedWorldFieldExecutionScope(input.response, input.geometry);
  const actors = deriveBattedWorldMotionActors(input), moment = input.cursor.moment, p = input.response.world.parameters;
  const glove = actors.find((actor) => actor.playerId === input.carrierPlayerId && actor.primitive.role === 'glove');
  if (!glove || !actors.some((actor) => actor.playerId === input.receiverPlayerId && actor.primitive.role === 'glove')) {
    throw new Error('scheduled field throw registered glove is missing');
  }
  const tolerance = Number.EPSILON * Math.max(1, ...Object.values(moment.ball.velocity).map(Math.abs), ...Object.values(glove.primitive.startVelocity).map(Math.abs)) * 32;
  if ((['x', 'y', 'z'] as const).some((axis) => Math.abs(moment.ball.velocity[axis] - glove.primitive.startVelocity[axis]) > tolerance)) {
    throw new Error('scheduled field throw carried velocity differs');
  }
  createDefensiveRatings(input.ratings);
  const c = input.throwCalibration;
  if (!hasBattedWorldFieldFields(c, ['minimumReleaseSpeedMps', 'maximumReleaseSpeedMps', 'minimumTargetErrorMeters', 'maximumTargetErrorMeters'])
    || !Object.values(c).every(Number.isFinite) || c.minimumReleaseSpeedMps <= 0 || c.maximumReleaseSpeedMps < c.minimumReleaseSpeedMps
    || c.minimumTargetErrorMeters < 0 || c.maximumTargetErrorMeters < c.minimumTargetErrorMeters) throw new Error('invalid scheduled throw calibration');
  const transfer = resolveRatedBallTransferTiming(moment.ball.tick, input.ratings, input.transferParameters);
  if (transfer.throwReadyTick > input.throughTick) throw new Error('scheduled field throw transfer exceeds accepted coverage horizon');
  // Validate the actual start and collision scope without advancing, forecasting, or sampling launch RNG.
  deriveAcceleratedBallWorldFieldMotion({ moment, actors, parameters: p, surfaces: input.response.world.surfaces, bases: input.geometry.bases,
    ...battedWorldFieldExecutionPrevious(previousContacts(input.cursor, input.carrierPlayerId)), acceleration: glove.primitive.acceleration,
    throughElapsedSeconds: moment.elapsedSeconds });
  return freezeBattedWorldField({ input, actors, transfer, releaseElapsedSeconds: (transfer.throwReadyTick - moment.originTick) / p.ticksPerSecond });
};

export const validateBattedWorldScheduledFieldThrowPlan = (raw: BattedWorldScheduledFieldThrowPlan): void => {
  const plan = cloneInert(raw);
  if (!hasBattedWorldFieldFields(plan, ['input', 'actors', 'transfer', 'releaseElapsedSeconds'])
    || !equal(plan, prepareBattedWorldScheduledFieldThrow(plan.input))) throw new Error('scheduled field throw plan differs from original scope');
};

/** Execute one new physical delta from the validated prior cursor, ending at the requested checkpoint, first contact, or release. */
const executeAdvance = (plan: BattedWorldScheduledFieldThrowPlan, previous: BattedWorldScheduledFieldThrowAdvance | null,
  throughElapsedSeconds: number): BattedWorldScheduledFieldThrowAdvance => {
  if (previous && previous.kind !== 'transfer') throw new Error('scheduled field throw prior is terminal');
  const { input, actors, transfer } = plan, p = input.response.world.parameters;
  const startCursor = previous ? previous.field.motion.cursor : input.cursor;
  if (!startCursor) throw new Error('scheduled field throw prior physical cursor is missing');
  if (!Number.isFinite(throughElapsedSeconds) || throughElapsedSeconds > (input.throughTick - input.cursor.moment.originTick) / p.ticksPerSecond) {
    throw new Error('scheduled field throw checkpoint exceeds accepted coverage horizon');
  }
  if (throughElapsedSeconds < startCursor.moment.elapsedSeconds
    || throughElapsedSeconds === startCursor.moment.elapsedSeconds && (previous !== null || plan.releaseElapsedSeconds !== throughElapsedSeconds)) {
    throw new Error('scheduled field throw checkpoint makes no actual progress');
  }
  const contacts = previousContacts(startCursor, input.carrierPlayerId), query = { actors, parameters: p,
    surfaces: input.response.world.surfaces, bases: input.geometry.bases, ...battedWorldFieldExecutionPrevious(contacts) };
  const glove = actors.find((actor) => actor.playerId === input.carrierPlayerId && actor.primitive.role === 'glove')!;
  // Evaluate the already accepted constant-acceleration curve on its original
  // clock basis, only as far as this executed bound. Validated prior checkpoints
  // prove that its prefix has no earlier boundary. The adopted history delta
  // still starts at startCursor; evaluating the curve does not re-adopt its past.
  // Accumulating separate ball steps against original-basis actors would change
  // contact membership through roundoff when the caller merely pauses.
  const carried = battedWorldFieldExecutionBoundary(deriveAcceleratedBallWorldFieldMotion({ ...query, moment: input.cursor.moment,
    acceleration: glove.primitive.acceleration, throughElapsedSeconds: Math.min(throughElapsedSeconds, plan.releaseElapsedSeconds) }));
  if (carried.world.moment.elapsedSeconds < startCursor.moment.elapsedSeconds) throw new Error('scheduled field throw prior crosses an earlier contact');
  const common = { transfer, startCursor, checkpointElapsedSeconds: [...(previous?.checkpointElapsedSeconds ?? []), throughElapsedSeconds],
    planIdentity: JSON.stringify(plan) };
  if (carried.world.kind === 'boundary') return freezeBattedWorldField({ ...common, kind: 'interrupted',
    field: { baseContacts: carried.baseContacts, motion: { actors, carrierPlayerId: input.carrierPlayerId, world: carried.world,
      response: { kind: 'unresolved', reason: 'carried_contact', cursor: null }, cursor: null } } });
  if (throughElapsedSeconds < plan.releaseElapsedSeconds) {
    const cursor = { moment: carried.world.moment, previousContacts: contacts };
    return freezeBattedWorldField({ ...common, kind: 'transfer', field: { baseContacts: carried.baseContacts,
      motion: { actors, carrierPlayerId: input.carrierPlayerId, world: carried.world, response: { kind: 'carried', cursor }, cursor } } });
  }
  const receiver = actors.find((actor) => actor.playerId === input.receiverPlayerId && actor.primitive.role === 'glove')!;
  const s = receiver.primitive, dt = (carried.world.moment.originTick - s.startTick) / p.ticksPerSecond
    + carried.world.moment.elapsedSeconds - (receiver.startElapsedSeconds ?? 0);
  const component = (axis: keyof Vec3) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
  const launch = createDefensiveRatedThrowLaunch({ releaseTick: transfer.throwReadyTick, origin: carried.world.moment.ball.position,
    intendedTarget: { x: component('x'), y: component('y'), z: component('z') }, ratings: input.ratings, calibration: input.throwCalibration,
    rng: new SeedRoot(input.seed.matchSeed).streamRng(input.seed.playId, 'fielding', input.seed.streamKey) });
  const releaseCursor = { moment: { ...carried.world.moment, ball: { ...carried.world.moment.ball, velocity: launch.initialVelocity } }, previousContacts: contacts };
  // No post-release horizon is borrowed from a future checkpoint. Ordinary field continuation owns subsequent flight.
  const released = battedWorldFieldExecutionBoundary(deriveBallWorldFieldContinuation({ ...query,
    moment: releaseCursor.moment, throughTick: transfer.throwReadyTick }));
  const response = respondToBattedWorldBoundary(battedWorldFieldExecutionResponse(input.response, input.geometry), releaseCursor, released.world);
  return freezeBattedWorldField({ ...common, kind: 'released', releaseCursor, launch, field: { baseContacts: released.baseContacts,
    motion: { actors, carrierPlayerId: null, world: released.world, response, cursor: response.cursor } } });
};

/** Reconstruct only recorded, bounded past deltas. Caller-provided state never becomes the new physical starting point. */
const replayProgress = (plan: BattedWorldScheduledFieldThrowPlan, progress: BattedWorldScheduledFieldThrowAdvance): BattedWorldScheduledFieldThrowAdvance => {
  if (!progress || !Array.isArray(progress.checkpointElapsedSeconds) || !progress.checkpointElapsedSeconds.length) {
    throw new Error('invalid scheduled field throw progress');
  }
  let actual: BattedWorldScheduledFieldThrowAdvance | null = null;
  for (const checkpoint of progress.checkpointElapsedSeconds) actual = executeAdvance(plan, actual, checkpoint);
  if (!equal(actual, progress)) throw new Error('scheduled field throw progress differs from executed deltas');
  return actual!;
};
export const validateBattedWorldScheduledFieldThrowProgress = (plan: BattedWorldScheduledFieldThrowPlan, progress: BattedWorldScheduledFieldThrowAdvance): void => {
  validateBattedWorldScheduledFieldThrowPlan(plan);
  replayProgress(cloneInert(plan), cloneInert(progress));
};
export const advanceBattedWorldScheduledFieldThrow = (raw: Readonly<{ plan: BattedWorldScheduledFieldThrowPlan;
  previous: BattedWorldScheduledFieldThrowAdvance | null; throughElapsedSeconds: number }>): BattedWorldScheduledFieldThrowAdvance => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['plan', 'previous', 'throughElapsedSeconds'])) throw new Error('invalid scheduled field throw advance scope');
  validateBattedWorldScheduledFieldThrowPlan(input.plan);
  const previous = input.previous === null ? null : replayProgress(input.plan, input.previous);
  return executeAdvance(input.plan, previous, input.throughElapsedSeconds);
};
