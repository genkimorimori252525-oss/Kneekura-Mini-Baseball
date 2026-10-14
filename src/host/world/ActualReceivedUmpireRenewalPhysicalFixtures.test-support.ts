import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal,
  type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { installReceivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { renewalExactCut, assertRenewalCut, renewalEnrollmentInput,
  type RenewalEnrollmentSource, type RenewalDecisionSource, type RenewalMotorSource } from './ActualReceivedUmpireRenewal';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';

const need = <T>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw new Error('synthetic renewal physical fixture missing ' + label);
  return value;
};
type Context = Readonly<{ enrollmentSource: RenewalEnrollmentSource; baseFieldSourceId: string; executionSourceId: string;
  executionRevision: number; playerId: string; initialDecisionSourceId: string; initialMotorSourceId: string; observationSourceId: string }>;
type Counters = { derivations: number; qualifications: number; qualificationsAfterAdvance: number; connections: Set<DatabaseSync> };
const counters = new Map<string, Counters>();
const context = (db: DatabaseSync): Context => JSON.parse(String(need(db.prepare('SELECT context_json FROM renewal_physical_fixture_context').get(), 'context').context_json));
const stats = (db: DatabaseSync, c: Context) => {
  const value = need(counters.get(c.enrollmentSource.sourceId), 'counters'); value.connections.add(db); return value;
};
const ref = (value: { source: { sourceId: string } }, snapshotHash = hash(value)) => ({ sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash });

/** Mock only the received E/R2 ancestry. Every physical/Player/model/self fact is
 * rederived by its real owner on the exact connection supplied by the caller.
 * Import this factory through a test-local vi.mock of ActualReceivedUmpireRenewalEvidence. */
