import type { BallWorldFieldTerritoryInput } from '../../core/rules/BallWorldFieldTerritory';
import { deriveBallWorldBattedRuleEvidence, type BallWorldBattedRuleContact, type BallWorldBattedRuleContactFrame } from '../../core/rules/BallWorldBattedRuleEvidence';
import { respondToGroundContact } from '../../core/sim/ball/BallFlight';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import type { BallWorldBoundaryContact, BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import type { BallWorldBaseBoundaryContact } from '../../core/sim/ball/BallWorldBaseBoundary';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { battedWorldBaseSurfaceId, createBattedWorldFieldGeometry, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveBallWorldPlayerBaseContactHistory, type BallWorldPlayerBaseContactHistory,
  type BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts, type BallWorldBaseControlWindow,
  type BallWorldControlledBaseContact } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import type { BaseTouchRegion } from '../../core/sim/running/BaseTouch';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type PrefixInput = Readonly<{ baseField: DurableBattedWorldFieldAction; fields: readonly DurableBattedWorldFieldAction[];
  executions: readonly DurableBattedWorldFieldExecution[] }>;
type Control = Readonly<{ playerId: string }> & BallWorldBaseControlWindow;
const key = (actor: BallWorldMotionActor) => json([actor.playerId, actor.primitive.role]);
const id = (value: string) => typeof value === 'string' && !!value.length && value === value.trim();
const sameNumber = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
const normalized = (contact: BallWorldBoundaryContact): BallWorldBattedRuleContact => contact.kind === 'actor'
  ? { kind: 'actor', playerId: contact.playerId, role: contact.role } : contact.kind === 'surface'
    ? { kind: 'surface', surfaceId: contact.surfaceId } : { kind: contact.kind };

/** Only the Native owner's complete rederived field/execution prefix is admissible. Observations never execute physical time. */
export const battedWorldFieldPhysicalPrefix = (input: PrefixInput): Readonly<{ field: BallWorldFieldTerritoryInput;
  segments: readonly BallWorldPlayerBaseContactSegment[]; controlWindows: readonly Control[] }> => {
  const base = input.baseField, world = base.response.touch.worldContact, flight = world.flight;
  const initial = flight.flight.initialBall, originTick = initial.tick, p = flight.source.execution.ballFlightParameters;
  const batter = flight.physicalPitch.frame.batterActor, geometry = base.geometry.geometry;
  if (!Number.isSafeInteger(base.revision) || base.revision < 1 || input.fields.length !== base.revision
    || json(input.fields.at(-1)) !== json(base)) throw new Error('actual field complete own prefix differs');
  if (!batter || flight.source.searchDurationTicks !== 0 || world.source.previousContactSourceId !== null
    || world.result.kind !== 'airborne' || world.result.throughTick !== originTick || json(world.result.ball) !== json(initial)
    || base.response.result.kind !== 'airborne' || json(base.response.result.ball) !== json(initial)
    || base.geometry.baseGeometry.source.flightSourceId !== flight.source.sourceId || json(base.geometry.baseGeometry.flight) !== json(flight)
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
    if (end.elapsedSeconds < horizon.elapsedSeconds || next.length !== actors.length || new Set(next.map(key)).size !== actorKeys.size
      || next.some((actor) => !actorKeys.has(key(actor)))) throw new Error('actual field actor coverage or horizon differs');
    for (const actor of next) {
      const prior = actors.find((old) => key(old) === key(actor))!, s = actor.primitive;
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
  const appendContacts = (at: BallWorldMoment, raw: readonly BallWorldBoundaryContact[], bags: readonly BallWorldBaseBoundaryContact[]) => {
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
      if (previous.moment.originTick !== at.originTick || json(previous.moment.ball.position) !== json(at.ball.position)
        || extra.length && json(previous.moment) !== json(at)) throw new Error('coincident actual field contact states differ');
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
  const appendField = (field: BattedWorldFieldMotion, freeStart: BallWorldMoment | null) => {
    const motion = field.motion, actual = motion.world;
    segment(motion.actors, actual.moment, true);
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
    cursor = motion.cursor; carrierPlayerId = motion.carrierPlayerId; currentField = field;
  };
  const sources = new Set<string>();
  for (const [index, value] of input.fields.entries()) {
    if (value.revision !== index + 1 || !id(value.source.sourceId) || sources.has(value.source.sourceId)
      || value.source.previousFieldSourceId !== (input.fields[index - 1]?.source.sourceId ?? null)
      || value.source.responseSourceId !== base.response.source.sourceId || value.source.geometrySourceId !== base.geometry.source.sourceId
      || json(value.history) !== json(input.fields.slice(0, index + 1).map((field) => field.source))
      || json(value.response) !== json(base.response) || json(value.geometry) !== json(base.geometry)) throw new Error('actual field original Source prefix differs');
    sources.add(value.source.sourceId);
    if (!cursor || value.field.motion.carrierPlayerId !== carrierPlayerId) throw new Error('actual field continuation lacks its actual prior cursor');
    appendField(value.field, carrierPlayerId === null ? cursor.moment : null);
  }
  // Source identifiers are unique within each original Native owner, not across separate tables.
  sources.clear();
  for (const [index, value] of input.executions.entries()) {
    if (value.revision !== index + 1 || !id(value.source.sourceId) || sources.has(value.source.sourceId)
      || value.source.baseFieldSourceId !== base.source.sourceId || json(value.baseField) !== json(base)
      || value.source.previousExecutionSourceId !== (input.executions[index - 1]?.source.sourceId ?? null)
      || json(value.history) !== json(input.executions.slice(0, index + 1).map((execution) => execution.source))
      || value.source.action.kind !== value.execution.kind) throw new Error('actual field execution Source prefix differs');
    sources.add(value.source.sourceId);
    const execution = value.execution;
    if (execution.kind === 'acquisition') {
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
      } else appendContacts(capture.world.moment, capture.world.contacts, capture.baseContacts);
    } else if (execution.kind === 'motion' || execution.kind === 'throw') {
      if (!cursor) throw new Error('actual field execution lacks a resolved prior cursor');
      const start = horizon.elapsedSeconds, priorCarrier = carrierPlayerId;
      if (execution.kind === 'motion') {
        if (execution.field.motion.carrierPlayerId !== priorCarrier) throw new Error('actual field motion custody differs');
        appendField(execution.field, priorCarrier === null ? cursor.moment : null);
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
  return freeze({ field, segments, controlWindows });
};

/** Same canonical segments and custody windows as the field-aware first-base observer. */
export const battedWorldFieldBaseTouchHistoryFromPrefix = (input: PrefixInput & Readonly<{ playerId: string; base: BaseTouchRegion;
  baseSurfaceHeightMeters: number }>): Readonly<{ history: BallWorldPlayerBaseContactHistory; controlledContacts: readonly BallWorldControlledBaseContact[] }> => {
  const prefix = battedWorldFieldPhysicalPrefix(input);
  const history = deriveBallWorldPlayerBaseContactHistory({ segments: prefix.segments, playerId: input.playerId,
    base: input.base, baseSurfaceHeightMeters: input.baseSurfaceHeightMeters });
  const controlWindows = prefix.controlWindows.filter((value) => value.playerId === input.playerId)
    .map(({ playerId: _, ...value }) => value);
  return freeze({ history, controlledContacts: findBallWorldControlledBaseContacts({ history, controlWindows }) });
};
