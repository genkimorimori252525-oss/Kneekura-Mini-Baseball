import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { actualCommunicationEvidenceFromSqlite, openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { actualFieldObservationEvidenceFromSqlite, openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { actualDefensiveBoundary } from './ActualDefensiveContext';
import { actualCommunicationObservationAt } from './ActualCallCommunication';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Pin = Readonly<{ path: string; sha256: string }>;
type Artifact = Pin & Readonly<{ bytes: number }>;
type Phase = 'authenticate' | 'reception' | 'after_observation';
type Run = Readonly<{ originalNativeCasePassed: false; originalReaped: true; rootCompleted: false }>;
type Manifest = Readonly<{ schema: string; recoveryLineageId: string; interruptedSourceCommit: string; interruptedRun: Run;
  originalTerminal: Pin; interruption: { rawManifest: Pin; diagnostic: Pin; forensicDirectory: string };
  qualification: { terminalPath: string; sourceCommit: string; sourceManifestSha256: string; configurationSha256: string } }>;
type Receipt = Readonly<{ schema: string; phase: string; recoveryLineageId: string; sourceCommit: string; sourceManifestSha256: string;
  configurationSha256: string; inputManifestSha256: string; interruptedRun: Run; predecessorTerminal: Pin;
  qualificationTerminal: Pin; predecessorReceipt?: Pin; inputDatabase?: Artifact; originalTerminal?: Pin; rawManifest?: Pin;
  allowedRowDelta?: readonly string[]; renewalQualified?: false; playEndQualified?: false;
  database: Artifact; rawIntegrityFingerprint: Fingerprint; authenticated?: ReturnType<typeof evidenceManifest>;
  allConnectionsClosedReopened: boolean; originalInputsUnchanged: boolean; nativeSemanticReauthenticationPerformed: boolean;
  recoveredPrerequisiteQualified: boolean; rootCompleted: false; originalDbbGatePassed: false; originalGateCredit: 0;
  receivedCallControllerImplemented: false; semanticReplanQualified: false; wholePipelinePassed: false }>;
type Terminal = Readonly<{ schema: string; phase: string; recoveryLineageId: string; sourceCommit: string; sourceManifestSha256: string;
  configurationSha256: string; inputManifestSha256: string; invocationVerified: boolean; phaseVerified: boolean; reaped: boolean;
  remainingOwnedProcesses: unknown[]; failure: unknown; cancellationSignal: unknown; sourceDependenciesControlsInputUnchanged: boolean;
  rootCompleted: boolean; wholePipelinePassed: boolean; proof: Pin; phaseTerminal: Pin }>;
export type ReceivedCallRecoveryInput = Readonly<{ phase: Phase; inputManifest: Pin; predecessorReceipt: Pin; predecessorTerminal: Pin;
  qualificationTerminal: Pin; sourceCommit: string; sourceManifestSha256: string; configurationSha256: string;
  outputDirectory: string; receiptPath: string; progress?(event: { phase: Phase; boundary: string; status: 'entered' | 'completed' | 'error' }): void }>;
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pinned = <T>(pin: Pin): T => { assert.match(pin.sha256, /^[a-f0-9]{64}$/); assert.equal(sha(pin.path), pin.sha256); return JSON.parse(readFileSync(pin.path, 'utf8')) as T; };
const required = <T>(value: T | null | undefined, label: string): T => { assert(value !== null && value !== undefined, label); return value; };
const absent = (path: string) => { try { lstatSync(path); assert.fail(`output exists: ${path}`); } catch (error) { assert.equal((error as NodeJS.ErrnoException).code, 'ENOENT'); } };
const closed = (path: string) => {
  for (const suffix of ['-wal', '-journal']) assert(!existsSync(path + suffix) || statSync(path + suffix).size === 0, 'unclosed journal');
  assert.deepEqual(readdirSync('/proc/self/fd').flatMap(fd => { try {
    const target = readlinkSync(`/proc/self/fd/${fd}`); return [path, path + '-wal', path + '-shm', path + '-journal'].includes(target) ? [target] : [];
  } catch { return []; } }), []);
};
const managed = <T extends { close(): void }, R>(handle: T, body: (value: T) => R): R => {
  let failed = false, failure: unknown, result!: R;
  try { result = body(handle); } catch (error) { failed = true; failure = error; }
  try { handle.close(); } catch (cleanup) {
    if (failed) throw new AggregateError([failure, cleanup], 'received checkpoint owner and close failed', { cause: failure });
    throw cleanup;
  }
  if (failed) throw failure; return result;
};
type Row = Record<string, import('node:sqlite').SQLOutputValue>;
type Raw = Readonly<{ schema: Row[]; tables: Record<string, Row[]> }>;
type Fingerprint = Readonly<{ schemaSha256: string; rows: readonly Readonly<{ name: string; rowsSha256: string }>[] }>;
const capture = (db: DatabaseSync): Raw => ({
  schema: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
  tables: Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => {
    const name = String(row.name); return [name, db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()];
  })),
});
const fingerprint = (raw: Raw): Fingerprint => ({ schemaSha256: digest(raw.schema), rows: Object.entries(raw.tables).map(([name, rows]) => ({ name, rowsSha256: digest(rows) })) });
const ids = (db: DatabaseSync, table: string) => db.prepare(`SELECT source_id FROM ${table} ORDER BY source_id`).all().map(row => row.source_id);
const executionIds = ['field-race-acquisition', 'received-call-covered-feet-integer-start', 'received-call-covered-feet',
  'field-first-base-race', 'received-call-initial-decision-deadline', 'received-call-adopt-initial-motor', 'received-call-retain-incumbent-through-reception'];