export const receivedRenewalPhysicalEvidenceFromSqlite = (db: DatabaseSync) => {
  const derive = (raw: RenewalEnrollmentSource) => withBattedWorldPhysicalReadTraversal(db, () => {
    const c = context(db), source = renewalEnrollmentInput(raw); stats(db, c).derivations++;
    if (json(source) !== json(c.enrollmentSource)) throw new Error('synthetic received ancestry Source differs');
    const fields = battedWorldFieldEvidenceFromSqlite(db), baseField = need(fields.read(c.baseFieldSourceId), 'base field');
    const prefix = { baseField, fields: fields.scope(baseField, c.baseFieldSourceId),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField, c.executionSourceId) };
    const execution = need(prefix.executions.at(-1), 'bounded execution');
    if (execution.source.sourceId !== c.executionSourceId || execution.revision !== c.executionRevision
      || execution.execution.kind !== 'owned_motion_v2' || execution.execution.operation !== null
      || execution.execution.field.motion.cursor === null) throw new Error('synthetic original physical predecessor differs');
    const world = baseField.response.touch.worldContact, batter = need(world.flight.physicalPitch.frame.batterActor, 'batter');
    const bindings = [batter.binding, ...batter.defenderBindings], ids = bindings.map(b => b.playerId);
    if (ids.length !== 10 || new Set(ids).size !== 10) throw new Error('synthetic original participant set differs');
    const selves = actualPlayersKinematicsFromPrefix(ids, prefix), self = need(selves.find(s => s.playerId === c.playerId), 'receiver');
    const cut = renewalExactCut(self.at, self.ticksPerSecond);
    for (const s of selves) {
      assertRenewalCut(cut, renewalExactCut(s.at, s.ticksPerSecond));
      if (s.roles.length !== 5 || new Set(s.roles.map(p => p.role)).size !== 5) throw new Error('synthetic original roles differ');
    }
    const initialMotor = need(actualLocomotionEvidenceFromSqlite(db).read(c.initialMotorSourceId), 'initial motor');
    const initialDecision = need(actualDefensiveDecisionEvidenceFromSqlite(db).read(c.initialDecisionSourceId), 'initial decision');
    const model = need(playerLocomotionModelEvidenceFromSqlite(db).read(initialMotor.source.locomotionModelSourceId), 'accepted locomotion model');
    const decisionModel = need(playerDecisionModelEvidenceFromSqlite(db).read(initialDecision.source.decisionModelSourceId), 'accepted decision model');
    const observation = need(actualFieldObservationEvidenceFromSqlite(db).read(c.observationSourceId), 'observation');
    assertRenewalCut(cut, renewalExactCut(observation.receipt.at, self.ticksPerSecond));
    if (self.ownedMotionCoverage?.rootAuthority.sourceId !== initialMotor.source.sourceId
      || self.activeCommand.adoptionSourceId !== execution.source.sourceId
      || model.source.playerId !== self.playerId || model.fieldingModel.person.personId !== self.personId) throw new Error('synthetic incumbent binding differs');
    const binding = need(bindings.find(b => b.playerId === self.playerId), 'receiver binding');
    const syntheticRef = (sourceId: string) => ({ sourceId, sourceHash: hash(['isolated-received-source', sourceId]), snapshotHash: hash(['isolated-received-snapshot', sourceId]) });
    const receiver = { careerId: binding.careerId, playerId: self.playerId, personId: self.personId, personLinkSourceId: self.personLinkSourceId,
      fieldingModelSourceId: model.source.fieldingModelSourceId, gameDay: self.gameDay };
    const originProcessSourceId = 'synthetic-received-physical-r1';
    const cause = { physicalPitchSourceId: self.physicalPitchSourceId, playerId: self.playerId,
      callSourceId: 'synthetic-received-physical-call', originCommunicationSourceId: 'synthetic-received-physical-send' };
    const selection = { selected: initialDecision.receipt.selected, target: initialDecision.receipt.target,
      selectedAt: self.at, movementStartTick: cut.tick, dueTick: cut.tick };
    const value = freeze({ source, gameId: self.gameId, playId: 1, physicalPitchSourceId: self.physicalPitchSourceId, playerId: self.playerId,
      runtimeSourceId: 'synthetic-received-physical-runtime', receivedEnrollmentSourceId: source.receivedEnrollmentSourceId,
      receivedReplanSourceId: source.receivedReplanSourceId, originProcessSourceId, receiver, cause, cut, selection,
      anchor: { receivedEnrollment: syntheticRef(source.receivedEnrollmentSourceId), receivedReplan: syntheticRef(source.receivedReplanSourceId),
        legacyAdmissionPrefix: { count: 24, digest: hash('isolated-synthetic-legacy-prefix') }, receivedJournal: { count: 4, digest: hash('isolated-synthetic-received-prefix') },
        baseField: ref(baseField), physicalPredecessor: { ...ref(execution, ownedScheduledMotionArchiveHash(execution)), revision: execution.revision },
        observation: { ...ref(observation), revision: observation.revision }, decision: { ...ref(initialDecision), revision: initialDecision.revision },
        motor: ref(initialMotor), adoption: { ...ref(execution, ownedScheduledMotionArchiveHash(execution)), revision: execution.revision },
        locomotionModel: ref(model), decisionModel: ref(decisionModel), fieldingModelHash: hash(model.fieldingModel), selfHash: hash(self),
        participants: selves.map(s => ({ playerId: s.playerId, personId: s.personId, selfHash: hash(s), activeCommandHash: hash(s.activeCommand),
          roleAuthoritiesHash: hash(s.ownedMotionCoverage?.roleAuthorities ?? s.roles.map(p => ({ role: p.role, command: s.activeCommand,
            acceptedThroughTick: Math.min(p.canonicalActor.primitive.endTick, s.activeCommand.acceptedThroughTick) }))) })) },
      membership: { version: 'received_umpire_renewal_membership_v1' as const, effectiveFrom: cut, playerId: self.playerId, legacyCoverage: 'unchanged' as const, physicalAdvancement: 'blocked' as const },
      pending: { kind: 'renewal_decision' as const, originProcessSourceId } });
    return { value, self, selves, model, baseField, execution, observation, prefix, initialMotor, initialDecision };
  });
  const qualifyCurrent = (derived: ReturnType<typeof derive>) => withBattedWorldPhysicalReadTraversal(db, () => {
    const c = context(db), count = stats(db, c); count.qualifications++;
    const head = db.prepare('SELECT source_id,revision FROM batted_world_field_execution_heads WHERE base_field_source_id=?').get(c.baseFieldSourceId);
    if (!head || head.source_id !== c.executionSourceId || head.revision !== c.executionRevision) {
      count.qualificationsAfterAdvance++; throw new Error('synthetic original current qualification after physical head advanced');
    }
    battedWorldFieldEvidenceFromSqlite(db).current(derived.baseField);
    battedWorldFieldExecutionEvidenceFromSqlite(db).current(derived.execution);
    actualFieldObservationEvidenceFromSqlite(db).current(derived.observation);
    return hash(head);
  });
  const qualifyNonPhysicalCurrent=(derived:ReturnType<typeof derive>)=>withBattedWorldPhysicalReadTraversal(db,()=>{
    battedWorldFieldEvidenceFromSqlite(db).current(derived.baseField);
    const head=db.prepare('SELECT source_id,revision FROM actual_field_observation_heads WHERE physical_pitch_source_id=? AND player_id=?').get(derived.value.physicalPitchSourceId,derived.value.playerId);
    if(!head||head.source_id!==derived.observation.source.sourceId||head.revision!==derived.observation.revision)throw new Error('synthetic current observation head differs');
    return 'synthetic-nonphysical-open';
  });
  return { derive, qualifyCurrent,qualifyNonPhysicalCurrent };
};

