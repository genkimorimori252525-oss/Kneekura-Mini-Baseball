import { validateBattedWorldScheduledFieldThrowPlan, validateBattedWorldScheduledFieldThrowProgress, type BattedWorldScheduledFieldThrowPlan, type BattedWorldScheduledFieldThrowAdvance } from './BattedWorldScheduledFieldThrow';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { createDefensiveRatings } from '../../model/DefensiveRatings';
import type { Vec3 } from '../../model/geometry';
import { SeedRoot } from '../../rng/SeedRoot';
import { createDefensiveRatedThrowLaunch, resolveRatedBallTransferTiming } from '../fielding/DefensiveRatingAdapters';
import type { BallTransferTiming } from '../fielding/BallTransferTiming';
import type { ThrowLaunch } from '../fielding/ThrowLaunch';
import { deriveBallWorldFieldContinuation } from './BallWorldContinuation';
import { respondToBattedWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { assertBattedWorldFieldExecutionScope, battedWorldFieldExecutionBoundary, battedWorldFieldExecutionPrevious,
  battedWorldFieldExecutionResponse, freezeBattedWorldField, hasBattedWorldFieldFields } from './BattedWorldFieldExecution';
import type { BattedWorldFieldMotion } from './BattedWorldFieldMotion';
import type { BattedWorldFieldThrowInput } from './BattedWorldFieldThrow';
import { adoptPiecewiseFieldMotionStep, clonePiecewiseReplayInput, piecewiseEqual, piecewiseFiniteData, piecewiseGloveContacts, queryPiecewiseFieldMotion,
  samplePiecewiseFieldActor, validatePiecewiseFieldActors, type BattedWorldPiecewiseFieldMotionPiece, type PiecewiseFieldMotionStep } from './BattedWorldPiecewiseFieldMotion';

export type BattedWorldPiecewiseFieldThrowInput = Omit<BattedWorldFieldThrowInput, 'availableAtTick' | 'throughTick' | 'commands'>;
/** Admission fixes intent/timing/RNG; actor coverage remains its own authority. */
export type BattedWorldPiecewiseFieldThrowPlan = Readonly<{
  bridge: Readonly<{ plan: BattedWorldScheduledFieldThrowPlan; progress: BattedWorldScheduledFieldThrowAdvance | null }> | null;
  policy: 'piecewise_original_transfer_v1'; input: BattedWorldPiecewiseFieldThrowInput; transfer: BallTransferTiming;
  releaseElapsedSeconds: number; initialCoverageThroughTick: number; contactOffset: Vec3;
}>;
type ProgressBase = Readonly<{ transfer: BallTransferTiming; seed: BattedWorldFieldThrowInput['seed']; startCursor: BattedWorldBallCursor;
  activePiece: BattedWorldPiecewiseFieldMotionPiece; field: BattedWorldFieldMotion }>;
export type BattedWorldPiecewiseFieldThrowProgress = ProgressBase & (Readonly<{ kind: 'transfer' | 'interrupted' }>
  | Readonly<{ kind: 'released'; releaseCursor: BattedWorldBallCursor; launch: ThrowLaunch }>);
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const originalPiece = (plan: BattedWorldPiecewiseFieldThrowPlan): BattedWorldPiecewiseFieldMotionPiece => ({
  anchorMoment: plan.bridge?.progress?.field.motion.world.moment ?? plan.input.cursor.moment, actors: plan.bridge?.progress ? plan.bridge.plan.actors : plan.input.actors, constraint: { playerId: plan.input.carrierPlayerId, contactOffset: plan.contactOffset },
  previousContacts: piecewiseGloveContacts(plan.input.cursor.previousContacts, plan.input.carrierPlayerId),
});
export const prepareBattedWorldPiecewiseFieldThrow = (raw: BattedWorldPiecewiseFieldThrowInput): BattedWorldPiecewiseFieldThrowPlan => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'receiverPlayerId', 'ratings',
    'transferParameters', 'throwCalibration', 'seed']) || !piecewiseFiniteData(input) || !id(input.carrierPlayerId)
    || !id(input.receiverPlayerId) || input.receiverPlayerId === input.carrierPlayerId || !hasBattedWorldFieldFields(input.seed, ['matchSeed', 'playId', 'streamKey'])
    || !tick(input.seed.matchSeed) || !tick(input.seed.playId) || !id(input.seed.streamKey)) throw new Error('invalid piecewise field throw intent');
  assertBattedWorldFieldExecutionScope(input.response, input.geometry);
  const moment = input.cursor.moment, p = input.response.world.parameters, initialCoverageThroughTick = validatePiecewiseFieldActors(input.response, moment, input.actors);
  const glove = input.actors.find((a) => a.playerId === input.carrierPlayerId && a.primitive.role === 'glove');
  if (!glove || !input.actors.some((a) => a.playerId === input.receiverPlayerId && a.primitive.role === 'glove')) throw new Error('piecewise field throw registered glove is missing');
  const state = samplePiecewiseFieldActor(glove, moment);
  const contactOffset = { x: moment.ball.position.x - state.center.x, y: moment.ball.position.y - state.center.y, z: moment.ball.position.z - state.center.z };
  createDefensiveRatings(input.ratings);
  const c = input.throwCalibration;
  if (!hasBattedWorldFieldFields(c, ['minimumReleaseSpeedMps', 'maximumReleaseSpeedMps', 'minimumTargetErrorMeters', 'maximumTargetErrorMeters'])
    || !Object.values(c).every(Number.isFinite) || c.minimumReleaseSpeedMps <= 0 || c.maximumReleaseSpeedMps < c.minimumReleaseSpeedMps
    || c.minimumTargetErrorMeters < 0 || c.maximumTargetErrorMeters < c.minimumTargetErrorMeters) throw new Error('invalid piecewise throw calibration');
  const transfer = resolveRatedBallTransferTiming(moment.ball.tick, input.ratings, input.transferParameters);
  const releaseElapsedSeconds = (transfer.throwReadyTick - moment.originTick) / p.ticksPerSecond;
  if (!Number.isFinite(releaseElapsedSeconds) || releaseElapsedSeconds < moment.elapsedSeconds) throw new Error('piecewise release precedes actual cursor');
  const plan = { policy: 'piecewise_original_transfer_v1' as const, bridge: null, input, transfer, releaseElapsedSeconds, initialCoverageThroughTick, contactOffset };
  // Validate only the current joint and collision scope. No future query or launch RNG is evaluated.
  queryPiecewiseFieldMotion(input.response, input.geometry, originalPiece(plan), moment.elapsedSeconds);
  return freezeBattedWorldField(plan);
};
export const validateBattedWorldPiecewiseFieldThrowPlan = (raw: BattedWorldPiecewiseFieldThrowPlan): void => {
  const plan = cloneInert(raw);
  if (!hasBattedWorldFieldFields(plan, ['policy', 'input', 'transfer', 'releaseElapsedSeconds', 'initialCoverageThroughTick', 'contactOffset', 'bridge'])
    || !piecewiseEqual(plan, plan.bridge === null ? prepareBattedWorldPiecewiseFieldThrow(plan.input) : bridgeBattedWorldPiecewiseFieldThrowPlan(plan.bridge))) throw new Error('piecewise throw plan differs from original scope');
};
/** A bridge never re-prepares timing or adopts an unexecuted legacy command set. */
export const bridgeBattedWorldPiecewiseFieldThrowPlan = (raw: Readonly<{
  plan: BattedWorldScheduledFieldThrowPlan; progress: BattedWorldScheduledFieldThrowAdvance | null;
}>): BattedWorldPiecewiseFieldThrowPlan => {
  const bridge = cloneInert(raw);
  if (!hasBattedWorldFieldFields(bridge, ['plan', 'progress'])) throw new Error('invalid piecewise throw bridge');
  validateBattedWorldScheduledFieldThrowPlan(bridge.plan);
  if (bridge.progress !== null) {
    validateBattedWorldScheduledFieldThrowProgress(bridge.plan, bridge.progress);
    if (bridge.progress.kind !== 'transfer') throw new Error('legacy throw bridge is terminal');
  }
  const { availableAtTick: _a, throughTick: _t, commands: _c, ...input } = bridge.plan.input;
  const current = bridge.progress?.field.motion.cursor ?? input.cursor;
  if (!current || bridge.plan.releaseElapsedSeconds < current.moment.elapsedSeconds) throw new Error('legacy throw release precedes actual bridge cut');
  const actors = bridge.progress ? bridge.plan.actors : input.actors;
  const initialCoverageThroughTick = validatePiecewiseFieldActors(input.response, current.moment, actors);
  const glove = actors.find((a) => a.playerId === input.carrierPlayerId && a.primitive.role === 'glove')!;
  const center = samplePiecewiseFieldActor(glove, input.cursor.moment).center;
  const contactOffset = { x: input.cursor.moment.ball.position.x - center.x, y: input.cursor.moment.ball.position.y - center.y,
    z: input.cursor.moment.ball.position.z - center.z };
  const plan: BattedWorldPiecewiseFieldThrowPlan = { policy: 'piecewise_original_transfer_v1', input, bridge,
    transfer: bridge.plan.transfer, releaseElapsedSeconds: bridge.plan.releaseElapsedSeconds, initialCoverageThroughTick, contactOffset };
  if (!bridge.progress) queryPiecewiseFieldMotion(input.response, input.geometry, originalPiece(plan), input.cursor.moment.elapsedSeconds);
  return freezeBattedWorldField(plan);
};
const executeStep = (plan: BattedWorldPiecewiseFieldThrowPlan, previous: BattedWorldPiecewiseFieldThrowProgress | null,
  step: PiecewiseFieldMotionStep): BattedWorldPiecewiseFieldThrowProgress => {
  if (previous && previous.kind !== 'transfer') throw new Error('piecewise throw prior is terminal');
  const { input, transfer } = plan, startCursor = previous?.field.motion.cursor ?? plan.bridge?.progress?.field.motion.cursor ?? input.cursor, moment = startCursor.moment;
  if (!previous && plan.bridge && (step.actors.kind !== 'retained' || step.throughElapsedSeconds !== moment.elapsedSeconds)) {
    throw new Error('piecewise legacy bridge requires a retained zero-time first step');
  }
  // A reached release belongs to the prior piece, before any later command adoption.
  if (moment.elapsedSeconds === plan.releaseElapsedSeconds && step.actors.kind === 'adopted') throw new Error('piecewise due release precedes adoption');
  const activePiece = adoptPiecewiseFieldMotionStep(input.response, previous?.activePiece ?? originalPiece(plan), moment, step);
  const p = input.response.world.parameters, coverage = validatePiecewiseFieldActors(input.response, moment, activePiece.actors);
  const bound = Math.min(step.throughElapsedSeconds, plan.releaseElapsedSeconds, (coverage - moment.originTick) / p.ticksPerSecond);
  if (bound < moment.elapsedSeconds || bound === moment.elapsedSeconds && step.actors.kind === 'retained' && bound !== plan.releaseElapsedSeconds && (previous !== null || plan.bridge === null)) {
    throw new Error('piecewise transfer step makes no actual progress or coverage is exhausted');
  }
  const legacyFirst = !previous ? plan.bridge?.progress : null;
  const carried = legacyFirst ? { world: legacyFirst.field.motion.world, baseContacts: legacyFirst.field.baseContacts }
    : queryPiecewiseFieldMotion(input.response, input.geometry, activePiece, bound);
  if (carried.world.moment.elapsedSeconds < moment.elapsedSeconds) throw new Error('piecewise transfer crosses an earlier contact');
  const common = { transfer, seed: input.seed, startCursor, activePiece }, actors = activePiece.actors, contacts = activePiece.previousContacts;
  if (carried.world.kind === 'boundary') return freezeBattedWorldField({ ...common, kind: 'interrupted', field: { baseContacts: carried.baseContacts,
    motion: { actors, carrierPlayerId: input.carrierPlayerId, world: carried.world, response: { kind: 'unresolved', reason: 'carried_contact', cursor: null }, cursor: null } } });
  if (carried.world.moment.elapsedSeconds < plan.releaseElapsedSeconds) {
    const cursor = { moment: carried.world.moment, previousContacts: contacts };
    return freezeBattedWorldField({ ...common, kind: 'transfer', field: { baseContacts: carried.baseContacts,
      motion: { actors, carrierPlayerId: input.carrierPlayerId, world: carried.world, response: { kind: 'carried', cursor }, cursor } } });
  }
  const receiver = actors.find((a) => a.playerId === input.receiverPlayerId && a.primitive.role === 'glove')!;
  const launch = createDefensiveRatedThrowLaunch({ releaseTick: transfer.throwReadyTick, origin: carried.world.moment.ball.position,
    intendedTarget: samplePiecewiseFieldActor(receiver, carried.world.moment).center, ratings: input.ratings, calibration: input.throwCalibration,
    rng: new SeedRoot(input.seed.matchSeed).streamRng(input.seed.playId, 'fielding', input.seed.streamKey) });
  const releaseCursor = { moment: { ...carried.world.moment, ball: { ...carried.world.moment.ball, velocity: launch.initialVelocity } }, previousContacts: contacts };
  // Remove the joint for this zero-duration free query; a real glove collision is possible again.
  const released = battedWorldFieldExecutionBoundary(deriveBallWorldFieldContinuation({ moment: releaseCursor.moment, throughTick: transfer.throwReadyTick,
    actors, parameters: p, surfaces: input.response.world.surfaces, bases: input.geometry.bases, ...battedWorldFieldExecutionPrevious(contacts) }));
  const response = respondToBattedWorldBoundary(battedWorldFieldExecutionResponse(input.response, input.geometry), releaseCursor, released.world);
  const result: BattedWorldPiecewiseFieldThrowProgress = { ...common, kind: 'released', releaseCursor, launch,
    field: { baseContacts: released.baseContacts, motion: { actors, carrierPlayerId: null, world: released.world, response, cursor: response.cursor } } };
  if (!piecewiseFiniteData(result)) throw new Error('nonfinite piecewise field release');
  return freezeBattedWorldField(result);
};
export const deriveBattedWorldPiecewiseFieldThrowProgress = (raw: Readonly<{
  plan: BattedWorldPiecewiseFieldThrowPlan; steps: readonly PiecewiseFieldMotionStep[];
}>): BattedWorldPiecewiseFieldThrowProgress => {
  const input = clonePiecewiseReplayInput(raw, ['plan', 'steps']);
  if (!hasBattedWorldFieldFields(input, ['plan', 'steps']) || !Array.isArray(input.steps) || !input.steps.length) throw new Error('invalid piecewise throw replay scope');
  validateBattedWorldPiecewiseFieldThrowPlan(input.plan);
  let previous: BattedWorldPiecewiseFieldThrowProgress | null = null;
  for (const step of input.steps) previous = executeStep(input.plan, previous, step);
  return previous!;
};
export const validateBattedWorldPiecewiseFieldThrowProgress = (raw: Readonly<{
  plan: BattedWorldPiecewiseFieldThrowPlan; steps: readonly PiecewiseFieldMotionStep[]; progress: BattedWorldPiecewiseFieldThrowProgress;
}>): void => {
  const input = clonePiecewiseReplayInput(raw, ['plan', 'steps', 'progress']);
  if (!hasBattedWorldFieldFields(input, ['plan', 'steps', 'progress']) || !piecewiseEqual(input.progress,
    deriveBattedWorldPiecewiseFieldThrowProgress({ plan: input.plan, steps: input.steps }))) throw new Error('piecewise throw progress differs from recorded steps');
};
