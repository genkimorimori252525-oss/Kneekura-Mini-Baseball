import { battedWorldFieldGeometry, battedWorldFieldRootIdentity } from './BattedWorldFieldRoot';
export { battedWorldOriginalContactPrefix, type BattedWorldOriginalContactPrefix } from './BattedWorldOriginalContactPrefix';
import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';
import { createOwnedScheduledMotionDependencyEncoding, createOwnedScheduledMotionPlanEncoding } from './OwnedScheduledMotionDependencyEncoding';
import { validateBattedWorldPiecewiseFieldAcquisitionPlan, validateBattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { validateBattedWorldPiecewiseFieldThrowPlan, validateBattedWorldPiecewiseFieldThrowProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';
import type { OwnedScheduledMotionExecution, OwnedScheduledMotionOperation, OwnedScheduledMotionReference } from './OwnedScheduledBattedWorldMotion';
import type { BattedWorldPossessionEvidence, BaseTouchCustodyEvidence, PendingFieldPossession } from '../../core/rules/BallWorldFieldFirstBaseRaceWithPossessionEvidence';
import { validateBattedWorldScheduledFieldAcquisitionPlan, validateBattedWorldScheduledFieldAcquisitionProgress,
  type BattedWorldScheduledFieldAcquisitionPlan, type BattedWorldScheduledFieldAcquisitionAdvance } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import type { BallWorldFieldTerritoryInput } from '../../core/rules/BallWorldFieldTerritory';
import { deriveBallWorldBattedRuleEvidence, type BallWorldBattedRuleContact, type BallWorldBattedRuleContactFrame } from '../../core/rules/BallWorldBattedRuleEvidence';
import { deriveBattedWorldFieldAcquisition } from '../../core/sim/ball/BattedWorldFieldAcquisition';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { respondToGroundContact } from '../../core/sim/ball/BallFlight';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import type { BallWorldBoundaryContact, BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import type { BallWorldBaseBoundaryContact } from '../../core/sim/ball/BallWorldBaseBoundary';
import type { BattedWorldScheduledFieldThrowPlan, BattedWorldScheduledFieldThrowAdvance } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { battedWorldBaseSurfaceId, createBattedWorldFieldGeometry, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveBallWorldPlayerBaseContactHistory, type BallWorldPlayerBaseContactHistory,
  type BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts, type BallWorldBaseControlWindow,
  type BallWorldControlledBaseContact } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import type { BaseTouchRegion } from '../../core/sim/running/BaseTouch';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type BattedWorldFieldCustodyPolicy = 'release_exclusive_v1';

type PrefixInput = Readonly<{ custodyPolicy?: BattedWorldFieldCustodyPolicy; baseField: DurableBattedWorldFieldAction; fields: readonly DurableBattedWorldFieldAction[];
  executions: readonly DurableBattedWorldFieldExecution[] }>;
type Control = Readonly<{ playerId: string }> & BallWorldBaseControlWindow;
const key = (actor: BallWorldMotionActor) => json([actor.playerId, actor.primitive.role]);
const id = (value: string) => typeof value === 'string' && !!value.length && value === value.trim();
const sameNumber = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
const normalized = (contact: BallWorldBoundaryContact): BallWorldBattedRuleContact => contact.kind === 'actor'
  ? { kind: 'actor', playerId: contact.playerId, role: contact.role } : contact.kind === 'surface'
    ? { kind: 'surface', surfaceId: contact.surfaceId } : { kind: contact.kind };

/** Bounded Source identity comparison, not ownership or physical replay authority.
 * New versioned histories compare individual inert records; raw/v1 histories retain
 * the original aggregate validation and byte convention. */
const executionHistoryMatches = (history: readonly AcceptedBattedWorldFieldExecution[],
  original: readonly AcceptedBattedWorldFieldExecution[], sourceJson: (source: AcceptedBattedWorldFieldExecution) => string): boolean => {
  const records = (values: readonly AcceptedBattedWorldFieldExecution[]) => {
    if (Array.isArray(values) && values.length > 100_000) throw new Error('actual field history exceeds size limits');
    if (!Array.isArray(values) || Reflect.ownKeys(values).length !== values.length + 1) throw new Error('actual field history requires a dense inert array');
    return Array.from({ length: values.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('actual field history requires inert records');
      return descriptor.value as AcceptedBattedWorldFieldExecution;
    });
  };
  const originals = records(original).map(value => sourceJson(value));
  const owned = originals.some(value => {
    const source = JSON.parse(value) as AcceptedBattedWorldFieldExecution;
    return ['owned_motion_v2', 'owned_acquisition_plan_v1', 'owned_throw_plan_v1'].includes(source?.action?.kind);
  });
  if (!owned) return json(history) === json(original);
  const actual = records(history);
  return actual.length === originals.length && actual.every((value, index) => sourceJson(value) === originals[index]);
};

/** Public comparisons always validate afresh; callers cannot supply trusted bytes. */
export const battedWorldFieldExecutionHistoryMatches = (history: readonly AcceptedBattedWorldFieldExecution[],
  original: readonly AcceptedBattedWorldFieldExecution[]): boolean => executionHistoryMatches(history, original, json);

/** Only the Native owner's complete rederived field/execution prefix is admissible. Observations never execute physical time. */
const projectPhysicalPrefix = (input: PrefixInput, reference: (snapshot: DurableBattedWorldFieldExecution) => OwnedScheduledMotionReference): Readonly<{ field: BallWorldFieldTerritoryInput;
  segments: readonly BallWorldPlayerBaseContactSegment[]; controlWindows: readonly Control[]; possessionEvidence?: BattedWorldPossessionEvidence }> => {
  if (input.custodyPolicy !== undefined && input.custodyPolicy !== 'release_exclusive_v1') throw new Error('invalid actual field custody policy');
  const base = input.baseField, world = base.response.touch.worldContact, flight = world.flight;
  assertSupportedBattedWorldConsumer(world, 'field_prefix');
  const initial = flight.flight.initialBall, originTick = initial.tick, p = flight.source.execution.ballFlightParameters;
  const batter = flight.physicalPitch.frame.batterActor, geometry = battedWorldFieldGeometry(base);
  if (!Number.isSafeInteger(base.revision) || base.revision < 1 || input.fields.length !== base.revision
    || json(input.fields.at(-1)) !== json(base)) throw new Error('actual field complete own prefix differs');
  if (!batter || flight.source.searchDurationTicks !== 0 || world.source.previousContactSourceId !== null
    || world.result.kind !== 'airborne' || world.result.throughTick !== originTick || json(world.result.ball) !== json(initial)
    || base.response.result.kind !== 'airborne' || json(base.response.result.ball) !== json(initial)
    || base.rootKind !== 'episode_field_binding_v1' && (base.geometry.baseGeometry.source.flightSourceId !== flight.source.sourceId || json(base.geometry.baseGeometry.flight) !== json(flight))
    || base.geometry.source.baseGeometrySourceId !== base.geometry.baseGeometry.source.sourceId
    || json(geometry.baseGeometry) !== json(base.geometry.baseGeometry.geometry)
    || json(createBattedWorldFieldGeometry({ baseGeometry: geometry.baseGeometry, baseModels: base.geometry.source.baseModels })) !== json(geometry)
    || base.geometry.baseGeometry.fixture.game_id !== base.response.model.gameId) throw new Error('actual field original root or geometry scope differs');
  const bindings = [batter.binding, ...batter.defenderBindings], players = new Set(bindings.map((binding) => binding.playerId));
  if (players.size !== bindings.length
    || bindings.some((binding) => world.modelActorEvidence.filter((actor) => json(actor.binding) === json(binding)).length !== 1)) {
    throw new Error('actual field original Player bindings differ');
  }
  const defenderIds = batter.defenderBindings.map((binding) => binding.playerId);
  const contacts: BallWorldBattedRuleContactFrame[] = [], baseContacts: BallWorldBaseBoundaryContact[] = [];
  const acquisitions: BallWorldFieldTerritoryInput['evidence']['acquisitions'][number][] = [];
  const groundSegments: NonNullable<BallWorldFieldTerritoryInput['groundSegments']>[number][] = [];
  const segments: BallWorldPlayerBaseContactSegment[] = [], controlWindows: Control[] = [];
  let horizon: BallWorldMoment = { originTick, elapsedSeconds: 0, ball: initial };
  let cursor: BattedWorldBallCursor | null = { moment: horizon, previousContacts: [] }, carrierPlayerId: string | null = null;
  let actors: readonly BallWorldMotionActor[] = world.actors, currentField: BattedWorldFieldMotion = base.field;
  let pendingThrow: { sourceId: string; plan: BattedWorldScheduledFieldThrowPlan; previous: BattedWorldScheduledFieldThrowAdvance | null } | null = null;
  let pendingAcquisition: { sourceId: string; plan: BattedWorldScheduledFieldAcquisitionPlan; previous: BattedWorldScheduledFieldAcquisitionAdvance | null } | null = null;
  let hasScheduledAcquisition = false;
  let pendingOwned: { sourceId: string; kind: 'acquisition' | 'throw'; plan: OwnedScheduledMotionOperation['plan']; previous: OwnedScheduledMotionOperation | null } | null = null;
  let ownedTransitions = false;
  const transitions: { incoming: BallWorldMoment; outgoing: BallWorldMoment }[] = [];
  const transition = (incoming: BallWorldMoment, outgoing: BallWorldMoment) => {
    if (incoming.elapsedSeconds === outgoing.elapsedSeconds && json(incoming.ball.position) === json(outgoing.ball.position)) transitions.push({ incoming, outgoing });
  };
  const hasTransitionChain = (incoming: BallWorldMoment, outgoing: BallWorldMoment): boolean => {
    if (!ownedTransitions) return false;
    const reached = new Set([json(incoming)]);
    for (const edge of transitions) if (reached.has(json(edge.incoming))) reached.add(json(edge.outgoing));
    return reached.has(json(outgoing));
  };
  const actorKeys = new Set(actors.map(key));
  if (!actors.length || actorKeys.size !== actors.length || actors.some((actor) => !players.has(actor.playerId))) {
    throw new Error('actual field original actor identity differs');
  }
  const moment = (value: BallWorldMoment) => {
    if (value.originTick !== originTick || !Number.isFinite(value.elapsedSeconds) || value.elapsedSeconds < 0
      || value.ball.tick !== quantizeEventTick(originTick, value.elapsedSeconds, p.ticksPerSecond)
      || (['position', 'velocity', 'spin'] as const).some((part) => !value.ball[part]
        || (['x', 'y', 'z'] as const).some((axis) => !Number.isFinite(value.ball[part][axis])))) {
      throw new Error('actual field original moment or horizon differs');
    }
  };
  const sample = (actor: BallWorldMotionActor, elapsed: number) => {
    const s = actor.primitive, dt = (originTick - s.startTick) / p.ticksPerSecond + elapsed - (actor.startElapsedSeconds ?? 0);
    return (['x', 'y', 'z'] as const).flatMap((axis) => [s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt,
      s.startVelocity[axis] + s.acceleration[axis] * dt]);
  };
  const segment = (next: readonly BallWorldMotionActor[], end: BallWorldMoment, rebase: boolean) => {
    moment(end);
    if (end.elapsedSeconds < horizon.elapsedSeconds || next.length !== actors.length) throw new Error('actual field actor coverage or horizon differs');
    // These identity indexes live only for this segment. Use the same inert keys
    // once per array, retaining uniqueness, membership and original iteration order.
    const nextByKey = new Map(next.map(actor => [key(actor), actor]));
    if (nextByKey.size !== actorKeys.size || [...nextByKey.keys()].some(identity => !actorKeys.has(identity))) {
      throw new Error('actual field actor coverage or horizon differs');
    }
    const priorByKey = next === actors ? nextByKey : new Map(actors.map(actor => [key(actor), actor]));
    for (const [identity, actor] of nextByKey) {
      const prior = priorByKey.get(identity)!, s = actor.primitive;
      const start = (s.startTick - originTick) / p.ticksPerSecond + (actor.startElapsedSeconds ?? 0);
      if (s.ticksPerSecond !== p.ticksPerSecond || s.radius !== prior.primitive.radius || s.endTick < end.ball.tick
        || rebase && start !== horizon.elapsedSeconds || !rebase && json(actor) !== json(prior)
        || !sample(prior, horizon.elapsedSeconds).every((value, index) => sameNumber(value, sample(actor, horizon.elapsedSeconds)[index]))) {
        throw new Error('actual field actor rebase or common horizon differs');
      }
    }
    segments.push({ originTick, startElapsedSeconds: horizon.elapsedSeconds, endElapsedSeconds: end.elapsedSeconds, actors: next });
    actors = next; horizon = end;
  };
  segment(actors, horizon, false);
  const appendContacts = (at: BallWorldMoment, raw: readonly BallWorldBoundaryContact[], bags: readonly BallWorldBaseBoundaryContact[],
    initialConstraint?: () => Readonly<{ incoming: BallWorldMoment; constrained: BallWorldMoment }>) => {
    moment(at);
    if (!raw.length || raw.some((contact) => json(contact.moment) !== json(at)
      || contact.kind === 'actor' && !actorKeys.has(json([contact.playerId, contact.role])))) throw new Error('actual field contact state or actor identity differs');
    // Prove each companion against its own incoming physical state before projecting
    // a response continuation onto the first exact-time rule frame.
    for (const bag of bags) {
      if (json(bag.moment) !== json(at) || !raw.some((contact) => contact.kind === 'surface'
        && contact.surfaceId === battedWorldBaseSurfaceId(bag.baseId) && json(contact.point) === json(bag.point)
        && json(contact.normal) === json(bag.normal) && contact.continuing === bag.continuing)) {
        throw new Error('actual field base contact provenance differs');
      }
    }
    for (const contact of raw) if (contact.kind === 'surface') {
      const bag = (['home', 'first', 'second', 'third'] as const).find((baseId) => contact.surfaceId === battedWorldBaseSurfaceId(baseId));
      if (bag && !bags.some((value) => value.baseId === bag)) throw new Error('actual field base contact provenance is incomplete');
    }
    const normalizedContacts = raw.map(normalized), previous = contacts.at(-1);
    if (previous && previous.moment.elapsedSeconds > at.elapsedSeconds) throw new Error('actual field contact chronology differs');
    if (previous?.moment.elapsedSeconds === at.elapsedSeconds) {
      const extra = normalizedContacts.filter((contact) => !previous.contacts.some((old) => json(old) === json(contact)));
      // Only the formerly rejected new-collider/different-state case needs a
      // proved constraint. Every already accepted projection stays byte-identical.
      const needsProjection = extra.length > 0 && json(previous.moment) !== json(at);
      const constraint = needsProjection ? initialConstraint?.() : undefined;
      const projectedConstraint = constraint && json(previous.moment) === json(constraint.incoming)
        && json(at) === json(constraint.constrained);
      if (previous.moment.originTick !== at.originTick || json(previous.moment.ball.position) !== json(at.ball.position)
        || needsProjection && !projectedConstraint && !hasTransitionChain(previous.moment, at)) throw new Error('coincident actual field contact states differ');
      // A validated initial acquisition constraint can immediately meet a new
      // collider without elapsed time. Keep the original incoming rule moment;
      // its distinct constrained state and every raw contact remain in the result.
      // A response can change velocity/spin without advancing time. Repeated
      // identities retain their first incoming rule moment, never a new impact.
      contacts[contacts.length - 1] = { moment: previous.moment, contacts: [...previous.contacts, ...extra] };
    } else contacts.push({ moment: at, contacts: normalizedContacts });
    for (const bag of bags) {
      const projected = { ...bag, moment: contacts.at(-1)!.moment };
      const index = baseContacts.findIndex((contact) => contact.baseId === bag.baseId && contact.moment.elapsedSeconds === at.elapsedSeconds);
      const old = baseContacts[index];
      if (old && json({ ...old, continuing: true }) !== json({ ...projected, continuing: true })) {
        throw new Error('coincident actual field base contact identities differ');
      }
      // Persistence is additional evidence at that instant; deduplication must
      // not erase it or rewrite any raw Native contact/snapshot.
      if (!old) baseContacts.push(projected);
      else if (bag.continuing && !old.continuing) baseContacts[index] = { ...old, continuing: true };
    }
  };
  const control = (playerId: string, start: number, end: number, endInclusive: boolean) => {
    if (!defenderIds.includes(playerId) || start < 0 || end < start || end > horizon.elapsedSeconds) throw new Error('actual field custody scope differs');
    controlWindows.push({ playerId, startElapsedSeconds: start, endElapsedSeconds: end, endInclusive });
  };
  const closeReleaseEndpoint = (playerId: string, elapsedSeconds: number) => {
    for (const [index, window] of controlWindows.entries()) if (window.playerId === playerId
      && window.endElapsedSeconds === elapsedSeconds && window.endInclusive) controlWindows[index] = { ...window, endInclusive: false };
  };
  const appendField = (field: BattedWorldFieldMotion, freeStart: BallWorldMoment | null, rebase = true) => {
    const motion = field.motion, actual = motion.world;
    segment(motion.actors, actual.moment, rebase);
    if (freeStart && 'phase' in actual && actual.phase !== 'resting'
      && contacts.some((frame) => frame.contacts.some((contact) => contact.kind === 'ground'))) {
      moment(freeStart);
      groundSegments.push({ moment: freeStart, throughElapsedSeconds: horizon.elapsedSeconds,
        rollingDecelerationMps2: actual.phase === 'airborne' ? 0 : p.groundRollingDecelerationMps2,
        ...(actual.phase === 'airborne' ? { gravityY: p.gravityY } : {}) });
    }
    if (actual.kind === 'boundary') appendContacts(actual.moment, actual.contacts, field.baseContacts);
    else if (field.baseContacts.length) throw new Error('actual field base companions lack a boundary');
    if (json(motion.cursor) !== json(motion.response.cursor)) throw new Error('actual field response cursor differs');
    if (motion.cursor) {
      moment(motion.cursor.moment);
      const respondedBall = motion.response.kind === 'ground' ? respondToGroundContact(horizon.ball, p) : horizon.ball;
      if (motion.response.kind === 'ground' && (actual.kind !== 'boundary' || actual.contacts.length !== 1 || actual.contacts[0].kind !== 'ground')
        || motion.cursor.moment.elapsedSeconds !== horizon.elapsedSeconds || json(motion.cursor.moment.ball.position) !== json(respondedBall.position)) {
        throw new Error('actual field continuation cursor horizon differs');
      }
    }
    if (motion.cursor) transition(actual.moment, motion.cursor.moment);
    cursor = motion.cursor; carrierPlayerId = motion.carrierPlayerId; currentField = field;
  };
  const sources = new Set<string>();
  for (const [index, value] of input.fields.entries()) {
    if (battedWorldFieldRootIdentity(value) !== battedWorldFieldRootIdentity(base)
      || json(value.episodeFieldBinding ?? null) !== json(base.episodeFieldBinding ?? null)
      || json(battedWorldFieldGeometry(value)) !== json(geometry)) throw new Error('actual field prefix binding mode or geometry differs');
    if (value.revision !== index + 1 || !id(value.source.sourceId) || sources.has(value.source.sourceId)
      || value.source.previousFieldSourceId !== (input.fields[index - 1]?.source.sourceId ?? null)
      || value.source.responseSourceId !== base.response.source.sourceId || value.source.geometrySourceId !== base.geometry.source.sourceId
      || json(value.history) !== json(input.fields.slice(0, index + 1).map((field) => field.source))
      || json(value.response) !== json(base.response) || json(value.geometry) !== json(base.geometry)) throw new Error('actual field original Source prefix differs');
    sources.add(value.source.sourceId);
    if (!cursor || value.field.motion.carrierPlayerId !== carrierPlayerId) throw new Error('actual field continuation lacks its actual prior cursor');
    appendField(value.field, carrierPlayerId === null ? cursor.moment : null);
  }
  // Keep base-field and plan comparisons local to each complete projection.
  // Archive references belong to the enclosing pure replay factory.
  const dependencyEncoding = createOwnedScheduledMotionDependencyEncoding();
  const sourceJson = (source: AcceptedBattedWorldFieldExecution) => dependencyEncoding.source(source).json;
  const planEncoding = createOwnedScheduledMotionPlanEncoding();
  const planJson = (kind: OwnedScheduledMotionOperation['kind'], plan: OwnedScheduledMotionOperation['plan']) => kind === 'acquisition'
    ? planEncoding.acquisition(plan as Extract<OwnedScheduledMotionOperation, { kind: 'acquisition' }>['plan']).json
    : planEncoding.throw(plan as Extract<OwnedScheduledMotionOperation, { kind: 'throw' }>['plan']).json;
  // Source identifiers are unique within each original Native owner, not across separate tables.
  sources.clear();
  for (const [index, value] of input.executions.entries()) {
    if (value.revision !== index + 1 || !id(value.source.sourceId) || sources.has(value.source.sourceId)
      || value.source.baseFieldSourceId !== base.source.sourceId || dependencyEncoding.baseField(value.baseField).json !== dependencyEncoding.baseField(base).json
      || value.source.previousExecutionSourceId !== (input.executions[index - 1]?.source.sourceId ?? null)
      || !executionHistoryMatches(value.history, input.executions.slice(0, index + 1).map((execution) => execution.source), sourceJson)
      || value.source.action.kind !== value.execution.kind) throw new Error('actual field execution Source prefix differs');
    sources.add(value.source.sourceId);
    const execution = value.execution;
    if (execution.kind === 'owned_acquisition_plan_v1') {
      const plan = execution.plan;
      if (pendingOwned || pendingThrow || pendingAcquisition || cursor !== null || carrierPlayerId !== null
        || currentField.motion.response.kind !== 'capture_candidate' || json(execution.field) !== json(currentField)
        || json(plan.input.field) !== json(currentField) || json(plan.contactMoment) !== json(horizon)
        || json(plan.input.field.motion.actors) !== json(actors) || !defenderIds.includes(plan.acquirerPlayerId)) {
        throw new Error('actual field owned capture candidate or physical basis differs');
      }
      validateBattedWorldPiecewiseFieldAcquisitionPlan(plan);
      hasScheduledAcquisition = true; ownedTransitions = true;
      pendingOwned = { sourceId: value.source.sourceId, kind: 'acquisition', plan, previous: null };
    } else if (execution.kind === 'owned_throw_plan_v1') {
      const plan = execution.plan, model = execution.model;
      const actor = world.modelActorEvidence.find(actor => actor.binding.playerId === carrierPlayerId);
      if (pendingOwned || pendingThrow || pendingAcquisition || !cursor || !carrierPlayerId || !actor
        || json(execution.field) !== json(currentField) || json(plan.input.cursor) !== json(cursor)
        || json(plan.input.actors) !== json(actors) || plan.input.carrierPlayerId !== carrierPlayerId
        || !defenderIds.includes(plan.input.receiverPlayerId) || model.source.playerId !== carrierPlayerId
        || model.source.careerId !== actor.binding.careerId || model.source.personLinkSourceId !== actor.binding.personLinkSourceId
        || json(model.person) !== json(actor.person)) throw new Error('actual field owned throw Player or physical basis differs');
      validateBattedWorldPiecewiseFieldThrowPlan(plan); ownedTransitions = true;
      pendingOwned = { sourceId: value.source.sourceId, kind: 'throw', plan, previous: null };
    } else if (execution.kind === 'owned_motion_v2') {
      ownedTransitions = true;
      const op = execution.operation, start = horizon.elapsedSeconds, priorCarrier = carrierPlayerId;
      if (op) {
        const earlier = input.executions.slice(0, index), original = earlier.find(v => v.source.sourceId === op.planSourceId);
        const previous = earlier.filter(v => v.execution.kind === 'owned_motion_v2' && v.execution.operation?.planSourceId === op.planSourceId);
        if (!original || json(reference(original)) !== json(op.planReference)
          || json(previous.map(reference)) !== json(op.previousSteps)) throw new Error('actual field owned operation reference manifest differs');
        const operations = previous.map(v => (v.execution as Extract<OwnedScheduledMotionExecution, { kind: 'owned_motion_v2' }>).operation!);
        if (operations.some(old => old.kind !== op.kind || planJson(old.kind, old.plan) !== planJson(op.kind, op.plan) || json(old.bridge) !== json(op.bridge))) {
          throw new Error('actual field owned operation previous-step lineage differs');
        }
        if (op.bridge) {
          const originalExecution = original.execution;
          const advanceKind = op.kind === 'acquisition' ? 'acquisition_advance' : 'throw_advance';
          const advance = [...earlier].reverse().find(v => v.execution.kind === advanceKind
            && (v.execution.kind === 'acquisition_advance' || v.execution.kind === 'throw_advance') && v.execution.planSourceId === op.planSourceId);
          if (json(op.bridge.legacyPlanReference) !== json(reference(original))
            || json(op.bridge.previousAdvanceReference) !== json(advance ? reference(advance) : null)
            || originalExecution.kind !== (op.kind === 'acquisition' ? 'acquisition_plan' : 'throw_plan')
            || !op.plan.bridge || json(op.plan.bridge.plan) !== json((originalExecution as { plan: unknown }).plan)
            || json(op.plan.bridge.progress) !== json(advance && (advance.execution.kind === 'acquisition_advance' || advance.execution.kind === 'throw_advance') ? advance.execution.progress : null)) {
            throw new Error('actual field owned legacy bridge lineage differs');
          }
          if (!previous.length) {
            const pending = op.kind === 'acquisition' ? pendingAcquisition : pendingThrow;
            if (!pending || pending.sourceId !== op.planSourceId) throw new Error('actual field owned bridge lacks pending legacy operation');
            pendingAcquisition = null; pendingThrow = null;
            pendingOwned = { sourceId: op.planSourceId, kind: op.kind, plan: op.plan, previous: null };
          }
        } else if (original.execution.kind !== (op.kind === 'acquisition' ? 'owned_acquisition_plan_v1' : 'owned_throw_plan_v1')
          || planJson(op.kind, (original.execution as { plan: OwnedScheduledMotionOperation['plan'] }).plan) !== planJson(op.kind, op.plan)) throw new Error('actual field owned original plan differs');
        if (!pendingOwned || pendingOwned.sourceId !== op.planSourceId || pendingOwned.kind !== op.kind
          || planJson(pendingOwned.kind, pendingOwned.plan) !== planJson(op.kind, op.plan)) throw new Error('actual field owned operation is not pending');
        const steps = [...operations.map(old => old.step), op.step];
        if (op.kind === 'acquisition') {
          const progress = op.progress;
          validateBattedWorldPiecewiseFieldAcquisitionProgress({ plan: op.plan, steps, progress });
          if (json(execution.field) !== json(op.plan.input.field) || json(progress.startMoment) !== json(horizon)) {
            throw new Error('actual field owned capture immutable candidate or actual cut differs');
          }
          if (!previous.length) transition(op.plan.contactMoment, op.plan.initialConstraintMoment);
          segment(progress.activePiece.actors, progress.world.moment, op.step.actors.kind === 'adopted');
          hasScheduledAcquisition = true;
          if (progress.kind === 'secured') {
            acquisitions.push(progress.acquisition); cursor = progress.cursor; carrierPlayerId = op.plan.acquirerPlayerId;
            control(carrierPlayerId, progress.acquisition.moment.elapsedSeconds, horizon.elapsedSeconds, true); pendingOwned = null;
          } else {
            if (progress.kind === 'interrupted') {
              acquisitions.push(progress.acquisition);
              appendContacts(progress.world.moment, progress.acquisition.world.contacts, progress.baseContacts);
            }
            cursor = null; carrierPlayerId = null;
            pendingOwned = { sourceId: op.planSourceId, kind: op.kind, plan: op.plan, previous: op };
          }
        } else {
          const progress: Extract<OwnedScheduledMotionOperation, { kind: 'throw' }>['progress'] = op.progress;
          validateBattedWorldPiecewiseFieldThrowProgress({ plan: op.plan, steps, progress });
          if (!cursor || !priorCarrier || json(progress.startCursor) !== json(cursor) || json(execution.field) !== json(progress.field)) {
            throw new Error('actual field owned throw current cut or field differs');
          }
          if (progress.kind === 'released') transition(progress.startCursor.moment, progress.releaseCursor.moment);
          appendField(execution.field, null, op.step.actors.kind === 'adopted');
          if (progress.kind === 'released') {
            closeReleaseEndpoint(priorCarrier, horizon.elapsedSeconds); control(priorCarrier, start, horizon.elapsedSeconds, false); pendingOwned = null;
          } else {
            control(priorCarrier, start, horizon.elapsedSeconds, progress.kind === 'transfer');
            pendingOwned = progress.kind === 'transfer' ? { sourceId: op.planSourceId, kind: op.kind, plan: op.plan, previous: op } : null;
          }
        }
      } else {
        if (pendingOwned || pendingThrow || pendingAcquisition || !cursor) throw new Error('actual field owned ordinary motion lacks resolved cut');
        if (execution.field.motion.carrierPlayerId !== priorCarrier) throw new Error('actual field owned motion custody differs');
        appendField(execution.field, priorCarrier === null ? cursor.moment : null, execution.composition.mode !== 'retained');
        if (priorCarrier) control(priorCarrier, start, horizon.elapsedSeconds, execution.field.motion.world.kind !== 'boundary');
      }
    } else if (execution.kind === 'acquisition_plan') {
      const plan = execution.plan;
      if (pendingThrow || pendingAcquisition || cursor !== null || carrierPlayerId !== null
        || currentField.motion.response.kind !== 'capture_candidate' || json(execution.field) !== json(currentField)
        || json(plan.input.field) !== json(currentField) || json(plan.contactMoment) !== json(horizon)
        || json(plan.input.field.motion.actors) !== json(actors) || !defenderIds.includes(plan.acquirerPlayerId)) {
        throw new Error('actual field scheduled capture candidate or physical basis differs');
      }
      validateBattedWorldScheduledFieldAcquisitionPlan(plan);
      hasScheduledAcquisition = true; pendingAcquisition = { sourceId: value.source.sourceId, plan, previous: null };
    } else if (execution.kind === 'acquisition_advance') {
      if (!pendingAcquisition || pendingThrow || cursor !== null || carrierPlayerId !== null
        || execution.planSourceId !== pendingAcquisition.sourceId || json(execution.field) !== json(currentField)
        || json(execution.field) !== json(pendingAcquisition.plan.input.field) || json(execution.progress.startMoment) !== json(horizon)) {
        throw new Error('actual field scheduled capture advance original lineage differs');
      }
      const progress = execution.progress, previous = pendingAcquisition.previous, plan = pendingAcquisition.plan, checkpoints = progress.checkpointElapsedSeconds;
      const priorCheckpoints = previous?.checkpointElapsedSeconds ?? [];
      if (!Array.isArray(checkpoints) || checkpoints.length !== priorCheckpoints.length + 1
        || json(checkpoints.slice(0, -1)) !== json(priorCheckpoints)) throw new Error('actual field scheduled capture checkpoint lineage differs');
      validateBattedWorldScheduledFieldAcquisitionProgress(plan, progress);
      segment(execution.field.motion.actors, progress.world.moment, false);
      if (progress.kind === 'secured') {
        acquisitions.push(progress.acquisition);
        control(progress.acquisition.acquirerPlayerId, progress.acquisition.moment.elapsedSeconds, horizon.elapsedSeconds, true);
        carrierPlayerId = progress.acquisition.acquirerPlayerId; cursor = progress.cursor; pendingAcquisition = null;
      } else {
        if (progress.kind === 'interrupted') {
          acquisitions.push(progress.acquisition);
          appendContacts(progress.world.moment, progress.acquisition.world.contacts, progress.baseContacts,
            previous === null ? () => ({ incoming: plan.contactMoment, constrained: plan.initialConstraintMoment }) : undefined);
        }
        pendingAcquisition = { sourceId: pendingAcquisition.sourceId, plan: pendingAcquisition.plan, previous: progress };
      }
    } else if (execution.kind === 'throw_plan') {
      const plan = execution.plan, model = execution.model;
      const actor = world.modelActorEvidence.find((actor) => actor.binding.playerId === carrierPlayerId);
      if (pendingThrow || pendingAcquisition || !cursor || !carrierPlayerId || !actor || json(execution.field) !== json(currentField)
        || json(plan.input.cursor) !== json(cursor) || json(plan.input.actors) !== json(actors)
        || plan.input.carrierPlayerId !== carrierPlayerId || !defenderIds.includes(plan.input.receiverPlayerId)
        || model.source.playerId !== carrierPlayerId || model.source.careerId !== actor.binding.careerId
        || model.source.personLinkSourceId !== actor.binding.personLinkSourceId || json(model.person) !== json(actor.person)) {
        throw new Error('actual field scheduled plan Player or physical basis differs');
      }
      pendingThrow = { sourceId: value.source.sourceId, plan, previous: null };
    } else if (execution.kind === 'throw_advance') {
      if (pendingAcquisition || !pendingThrow || !cursor || !carrierPlayerId || execution.planSourceId !== pendingThrow.sourceId
        || json(execution.progress.startCursor) !== json(cursor) || json(execution.progress.field) !== json(execution.field)
        || json(execution.progress.transfer) !== json(pendingThrow.plan.transfer)
        || execution.progress.planIdentity !== JSON.stringify(pendingThrow.plan)
        || json(execution.field.motion.actors) !== json(pendingThrow.plan.actors)) {
        throw new Error('actual field scheduled advance original lineage differs');
      }
      const progress = execution.progress, start = horizon.elapsedSeconds, priorCarrier = carrierPlayerId;
      const end = execution.field.motion.world.moment.elapsedSeconds;
      if (end > pendingThrow.plan.releaseElapsedSeconds) throw new Error('actual field scheduled advance exceeds release');
      if (progress.kind === 'released') {
        if (progress.releaseCursor.moment.elapsedSeconds !== pendingThrow.plan.releaseElapsedSeconds
          || progress.releaseCursor.moment.elapsedSeconds !== end
          || execution.field.motion.carrierPlayerId !== null) throw new Error('actual field scheduled release horizon or custody differs');
        appendField(execution.field, null, pendingThrow.previous === null);
        // A release at an already observed horizon closes the earlier inclusive
        // endpoint too; it cannot inherit custody from a zero-duration snapshot.
        closeReleaseEndpoint(priorCarrier, end);
        control(priorCarrier, start, end, false); pendingThrow = null;
      } else {
        if (execution.field.motion.carrierPlayerId !== priorCarrier
          || progress.kind === 'transfer' && (execution.field.motion.world.kind === 'boundary' || !execution.field.motion.cursor)
          || progress.kind === 'interrupted' && (execution.field.motion.world.kind !== 'boundary' || execution.field.motion.cursor !== null)) {
          throw new Error('actual field scheduled transfer custody differs');
        }
        appendField(execution.field, null, pendingThrow.previous === null);
        control(priorCarrier, start, end, progress.kind === 'transfer');
        pendingThrow = progress.kind === 'transfer' ? { sourceId: pendingThrow.sourceId, plan: pendingThrow.plan, previous: progress } : null;
      }
    } else if (execution.kind === 'acquisition') {
      if (pendingOwned || pendingThrow || pendingAcquisition) throw new Error('actual field pending scheduled operation owns physical work');
      const capture = execution.acquisition;
      if (cursor || carrierPlayerId !== null || currentField?.motion.response.kind !== 'capture_candidate'
        || json(execution.field) !== json(currentField) || json(capture.contactMoment) !== json(horizon)) {
        throw new Error('actual field capture does not continue its candidate prefix');
      }
      const end = capture.kind === 'secured' ? capture.moment : capture.world.moment;
      segment(execution.field.motion.actors, end, false); acquisitions.push(capture);
      if (capture.kind === 'secured') {
        if (capture.baseContacts.length) throw new Error('secured actual field capture contains competing base contacts');
        control(capture.acquirerPlayerId, end.elapsedSeconds, end.elapsedSeconds, true);
        carrierPlayerId = capture.acquirerPlayerId;
        cursor = { moment: end, previousContacts: [{ kind: 'actor', playerId: carrierPlayerId, role: 'glove' }] };
      } else appendContacts(capture.world.moment, capture.world.contacts, capture.baseContacts, () => {
        // Atomic results have no saved plan: rederive their complete original
        // Native evidence before admitting the otherwise invalid rule projection.
        const expected = deriveBattedWorldFieldAcquisition({ response: battedWorldResponseInput(base.response), geometry, field: currentField });
        const candidate = currentField.motion.world, contact = candidate.kind === 'boundary' ? candidate.contacts[0] : undefined;
        if (json(expected) !== json(capture) || contact?.kind !== 'actor' || contact.role !== 'glove') {
          throw new Error('actual field atomic constraint derivation differs');
        }
        return { incoming: expected.contactMoment, constrained: { ...expected.contactMoment, ball: { ...expected.contactMoment.ball,
          velocity: contact.velocity, spin: { x: 0, y: 0, z: 0 } } } };
      });
    } else if (execution.kind === 'owned_motion_v1' || execution.kind === 'motion' || execution.kind === 'motion_checkpoint_v1' || execution.kind === 'retained_motion_checkpoint_v1' || execution.kind === 'throw') {
      if (pendingOwned || pendingThrow || pendingAcquisition) throw new Error('actual field pending scheduled operation owns physical work');
      if (!cursor) throw new Error('actual field execution lacks a resolved prior cursor');
      const start = horizon.elapsedSeconds, priorCarrier = carrierPlayerId;
      if (execution.kind !== 'throw') {
        if (execution.field.motion.carrierPlayerId !== priorCarrier) throw new Error('actual field motion custody differs');
        appendField(execution.field, priorCarrier === null ? cursor.moment : null, execution.kind !== 'retained_motion_checkpoint_v1' && !(execution.kind === 'owned_motion_v1' && execution.composition.mode === 'retained'));
        if (priorCarrier) control(priorCarrier, start, horizon.elapsedSeconds, execution.field.motion.world.kind !== 'boundary');
      } else {
        const thrown = execution.throw, model = execution.model, actor = world.modelActorEvidence.find((actor) => actor.binding.playerId === priorCarrier);
        if (!priorCarrier || !actor || model.source.playerId !== priorCarrier || model.source.careerId !== actor.binding.careerId
          || model.source.personLinkSourceId !== actor.binding.personLinkSourceId || json(model.person) !== json(actor.person)
          || json(thrown.field) !== json(execution.field)) throw new Error('actual field throw Player or field scope differs');
        if (thrown.kind === 'released') {
          moment(thrown.releaseCursor.moment);
          const release = thrown.releaseCursor.moment.elapsedSeconds;
          if (release < start || release > execution.field.motion.world.moment.elapsedSeconds || execution.field.motion.carrierPlayerId !== null) {
            throw new Error('actual field throw release horizon or custody differs');
          }
          appendField(execution.field, thrown.releaseCursor.moment);
          // Omission preserves the original archived atomic-throw interpretation.
          if (input.custodyPolicy === 'release_exclusive_v1') closeReleaseEndpoint(priorCarrier, release);
          control(priorCarrier, start, release, false);
        } else {
          if (execution.field.motion.carrierPlayerId !== priorCarrier || execution.field.motion.world.kind !== 'boundary') {
            throw new Error('actual field interrupted transfer custody differs');
          }
          appendField(execution.field, null); control(priorCarrier, start, horizon.elapsedSeconds, false);
        }
      }
    }
  }
  const field: BallWorldFieldTerritoryInput = { evidence: { batterRunnerId: batter.binding.playerId, defenderIds,
    field: geometry.baseGeometry.field, bases: geometry.baseGeometry.gates, ballRadiusMeters: p.ballRadius,
    originTick, ticksPerSecond: p.ticksPerSecond, horizon, contacts, acquisitions }, baseContacts, groundSegments };
  deriveBallWorldBattedRuleEvidence(field.evidence);
  const pending: PendingFieldPossession[] = pendingAcquisition ? [{ planSourceId: pendingAcquisition.sourceId,
    playerId: pendingAcquisition.plan.acquirerPlayerId, contactElapsedSeconds: pendingAcquisition.plan.contactMoment.elapsedSeconds,
    phase: pendingAcquisition.previous?.kind === 'interrupted' ? 'contact_policy_pending' : pendingAcquisition.previous?.kind === 'fence_pending' ? 'fence_pending' : 'capturing',
    earliestPotentialControlElapsedSeconds: pendingAcquisition.previous?.kind === 'interrupted'
      ? Math.min(pendingAcquisition.plan.secureElapsedSeconds, pendingAcquisition.previous.world.moment.elapsedSeconds)
      : pendingAcquisition.plan.secureElapsedSeconds }] : [];
  if (pendingOwned?.kind === 'acquisition') {
    const plan = pendingOwned.plan as Extract<OwnedScheduledMotionOperation, { kind: 'acquisition' }>['plan'];
    const progress = pendingOwned.previous?.kind === 'acquisition' ? pendingOwned.previous.progress : null;
    pending.push({ planSourceId: pendingOwned.sourceId, playerId: plan.acquirerPlayerId,
      contactElapsedSeconds: plan.contactMoment.elapsedSeconds,
      phase: progress?.kind === 'interrupted' ? 'contact_policy_pending' : progress?.kind === 'fence_pending' ? 'fence_pending' : 'capturing',
      earliestPotentialControlElapsedSeconds: progress?.kind === 'interrupted'
        ? Math.min(plan.secureElapsedSeconds, progress.world.moment.elapsedSeconds) : plan.secureElapsedSeconds });
  }
  return freeze({ field, segments, controlWindows, ...(hasScheduledAcquisition ? { possessionEvidence: {
    policy: 'scheduled_capture_confirmation_v1' as const, originTick, ticksPerSecond: p.ticksPerSecond,
    throughElapsedSeconds: horizon.elapsedSeconds, pending } } : {}) });
};

/** Internal pure replay service. Each caller constructs its own lexical identity
 * scope; no callback, precomputed projection or validation token is accepted. */
export const createBattedWorldFieldPhysicalReplay = () => {
  const encoding = createOwnedScheduledMotionDependencyEncoding();
  const reference = (snapshot: DurableBattedWorldFieldExecution): OwnedScheduledMotionReference => {
    // The full codec rejects active/non-inert envelopes before property access.
    const identity = encoding.snapshot(snapshot);
    return freeze({ sourceId: snapshot.source.sourceId, sourceHash: encoding.source(snapshot.source).hash,
      snapshotHash: identity.hash });
  };
  return Object.freeze({
    project: (input: PrefixInput) => projectPhysicalPrefix(input, reference),
    reference,
    snapshotIdentity: encoding.snapshot,
  });
};

/** Public pure entry point always starts a fresh single-call replay scope. */
export const battedWorldFieldPhysicalPrefix = (input: PrefixInput) => createBattedWorldFieldPhysicalReplay().project(input);

/** Same canonical segments and custody windows as the field-aware first-base observer. */
export const battedWorldFieldBaseTouchHistoryFromPrefix = (input: PrefixInput & Readonly<{ playerId: string; base: BaseTouchRegion;
  baseSurfaceHeightMeters: number }>): Readonly<{ history: BallWorldPlayerBaseContactHistory; controlledContacts: readonly BallWorldControlledBaseContact[]; custodyEvidence?: BaseTouchCustodyEvidence }> => {
  const prefix = battedWorldFieldPhysicalPrefix(input);
  const history = deriveBallWorldPlayerBaseContactHistory({ segments: prefix.segments, playerId: input.playerId,
    base: input.base, baseSurfaceHeightMeters: input.baseSurfaceHeightMeters });
  const controlWindows = prefix.controlWindows.filter((value) => value.playerId === input.playerId)
    .map(({ playerId: _, ...value }) => value);
  const evidence = prefix.possessionEvidence, pending = evidence?.pending.filter((value) => value.playerId === input.playerId);
  return freeze({ history, controlledContacts: findBallWorldControlledBaseContacts({ history, controlWindows }),
    ...(evidence ? { custodyEvidence: { status: pending!.length ? 'bounded_unconfirmed' as const : 'confirmed_contacts_only' as const,
      originTick: evidence.originTick, ticksPerSecond: evidence.ticksPerSecond, throughElapsedSeconds: evidence.throughElapsedSeconds, pending: pending! } } : {}) });
};