/** Real synthetic Native physical setup. Received-call ancestry alone is isolated;
 * no genuine checkpoint, runtime admission, received-call or adoption credit is claimed. */
export const receivedRenewalPhysicalFixture = async () => {
  const directory = mkdtempSync(join(tmpdir(), 'renewal-physical-fixture-')), path = join(directory, 'state.sqlite');
  const x = battedWorldFieldExecutionFixture(path, 'free');
  try {
    const motionSource: AcceptedBattedWorldFieldExecution = { ...x.source, action: { kind: 'motion_checkpoint_v1',
      availableAtTick: x.fieldSource.availableAtTick,
      checkpointThroughTick: x.baseField.field.motion.world.moment.ball.tick + 1000,
      coverageThroughTick: x.baseField.field.motion.world.moment.ball.tick + 1_000_000, commands: x.fieldSource.commands } };
    x.sources.set(motionSource.sourceId, motionSource);
    const moved = x.executions.accept(motionSource.sourceId), world = x.baseField.response.touch.worldContact;
    const playerId = world.flight.physicalPitch.frame.batterActor!.defenderBindings[0].playerId;
    const installed = installOwnedScheduledDecision(x, playerId, moved.source.sourceId), initialMotor = installed.issue(moved.source.sourceId);
    const playerIds = x.fieldSource.commands.map(c => c.playerId), pitchId = world.flight.source.physicalPitchSourceId;
    const before = { baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField, x.baseField.source.sourceId),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, moved.source.sourceId) };
    const beforeSelves = actualPlayersKinematicsFromPrefix(playerIds, before), at = beforeSelves[0].at;
    renewalExactCut(at, beforeSelves[0].ticksPerSecond);
    const initialAdoptionSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'renewal-physical-initial-adoption',
      previousExecutionSourceId: moved.source.sourceId, action: { kind: 'owned_motion_v2', checkpoint: { kind: 'motion', throughTick: at.tick },
        knownWork: ownedMotionKnownWorkFromSqlite(x.f.db, pitchId, playerIds), contributions: beforeSelves.map(s => s.playerId === playerId
          ? { kind: 'motor', playerId, motorSourceId: initialMotor.source.sourceId } : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }) } };
    x.sources.set(initialAdoptionSource.sourceId, initialAdoptionSource);
    const initialAdoption = x.executions.accept(initialAdoptionSource.sourceId);
    const observationSource = { ...installed.observer.observationSource, sourceId: 'renewal-physical-current-observation',
      previousObservationSourceId: installed.observation.source.sourceId, executionSourceId: initialAdoption.source.sourceId };
    installed.observer.observationSources.set(observationSource.sourceId, observationSource);
    const currentObservation = installed.observer.observations.accept(observationSource.sourceId);
    const enrollmentSource: RenewalEnrollmentSource = { sourceId: 'synthetic-renewal-physical-enrollment', sourceVersion: 'isolated-physical-v1',
      capability: 'received_umpire_renewal_enrollment_v1', receivedEnrollmentSourceId: 'synthetic-received-physical-enrollment', receivedReplanSourceId: 'synthetic-received-physical-r2' };
    const decisionSource: RenewalDecisionSource = { sourceId: 'synthetic-renewal-physical-decision', sourceVersion: 'isolated-physical-v1',
      capability: 'received_umpire_renewal_decision_v1', renewalEnrollmentSourceId: enrollmentSource.sourceId };
    const motorSource: RenewalMotorSource = { sourceId: 'synthetic-renewal-physical-motor', sourceVersion: 'isolated-physical-v1',
      capability: 'received_umpire_renewal_motor_v1', renewalEnrollmentSourceId: enrollmentSource.sourceId, renewalDecisionSourceId: decisionSource.sourceId };
    const c: Context = { enrollmentSource, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: initialAdoption.source.sourceId,
      executionRevision: initialAdoption.revision, playerId, initialDecisionSourceId: installed.decision.source.sourceId,
      initialMotorSourceId: initialMotor.source.sourceId, observationSourceId: currentObservation.source.sourceId };
    counters.set(enrollmentSource.sourceId, { derivations: 0, qualifications: 0, qualificationsAfterAdvance: 0, connections: new Set() });
    x.f.db.exec('CREATE TABLE renewal_physical_fixture_context(context_json TEXT NOT NULL); BEGIN');
    x.f.db.prepare('INSERT INTO renewal_physical_fixture_context VALUES(?)').run(JSON.stringify(c));installReceivedOwnerSchema(x.f.db);x.f.db.exec('COMMIT');
    const original = receivedRenewalPhysicalEvidenceFromSqlite(x.f.db).derive(enrollmentSource);
    const { openSqliteActualReceivedUmpireRenewalEnrollmentStore } = await import('./SqliteActualReceivedUmpireRenewalEnrollmentStore');
    const { openSqliteActualReceivedUmpireRenewalDecisionStore } = await import('./SqliteActualReceivedUmpireRenewalDecisionStore');
    const { openSqliteActualReceivedUmpireRenewalMotorStore } = await import('./SqliteActualReceivedUmpireRenewalMotorStore');
    const enrollments = x.f.track(openSqliteActualReceivedUmpireRenewalEnrollmentStore(path, { readAcceptedEnrollment: id => id === enrollmentSource.sourceId ? enrollmentSource : null }));
    const enrollment = enrollments.accept(enrollmentSource.sourceId);
    const decisions = x.f.track(openSqliteActualReceivedUmpireRenewalDecisionStore(path, { readAcceptedDecision: id => id === decisionSource.sourceId ? decisionSource : null }));
    const decision = decisions.accept(decisionSource.sourceId);
    const motors = x.f.track(openSqliteActualReceivedUmpireRenewalMotorStore(path, { readAcceptedMotor: id => id === motorSource.sourceId ? motorSource : null }));
    const motor = motors.accept(motorSource.sourceId);
    const adoptionSource = { sourceId: 'synthetic-renewal-physical-adoption', sourceVersion: 'isolated-physical-v1', baseFieldSourceId: x.baseField.source.sourceId,
      previousExecutionSourceId: initialAdoption.source.sourceId, action: { kind: 'received_renewal_adoption_v1' as const,
        renewalEnrollmentSourceId: enrollmentSource.sourceId, renewalMotorSourceId: motorSource.sourceId } };
    return { ...x, directory, path, db: x.f.db, playerId, playerIds, installed, initialMotor, initialAdoption, currentObservation, before, beforeSelves, original,
      prefix: original.prefix, selves: original.selves, model: original.model, enrollmentSource, decisionSource, motorSource, adoptionSource,
      enrollments, decisions, motors, enrollment, decision, motor,
      seamStats: () => { const s = need(counters.get(enrollmentSource.sourceId), 'counters'); return { ...s, connections: new Set(s.connections) }; },
      close() { counters.delete(enrollmentSource.sourceId);x.f.close();rmSync(directory, { recursive: true, force: true }); } };
  } catch (error) { x.f.close();rmSync(directory, { recursive: true, force: true });throw error; }
};

