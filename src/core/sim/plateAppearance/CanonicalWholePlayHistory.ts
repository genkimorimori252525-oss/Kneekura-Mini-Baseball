import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { CanonicalPlateAppearanceTimeline } from './CanonicalPlateAppearanceTimeline';
import type { BallWorldMoment, BallWorldMotionActor } from '../ball/BallWorldContinuation';
import type { BattedWorldBallCursor } from '../ball/BattedWorldContinuation';
import { battedWorldBaseSurfaceId, type BattedWorldFieldMotion } from '../ball/BattedWorldFieldMotion';
import type { Vec3 } from '../../model/geometry';
import { createBattedBallInitialStateFromContact } from '../contact/BatBallContact';
import { quantizeEventTick } from '../ExactEventTime';
import type { BallWorldBaseBoundaryContact } from '../ball/BallWorldBaseBoundary';
import type { BattedWorldFieldAcquisition } from '../ball/BattedWorldFieldAcquisition';
import type { BattedWorldFieldThrow } from '../ball/BattedWorldFieldThrow';
import { validateBattedWorldScheduledFieldThrowPlan, type BattedWorldScheduledFieldThrowPlan, type BattedWorldScheduledFieldThrowAdvance } from '../ball/BattedWorldScheduledFieldThrow';
import { validateBattedWorldScheduledFieldAcquisitionPlan, validateBattedWorldScheduledFieldAcquisitionProgress,
  type BattedWorldScheduledFieldAcquisitionPlan, type BattedWorldScheduledFieldAcquisitionAdvance } from '../ball/BattedWorldScheduledFieldAcquisition';
import type { CatchRetentionResolution } from '../fielding/CatchRetention';

/** Source IDs are scoped by their Native owner and original physical pitch. */
export type WholePlaySourceRef = Readonly<{ owner: 'field_action' | 'field_execution'; sourceId: string;
  revision: number; physicalPitchSourceId: string }>;
type Owned = Readonly<{ source: WholePlaySourceRef; previousSourceId: string | null }>;
export type WholePlayPhysicalStep = Owned & (
  Readonly<{ kind: 'motion' | 'retained_motion_checkpoint_v1'; startCursor: BattedWorldBallCursor; field: BattedWorldFieldMotion }>
  | Readonly<{ kind: 'acquisition'; field: BattedWorldFieldMotion; acquisition: BattedWorldFieldAcquisition }>
  | Readonly<{ kind: 'throw'; startCursor: BattedWorldBallCursor; field: BattedWorldFieldMotion; throw: BattedWorldFieldThrow }>
  | Readonly<{ kind: 'acquisition_advance'; planSourceId: string; field: BattedWorldFieldMotion; progress: BattedWorldScheduledFieldAcquisitionAdvance }>
  | Readonly<{ kind: 'throw_advance'; planSourceId: string; startCursor: BattedWorldBallCursor;
    field: BattedWorldFieldMotion; progress: BattedWorldScheduledFieldThrowAdvance }>);
/** Rule payloads remain in their source-bound owner; this link cannot execute time or embed history recursively. */
export type WholePlayObservation = Owned & Readonly<{ kind: 'observation';
  observationKind: 'base_touch_history' | 'first_base_race' | 'whole_play_history'; basis: WholePlaySourceRef; horizon: BallWorldMoment }>;
/** Admission preserves future action metadata without asserting a physical occurrence. */
export type WholePlayScheduledThrowPlan = Owned & Readonly<{ kind: 'throw_plan'; basis: WholePlaySourceRef;
  horizon: BallWorldMoment; plan: BattedWorldScheduledFieldThrowPlan }>;
export type WholePlayScheduledAcquisitionPlan = Owned & Readonly<{ kind: 'acquisition_plan'; basis: WholePlaySourceRef;
  horizon: BallWorldMoment; plan: BattedWorldScheduledFieldAcquisitionPlan }>;
export type WholePlayHistoryStep = WholePlayPhysicalStep | WholePlayObservation | WholePlayScheduledThrowPlan | WholePlayScheduledAcquisitionPlan;
export type CanonicalWholePlayHistoryInput = Readonly<{
  scope: Readonly<{ gameId: string; playId: number; physicalPitchSourceId: string }>;
  originalTimeline: CanonicalPlateAppearanceTimeline;
  origin: Readonly<{ moment: BallWorldMoment; actors: readonly BallWorldMotionActor[]; batterRunnerId: string;
    defenderIds: readonly string[]; ticksPerSecond: number }>;
  steps: readonly WholePlayHistoryStep[];
}>;
export type WholePlayHistoryPhase = 'bat_contact' | 'world_boundary' | 'motion_horizon' | 'response_cursor'
  | 'acquisition_secured' | 'acquisition_interrupted' | 'throw_release'
  | 'acquisition_constraint_started' | 'acquisition_progress' | 'acquisition_dissipation_complete' | 'acquisition_confirmed';
export type WholePlayOriginalPitchRef = Readonly<{ owner: 'physical_pitch'; sourceId: string }>;
/** Occurrence array order is serialization only; equal elapsed time has no implicit physical precedence. */
export type WholePlayHistoryFrame = Readonly<{ originTick: number; elapsedSeconds: number; tick: number;
  occurrences: readonly Readonly<{ source: WholePlaySourceRef | WholePlayOriginalPitchRef; phase: WholePlayHistoryPhase }>[] }>;