const observationIds = ['actual-observation-home-1-1', 'scheduled-observation-home-1-received-call-due', 'received-call-before-reception-observation'];
const decisionIds = ['scheduled-decision-home-1', 'scheduled-decision-home-1-received-call-due'];
const roles = ['body', 'glove', 'left_foot', 'right_foot', 'tag_hand'];
const conditions = { propagationDelayTicks: 2, recognitionBaseDelayTicks: 3, maxAdditionalRecognitionDelayTicks: 2,
  audibility: 0.9, recognition: 0.8, attention: 0.7, minimumRecognizableQuality: 0.1 };

/** All values come from actual owners on this one real, unchanged read connection.
 * Historical values stay historical; only the latest physical cut is current. */
const authenticate = (db: DatabaseSync, level: 0 | 1 | 2) => withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db, () => {
  assert.deepEqual(db.prepare('PRAGMA quick_check').all().map(row => row.quick_check), ['ok']);
  assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
  const executions = battedWorldFieldExecutionEvidenceFromSqlite(db), fields = battedWorldFieldEvidenceFromSqlite(db);
  const paired = required(executions.readWithExecutions(executionIds[6]), 'retained physical checkpoint');
  assert.deepEqual(paired.executions.map(value => value.source.sourceId), executionIds);
  assert.deepEqual(ids(db, 'batted_world_field_executions'), [...executionIds].sort()); executions.current(paired.value);
  const [acquired, bridge, feet, race, deadline, adopted, advanced] = paired.executions;
  assert.equal(paired.value.source.sourceId, advanced.source.sourceId);
  assert.equal(paired.value.revision, 7); assert.equal(paired.value.baseField.source.sourceId, 'field-race-candidate-0');
  const fieldPrefix = fields.scope(paired.value.baseField, paired.value.baseField.source.sourceId);
  assert.deepEqual(fieldPrefix.map(value => value.source.sourceId), ['field-motion-1', 'field-race-candidate-0']);
  const physicalPrefix = (end: number) => ({ baseField: paired.value.baseField, fields: fieldPrefix, executions: paired.executions.slice(0, end + 1) });
  const pitch = required(readOriginalPhysicalPitchPrefixFromSqlite(db, 'pitch-0').at(-1), 'original Native pitch');
  assert.equal(pitch.result.pitch.resolution.timeline.status.kind, 'batted_ball_pending');
  assert.equal(pitch.frame.gameId, 'game-1'); assert.equal(pitch.frame.prePitchRunner, undefined);
  const batter = required(pitch.frame.batterActor, 'original batter'), bindings = [batter.binding, ...batter.defenderBindings];
  const players = bindings.map(binding => binding.playerId); assert.equal(new Set(players).size, 10);
  assert(acquired.execution.kind === 'acquisition' && acquired.execution.acquisition.kind === 'secured');
  const holder = acquired.execution.acquisition.acquirerPlayerId;
  const player = required(batter.defenderBindings.find(binding => binding.playerId !== holder), 'original non-holder').playerId;
  assert.equal(player, 'home-1'); assert.notEqual(player, holder); assert.notEqual(player, batter.binding.playerId);
  const links = playerPersonLinkEvidenceFromSqlite(db);
  for (const binding of bindings) {
    const link = required(links.readLink(binding.personLinkSourceId), 'original Person link');
    assert.equal(link.playerId, binding.playerId); assert.equal(link.personId, binding.personId);
  }
  for (const table of ['actual_live_play_runtimes', 'actual_live_play_admissions', 'actual_live_play_fences', 'actual_first_base_play_ends']) {
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n, 0, 'legacy fixture must remain unregistered and unsealed');
    }
  }
  assert.equal(bridge.source.action.kind, 'retained_motion_checkpoint_v1');
  assert.equal(bridge.source.previousExecutionSourceId, acquired.source.sourceId);
  assert.equal(bridge.execution.field.motion.world.kind, 'moving');
  assert.deepEqual(bridge.execution.field.motion.actors, acquired.execution.field.motion.actors);
  assert.equal(bridge.execution.field.motion.carrierPlayerId, holder);
  assert(feet.source.action.kind === 'motion_checkpoint_v1'); const coverage = feet.source.action.coverageThroughTick, raceTick = feet.source.action.checkpointThroughTick;
  const actualTps = paired.value.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
  // The original physical model's explicit clock is the authority, never a local wall clock.
  const feetMoment = bridge.execution.field.motion.world.moment;
  assert.equal(feetMoment.elapsedSeconds, (feetMoment.ball.tick - feetMoment.originTick) / actualTps);
  assert.equal(feet.source.action.availableAtTick, feetMoment.ball.tick); assert.equal(feet.source.previousExecutionSourceId, bridge.source.sourceId);
  assert.equal(coverage, raceTick + 11);
  assert(race.execution.kind === 'first_base_race'); assert(race.execution.ballEvidence.kind === 'grounded');
  assert.equal(race.execution.ballEvidence.territory, 'fair');
  const ruling = required(race.execution.groundRule?.correctRuleResult, 'original race ruling');
  assert(ruling.kind === 'resolved'); assert.equal(ruling.batterRunnerFirstBase.kind, 'out');
  const chronology = required(race.execution.groundRule?.actualChronology, 'original race chronology');
  assert.equal(chronology.firstDefenderControls.length, 1); assert.equal(chronology.firstDefenderControls[0].playerId, holder);
  assert(chronology.firstDefenderControls[0].elapsedSeconds < required(chronology.runnerTouch, 'runner touch').elapsedSeconds);
  const call = required(actualFirstBaseUmpireEvidenceFromSqlite(db).readCall('first-base-umpire-call'), 'original call');
  assert.equal(call.schedule.kind, 'called'); assert.equal(call.source.currentExecutionSourceId, race.source.sourceId);
  assert.equal(call.observation.source.sourceId, 'first-base-umpire-observation'); assert.equal(call.observation.setup.sourceId, 'first-base-umpire-setup');
  assert.equal(call.observation.physicalPitchSourceId, pitch.source.sourceId);
  const communications = actualCommunicationEvidenceFromSqlite(db);
  const model = required(communications.readModel('received-call-communication-model'), 'original reception model');
  assert(model.source.parameters); assert.equal(model.source.parameters.version, 'fixed_receiver_conditions_v1');
  assert.equal(model.source.parameters.timing, 'exact_sent_plus_core_delay_ticks_v1');
  assert.deepEqual([...model.originalPlayerIds].sort(), [...players].sort());
  assert.deepEqual(model.source.parameters.receivers.map(receiver => receiver.playerId), players);
  for (const receiver of model.source.parameters.receivers) assert.deepEqual(receiver.conditions, conditions);
  const sent = required(communications.read('received-call-send'), 'original scheduled send');
  assert.equal(sent.revision, 1); assert.equal(sent.source.previousCommunicationSourceId, null);
  assert.equal(sent.source.callSourceId, call.source.sourceId); assert.equal(sent.source.modelSourceId, model.source.sourceId);
  assert.equal(sent.source.currentExecutionSourceId, race.source.sourceId); assert.equal(sent.callHash, hash(call)); assert.equal(sent.modelHash, hash(model));
  const emitted = required(sent.emitted, 'original emitted call'); assert.equal(emitted.kind, 'callout');
  assert.equal(emitted.content.callSourceId, call.source.sourceId); assert.deepEqual(emitted.content.onFieldCall, call.onFieldCall);
  const scheduled = required(sent.recipients.find(recipient => recipient.playerId === player), 'original scheduled receiver');
  assert(scheduled.kind === 'scheduled');
  const receivedAt = { originTick: sent.clock.originTick, elapsedSeconds: scheduled.reception.receivedAtElapsedSeconds, tick: scheduled.reception.received.receivedAt };
  const throughTick = actualDefensiveBoundary(receivedAt, sent.clock.ticksPerSecond);
  assert(advanced.source.action.kind === 'owned_motion_v2' && advanced.source.action.checkpoint.kind === 'motion');
  assert.equal(advanced.source.action.checkpoint.throughTick, throughTick); assert(throughTick <= coverage);
  assert.equal(advanced.source.previousExecutionSourceId, adopted.source.sourceId);
  assert(advanced.source.action.contributions.every(contribution => contribution.kind === 'retained'));
  const observations = actualFieldObservationEvidenceFromSqlite(db);
  const initialObservation = required(observations.read(observationIds[0]), 'original observation');
  const dueObservation = required(observations.read(observationIds[1]), 'due observation');
  const before = required(observations.read(observationIds[2]), 'before-reception observation');
  assert.equal(initialObservation.source.executionSourceId, race.source.sourceId); assert.equal(dueObservation.source.executionSourceId, deadline.source.sourceId);
  assert.equal(before.revision, 3); assert.equal(before.source.playerId, player); assert.equal(before.source.executionSourceId, adopted.source.sourceId);
  assert.equal(before.source.previousObservationSourceId, dueObservation.source.sourceId); assert.equal(before.source.communicationSourceId, sent.source.sourceId);
  for (const value of [initialObservation, dueObservation, before]) {
    assert.equal(value.source.observationModelSourceId, 'actual-observation-model-home-1');
    assert.equal(value.source.sourceVersion, 'synthetic-v1');
    assert.deepEqual(value.source.view, { poseVersion: 'synthetic-body-translation-world-axes-v1', bodyRelativeEyeOffset: { x: 0, y: 3, z: 0 },
      forward: { x: 0, y: 0, z: 1 }, attentionTarget: { kind: 'ball' } });
  }
  assert.deepEqual(before.history.map(value => value.sourceId), observationIds);
  assert.equal(before.receipt.communicationEvidence?.result.kind, 'scheduled'); assert.deepEqual(before.receipt.perceived.communications, []);
  assert(!json(before.receipt.communicationEvidence).includes('onFieldCall'));
  const decisions = actualDefensiveDecisionEvidenceFromSqlite(db);
  const initialDecision = required(decisions.read(decisionIds[0]), 'initial decision');
  const issued = required(decisions.read(decisionIds[1]), 'issued decision');
  assert.equal(initialDecision.receipt.lifecycle.status, 'pending_decision'); assert.equal(issued.receipt.lifecycle.status, 'issued');
  assert.equal(initialDecision.source.observationSourceId, initialObservation.source.sourceId);
  assert.equal(issued.source.observationSourceId, dueObservation.source.sourceId); assert.equal(issued.receipt.originObservationSourceId, initialObservation.source.sourceId);
  assert.deepEqual(issued.receipt.availability, initialObservation.receipt.at); assert.deepEqual(initialObservation.receipt.perceived.communications, []);
  assert.equal(initialDecision.receipt.scheduling.movementStartTick, raceTick + 1);
  assert.equal(initialDecision.receipt.scheduling.decisionDelayTicks, 1); assert.equal(initialDecision.receipt.scheduling.firstStepDelayTicks, 0);
  const motor = required(actualLocomotionEvidenceFromSqlite(db).read('scheduled-motor-home-1'), 'original motor');
  assert.equal(motor.source.decisionSourceId, issued.source.sourceId); assert.equal(motor.source.executionSourceId, deadline.source.sourceId);
  assert.equal(motor.decisionHash, hash(issued)); assert.equal(motor.originDecisionHash, hash(initialDecision)); assert.equal(motor.originObservationHash, hash(initialObservation));
  assert.deepEqual(motor.receipt.startAt, issued.receipt.lifecycle.issuedAt); assert.equal(motor.receipt.coverageEndTick, coverage);
  assert.equal(motor.receipt.retainedRoles.length, 5); assert(motor.receipt.retainedRoles.every(role => role.command.sourceId === feet.source.sourceId && role.acceptedThroughTick === coverage));
  assert(receivedAt.elapsedSeconds > required(issued.receipt.lifecycle.issuedAt, 'issued moment').elapsedSeconds);
  assert(receivedAt.elapsedSeconds > before.receipt.at.elapsedSeconds);
  const initial = actualPlayersKinematicsFromPrefix(players, physicalPrefix(3));
  const atDeadline = actualPlayersKinematicsFromPrefix(players, physicalPrefix(4));
  const atAdoption = actualPlayersKinematicsFromPrefix(players, physicalPrefix(5));
  const final = actualPlayersKinematicsFromPrefix(players, physicalPrefix(6));
  assert.equal(initial[0].at.tick, raceTick); assert.equal(initial[0].at.elapsedSeconds, (raceTick - initial[0].at.originTick) / actualTps);
  for (const [index, binding] of bindings.entries()) {
    const self = initial[index], priorSelf = atDeadline[index], adoptedSelf = atAdoption[index], finalSelf = final[index];
    assert.equal(self.playerId, binding.playerId); assert.equal(self.personId, binding.personId); assert.equal(self.personLinkSourceId, binding.personLinkSourceId);
    assert.equal(self.physicalPitchSourceId, pitch.source.sourceId); assert.equal(self.gameDay, binding.gameDay); assert.equal(self.gameId, binding.gameId);
    assert.equal(self.activeCommand.kind, 'motion_checkpoint_v1'); assert.equal(self.activeCommand.sourceId, feet.source.sourceId);
    assert.equal(self.activeCommand.acceptedThroughTick, coverage);
    assert.deepEqual(adoptedSelf.root.position, priorSelf.root.position); assert.deepEqual(adoptedSelf.root.velocity, priorSelf.root.velocity);
    assert.deepEqual(adoptedSelf.roles.map(role => role.declaredPose), priorSelf.roles.map(role => role.declaredPose));
    assert(adoptedSelf.ownedMotionCoverage?.roleAuthorities.every(role => role.command.sourceId === feet.source.sourceId && role.acceptedThroughTick === coverage));
    if (binding.playerId === player) {
      const owned = required(adoptedSelf.ownedMotionCoverage, 'adopted original root authority');
      assert.equal(owned.rootAuthority.owner, 'actual_locomotion_receipts');
      assert.equal(owned.rootAuthority.sourceId, motor.source.sourceId);
      assert.equal(owned.rootAuthority.adoptionSourceId, adopted.source.sourceId); assert.equal(owned.rootAuthority.acceptedThroughTick, coverage);
      assert.equal(adoptedSelf.adoptions.length, priorSelf.adoptions.length + 1);
    } else { assert.deepEqual(adoptedSelf.activeCommand, priorSelf.activeCommand); assert.deepEqual(adoptedSelf.adoptions, priorSelf.adoptions); }
    const { executedThrough: _before, ...oldCommand } = adoptedSelf.activeCommand;
    const { executedThrough: _after, ...newCommand } = finalSelf.activeCommand;
    assert.deepEqual(newCommand, oldCommand);
    assert.deepEqual(finalSelf.ownedMotionCoverage?.rootAuthority, adoptedSelf.ownedMotionCoverage?.rootAuthority);
    assert.deepEqual(finalSelf.ownedMotionCoverage?.roleAuthorities, adoptedSelf.ownedMotionCoverage?.roleAuthorities);
    assert.equal(adoptedSelf.ownedMotionCoverage?.compositionSourceId, adopted.source.sourceId);
    assert.equal(finalSelf.ownedMotionCoverage?.compositionSourceId, advanced.source.sourceId);
    for (const actor of [self, finalSelf]) {
      assert.deepEqual(actor.roles.map(role => role.role).sort(), roles);
      assert(actor.roles.every(role => role.canonicalActor.primitive.endTick === coverage));
    }
  }
  const receiveSource = { ...sent.source, sourceId: 'received-call-reception', currentExecutionSourceId: advanced.source.sourceId, previousCommunicationSourceId: sent.source.sourceId };
  const afterSource = { ...before.source, sourceId: 'received-call-after-reception-observation', previousObservationSourceId: before.source.sourceId,
    executionSourceId: advanced.source.sourceId, communicationSourceId: receiveSource.sourceId };
  const received = communications.read(receiveSource.sourceId), after = observations.read(afterSource.sourceId);
  assert.deepEqual(ids(db, 'actual_call_communications'), ['received-call-send', ...(level >= 1 ? [receiveSource.sourceId] : [])].sort());
  assert.deepEqual(ids(db, 'actual_field_observations'), [...observationIds, ...(level === 2 ? [afterSource.sourceId] : [])].sort());
  assert.deepEqual(ids(db, 'actual_defensive_decisions'), [...decisionIds].sort()); assert.deepEqual(ids(db, 'actual_locomotion_receipts'), [motor.source.sourceId]);
  assert.deepEqual(ids(db, 'actual_communication_models'), [model.source.sourceId]);
  assert.deepEqual(ids(db, 'batted_world_field_actions'), ['field-motion-1', 'field-race-candidate-0']);
  const head = (table: string, expected: Row) => assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all().map(row => ({ ...row })), [expected], table);
  head('batted_world_field_heads', { physical_pitch_source_id: pitch.source.sourceId,
    response_source_id: paired.value.baseField.source.responseSourceId, geometry_source_id: paired.value.baseField.source.geometrySourceId,
    source_id: paired.value.baseField.source.sourceId, revision: 2 });
  head('batted_world_field_execution_heads', { physical_pitch_source_id: pitch.source.sourceId, base_field_source_id: paired.value.baseField.source.sourceId,
    source_id: advanced.source.sourceId, revision: 7 });
  head('actual_call_communication_heads', { call_source_id: call.source.sourceId, source_id: level >= 1 ? receiveSource.sourceId : sent.source.sourceId, revision: level >= 1 ? 2 : 1 });
  const playerHead = { physical_pitch_source_id: pitch.source.sourceId, player_id: player };
  head('actual_field_observation_heads', { ...playerHead, source_id: level === 2 ? afterSource.sourceId : before.source.sourceId, revision: level === 2 ? 4 : 3 });
  head('actual_defensive_decision_heads', { ...playerHead, source_id: issued.source.sourceId, revision: 2 });
  head('actual_locomotion_heads', { ...playerHead, source_id: motor.source.sourceId, revision: 1 });
  if (level === 0) { assert.equal(received, null); assert.equal(after, null); }
  else {
    assert(received); assert.deepEqual(received.source, receiveSource); assert.equal(received.revision, 2);
    assert.equal(received.callHash, sent.callHash); assert.equal(received.modelHash, sent.modelHash); assert.deepEqual(received.emitted, sent.emitted);
    const recipient = required(received.recipients.find(value => value.playerId === player), 'received defender'); assert(recipient.kind === 'received');
    assert.deepEqual(recipient.reception, scheduled.reception); assert.deepEqual(recipient.reception.received.event, sent.emitted);
    const p = battedWorldFieldPhysicalPrefix(physicalPrefix(6)); assert.equal(p.segments.at(-1)!.actors.length, 50);
    const segment = required(p.segments.filter(value => value.startElapsedSeconds <= receivedAt.elapsedSeconds && value.endElapsedSeconds >= receivedAt.elapsedSeconds).at(-1), 'original body segment');
    const body = required(segment.actors.find(value => value.playerId === player && value.primitive.role === 'body'), 'original body');
    const primitive = body.primitive, dt = (receivedAt.originTick - primitive.startTick) / primitive.ticksPerSecond + receivedAt.elapsedSeconds - (body.startElapsedSeconds ?? 0);
    for (const axis of ['x', 'y', 'z'] as const) assert.equal(recipient.receiverPosition[axis], primitive.startCenter[axis] + primitive.startVelocity[axis] * dt + 0.5 * primitive.acceleration[axis] * dt * dt);
    const elapsed = ((receivedAt.tick - receivedAt.originTick - 1) / sent.clock.ticksPerSecond + receivedAt.elapsedSeconds) / 2;
    const earlier = { ...receivedAt, elapsedSeconds: elapsed, tick: quantizeEventTick(receivedAt.originTick, elapsed, sent.clock.ticksPerSecond) };
    assert.equal(earlier.tick, receivedAt.tick); assert(elapsed < receivedAt.elapsedSeconds);
    assert.equal(actualCommunicationObservationAt(received, player, earlier).kind, 'scheduled'); assert.equal(actualCommunicationObservationAt(received, player, receivedAt).kind, 'received');
    if (level === 1) assert.equal(after, null);
    else {
      assert(after); assert.deepEqual(after.source, afterSource); assert.equal(after.revision, 4);
      assert.deepEqual(after.receipt.communicationEvidence, { sourceId: received.source.sourceId, snapshotHash: hash(received),
        result: { playerId: player, kind: 'received', receivedAt, received: recipient.reception.received, receiverPosition: recipient.receiverPosition } });
      assert.deepEqual(after.receipt.perceived.communications, [recipient.reception.received]);
      assert(after.receipt.at.elapsedSeconds >= receivedAt.elapsedSeconds); assert.equal(after.receipt.at.tick, throughTick);
    }
  }
  return { pitch, paired, call, model, sent, initialObservation, dueObservation, before, initialDecision, issued, motor,
    initial, atDeadline, atAdoption, final, receivedAt, throughTick, player, receiveSource, afterSource, received, after };
}));