/** Opens an already materialized private synthetic copy. No root reconstruction,
 * accepted Source callback, acceptance, current qualification or motor issuance.
 * The caller owns exact tuple copying/recovery and must never pass the input donor. */
export const openPreparedReceivedRenewalPhysicalFixture = async (path: string) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  // A private copy may need WAL-index recovery. Native file access is writable,
  // then all SQL on this inspection connection is protected by query_only.
  const db = new DatabaseSync(path);
  const opened: { close(): void }[] = [];
  let enrollmentId: string | undefined;
  let registered = false;
  try {
    db.exec('PRAGMA query_only=1');
    const c = context(db); enrollmentId = c.enrollmentSource.sourceId;
    const head = need(db.prepare('SELECT * FROM actual_received_umpire_renewal_heads WHERE renewal_enrollment_source_id=?').get(enrollmentId), 'prepared renewal head');
    if (head.stage !== 2 && head.stage !== 3 && head.stage !== 4) throw new Error('prepared synthetic renewal stage differs');
    const decisionId = String(head.renewal_decision_source_id);
    const motorId = head.renewal_motor_source_id === null ? null : String(head.renewal_motor_source_id);
    if ((head.stage === 2) !== (motorId === null)) throw new Error('prepared synthetic motor pointer differs');
    if (counters.has(enrollmentId)) throw new Error('prepared synthetic fixture already has an active context');
    counters.set(enrollmentId, { derivations: 0, qualifications: 0, qualificationsAfterAdvance: 0, connections: new Set([db]) });
    registered = true;
    const { openSqliteActualReceivedUmpireRenewalEnrollmentStore } = await import('./SqliteActualReceivedUmpireRenewalEnrollmentStore');
    const { openSqliteActualReceivedUmpireRenewalDecisionStore } = await import('./SqliteActualReceivedUmpireRenewalDecisionStore');
    const enrollments = openSqliteActualReceivedUmpireRenewalEnrollmentStore(path);opened.push(enrollments);
    const decisions = openSqliteActualReceivedUmpireRenewalDecisionStore(path);opened.push(decisions);
    const { openSqliteActualReceivedUmpireRenewalMotorStore } = await import('./SqliteActualReceivedUmpireRenewalMotorStore');
    const motors=openSqliteActualReceivedUmpireRenewalMotorStore(path);opened.push(motors);
    // Archived expectations are test assertions only, never supplied as Native
    // authority. Each production read authenticates these rows independently.
    const enrollment=JSON.parse(String(db.prepare('SELECT snapshot_json FROM actual_received_umpire_renewal_enrollments WHERE source_id=?').get(enrollmentId)!.snapshot_json)) as import('./ActualReceivedUmpireRenewalEvidence').DurableReceivedRenewalEnrollment;
    const decision=JSON.parse(String(db.prepare('SELECT snapshot_json FROM actual_received_umpire_renewal_decisions WHERE source_id=?').get(decisionId)!.snapshot_json)) as import('./SqliteActualReceivedUmpireRenewalDecisionStore').DurableReceivedRenewalDecision;
    const motor=motorId===null?null:JSON.parse(String(db.prepare('SELECT snapshot_json FROM actual_received_umpire_renewal_motors WHERE source_id=?').get(motorId)!.snapshot_json)) as import('./SqliteActualReceivedUmpireRenewalMotorStore').DurableReceivedRenewalMotor;
    const decisionSource=decision.source,motorSource:RenewalMotorSource=motor?.source??{sourceId:'synthetic-renewal-physical-motor',sourceVersion:'isolated-physical-v1',capability:'received_umpire_renewal_motor_v1',renewalEnrollmentSourceId:enrollmentId,renewalDecisionSourceId:decisionId};
    const adoptionSource={sourceId:'synthetic-renewal-physical-adoption',sourceVersion:'isolated-physical-v1',baseFieldSourceId:c.baseFieldSourceId,previousExecutionSourceId:c.executionSourceId,
      action:{kind:'received_renewal_adoption_v1' as const,renewalEnrollmentSourceId:enrollmentId,renewalMotorSourceId:motorSource.sourceId}};
    const originalOwner = receivedRenewalPhysicalEvidenceFromSqlite(db);
    const readOriginal = () => {
      db.exec('BEGIN');
      try { const value = withRenewalReadProof(db, () => originalOwner.derive(c.enrollmentSource));db.exec('COMMIT');return value; }
      catch (error) { if (db.isTransaction) db.exec('ROLLBACK');throw error; }
    };
    const seamStats = () => { const s = need(counters.get(c.enrollmentSource.sourceId), 'prepared counters');return { ...s, connections: new Set(s.connections) }; };
    let closed = false;
    return { path, db, context: c, head, enrollmentSource: c.enrollmentSource, decisionId, motorId, enrollments, decisions,
      originalOwner, readOriginal, seamStats,motors,enrollment,decision,motor,decisionSource,motorSource,adoptionSource,
      close() { if (closed) return;closed = true;for (const owner of opened.reverse()) owner.close();db.close();counters.delete(c.enrollmentSource.sourceId); } };
  } catch (error) {
    for (const owner of opened.reverse()) owner.close();db.close();if (registered && enrollmentId) counters.delete(enrollmentId);throw error;
  }
};