export type CanonicalWholePlayHistory = Readonly<{
  scope: CanonicalWholePlayHistoryInput['scope']; originalPitch: WholePlayOriginalPitchRef;
  originalTimeline: CanonicalPlateAppearanceTimeline; origin: CanonicalWholePlayHistoryInput['origin'];
  physicalSteps: readonly WholePlayPhysicalStep[]; observations: readonly WholePlayObservation[];
  scheduledThrowPlans?: readonly WholePlayScheduledThrowPlan[];
  scheduledAcquisitionPlans?: readonly WholePlayScheduledAcquisitionPlan[];
  frames: readonly WholePlayHistoryFrame[]; horizon: BallWorldMoment;
  cursor: BattedWorldBallCursor | null; carrierPlayerId: string | null; end: Readonly<{ kind: 'unestablished' }>;
}>;

const json = (value: unknown) => JSON.stringify(value);
const fields = (value: unknown, names: readonly string[]): boolean => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...names].sort().join('|');
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const vector = (value: Vec3): boolean => fields(value, ['x', 'y', 'z']) && Object.values(value).every(Number.isFinite);
const sameNumber = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
const actorKey = (actor: BallWorldMotionActor) => json([actor.playerId, actor.primitive.role]);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function fail(reason: string): never { throw new Error(`whole-play history ${reason}`); }

/**
 * Native proves Source ownership and rederives each physical result. This additive
 * envelope checks internal clock, actor/cursor continuity and directed linkage.
 * It does not grant a caller's Source authority or resolve any baseball result.
 */