const evidenceManifest = (value: ReturnType<typeof authenticate>) => ({
  physicalPitchSourceId: value.pitch.source.sourceId, playerId: value.player, receivedAt: value.receivedAt, receptionThroughTick: value.throughTick,
  originals: { pitch: hash(value.pitch), call: hash(value.call), model: hash(value.model), sent: hash(value.sent),
    initialObservation: hash(value.initialObservation), dueObservation: hash(value.dueObservation), before: hash(value.before),
    initialDecision: hash(value.initialDecision), issued: hash(value.issued), motor: hash(value.motor),
    physical: value.paired.executions.map(value => ({ sourceId: value.source.sourceId, hash: ownedScheduledMotionArchiveHash(value) })),
    initialKinematics: hash(value.initial), deadlineKinematics: hash(value.atDeadline), adoptedKinematics: hash(value.atAdoption), finalKinematics: hash(value.final) },
  receiveSource: value.receiveSource, afterSource: value.afterSource,
  received: value.received ? hash(value.received) : null, after: value.after ? hash(value.after) : null,
});
const unchangedOriginals = (before: ReturnType<typeof evidenceManifest>, after: ReturnType<typeof evidenceManifest>) => {
  assert.deepEqual(after.originals, before.originals); assert.deepEqual(after.receiveSource, before.receiveSource); assert.deepEqual(after.afterSource, before.afterSource);
  assert.deepEqual(after.receivedAt, before.receivedAt); assert.equal(after.playerId, before.playerId); assert.equal(after.physicalPitchSourceId, before.physicalPitchSourceId);
};
const delta = (before: Raw, after: Raw, phase: Phase, sourceId: string) => {
  assert.deepEqual(after.schema, before.schema); assert.deepEqual(Object.keys(after.tables), Object.keys(before.tables));
  const table = phase === 'reception' ? 'actual_call_communications' : 'actual_field_observations';
  const head = phase === 'reception' ? 'actual_call_communication_heads' : 'actual_field_observation_heads';
  for (const name of Object.keys(before.tables)) {
    if (phase === 'authenticate' || name !== table && name !== head) { assert.deepEqual(after.tables[name], before.tables[name], name); continue; }
    if (name === table) {
      assert.equal(after.tables[name].filter(row => row.source_id === sourceId).length, 1);
      assert.equal(after.tables[name].length, before.tables[name].length + 1);
      assert.deepEqual(after.tables[name].filter(row => row.source_id !== sourceId), before.tables[name]);
    } else {
      assert.equal(before.tables[name].length, 1); assert.equal(after.tables[name].length, 1);
      assert.deepEqual({ ...after.tables[name][0] }, { ...before.tables[name][0], source_id: sourceId, revision: phase === 'reception' ? 2 : 4 });
    }
  }
};

