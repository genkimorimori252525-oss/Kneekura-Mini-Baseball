import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { closeSync, constants, copyFileSync, fsyncSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { battedBallFlightEvidenceFromSqlite } from './SqliteBattedBallFlightStore';
import { battedWorldContactEvidenceFromSqlite, openSqliteBattedWorldContactStore,
  type AcceptedBattedWorldContact, type DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import { battedFirstFielderTouchEvidenceFromSqlite, openSqliteBattedFirstFielderTouchStore,
  type AcceptedBattedFirstFielderTouch, type DurableBattedFirstFielderTouch } from './SqliteBattedFirstFielderTouchStore';
import { battedContactResponseEvidenceFromSqlite, openSqliteBattedContactResponseStore,
  type AcceptedBattedContactResponse, type DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import { battedWorldFieldCalibrationEvidenceFromSqlite } from './BattedWorldFieldCalibrationEvidenceFromSqlite';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';
import { battedEpisodeFieldBindingEvidenceFromSqlite, openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import type { AcceptedBattedEpisodeFieldBinding, DurableBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';
import { battedWorldFieldRootIdentity } from './BattedWorldFieldRoot';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
type Pin = Readonly<{ path: string; sha256: string }>;
type Stage = 'inventory' | 'contact' | 'touch' | 'response' | 'binding';
type Input = Readonly<{ schema: 'episode_participant_stage_input_v1'; stage: Stage; input: Pin; acceptedSources: Pin;
  lineage: Readonly<{ receipt: Pin; terminal: Pin; config: Pin }>; sourceIdentity: Readonly<{ head: string; src: string }>;
  recoveredInventory?: Readonly<{ input: Pin; audit: Pin; returnedCheckpoint: Pin;
    sourceIdentity: Readonly<{ head: string; src: string }>; sourceGroupHash: string }>;
  contactProvenance?: Readonly<{ input: Pin; sourceIdentity: Readonly<{ head: string; src: string }>; sourceGroupHash: string }>;
  touchProvenance?: Readonly<{ input: Pin; sourceIdentity: Readonly<{ head: string; src: string }>; sourceGroupHash: string }>;
  bindingSchema?: 'existing' | 'create' }>;
type Sources = Readonly<{ contact: AcceptedBattedWorldContact; touch: AcceptedBattedFirstFielderTouch;
  response: AcceptedBattedContactResponse; binding: AcceptedBattedEpisodeFieldBinding }>;
const sourceProposalHash = '96a7aa39d2fa08be681d778711be1acb60974977e3fc3af9527f7c0d72323486';
const flightId = 'fixture-next-actual-setup-flight', pitchId = 'fixture-next-actual-setup-swing';
const flightHash = '150237c1905783e6cccecb50a6ac09130ce264c4977e4b8f42d28028c6a56b6d';
const players = ['p2', 'home-1', 'home-2', 'home-3', 'home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'away-2'];
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'];
const zero = { x: 0, y: 0, z: 0 };
const snapshot = <T>(db: Db, work: () => T): T => withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db, work));
const changes = (db: Db) => Number(db.prepare('SELECT total_changes() AS n').get()!.n);
const installed = (db: Db, table: string) => db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name=?").get(table) !== undefined;
const durableJson = (file: string, value: unknown) => {
  writeFileSync(file, `${json(value)}\n`, { flag: 'wx' });
  const fd = openSync(file, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  const folder = openSync(dirname(file), 'r'); try { fsyncSync(folder); } finally { closeSync(folder); }
};

/** Each case starts from a separately qualified closed artifact. No stage rebuilds
 * the original world, pitch, SWING or flight, or shares a live donor connection. */
const stageCopy = (stage: Stage) => {
  const manifestPath = process.env.EPISODE_PARTICIPANT_INPUT; assert(manifestPath, 'pinned episode participant stage input required');
  const input = JSON.parse(readFileSync(manifestPath, 'utf8')) as Input;
  assert.equal(input.schema, 'episode_participant_stage_input_v1'); assert.equal(input.stage, stage);
  assert.equal(input.acceptedSources.sha256, sourceProposalHash);
  const pins = [input.input, input.acceptedSources, ...Object.values(input.lineage),
    ...(input.recoveredInventory ? [input.recoveredInventory.input, input.recoveredInventory.audit, input.recoveredInventory.returnedCheckpoint] : []),
    ...(input.contactProvenance ? [input.contactProvenance.input] : []),
    ...(input.touchProvenance ? [input.touchProvenance.input] : [])];
  const checkPins = () => { for (const pin of pins) assert.equal(geometryFileHash(pin.path), pin.sha256); geometryClosed(input.input.path); };
  checkPins();
  const proposal = JSON.parse(readFileSync(input.acceptedSources.path, 'utf8'));
  const sources = proposal.sources as Sources;
  assert.equal(proposal.schema, 'episode_participant_binding_v2_input_proposal_v1');
  assert.equal(proposal.nativeExecutionReleased, false, 'Source proposal must remain immutable when a separate stage is released');
  assert.deepEqual(sources.contact.commands.map(c => c.playerId), players);
  for (const command of sources.contact.commands) {
    assert.deepEqual(command.bodyAcceleration, zero); assert.deepEqual(command.primitiveMotions.map(p => p.role), roles);
    for (const motion of command.primitiveMotions) { assert.deepEqual(motion.offsetVelocity, zero); assert.deepEqual(motion.offsetAcceleration, zero); }
  }
  const receipt = JSON.parse(readFileSync(input.lineage.receipt.path, 'utf8'));
  const terminal = JSON.parse(readFileSync(input.lineage.terminal.path, 'utf8'));
  assert.equal(receipt.destinationSha256, input.input.sha256); assert.equal(receipt.destinationPath, input.input.path);
  assert.equal(terminal.status, 'passed'); assert.deepEqual(terminal.failures, []);
  assert.equal(terminal.configSha256, input.lineage.config.sha256);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.deepEqual(terminal.before, terminal.after);
  assert.equal(terminal.groupChildExits.length, terminal.ownedIdentities.length);
  for (const identity of terminal.ownedIdentities) {
    const matches = terminal.groupChildExits.filter((item: { identity: unknown }) => json(item.identity) === json(identity));
    assert.equal(matches.length, 1); const exit = matches[0];
    const expected = stage === 'inventory' && json(identity) === json(terminal.originalChildIdentity) ? 1 : 0;
    assert.equal(exit.exitCode, expected); assert.equal(exit.rawWaitStatus, expected * 256);
  }
  if (stage === 'inventory') {
    assert.equal(receipt.allConnectionsClosedReopened, true);
    assert.equal(receipt.schema, 'actual_live_geometry_flight_prerequisites_v1');
    assert.equal(receipt.flightHash, flightHash); assert.equal(receipt.freshWriter.delta, 2); assert.equal(receipt.retryWriter.delta, 0);
    assert.equal(receipt.authorityFreeRetry, true); assert.equal(terminal.originalChildExit, 1);
    assert.equal(terminal.tests.expectedFailedCases, 1); assert.equal(terminal.tests.passedCases, 0); assert.deepEqual(terminal.tests.skipped, []);
  } else if (stage === 'contact') {
    const recovered = input.recoveredInventory; assert(recovered, 'contact requires explicitly qualified recovered inventory');
    assert.equal(receipt.schema, 'episode_participant_inventory_recovery_v1');
    assert.equal(receipt.manifestSha256, recovered.input.sha256);
    const recoveryInput = JSON.parse(readFileSync(recovered.input.path, 'utf8'));
    const audit = JSON.parse(readFileSync(recovered.audit.path, 'utf8'));
    const checkpoint = JSON.parse(readFileSync(recovered.returnedCheckpoint.path, 'utf8'));
    const config = JSON.parse(readFileSync(input.lineage.config.path, 'utf8'));
    assert.equal(recoveryInput.schema, 'episode_participant_inventory_recovery_input_v1');
    assert.deepEqual(recoveryInput.audit, recovered.audit);
    assert.equal(audit.status, 'failed_zero_aggregate_credit');
    assert.equal(receipt.priorAttempt.status, 'failed'); assert.equal(receipt.priorAttempt.aggregateCredit, 0);
    assert.equal(receipt.priorAttempt.originalCloseSuccess, 'unknown');
    assert.equal(receipt.priorAttempt.configSha256, audit.pins.releasedConfig.sha256);
    assert.equal(receipt.priorAttempt.terminalSha256, audit.pins.terminal.sha256);
    assert.equal(receipt.priorAttempt.reportSha256, audit.pins.report.sha256);
    assert.equal(receipt.priorAttempt.progressSha256, recoveryInput.progress.sha256);
    assert.deepEqual(receipt.priorAttempt.sourceIdentity, recoveryInput.expectedSourceIdentity);
    assert.equal(receipt.priorAttempt.returnedCheckpointSha256, recovered.returnedCheckpoint.sha256);
    assert.equal(audit.pins.returned.sha256, recovered.returnedCheckpoint.sha256);
    assert.equal(checkpoint.phase, 'authentication-returned'); assert.equal(checkpoint.independentlyQualified, false);
    assert.deepEqual(checkpoint.sourceIdentity, receipt.priorAttempt.sourceIdentity);
    assert.equal(checkpoint.manifestSha256, audit.pins.stageInput.sha256);
    assert.deepEqual(receipt.completedObservations.hashes, checkpoint.hashes);
    assert.equal(receipt.completedObservations.rowsHash, checkpoint.rowsHash);
    assert.equal(receipt.completedObservations.bindingTablePresent, false);
    assert.equal(receipt.completedObservations.originalAuthenticationRepeated, false);
    assert.deepEqual(receipt.currentReadback, { allConnectionsClosedReopened: true, censusAndArchiveHashesMatch: true,
      inputTupleUnchanged: true, mainBytesUnchanged: true, ordinaryNativeConnection: true,
      queryOnly: true, sidecarsAbsent: true, zeroChanges: true });
    assert.equal(receipt.newOwnerRows, 0); assert.equal(receipt.successorAcceptanceReleased, false);
    assert.deepEqual(config.sourceIdentity, recovered.sourceIdentity);
    assert.equal(config.inputs.source.sha256, recovered.sourceGroupHash);
    assert.equal(terminal.before.source.sha256, recovered.sourceGroupHash);
    assert.equal(terminal.originalChildExit, 0); assert.equal(terminal.tests.passedCases, 1);
    assert.equal(terminal.tests.expectedFailedCases, 0); assert.deepEqual(terminal.tests.skipped, []);
  } else {
    assert.equal(input.recoveredInventory, undefined); assert.equal(receipt.allConnectionsClosedReopened, true);
    const predecessor: Record<Exclude<Stage, 'inventory'>, Stage> = { contact: 'inventory', touch: 'contact', response: 'touch', binding: 'response' };
    assert.equal(receipt.schema, 'episode_participant_stage_receipt_v1'); assert.equal(receipt.stage, predecessor[stage]);
    assert.equal(receipt.acceptedSourcesSha256, sourceProposalHash); assert.equal(receipt.verified, true);
    assert.equal(terminal.originalChildExit, 0); assert.equal(terminal.tests.passedCases, 1); assert.equal(terminal.tests.expectedFailedCases, 0);
    if (stage === 'touch') {
      const contact = input.contactProvenance; assert(contact, 'touch requires explicitly qualified contact-owner provenance');
      const contactInput = JSON.parse(readFileSync(contact.input.path, 'utf8'));
      const config = JSON.parse(readFileSync(input.lineage.config.path, 'utf8'));
      assert.equal(receipt.manifestSha256, contact.input.sha256);
      assert.deepEqual(receipt.sourceIdentity, contact.sourceIdentity); assert.deepEqual(config.sourceIdentity, contact.sourceIdentity);
      assert.deepEqual(contactInput.sourceIdentity, contact.sourceIdentity);
      assert.equal(config.inputs.source.sha256, contact.sourceGroupHash); assert.equal(terminal.before.source.sha256, contact.sourceGroupHash);
      assert.equal(contactInput.stage, 'contact'); assert.equal(contactInput.acceptedSources.sha256, sourceProposalHash);
      assert.deepEqual(receipt.exactAdditions, { contact: 1, contactHead: 1 });
      assert.equal(receipt.freshWriter.delta, 2); assert.deepEqual(receipt.freshWriter.witnessed, [true, true]);
      assert.deepEqual(receipt.freshWriter.writes, [{ index: 0, totalChanges: receipt.freshWriter.before + 1 },
        { index: 1, totalChanges: receipt.freshWriter.before + 2 }]);
      assert.equal(receipt.retryWriter.delta, 0); assert.deepEqual(receipt.retryWriter.writes, []);
      assert.deepEqual(receipt.retryWriter.witnessed, [false, false]); assert.equal(receipt.authorityFreeRetry, true); assert.equal(receipt.zeroWriteRetry, true);
      assert.equal(receipt.inputProvenance.kind, 'audited_inventory_and_native_readback_v1');
      assert.equal(receipt.inputProvenance.recoveryReceiptSha256, contactInput.lineage.receipt.sha256);
      assert.equal(receipt.inputProvenance.recoveryTerminalSha256, contactInput.lineage.terminal.sha256);
      assert.equal(receipt.inputProvenance.originalAuthenticationRepeatedByTest, false);
      assert.equal(receipt.inputProvenance.priorAttempt.status, 'failed'); assert.equal(receipt.inputProvenance.priorAttempt.aggregateCredit, 0);
      assert.equal(receipt.inputProvenance.priorAttempt.originalCloseSuccess, 'unknown');
      assert.equal(terminal.tests.skipped.length, 4);
      assert(terminal.tests.skipped.every((test: { status: string; credit: number }) => test.status === 'skipped' && test.credit === 0));
    }
    if (stage === 'response') {
      const touch = input.touchProvenance; assert(touch, 'response requires explicitly qualified touch-owner provenance');
      const touchInput = JSON.parse(readFileSync(touch.input.path, 'utf8'));
      const config = JSON.parse(readFileSync(input.lineage.config.path, 'utf8'));
      assert.equal(receipt.manifestSha256, touch.input.sha256);
      assert.deepEqual(receipt.sourceIdentity, touch.sourceIdentity); assert.deepEqual(config.sourceIdentity, touch.sourceIdentity);
      assert.deepEqual(touchInput.sourceIdentity, touch.sourceIdentity);
      assert.equal(config.inputs.source.sha256, touch.sourceGroupHash); assert.equal(terminal.before.source.sha256, touch.sourceGroupHash);
      assert.equal(touchInput.stage, 'touch'); assert.equal(touchInput.acceptedSources.sha256, sourceProposalHash);
      assert.deepEqual(receipt.exactAdditions, { touch: 1 });
      assert.equal(receipt.freshWriter.delta, 1); assert.deepEqual(receipt.freshWriter.witnessed, [true]);
      assert.deepEqual(receipt.freshWriter.writes, [{ index: 0, totalChanges: receipt.freshWriter.before + 1 }]);
      assert.equal(receipt.retryWriter.delta, 0); assert.deepEqual(receipt.retryWriter.writes, []);
      assert.deepEqual(receipt.retryWriter.witnessed, [false]); assert.equal(receipt.authorityFreeRetry, true); assert.equal(receipt.zeroWriteRetry, true);
      const provenance = receipt.inputProvenance; assert.equal(provenance.kind, 'qualified_contact_owner_v1');
      assert.equal(provenance.receiptSha256, touchInput.lineage.receipt.sha256); assert.equal(provenance.terminalSha256, touchInput.lineage.terminal.sha256);
      assert.equal(provenance.configSha256, touchInput.lineage.config.sha256); assert.deepEqual(provenance.sourceIdentity, touchInput.contactProvenance.sourceIdentity);
      assert.equal(provenance.originalAuthenticationRepeatedByTest, false);
      assert.equal(provenance.inherited.kind, 'audited_inventory_and_native_readback_v1');
      assert.equal(provenance.inherited.originalAuthenticationRepeatedByTest, false);
      assert.equal(provenance.inherited.priorAttempt.status, 'failed'); assert.equal(provenance.inherited.priorAttempt.aggregateCredit, 0);
      assert.equal(provenance.inherited.priorAttempt.originalCloseSuccess, 'unknown');
      assert.equal(terminal.tests.skipped.length, 4);
      assert(terminal.tests.skipped.every((test: { status: string; credit: number }) => test.status === 'skipped' && test.credit === 0));
    }
  }
  const directory = mkdtempSync(join(tmpdir(), `episode-participant-${stage}-`)), path = join(directory, 'episode.sqlite');
  copyFileSync(input.input.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), input.input.sha256);
  const resources: { close(): void }[] = [];
  const track = <T extends { close(): void }>(value: T): T => { resources.push(value); return value; };
  const drain = () => { const errors: unknown[] = []; while (resources.length) try { resources.pop()!.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, 'episode test resource cleanup failed'); };
  const checkpoint = (phase: string, evidence: object) => durableJson(join(directory, `${phase}.checkpoint.json`), {
    schema: 'episode_participant_stage_checkpoint_v1', stage, phase, sourceIdentity: input.sourceIdentity,
    manifestSha256: geometryFileHash(manifestPath), independentlyQualified: false, ...evidence });
  const finish = (evidence: object) => {
    drain(); geometryClosed(path); checkPins();
    durableJson(join(directory, 'stage-receipt.json'), { schema: 'episode_participant_stage_receipt_v1', stage,
      manifestSha256: geometryFileHash(manifestPath), sourceIdentity: input.sourceIdentity, acceptedSourcesSha256: sourceProposalHash,
      inputSha256: input.input.sha256, destinationPath: path, destinationSha256: geometryFileHash(path),
      allConnectionsClosedReopened: true, verified: true, ...evidence });
  };
  return { input, sources, receipt, path, track, drain, checkpoint, finish, checkPins };
};

const authenticate = (db: Db, sources: Sources) => snapshot(db, () => {
  const ownFlights = battedBallFlightEvidenceFromSqlite(db), flight = ownFlights.read(flightId); assert(flight);
  assert.equal(hash(flight), flightHash); assert.equal(flight.source.physicalPitchSourceId, pitchId);
  assert.equal(flight.source.previousFlightSourceId, null); assert.equal(flight.source.searchDurationTicks, 0);
  assert.equal(json(ownFlights.currentHead(pitchId)), json({ source_id: flightId, revision: 1 })); ownFlights.openFrame(flight.physicalPitch);
  const pitch = flight.physicalPitch, actor = pitch.frame.batterActor; assert(actor);
  assert.equal(hash(pitch.source), '9b5e7fb92ff3427737a15cf837b93e4d03c4c860a6ac9ec7663fb2e5403533f7');
  assert.equal(hash(pitch), 'ffcb2697255e4682dc53db6ac52a13efa66d3ca55d2ae25ef817c9595265345a');
  assert.equal(actor.source.sourceId, 'fixture-next-actual-batter'); assert.equal(actor.binding.playerId, 'away-2');
  assert.equal(actor.binding.personId, 'person-away-2'); assert.equal(actor.binding.personLinkSourceId, 'intake-away-2');
  assert.equal(pitch.frame.gameId, 'game-1'); assert.equal(pitch.frame.match.playId, 8);
  assert.equal(actor.binding.gameDay, 10); assert.equal(actor.binding.rosterRevision, 0);
  assert.equal(actor.origin.actualLiveReadiness?.closureSourceId, 'fixture-actual-live-closure');
  assert('activationApplicationId' in actor.source); assert.equal(actor.source.activationApplicationId, 'fixture-actual-live-application');
  const contacts = pitch.result.pitch.resolution.timeline.events.slice(pitch.beforeTimeline.events.length).filter(e => e.kind === 'BatBallContact');
  assert.equal(contacts.length, 1); assert.equal(contacts[0].sequence, 2); assert.equal(contacts[0].tick, 35_470_251);
  assert.equal(pitch.frame.world.runners.length, 0); assert(Object.values(pitch.frame.match.bases).every(value => value === null));
  const worldModel = battedWorldContactEvidenceFromSqlite(db).readModel(sources.contact.modelSourceId); assert(worldModel);
  const responseModel = battedContactResponseEvidenceFromSqlite(db).readModel(sources.response.responseModelSourceId); assert(responseModel);
  const bindings = [...actor.defenderBindings, actor.binding]; assert.deepEqual(bindings.map(b => b.playerId), players);
  for (const model of [worldModel, responseModel]) {
    assert.equal(model.actors.length, 18); assert.equal(model.gameId, 'game-1'); assert.equal(model.fixtureEventId, 'fixture-1');
    assert.equal(model.careerId, 'career-a'); assert.equal(model.venueId, 'venue-1'); assert(model.availableAtDay <= 10);
    for (const binding of bindings) {
      const entries = model.actors.filter(a => a.playerId === binding.playerId && a.personId === binding.personId);
      assert.equal(entries.length, 1); assert.deepEqual(entries[0].primitives.map(p => p.role).sort(), [...roles].sort());
    }
  }
  const calibrations = battedWorldFieldCalibrationEvidenceFromSqlite(db), calibration = calibrations.readGeometry(sources.binding.fieldCalibrationSourceId);
  assert(calibration, 'the retained field-bags calibration is required'); calibrations.historicalGeometry(calibration);
  const oldPitch = calibration.baseGeometry.flight.physicalPitch, oldActor = oldPitch.frame.batterActor; assert(oldActor);
  assert(oldPitch.frame.match.playId < pitch.frame.match.playId); assert.notEqual(oldActor.binding.playerId, actor.binding.playerId);
  assert.deepEqual(oldActor.defenderBindings, actor.defenderBindings);
  for (const key of ['gameId', 'careerId', 'fixtureEventId', 'competitionEditionId', 'gameDay', 'clubId', 'side'] as const) {
    assert.equal(actor.binding[key], oldActor.binding[key]);
  }
  assert.deepEqual(flight.source.execution.field, calibration.baseGeometry.flight.source.execution.field);
  const centers = battedWorldFrameBaseCenters(db, flight);
  assert.deepEqual(centers, { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } });
  for (const base of ['first', 'second', 'third'] as const) assert.deepEqual(centers[base], calibration.baseGeometry.source.bases[base].region.center);
  assert.equal(db.prepare('SELECT count(*) AS n FROM actual_live_play_runtimes WHERE game_id=? AND play_id=?').get('game-1', 8)!.n, 0);
  return { flight, calibration, worldModel, responseModel, hashes: { flight: hash(flight), physicalActor: hash(actor),
    calibration: hash(calibration), worldModel: hash(worldModel), responseModel: hash(responseModel) } };
});

const assertWorld = (world: DurableBattedWorldContact, sources: Sources) => {
  assert.equal(json(world.source), json(sources.contact)); assert.equal(hash(world.flight), flightHash); assert.equal(world.revision, 1);
  assert(world.result.kind === 'airborne', 'zero-horizon commands did not yield the required airborne root; do not tune');
  assert.equal(json(world.result.ball), json(world.flight.flight.initialBall));
  assert.equal(world.result.throughTick, world.flight.flight.initialBall.tick);
  assert.equal(json(world.timeline), json(world.flight.physicalPitch.result.pitch.resolution.timeline));
  assert.deepEqual(world.actors.map(a => `${a.playerId}/${a.primitive.role}`).sort(), players.flatMap(p => roles.map(r => `${p}/${r}`)).sort());
  const actor = world.flight.physicalPitch.frame.batterActor!;
  for (const binding of [...actor.defenderBindings, actor.binding]) {
    const matches = world.modelActorEvidence.filter(e => json(e.binding) === json(binding)); assert.equal(matches.length, 1);
    if (binding.playerId === actor.binding.playerId) assert.equal(json(matches[0].person), json(actor.person));
  }
};
const assertTouch = (touch: DurableBattedFirstFielderTouch, sources: Sources) => {
  assert.equal(json(touch.source), json(sources.touch)); assertWorld(touch.worldContact, sources);
  assert.deepEqual(touch.result, { kind: 'unresolved', reason: 'airborne', timeline: touch.worldContact.timeline });
};
const assertResponse = (response: DurableBattedContactResponse, sources: Sources) => {
  assert.equal(json(response.source), json(sources.response)); assertTouch(response.touch, sources);
  assert.equal(response.result.kind, 'airborne'); assert.equal(json(response.result.ball), json(response.touch.worldContact.flight.flight.initialBall));
};

/** Native methods/results are forwarded unchanged. Capture the real writer at
 * its first owner read and count only its exact concrete insertion statements. */
const observeWriter = <T>(ownerRead: RegExp, inserts: readonly RegExp[], work: () => T) => {
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!, prepare = DatabaseSync.prototype.prepare;
  const count = (db: Db) => Number(Reflect.apply(prepare, db, ['SELECT total_changes() AS n']).get()!.n);
  let owner: Db | null = null, before = -1; const writes: { index: number; totalChanges: number }[] = [];
  const capture: typeof prepare = function (this: Db, ...args: Parameters<typeof prepare>) {
    if (owner === null && ownerRead.test(args[0])) { owner = this; before = count(this); }
    return Reflect.apply(prepare, this, args);
  };
  Object.defineProperty(DatabaseSync.prototype, 'prepare', { ...descriptor, value: capture });
  const witnesses = inserts.map((sql, index) => witnessSqliteWrite(sql, db => {
    assert.equal(db, owner); writes.push({ index, totalChanges: count(db) }); return true;
  }));
  try {
    const value = work(); assert(owner, 'genuine owner connection was not observed'); const after = count(owner);
    return { value, counters: { before, after, delta: after - before, writes, witnessed: witnesses.map(w => w.wasReached()) } };
  } finally {
    try { while (witnesses.length) witnesses.pop()!.close(); }
    finally { const unchanged = DatabaseSync.prototype.prepare === capture; Object.defineProperty(DatabaseSync.prototype, 'prepare', descriptor);
      assert(unchanged, 'Native writer observation changed during the test'); }
  }
};

type Rows = ReturnType<typeof geometryRows>;
const append = (rows: Rows, table: string, row: object) => {
  assert(rows.tables[table], `preinstalled owner table is missing: ${table}`);
  const rowid = Math.max(0, ...rows.tables[table].map(bytes => Number(JSON.parse(bytes).__rowid))) + 1;
  rows.tables[table].push(json({ __rowid: rowid, ...row }));
};
const assertOnlyAddition = (before: Rows, after: Rows, stage: 'contact' | 'touch' | 'response', value: DurableBattedWorldContact | DurableBattedFirstFielderTouch | DurableBattedContactResponse) => {
  const expected = structuredClone(before);
  if (stage === 'contact') {
    const v = value as DurableBattedWorldContact;
    append(expected, 'batted_world_contacts', { source_id: v.source.sourceId, physical_pitch_source_id: pitchId, game_id: v.model.gameId,
      revision: v.revision, previous_source_id: null, source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v) });
    append(expected, 'batted_world_contact_heads', { physical_pitch_source_id: pitchId, source_id: v.source.sourceId, revision: v.revision });
  } else if (stage === 'touch') {
    const v = value as DurableBattedFirstFielderTouch;
    append(expected, 'batted_first_fielder_touches', { source_id: v.source.sourceId, world_contact_source_id: v.source.worldContactSourceId,
      physical_pitch_source_id: pitchId, game_id: v.worldContact.model.gameId, source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v) });
  } else {
    const v = value as DurableBattedContactResponse;
    append(expected, 'batted_contact_responses', { source_id: v.source.sourceId, first_fielder_touch_source_id: v.source.firstFielderTouchSourceId,
      world_contact_source_id: v.touch.worldContact.source.sourceId, physical_pitch_source_id: pitchId, game_id: v.model.gameId,
      source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v) });
  }
  assert.deepEqual(after, expected, 'unexpected model, schema, rowid, owner, head or admission change');
};