export const deriveCanonicalWholePlayHistory = (raw: CanonicalWholePlayHistoryInput): CanonicalWholePlayHistory => {
  const input = cloneInert(raw);
  if (!fields(input, ['scope', 'originalTimeline', 'origin', 'steps'])
    || !fields(input.scope, ['gameId', 'playId', 'physicalPitchSourceId']) || !id(input.scope.gameId)
    || !id(input.scope.physicalPitchSourceId) || !tick(input.scope.playId)
    || !fields(input.origin, ['moment', 'actors', 'batterRunnerId', 'defenderIds', 'ticksPerSecond'])
    || !id(input.origin.batterRunnerId) || !Array.isArray(input.origin.defenderIds) || !input.origin.defenderIds.every(id)
    || !Array.isArray(input.origin.actors) || !input.origin.actors.length || !Array.isArray(input.steps) || !input.steps.length
    || input.steps[0].source?.owner !== 'field_action' || input.steps[0].kind !== 'motion') {
    fail('scope is invalid');
  }
  const { scope, originalTimeline: timeline, origin } = input;
  const p = origin.ticksPerSecond, originTick = origin.moment.originTick;
  const players = new Set([origin.batterRunnerId, ...origin.defenderIds]);
  if (!tick(originTick) || !Number.isSafeInteger(p) || p <= 0 || players.size !== origin.defenderIds.length + 1
    || origin.moment.elapsedSeconds !== 0) fail('original clock or Player scope differs');
  const moment = (value: BallWorldMoment) => {
    if (!fields(value, ['originTick', 'elapsedSeconds', 'ball']) || value.originTick !== originTick
      || !Number.isFinite(value.elapsedSeconds) || value.elapsedSeconds < 0
      || !fields(value.ball, ['tick', 'position', 'velocity', 'spin'])
      || value.ball.tick !== quantizeEventTick(originTick, value.elapsedSeconds, p)
      || ![value.ball.position, value.ball.velocity, value.ball.spin].every(vector)) fail('moment differs from the original clock');
  };
  moment(origin.moment);
  const event = timeline?.events?.at(-1);
  if (!fields(timeline, ['playId', 'startedAtTick', 'lastEventTick', 'nextSequence', 'status', 'events'])
    || timeline.playId !== scope.playId || !tick(timeline.startedAtTick) || timeline.startedAtTick > originTick
    || timeline.lastEventTick !== originTick || !tick(timeline.nextSequence) || timeline.nextSequence !== timeline.events.length
    || timeline.status.kind !== 'batted_ball_pending' || timeline.status.contactTick !== originTick
    || event?.kind !== 'BatBallContact' || event.tick !== originTick
    || json(createBattedBallInitialStateFromContact(event.payload.contact)) !== json(origin.moment.ball)
    || timeline.events.some((value, index) => !tick(value.tick) || value.sequence !== index
      || value.tick < (timeline.events[index - 1]?.tick ?? timeline.startedAtTick) || value.tick > originTick
      || value.kind === 'LiveBallPlayEnded')) fail('original pitch timeline or bat contact differs');

  let horizon = origin.moment, actors = origin.actors, cursor: BattedWorldBallCursor | null = { moment: horizon, previousContacts: [] };
  let carrierPlayerId: string | null = null, currentField: BattedWorldFieldMotion | null = null;
  let physicalBasis: WholePlaySourceRef | null = null, executionStarted = false;
  const actorKeys = new Set(actors.map(actorKey));
  if (actorKeys.size !== actors.length) fail('original actor identity is duplicated');
  const validateActor = (actor: BallWorldMotionActor, end: BallWorldMoment) => {
    const s = actor.primitive;
    if (!fields(actor, ['playerId', 'primitive', ...(actor.startElapsedSeconds === undefined ? [] : ['startElapsedSeconds'])])
      || !players.has(actor.playerId) || !fields(s, ['role', 'radius', 'startTick', 'endTick', 'ticksPerSecond',
        'startCenter', 'startVelocity', 'acceleration']) || !['glove', 'tag_hand', 'body', 'left_foot', 'right_foot'].includes(s.role)
      || !Number.isFinite(s.radius) || s.radius <= 0 || !tick(s.startTick) || !tick(s.endTick) || s.ticksPerSecond !== p
      || s.endTick < end.ball.tick || ![s.startCenter, s.startVelocity, s.acceleration].every(vector)
      || actor.startElapsedSeconds !== undefined && (!Number.isFinite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)
      || (s.startTick - originTick) / p + (actor.startElapsedSeconds ?? 0) > horizon.elapsedSeconds) fail('actor scope or executed coverage differs');
  };
  const sample = (actor: BallWorldMotionActor, elapsed: number) => {
    const s = actor.primitive, dt = (originTick - s.startTick) / p + elapsed - (actor.startElapsedSeconds ?? 0);
    return (['x', 'y', 'z'] as const).flatMap((axis) => [s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt,
      s.startVelocity[axis] + s.acceleration[axis] * dt]);
  };
  actors.forEach((actor) => validateActor(actor, horizon));
  const rebaseActors = (next: readonly BallWorldMotionActor[], end: BallWorldMoment) => {
    moment(end);
    if (end.elapsedSeconds < horizon.elapsedSeconds || !Array.isArray(next) || next.length !== actors.length
      || new Set(next.map(actorKey)).size !== actorKeys.size) fail('actor horizon or coverage differs');
    for (const actor of next) {
      validateActor(actor, end);
      const previous = actors.find((value) => actorKey(value) === actorKey(actor));
      if (!previous || !actorKeys.has(actorKey(actor)) || actor.primitive.radius !== previous.primitive.radius
        || (actor.primitive.startTick - originTick) / p + (actor.startElapsedSeconds ?? 0) !== horizon.elapsedSeconds
        || !sample(previous, horizon.elapsedSeconds).every((value, index) => sameNumber(value, sample(actor, horizon.elapsedSeconds)[index]))) {
        fail('actor rebase is discontinuous');
      }
    }
    actors = next;
  };
  const checkCursor = (value: BattedWorldBallCursor) => {
    if (!fields(value, ['moment', 'previousContacts']) || !Array.isArray(value.previousContacts)) fail('cursor scope differs');
    moment(value.moment);
    for (const contact of value.previousContacts) {
      if (contact.kind === 'actor' ? !fields(contact, ['kind', 'playerId', 'role']) || !actorKeys.has(json([contact.playerId, contact.role]))
        : contact.kind !== 'surface' || !fields(contact, ['kind', 'surfaceId']) || !id(contact.surfaceId)) fail('cursor contact scope differs');
    }
  };
  const checkBoundary = (world: BattedWorldFieldMotion['motion']['world'], bags: readonly BallWorldBaseBoundaryContact[]) => {
    moment(world.moment);
    if (!Array.isArray(bags)) fail('base companions are missing');
    if (world.kind !== 'boundary') {
      if (!['moving', 'resting'].includes(world.kind) || !fields(world, ['kind', 'moment', 'throughTick', ...('phase' in world ? ['phase'] : [])])
        || world.throughTick !== world.moment.ball.tick || bags.length) fail('non-boundary has invalid contacts or horizon');
      return;
    }
    if (!fields(world, ['kind', 'moment', 'contacts', ...('phase' in world ? ['phase'] : []), ...(world.pendingReason ? ['pendingReason'] : [])])
      || !world.contacts.length || world.pendingReason !== undefined && world.pendingReason !== 'persistent_contact') fail('boundary scope differs');
    for (const contact of world.contacts) {
      const names = contact.kind === 'actor' ? ['kind', 'playerId', 'role', 'moment', 'center', 'velocity', 'normal', ...(contact.continuing ? ['continuing'] : [])]
        : contact.kind === 'surface' ? ['kind', 'surfaceId', 'moment', 'point', 'normal', ...(contact.continuing ? ['continuing'] : [])] : ['kind', 'moment'];
      if (!fields(contact, names) || json(contact.moment) !== json(world.moment)) fail('raw contact state differs');
      if (contact.kind === 'actor') {
        if (!actorKeys.has(json([contact.playerId, contact.role])) || ![contact.center, contact.velocity].every(vector)
          || contact.normal !== null && !vector(contact.normal)) fail('raw actor contact scope differs');
      } else if (contact.kind === 'surface') {
        if (!id(contact.surfaceId) || !vector(contact.point) || contact.normal !== null && !vector(contact.normal)) fail('raw surface contact differs');
      } else if (contact.kind !== 'ground' && contact.kind !== 'rolling_stop') fail('raw contact kind differs');
    }
    const bases = ['home', 'first', 'second', 'third'] as const;
    if (new Set(bags.map((bag) => bag.baseId)).size !== bags.length) fail('base companion is duplicated');
    for (const bag of bags) {
      if (!fields(bag, ['kind', 'baseId', 'moment', 'point', 'normal', ...(bag.continuing ? ['continuing'] : [])]) || bag.kind !== 'base'
        || !bases.includes(bag.baseId) || !vector(bag.point) || bag.normal !== null && !vector(bag.normal)
        || json(bag.moment) !== json(world.moment) || !world.contacts.some((contact) => contact.kind === 'surface'
          && contact.surfaceId === battedWorldBaseSurfaceId(bag.baseId) && json(contact.point) === json(bag.point)
          && json(contact.normal) === json(bag.normal) && contact.continuing === bag.continuing)) fail('base companion provenance differs');
    }
    for (const contact of world.contacts) if (contact.kind === 'surface') {
      const base = bases.find((value) => contact.surfaceId === battedWorldBaseSurfaceId(value));
      if (base && !bags.some((bag) => bag.baseId === base)) fail('base companion provenance is incomplete');
    }
  };
  const checkRetention = (retention: CatchRetentionResolution, at: BallWorldMoment) => {
    if (!fields(retention, ['outcome', 'diagnostics']) || !fields(retention.diagnostics, ['relativeVelocity', 'translationalEnergyJ',
      'rotationalEnergyJ', 'retentionLoadJ', 'pocketFactor', 'effectiveCapacityJ']) || !vector(retention.diagnostics.relativeVelocity)
      || !Object.entries(retention.diagnostics).filter(([name]) => name !== 'relativeVelocity').every(([, value]) => typeof value === 'number' && value >= 0)
      || !fields(retention.outcome, ['kind', 'gloveContactTick', ...(retention.outcome.kind === 'secured' ? ['secureTick'] : ['ball'])])
      || retention.outcome.gloveContactTick !== at.ball.tick) fail('retention physical scope differs');
    if (retention.outcome.kind === 'secured') {
      if (!tick(retention.outcome.secureTick) || retention.outcome.secureTick < at.ball.tick) fail('retention candidate deadline differs');
    } else if (retention.outcome.kind === 'live-ball') moment({ ...at, ball: retention.outcome.ball });
    else fail('retention outcome kind differs');
  };
  const physicalSteps: WholePlayPhysicalStep[] = [], observations: WholePlayObservation[] = [];
  const scheduledThrowPlans: WholePlayScheduledThrowPlan[] = [];
  const scheduledAcquisitionPlans: WholePlayScheduledAcquisitionPlan[] = [];
  let pendingAcquisition: { step: WholePlayScheduledAcquisitionPlan; previous: BattedWorldScheduledFieldAcquisitionAdvance | null } | null = null;
  let pendingThrow: { step: WholePlayScheduledThrowPlan; previous: BattedWorldScheduledFieldThrowAdvance | null } | null = null;
  const originalPitch: WholePlayOriginalPitchRef = { owner: 'physical_pitch', sourceId: scope.physicalPitchSourceId };
  const frames: { originTick: number; elapsedSeconds: number; tick: number;
    occurrences: { source: WholePlaySourceRef | WholePlayOriginalPitchRef; phase: WholePlayHistoryPhase }[] }[] = [];
  const occurrence = (at: BallWorldMoment, source: WholePlaySourceRef | WholePlayOriginalPitchRef, phase: WholePlayHistoryPhase) => {
    moment(at);
    const previous = frames.at(-1);
    if (previous && previous.elapsedSeconds > at.elapsedSeconds) fail('physical chronology runs backward');
    if (previous?.elapsedSeconds === at.elapsedSeconds) previous.occurrences.push({ source, phase });
    else frames.push({ originTick, elapsedSeconds: at.elapsedSeconds, tick: at.ball.tick, occurrences: [{ source, phase }] });
  };
  occurrence(horizon, originalPitch, 'bat_contact');
  const adoptField = (field: BattedWorldFieldMotion, source: WholePlaySourceRef) => {
    if (!fields(field, ['motion', 'baseContacts']) || !fields(field.motion, ['actors', 'carrierPlayerId', 'world', 'response', 'cursor'])) fail('field scope differs');
    const { motion } = field, response = motion.response, end = motion.world.moment;
    checkBoundary(motion.world, field.baseContacts);
    if (end.elapsedSeconds < horizon.elapsedSeconds || json(motion.cursor) !== json(response.cursor)) fail('field response cursor or horizon differs');
    if (motion.carrierPlayerId !== null && !origin.defenderIds.includes(motion.carrierPlayerId)) fail('field carrier scope differs');
    const responseFields = ['kind', 'cursor', ...('retention' in response ? ['retention'] : []),
      ...(response.kind === 'capture_candidate' ? ['moment'] : []), ...(response.kind === 'unresolved' ? ['reason'] : [])];
    if (!fields(response, responseFields)) fail('response scope differs');
    if ('retention' in response && response.retention) checkRetention(response.retention, end);
    if (response.cursor) {
      if (!['moving', 'resting', 'ground', 'rolling_stop', 'rebound', 'carried'].includes(response.kind)) fail('response kind differs');
      checkCursor(response.cursor);
      const adopted = response.cursor.moment;
      if (adopted.elapsedSeconds !== end.elapsedSeconds || adopted.ball.tick !== end.ball.tick
        || !(['x', 'z'] as const).every((axis) => adopted.ball.position[axis] === end.ball.position[axis])
        || response.kind !== 'ground' && adopted.ball.position.y !== end.ball.position.y
        || ['moving', 'resting', 'rolling_stop', 'carried'].includes(response.kind) && json(adopted) !== json(end)
        || response.kind === 'carried' && motion.carrierPlayerId === null
        || response.kind !== 'carried' && motion.carrierPlayerId !== null) fail('adopted response state differs');
    } else if (response.kind === 'capture_candidate') {
      if (motion.carrierPlayerId !== null || motion.world.kind !== 'boundary' || motion.world.contacts.length !== 1
        || motion.world.contacts[0].kind !== 'actor' || motion.world.contacts[0].role !== 'glove'
        || motion.world.contacts[0].continuing || json(response.moment) !== json(end)) fail('capture candidate differs');
    } else if (response.kind !== 'unresolved' || !['simultaneous', 'degenerate_normal', 'persistent_contact', 'carried_contact'].includes(response.reason)
      || motion.world.kind !== 'boundary') fail('unresolved physical response differs');
    occurrence(end, source, motion.world.kind === 'boundary' ? 'world_boundary' : 'motion_horizon');
    // Incoming and adopted states may differ at the exact same time. Both remain
    // available in the raw step; the frame never invents a total order between them.
    if (motion.cursor && json(motion.cursor.moment) !== json(end)) occurrence(motion.cursor.moment, source, 'response_cursor');
    horizon = end; cursor = motion.cursor; carrierPlayerId = motion.carrierPlayerId;
  };
  const owners = new Map<string, { sourceId: string; revision: number; seen: Set<string> }>();
  for (const step of input.steps) {
    const ref = step.source;
    if (!fields(ref, ['owner', 'sourceId', 'revision', 'physicalPitchSourceId']) || !['field_action', 'field_execution'].includes(ref.owner)
      || !id(ref.sourceId) || ref.physicalPitchSourceId !== scope.physicalPitchSourceId || !Number.isSafeInteger(ref.revision)
      || step.previousSourceId !== null && !id(step.previousSourceId)) fail('Source scope differs');
    const previous = owners.get(ref.owner);
    if (ref.revision !== (previous?.revision ?? 0) + 1 || step.previousSourceId !== (previous?.sourceId ?? null)
      || previous?.seen.has(ref.sourceId)) fail('Source directed prefix differs');
    const seen = previous?.seen ?? new Set<string>(); seen.add(ref.sourceId); owners.set(ref.owner, { sourceId: ref.sourceId, revision: ref.revision, seen });
    if (ref.owner === 'field_execution') executionStarted = true;
    else if (executionStarted || step.kind !== 'motion') fail('field owner ordering differs');
    if (step.kind === 'observation') {
      if (!fields(step, ['source', 'previousSourceId', 'kind', 'observationKind', 'basis', 'horizon'])
        || !['base_touch_history', 'first_base_race', 'whole_play_history'].includes(step.observationKind)
        || !physicalBasis || json(step.basis) !== json(physicalBasis) || json(step.horizon) !== json(horizon)) fail('observation physical basis differs');
      observations.push(step); continue;
    }
    if (step.kind === 'acquisition_plan') {
      if (!fields(step, ['source', 'previousSourceId', 'kind', 'basis', 'horizon', 'plan']) || pendingThrow || pendingAcquisition
        || cursor !== null || carrierPlayerId !== null || !physicalBasis || json(step.basis) !== json(physicalBasis)
        || json(step.horizon) !== json(horizon) || currentField?.motion.response.kind !== 'capture_candidate'
        || json(step.plan.input.field) !== json(currentField) || json(step.plan.contactMoment) !== json(horizon)
        || json(step.plan.input.field.motion.actors) !== json(actors) || !origin.defenderIds.includes(step.plan.acquirerPlayerId)) {
        fail('scheduled acquisition admission differs from its original candidate');
      }
      validateBattedWorldScheduledFieldAcquisitionPlan(step.plan);
      scheduledAcquisitionPlans.push(step); pendingAcquisition = { step, previous: null }; continue;
    }
    if (step.kind === 'acquisition_advance') {
      if (!fields(step, ['source', 'previousSourceId', 'kind', 'planSourceId', 'field', 'progress'])
        || pendingThrow || !pendingAcquisition || cursor !== null || carrierPlayerId !== null
        || step.planSourceId !== pendingAcquisition.step.source.sourceId || json(step.field) !== json(currentField)
        || json(step.field) !== json(pendingAcquisition.step.plan.input.field)) fail('scheduled acquisition advance lacks its exact pending candidate');
      const { plan } = pendingAcquisition.step, previous = pendingAcquisition.previous, progress = step.progress;
      const checkpoints = progress.checkpointElapsedSeconds, priorCheckpoints = previous?.checkpointElapsedSeconds ?? [];
      if (json(progress.startMoment) !== json(horizon) || json(step.field.motion.actors) !== json(actors)
        || !Array.isArray(checkpoints) || checkpoints.length !== priorCheckpoints.length + 1
        || json(checkpoints.slice(0, -1)) !== json(priorCheckpoints)) fail('scheduled acquisition advance lineage differs');
      validateBattedWorldScheduledFieldAcquisitionProgress(plan, progress);
      const end = progress.world.moment;
      moment(end); actors.forEach((actor) => validateActor(actor, end));
      if (end.elapsedSeconds < horizon.elapsedSeconds) fail('scheduled acquisition chronology runs backward');
      checkBoundary(progress.world, progress.baseContacts);
      if (previous === null) occurrence(plan.contactMoment, ref, 'acquisition_constraint_started');
      if (progress.dissipationMoment && !previous?.dissipationMoment) occurrence(progress.dissipationMoment, ref, 'acquisition_dissipation_complete');
      if (progress.kind === 'secured') {
        checkCursor(progress.cursor);
        carrierPlayerId = plan.acquirerPlayerId; cursor = progress.cursor;
        occurrence(end, ref, 'acquisition_confirmed'); pendingAcquisition = null;
      } else {
        occurrence(end, ref, progress.kind === 'interrupted' ? 'acquisition_interrupted' : 'acquisition_progress');
        // A terminal interruption leaves an unresolved physical contact. It is
        // not permission to retry the old capture candidate or restart motion.
        pendingAcquisition = { step: pendingAcquisition.step, previous: progress };
      }
      horizon = end; physicalSteps.push(step); physicalBasis = ref; continue;
    }
    if (pendingAcquisition && step.kind !== 'acquisition_advance') fail('pending scheduled acquisition requires its owned advance');
    if (step.kind === 'throw_plan') {
      const plan = step.plan, transfer = plan?.transfer;
      if (!fields(step, ['source', 'previousSourceId', 'kind', 'basis', 'horizon', 'plan']) || pendingThrow || !cursor || !carrierPlayerId
        || !physicalBasis || json(step.basis) !== json(physicalBasis) || json(step.horizon) !== json(horizon)
        || !fields(plan, ['input', 'actors', 'transfer', 'releaseElapsedSeconds'])
        || !fields(plan.input, ['response', 'geometry', 'cursor', 'actors', 'carrierPlayerId', 'availableAtTick', 'throughTick', 'commands',
          'receiverPlayerId', 'ratings', 'transferParameters', 'throwCalibration', 'seed'])
        || json(plan.input.cursor) !== json(cursor) || json(plan.input.actors) !== json(actors)
        || plan.input.carrierPlayerId !== carrierPlayerId || !origin.defenderIds.includes(plan.input.receiverPlayerId)
        || plan.input.receiverPlayerId === carrierPlayerId
        || !fields(transfer, ['securedPossessionTick', 'transferDelayTicks', 'throwReadyTick']) || !Object.values(transfer).every(tick)
        || transfer.securedPossessionTick !== horizon.ball.tick || transfer.throwReadyTick !== transfer.securedPossessionTick + transfer.transferDelayTicks
        || plan.releaseElapsedSeconds !== (transfer.throwReadyTick - originTick) / p || plan.releaseElapsedSeconds < horizon.elapsedSeconds
        || plan.input.throughTick < transfer.throwReadyTick) fail('scheduled throw admission differs from its physical basis');
      validateBattedWorldScheduledFieldThrowPlan(plan);
      scheduledThrowPlans.push(step); pendingThrow = { step, previous: null }; continue;
    }
    if (step.kind === 'throw_advance') {
      if (!fields(step, ['source', 'previousSourceId', 'kind', 'planSourceId', 'startCursor', 'field', 'progress'])
        || !pendingThrow || !cursor || !carrierPlayerId || step.planSourceId !== pendingThrow.step.source.sourceId
        || json(step.startCursor) !== json(cursor)) fail('scheduled advance lacks its exact pending plan and cursor');
      const { plan } = pendingThrow.step, previous = pendingThrow.previous, progress = step.progress;
      const checkpoints = progress.checkpointElapsedSeconds, priorCheckpoints = previous?.checkpointElapsedSeconds ?? [];
      if (!fields(progress, ['kind', 'transfer', 'startCursor', 'field', 'checkpointElapsedSeconds', 'planIdentity',
        ...(progress.kind === 'released' ? ['releaseCursor', 'launch'] : [])])
        || progress.planIdentity !== json(plan) || json(progress.transfer) !== json(plan.transfer) || json(progress.startCursor) !== json(cursor)
        || json(progress.field) !== json(step.field) || json(step.field.motion.actors) !== json(plan.actors)
        || carrierPlayerId !== plan.input.carrierPlayerId || !Array.isArray(checkpoints) || checkpoints.length !== priorCheckpoints.length + 1
        || json(checkpoints.slice(0, -1)) !== json(priorCheckpoints)
        || checkpoints.some((value) => !Number.isFinite(value))
        || checkpoints.at(-1)! < horizon.elapsedSeconds
        || checkpoints.at(-1) === horizon.elapsedSeconds && (previous !== null || plan.releaseElapsedSeconds !== horizon.elapsedSeconds)
        || checkpoints.at(-1)! > (plan.input.throughTick - originTick) / p) fail('scheduled transfer lineage or coverage differs');
      checkCursor(step.startCursor);
      const end = step.field.motion.world.moment;
      if (previous) {
        if (json(step.field.motion.actors) !== json(actors)) fail('scheduled transfer actor anchors changed');
        actors.forEach((actor) => validateActor(actor, end));
      } else rebaseActors(step.field.motion.actors, end);
      moment(end);
      if (end.elapsedSeconds < horizon.elapsedSeconds || end.elapsedSeconds > checkpoints.at(-1)!
        || end.elapsedSeconds > plan.releaseElapsedSeconds) fail('scheduled transfer executed horizon differs');
      const glove = actors.find((actor) => actor.playerId === carrierPlayerId && actor.primitive.role === 'glove');
      const dt = end.elapsedSeconds - horizon.elapsedSeconds;
      if (!glove || !(['x', 'y', 'z'] as const).every((axis) => sameNumber(end.ball.position[axis],
        step.startCursor.moment.ball.position[axis] + step.startCursor.moment.ball.velocity[axis] * dt + 0.5 * glove.primitive.acceleration[axis] * dt * dt))
        || json(end.ball.spin) !== json(cursor.moment.ball.spin)) fail('scheduled transfer carried position differs');
      if (progress.kind === 'released') {
        const release = progress.releaseCursor.moment, launch = progress.launch;
        checkCursor(progress.releaseCursor);
        if (!fields(launch, ['releaseTick', 'origin', 'intendedTarget', 'aimedTarget', 'targetError', 'targetErrorScaleMeters', 'releaseSpeedMps', 'initialVelocity'])
          || release.elapsedSeconds !== plan.releaseElapsedSeconds || release.elapsedSeconds !== end.elapsedSeconds
          || !(['x', 'y', 'z'] as const).every((axis) => sameNumber(release.ball.position[axis], end.ball.position[axis]))
          || json(release.ball.spin) !== json(step.startCursor.moment.ball.spin)
          || release.ball.tick !== plan.transfer.throwReadyTick || launch.releaseTick !== plan.transfer.throwReadyTick
          || json(launch.origin) !== json(release.ball.position) || json(launch.initialVelocity) !== json(release.ball.velocity)
          || json(progress.releaseCursor.previousContacts) !== json(cursor.previousContacts)
          || step.field.motion.carrierPlayerId !== null) fail('scheduled release clock or launch differs');
        occurrence(release, ref, 'throw_release'); pendingThrow = null;
      } else {
        if (!(['x', 'y', 'z'] as const).every((axis) => sameNumber(end.ball.velocity[axis],
          cursor!.moment.ball.velocity[axis] + glove.primitive.acceleration[axis] * dt))
          || step.field.motion.carrierPlayerId !== carrierPlayerId) fail('scheduled transfer carried velocity or custody differs');
        if (progress.kind === 'transfer') {
          if (end.elapsedSeconds !== checkpoints.at(-1) || end.elapsedSeconds >= plan.releaseElapsedSeconds
            || !step.field.motion.cursor || step.field.motion.response.kind !== 'carried'
            || step.field.motion.world.kind === 'boundary') fail('scheduled pending transfer differs');
          pendingThrow = { step: pendingThrow.step, previous: progress };
        } else if (progress.kind === 'interrupted') {
          if (step.field.motion.world.kind !== 'boundary' || step.field.motion.cursor !== null
            || step.field.motion.response.kind !== 'unresolved' || step.field.motion.response.reason !== 'carried_contact') {
            fail('scheduled interrupted transfer differs');
          }
          pendingThrow = null;
        } else fail('scheduled progress kind differs');
      }
      adoptField(step.field, ref); currentField = step.field;
      physicalSteps.push(step); physicalBasis = ref; continue;
    }
    if (pendingThrow) fail('pending scheduled throw requires its owned advance');
    if (step.kind === 'acquisition') {
      if (!fields(step, ['source', 'previousSourceId', 'kind', 'field', 'acquisition']) || cursor !== null || carrierPlayerId !== null
        || currentField?.motion.response.kind !== 'capture_candidate' || json(step.field) !== json(currentField)) fail('acquisition candidate linkage differs');
      const capture = step.acquisition;
      if (!fields(capture, ['kind', 'acquirerPlayerId', 'contactMoment', 'candidateSecureTick', 'archivedCandidateSecureTick', 'retention', 'transport', 'baseContacts',
        ...(capture.kind === 'secured' ? ['secureTick', 'moment'] : ['reason', 'world'])])
        || !origin.defenderIds.includes(capture.acquirerPlayerId) || json(capture.contactMoment) !== json(horizon)
        || json(capture.retention) !== json(currentField.motion.response.retention)
        || currentField.motion.world.kind !== 'boundary' || currentField.motion.world.contacts[0].kind !== 'actor'
        || currentField.motion.world.contacts[0].playerId !== capture.acquirerPlayerId
        || !tick(capture.candidateSecureTick) || !tick(capture.archivedCandidateSecureTick)) fail('acquisition state differs');
      const end = capture.kind === 'secured' ? capture.moment : capture.world.moment;
      moment(end);
      if (end.elapsedSeconds < horizon.elapsedSeconds) fail('acquisition chronology runs backward');
      actors.forEach((actor) => validateActor(actor, end));
      if (capture.kind === 'secured') {
        if (capture.baseContacts.length || capture.secureTick !== capture.candidateSecureTick || capture.secureTick !== end.ball.tick
          || capture.transport.remainingEnergyJ !== 0) fail('secure state differs');
        carrierPlayerId = capture.acquirerPlayerId;
        cursor = { moment: end, previousContacts: [{ kind: 'actor', playerId: capture.acquirerPlayerId, role: 'glove' }] };
      } else {
        if (capture.kind !== 'interrupted' || !['contact', 'same_tick_competition'].includes(capture.reason)) fail('interruption kind differs');
        checkBoundary(capture.world, capture.baseContacts);
      }
      occurrence(end, ref, capture.kind === 'secured' ? 'acquisition_secured' : 'acquisition_interrupted'); horizon = end;
    } else if (step.kind === 'motion' || step.kind === 'retained_motion_checkpoint_v1' || step.kind === 'throw') {
      if (!fields(step, ['source', 'previousSourceId', 'kind', 'startCursor', 'field', ...(step.kind === 'throw' ? ['throw'] : [])])
        || !cursor || json(step.startCursor) !== json(cursor)) fail('physical step lacks its exact preceding cursor');
      checkCursor(step.startCursor);
      if (step.kind === 'retained_motion_checkpoint_v1') {
        if (json(step.field.motion.actors) !== json(actors)) fail('retained motion actor curves differ');
        actors.forEach((actor) => validateActor(actor, step.field.motion.world.moment));
      } else rebaseActors(step.field.motion.actors, step.field.motion.world.moment);
      if (step.kind !== 'throw') {
        if (step.field.motion.world.moment.elapsedSeconds === step.startCursor.moment.elapsedSeconds
          && json(step.field.motion.world.moment) !== json(step.startCursor.moment)) fail('zero-duration motion changed the incoming ball state');
        if (step.field.motion.carrierPlayerId !== carrierPlayerId) fail('motion custody differs');
      } else {
        const thrown = step.throw, transfer = thrown.transfer;
        if (!carrierPlayerId || !fields(thrown, ['kind', 'transfer', 'field', ...(thrown.kind === 'released' ? ['releaseCursor', 'launch'] : [])])
          || !fields(transfer, ['securedPossessionTick', 'transferDelayTicks', 'throwReadyTick'])
          || !Object.values(transfer).every(tick) || transfer.securedPossessionTick !== horizon.ball.tick
          || transfer.throwReadyTick !== transfer.securedPossessionTick + transfer.transferDelayTicks
          || json(thrown.field) !== json(step.field)) fail('throw transfer or field linkage differs');
        if (thrown.kind === 'released') {
          const release = thrown.releaseCursor.moment, launch = thrown.launch;
          checkCursor(thrown.releaseCursor);
          if (!fields(launch, ['releaseTick', 'origin', 'intendedTarget', 'aimedTarget', 'targetError', 'targetErrorScaleMeters', 'releaseSpeedMps', 'initialVelocity'])
            || release.elapsedSeconds < horizon.elapsedSeconds || release.elapsedSeconds > step.field.motion.world.moment.elapsedSeconds
            || release.elapsedSeconds !== (transfer.throwReadyTick - originTick) / p || launch.releaseTick !== transfer.throwReadyTick
            || release.ball.tick !== transfer.throwReadyTick || json(launch.origin) !== json(release.ball.position)
            || json(launch.initialVelocity) !== json(release.ball.velocity) || step.field.motion.carrierPlayerId !== null) fail('throw release clock or launch differs');
          const glove = actors.find((actor) => actor.playerId === carrierPlayerId && actor.primitive.role === 'glove');
          const dt = release.elapsedSeconds - horizon.elapsedSeconds;
          if (!glove || !(['x', 'y', 'z'] as const).every((axis) => sameNumber(release.ball.position[axis],
            step.startCursor.moment.ball.position[axis] + step.startCursor.moment.ball.velocity[axis] * dt
              + 0.5 * glove.primitive.acceleration[axis] * dt * dt))
            || json(release.ball.spin) !== json(step.startCursor.moment.ball.spin)
            || json(thrown.releaseCursor.previousContacts) !== json(step.startCursor.previousContacts)) fail('throw release is discontinuous from carried state');
          occurrence(release, ref, 'throw_release');
        } else if (thrown.kind !== 'interrupted' || step.field.motion.carrierPlayerId !== carrierPlayerId
          || step.field.motion.world.kind !== 'boundary' || step.field.motion.world.moment.elapsedSeconds > (transfer.throwReadyTick - originTick) / p) {
          fail('interrupted transfer custody or horizon differs');
        }
      }
      adoptField(step.field, ref); currentField = step.field;
    } else fail('physical step kind differs');
    physicalSteps.push(step); physicalBasis = ref;
  }
  return freeze({ scope, originalPitch, originalTimeline: timeline, origin, physicalSteps, observations,
    ...(scheduledThrowPlans.length ? { scheduledThrowPlans } : {}),
    ...(scheduledAcquisitionPlans.length ? { scheduledAcquisitionPlans } : {}), frames, horizon,
    cursor, carrierPlayerId, end: { kind: 'unestablished' as const } });
};