/** A concrete phase only. Inputs are copied; the interrupted original is never opened. */
export const runReceivedCallRecoveryPhase = (input: ReceivedCallRecoveryInput): void => {
  const manifest = pinned<Manifest>(input.inputManifest);
  assert.equal(manifest.schema, 'received_call_recovery_input_v1'); assert.equal(manifest.interruptedSourceCommit, 'dbb032dd43d6ce3856a9a6b921af63569b897215');
  assert.deepEqual(manifest.interruptedRun, { originalNativeCasePassed: false, originalReaped: true, rootCompleted: false });
  const original = pinned<{ passed: boolean; reaped: boolean }>(manifest.originalTerminal); assert.equal(original.passed, false); assert.equal(original.reaped, true);
  const qualification = pinned<{ sourceCommit: string; sourceManifestSha256: string; controlHashes: Record<string, string>; passed: boolean; reaped: boolean;
    counts: Record<string, number>; remainingOwnedProcesses: unknown[]; sourceDependenciesControlsUnchanged: boolean }>(input.qualificationTerminal);
  assert.equal(input.qualificationTerminal.path, manifest.qualification.terminalPath); assert.equal(qualification.sourceCommit, manifest.qualification.sourceCommit);
  assert(qualification.passed && qualification.reaped && qualification.sourceDependenciesControlsUnchanged); assert.deepEqual(qualification.remainingOwnedProcesses, []);
  assert.deepEqual(qualification.counts, { numTotalTests: 137, numPassedTests: 137, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0 });
  assert.equal(qualification.sourceManifestSha256, manifest.qualification.sourceManifestSha256);
  assert.equal(qualification.controlHashes[resolve(dirname(manifest.qualification.terminalPath), '..', 'green1.config.json')], manifest.qualification.configurationSha256);
  const previousPhase = input.phase === 'authenticate' ? 'materialize' : input.phase === 'reception' ? 'authenticate' : 'reception';
  const terminal = pinned<Terminal>(input.predecessorTerminal), prior = pinned<Receipt>(input.predecessorReceipt);
  assert.equal(terminal.schema, 'received_call_recovery_terminal_v1'); assert.equal(terminal.phase, previousPhase);
  assert(terminal.invocationVerified && terminal.phaseVerified && terminal.reaped && terminal.sourceDependenciesControlsInputUnchanged);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.equal(terminal.failure, null); assert.equal(terminal.cancellationSignal, null);
  assert.equal(terminal.rootCompleted, false); assert.equal(terminal.wholePipelinePassed, false); assert.deepEqual(terminal.proof, input.predecessorReceipt);
  const stage = pinned<{ phase: string; phaseVerified: boolean; reaped: boolean; remainingOwnedProcesses: unknown[]; failure: unknown; stopReason: unknown; cancellationSignal: unknown; proof: Pin }>(terminal.phaseTerminal);
  assert.equal(stage.phase, previousPhase); assert(stage.phaseVerified && stage.reaped); assert.deepEqual(stage.remainingOwnedProcesses, []);
  assert.equal(stage.failure, null); assert.equal(stage.stopReason, null); assert.equal(stage.cancellationSignal, null); assert.deepEqual(stage.proof, input.predecessorReceipt);
  for (const proof of [terminal, prior]) {
    assert.equal(proof.sourceCommit, input.sourceCommit); assert.equal(proof.sourceManifestSha256, input.sourceManifestSha256);
    assert.equal(proof.configurationSha256, input.configurationSha256); assert.equal(proof.inputManifestSha256, input.inputManifest.sha256);
    assert.equal(proof.recoveryLineageId, manifest.recoveryLineageId);
  }
  assert.equal(prior.schema, `received_call_recovery_${previousPhase}_receipt_v1`); assert.equal(prior.phase, previousPhase);
  assert.deepEqual(prior.qualificationTerminal, input.qualificationTerminal);
  assert(prior.allConnectionsClosedReopened && prior.originalInputsUnchanged); assert.equal(prior.rootCompleted, false);
  assert.equal(prior.originalDbbGatePassed, false); assert.equal(prior.originalGateCredit, 0); assert.equal(prior.recoveredPrerequisiteQualified, false);
  assert.equal(prior.nativeSemanticReauthenticationPerformed, previousPhase !== 'materialize');
  const raw = pinned<{ files: { original: string; copy: string; sha256: string; bytes: number }[] }>(manifest.interruption.rawManifest);
  const recheck = () => {
    pinned(manifest.originalTerminal); pinned(manifest.interruption.rawManifest); pinned(manifest.interruption.diagnostic);
    pinned(input.inputManifest); pinned(input.predecessorTerminal); pinned(input.predecessorReceipt); pinned(input.qualificationTerminal);
    for (const file of raw.files) for (const path of [file.original, file.copy]) {
      assert.equal(sha(path), file.sha256); assert.equal(statSync(path).size, file.bytes);
    }
    assert.equal(sha(prior.database.path), prior.database.sha256); assert.equal(statSync(prior.database.path).size, prior.database.bytes); closed(prior.database.path);
  };
  recheck(); assert.equal(realpathSync(prior.database.path), prior.database.path);
  const outputDirectory = realpathSync(input.outputDirectory), output = resolve(outputDirectory, 'checkpoint.sqlite'), receiptPath = resolve(input.receiptPath);
  assert.equal(dirname(receiptPath), outputDirectory); absent(receiptPath);
  const protectedPaths = [input.inputManifest.path, input.predecessorTerminal.path, input.predecessorReceipt.path, input.qualificationTerminal.path,
    manifest.originalTerminal.path, manifest.interruption.rawManifest.path, manifest.interruption.diagnostic.path, prior.database.path,
    ...raw.files.flatMap(file => [file.original, file.copy])];
  for (const path of protectedPaths) assert(!realpathSync(path).startsWith(outputDirectory + '/') && realpathSync(path) !== outputDirectory);
  for (const path of [output, ...['-wal', '-shm', '-journal'].map(suffix => output + suffix)]) absent(path);
  let boundary = 'stage'; const mark = (status: 'entered' | 'completed' | 'error') => input.progress?.({ phase: input.phase, boundary, status });
  mark('entered');
  try {
    copyFileSync(prior.database.path, output, constants.COPYFILE_EXCL); assert.equal(sha(output), prior.database.sha256);
    boundary = 'authenticate-input'; mark('entered');
    const start = managed(new Sqlite(output, { readOnly: true }), db => {
      db.exec('PRAGMA query_only=ON'); const raw = capture(db); assert.deepEqual(fingerprint(raw), prior.rawIntegrityFingerprint);
      const evidence = input.phase === 'authenticate' ? evidenceManifest(authenticate(db, 0)) : required(prior.authenticated, 'preceding genuine owner manifest');
      // Later phases consume only the exact prospective Source references from
      // the pinned prior receipt; acceptance and the fresh reopen rederive truth.
      return { raw, evidence };
    }); closed(output); mark('completed');
    if (input.phase !== 'authenticate') {
      boundary = input.phase === 'reception' ? 'accept-reception' : 'accept-after-observation'; mark('entered');
      if (input.phase === 'reception') managed(openSqliteActualCommunicationStore(output, {
        readAcceptedModel: () => null, readAcceptedCommunication: id => id === start.evidence.receiveSource.sourceId ? start.evidence.receiveSource : null,
      }), store => { const result = store.accept(start.evidence.receiveSource.sourceId); assert.deepEqual(result.source, start.evidence.receiveSource); assert.equal(result.revision, 2); });
      else managed(openSqliteActualFieldObservationStore(output, { readAcceptedObservation: id => id === start.evidence.afterSource.sourceId ? start.evidence.afterSource : null }),
        store => { const result = store.accept(start.evidence.afterSource.sourceId); assert.deepEqual(result.source, start.evidence.afterSource); assert.equal(result.revision, 4); });
      closed(output); mark('completed');
    }
    boundary = 'closed-native-reopen'; mark('entered');
    const final = managed(new Sqlite(output, { readOnly: true }), db => {
      db.exec('PRAGMA query_only=ON'); const raw = capture(db);
      delta(start.raw, raw, input.phase, input.phase === 'reception' ? start.evidence.receiveSource.sourceId : start.evidence.afterSource.sourceId);
      const authenticated = input.phase === 'authenticate' ? start.evidence : evidenceManifest(authenticate(db, input.phase === 'reception' ? 1 : 2));
      unchangedOriginals(start.evidence, authenticated);
      if (input.phase === 'after_observation') assert.equal(authenticated.received, start.evidence.received);
      return { rawIntegrityFingerprint: fingerprint(raw), authenticated };
    }); closed(output); recheck(); mark('completed');
    boundary = 'receipt'; mark('entered');
    const result: Receipt = { schema: `received_call_recovery_${input.phase}_receipt_v1`, phase: input.phase, recoveryLineageId: manifest.recoveryLineageId,
      sourceCommit: input.sourceCommit, sourceManifestSha256: input.sourceManifestSha256, configurationSha256: input.configurationSha256,
      inputManifestSha256: input.inputManifest.sha256, interruptedRun: manifest.interruptedRun, predecessorTerminal: input.predecessorTerminal,
      qualificationTerminal: input.qualificationTerminal, predecessorReceipt: input.predecessorReceipt, inputDatabase: prior.database,
      originalTerminal: manifest.originalTerminal, rawManifest: manifest.interruption.rawManifest,
      allowedRowDelta: input.phase === 'authenticate' ? [] : input.phase === 'reception'
        ? ['INSERT actual_call_communications:received-call-reception', 'UPDATE actual_call_communication_heads:first-base-umpire-call:1->2']
        : ['INSERT actual_field_observations:received-call-after-reception-observation', 'UPDATE actual_field_observation_heads:pitch-0/home-1:3->4'],
      database: { path: output, sha256: sha(output), bytes: statSync(output).size }, ...final,
      allConnectionsClosedReopened: true, originalInputsUnchanged: true, nativeSemanticReauthenticationPerformed: true,
      recoveredPrerequisiteQualified: input.phase === 'after_observation', rootCompleted: false, originalDbbGatePassed: false, originalGateCredit: 0,
      receivedCallControllerImplemented: false, semanticReplanQualified: false, renewalQualified: false, playEndQualified: false, wholePipelinePassed: false };
    writeFileSync(receiptPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); mark('completed'); boundary = 'stage'; mark('completed');
  } catch (error) { mark('error'); if (boundary !== 'stage') { boundary = 'stage'; mark('error'); } throw error; }
};