it('EPB-P00 authenticates retained flight and accepted current participant inputs', () => {
  const x = stageCopy('inventory');
  try {
    let db = x.track(new DatabaseSync(x.path, { readOnly: true })); db.exec('PRAGMA query_only=ON');
    const before = geometryRows(db), beforeChanges = changes(db); x.checkpoint('authentication-start', { rowsHash: hash(before) });
    const value = authenticate(db, x.sources);
    for (const table of ['batted_world_contacts', 'batted_world_contact_heads', 'batted_first_fielder_touches', 'batted_contact_responses']) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE physical_pitch_source_id=?`).get(pitchId)!.n, 0);
    }
    const bindingTablePresent = installed(db, 'batted_episode_field_bindings');
    if (bindingTablePresent) assert.equal(db.prepare('SELECT count(*) AS n FROM batted_episode_field_bindings WHERE physical_pitch_source_id=?').get(pitchId)!.n, 0);
    assert.deepEqual(geometryRows(db), before); assert.equal(changes(db), beforeChanges); assert.equal(db.isTransaction, false);
    assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
    x.checkpoint('authentication-returned', { hashes: value.hashes, rowsHash: hash(before), bindingTablePresent });
    x.drain(); geometryClosed(x.path); assert.equal(geometryFileHash(x.path), x.input.input.sha256);
    db = x.track(new DatabaseSync(x.path, { readOnly: true })); db.exec('PRAGMA query_only=ON');
    assert.deepEqual(geometryRows(db), before); assert.equal(changes(db), 0); x.drain(); geometryClosed(x.path);
    x.finish({ hashes: value.hashes, bindingTablePresent, beforeRowsHash: hash(before), afterRowsHash: hash(before), exactAdditions: {},
      zeroWrites: true, reopenCensusVerified: true, nativeOwnerAuthentication: true });
  } finally { x.drain(); geometryClosed(x.path); x.checkPins(); }
});

const prerequisite = (stage: 'contact' | 'touch' | 'response') => {
  const x = stageCopy(stage);
  try {
    let db = x.track(new DatabaseSync(x.path)); const before = geometryRows(db);
    // Qualified predecessor receipts replace only standalone test inventory
    // replay. Each normal production owner still authenticates its dependencies.
    const inputObservation = stage === 'contact' ? x.receipt.completedObservations
      : { hashes: x.receipt.hashes, rowsHash: x.receipt.afterRowsHash };
    const authenticated = { hashes: inputObservation.hashes };
    assert.equal(hash(before), inputObservation.rowsHash);
    assert.equal(installed(db, 'batted_episode_field_bindings'), false);
    const peer = <T>(read: () => T) => snapshot(db, read);
    const openOwner = (authority: boolean) => stage === 'contact'
      ? x.track(openSqliteBattedWorldContactStore(x.path, { read: id => peer(() => battedBallFlightEvidenceFromSqlite(db).read(id)) },
        authority ? { readAcceptedContact: id => id === x.sources.contact.sourceId ? x.sources.contact : null, readAcceptedModel: () => null } : undefined))
      : stage === 'touch'
        ? x.track(openSqliteBattedFirstFielderTouchStore(x.path, { read: id => peer(() => battedWorldContactEvidenceFromSqlite(db).read(id)) },
          authority ? { readAcceptedTouch: id => id === x.sources.touch.sourceId ? x.sources.touch : null } : undefined))
        : x.track(openSqliteBattedContactResponseStore(x.path, { read: id => peer(() => battedFirstFielderTouchEvidenceFromSqlite(db).read(id)) },
          authority ? { readAcceptedResponse: id => id === x.sources.response.sourceId ? x.sources.response : null, readAcceptedModel: () => null } : undefined));
    const ownerRead = stage === 'contact' ? /^SELECT \* FROM batted_world_contacts WHERE source_id=/
      : stage === 'touch' ? /^SELECT \* FROM batted_first_fielder_touches WHERE source_id=/ : /^SELECT \* FROM batted_contact_responses WHERE source_id=/;
    const inserts = stage === 'contact' ? [/^INSERT INTO batted_world_contacts VALUES/, /^INSERT INTO batted_world_contact_heads VALUES/]
      : stage === 'touch' ? [/^INSERT INTO batted_first_fielder_touches VALUES/] : [/^INSERT INTO batted_contact_responses VALUES/];
    let owner = openOwner(true); assert.deepEqual(geometryRows(db), before);
    x.checkpoint('accept-start', { sourceHash: hash(x.sources[stage]) });
    const accepted = observeWriter(ownerRead, inserts, () => owner.accept(x.sources[stage].sourceId));
    x.checkpoint('accept-returned', { valueHash: hash(accepted.value), writer: accepted.counters });
    if (stage === 'contact') assertWorld(accepted.value as DurableBattedWorldContact, x.sources);
    else if (stage === 'touch') assertTouch(accepted.value as DurableBattedFirstFielderTouch, x.sources);
    else assertResponse(accepted.value as DurableBattedContactResponse, x.sources);
    assert.equal(accepted.counters.delta, inserts.length); assert(accepted.counters.witnessed.every(Boolean));
    assert.deepEqual(accepted.counters.writes, inserts.map((_sql, index) => ({ index, totalChanges: accepted.counters.before + index + 1 })));
    const after = geometryRows(db); assertOnlyAddition(before, after, stage, accepted.value); x.drain(); geometryClosed(x.path);
    db = x.track(new DatabaseSync(x.path)); owner = openOwner(false);
    const retry = observeWriter(ownerRead, inserts, () => owner.accept(x.sources[stage].sourceId));
    assert.equal(json(retry.value), json(accepted.value)); assert.equal(retry.counters.delta, 0); assert.deepEqual(retry.counters.writes, []);
    assert(retry.counters.witnessed.every(v => !v)); assert.deepEqual(geometryRows(db), after); x.drain(); geometryClosed(x.path);
    db = x.track(new DatabaseSync(x.path)); db.exec('PRAGMA query_only=ON');
    const fresh = snapshot(db, () => stage === 'contact' ? battedWorldContactEvidenceFromSqlite(db).read(x.sources.contact.sourceId)
      : stage === 'touch' ? battedFirstFielderTouchEvidenceFromSqlite(db).read(x.sources.touch.sourceId)
        : battedContactResponseEvidenceFromSqlite(db).read(x.sources.response.sourceId));
    assert.equal(json(fresh), json(accepted.value)); assert.deepEqual(geometryRows(db), after); assert.equal(changes(db), 0);
    x.finish({ hashes: authenticated.hashes, valueHash: hash(accepted.value), beforeRowsHash: hash(before), afterRowsHash: hash(after),
      freshWriter: accepted.counters, retryWriter: retry.counters, authorityFreeRetry: true, zeroWriteRetry: true,
      ...(stage === 'contact' ? { inputProvenance: { kind: 'audited_inventory_and_native_readback_v1',
        recoveryReceiptSha256: x.input.lineage.receipt.sha256, recoveryTerminalSha256: x.input.lineage.terminal.sha256,
        priorAttempt: x.receipt.priorAttempt, originalAuthenticationRepeatedByTest: false } } : {}),
      ...(stage === 'touch' ? { inputProvenance: { kind: 'qualified_contact_owner_v1',
        sourceIdentity: x.receipt.sourceIdentity, receiptSha256: x.input.lineage.receipt.sha256,
        terminalSha256: x.input.lineage.terminal.sha256, configSha256: x.input.lineage.config.sha256,
        inherited: x.receipt.inputProvenance, originalAuthenticationRepeatedByTest: false } } : {}),
      ...(stage === 'response' ? { inputProvenance: { kind: 'qualified_touch_owner_v1',
        sourceIdentity: x.receipt.sourceIdentity, receiptSha256: x.input.lineage.receipt.sha256,
        terminalSha256: x.input.lineage.terminal.sha256, configSha256: x.input.lineage.config.sha256,
        inherited: x.receipt.inputProvenance, originalAuthenticationRepeatedByTest: false } } : {}),
      exactAdditions: stage === 'contact' ? { contact: 1, contactHead: 1 } : { [stage]: 1 } });
  } finally { x.drain(); geometryClosed(x.path); x.checkPins(); }
};
it('EPB-P01 accepts only the next contact and contact head', () => prerequisite('contact'));
it('EPB-P02 accepts only the next first-fielder touch', () => prerequisite('touch'));
it('EPB-P03 accepts only the next contact response', () => prerequisite('response'));

it('EPB-R01 accepts the new batter binding through its explicit v2 actor reference', () => {
  const x = stageCopy('binding');
  try {
    const db = x.track(new DatabaseSync(x.path)); const before = geometryRows(db), authenticated = authenticate(db, x.sources);
    assert.deepEqual(authenticated.hashes, x.receipt.hashes);
    const response = snapshot(db, () => battedContactResponseEvidenceFromSqlite(db).read(x.sources.response.sourceId)); assert(response);
    assertResponse(response, x.sources); assert.equal(hash(response), x.receipt.valueHash);
    // Preflight determines whether this normal owner schema is already present.
    // Schema creation is not silently admitted in the first genuine RED packet.
    assert.equal(x.input.bindingSchema, 'existing', 'separate exact schema-bootstrap release required before a missing binding owner can be installed');
    assert(installed(db, 'batted_episode_field_bindings'));
    const bindings = x.track(openSqliteBattedEpisodeFieldBindingStore(x.path, { readAcceptedBinding: id => id === x.sources.binding.sourceId ? x.sources.binding : null }));
    assert.deepEqual(geometryRows(db), before);
    x.checkpoint('binding-assertion-start', { responseHash: hash(response), sourceHash: hash(x.sources.binding), hashes: authenticated.hashes });
    let bound: DurableBattedEpisodeFieldBinding;
    let freshWriter: ReturnType<typeof observeWriter<DurableBattedEpisodeFieldBinding>>['counters'];
    const ownerRead = /^SELECT \* FROM main\.batted_episode_field_bindings/;
    const insert = [/^INSERT INTO main\.batted_episode_field_bindings VALUES/];
    try {
      const accepted = observeWriter(ownerRead, insert, () => bindings.accept(x.sources.binding.sourceId));
      bound = accepted.value; freshWriter = accepted.counters;
    } catch (error) {
      assert.deepEqual(geometryRows(db), before);
      x.checkpoint('binding-assertion-threw', { message: error instanceof Error ? error.message : String(error), rowsHash: hash(before) });
      throw error;
    }
    assert.equal(freshWriter.delta, 1); assert.deepEqual(freshWriter.witnessed, [true]);
    assert.deepEqual(freshWriter.writes, [{ index: 0, totalChanges: freshWriter.before + 1 }]);
    assert.equal(bound.source.version, 'batted_episode_field_binding_v2'); assert.equal(json(bound.source), json(x.sources.binding));
    assert.equal(json(bound.response), json(response)); assert.equal(json(bound.calibration), json(authenticated.calibration));
    assert.equal(bound.physicalPitchSourceId, pitchId); assert.equal(bound.playId, 8); assert.equal(bound.contactSequence, 2); assert.equal(bound.contactTick, 35_470_251);
    const expected = structuredClone(before);
    append(expected, 'batted_episode_field_bindings', { source_id: bound.source.sourceId, source_version: bound.source.sourceVersion,
      binding_version: bound.source.version, game_id: bound.gameId, play_id: bound.playId, physical_pitch_source_id: bound.physicalPitchSourceId,
      response_source_id: bound.source.responseSourceId, field_calibration_source_id: bound.source.fieldCalibrationSourceId,
      source_json: json(bound.source), source_hash: hash(bound.source), snapshot_json: json(bound), snapshot_hash: hash(bound) });
    assert.deepEqual(geometryRows(db), expected);
    // Untouched v1 consumer discrimination must remain fail-closed.
    assert.throws(() => battedWorldFieldRootIdentity({ rootKind: 'episode_field_binding_v1', episodeFieldBinding: bound,
      response: bound.response, geometry: bound.calibration }), /invalid actual field episode root kind or binding receipt/);
    assert.throws(() => battedEpisodeFieldBindingEvidenceFromSqlite(db).derive({ sourceId: 'fixture-next-episode-legacy-rejection',
      sourceVersion: x.sources.binding.sourceVersion, version: 'batted_episode_field_binding_v1',
      responseSourceId: bound.source.responseSourceId, fieldCalibrationSourceId: bound.source.fieldCalibrationSourceId }),
    /episode field binding original Player\/Person\/fixture\/day or orientation differs/);
    x.drain(); geometryClosed(x.path);
    const reopened = x.track(openSqliteBattedEpisodeFieldBindingStore(x.path));
    const retry = observeWriter(ownerRead, insert, () => reopened.accept(bound.source.sourceId));
    assert.equal(json(retry.value), json(bound)); assert.equal(retry.counters.delta, 0);
    assert.deepEqual(retry.counters.writes, []); assert.deepEqual(retry.counters.witnessed, [false]);
    x.drain(); geometryClosed(x.path);
    const fresh = x.track(new DatabaseSync(x.path, { readOnly: true })); fresh.exec('PRAGMA query_only=ON');
    assert.equal(json(battedEpisodeFieldBindingEvidenceFromSqlite(fresh).read(bound.source.sourceId)), json(bound));
    assert.deepEqual(geometryRows(fresh), expected); assert.equal(changes(fresh), 0);
    x.finish({ hashes: authenticated.hashes, valueHash: hash(bound), beforeRowsHash: hash(before), afterRowsHash: hash(expected),
      exactAdditions: { binding: 1 }, freshWriter, retryWriter: retry.counters,
      authorityFreeRetry: true, zeroWriteRetry: true, v1ConsumerRejected: true, v1ParticipantGuardPreserved: true });
  } finally { x.drain(); geometryClosed(x.path); x.checkPins(); }
});
