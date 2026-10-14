import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { closeSync, constants, copyFileSync, fsyncSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { battedEpisodeFieldBindingEvidenceFromSqlite } from './SqliteBattedEpisodeFieldBindingStore';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { battedWorldBaseGeometryEvidenceFromSqlite } from './SqliteBattedWorldBaseGeometryStore';
import { battedWorldFieldEvidenceFromSqlite, openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldGeometry, battedWorldFieldRootIdentity, battedWorldFieldSourceRootIdentity, battedWorldFieldEpisodeBindingHash } from './BattedWorldFieldRoot';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
type Pin = Readonly<{ path: string; sha256: string }>;
type Input = Readonly<{ schema: 'episode_binding_v2_field_input_v1'; input: Pin; receipt: Pin; terminal: Pin; config: Pin;
  bindingInput: Pin; acceptedField: Pin; fixtureAudit: Pin; sourceIdentity: Readonly<{ head: string; src: string }>;
  bindingSourceIdentity: Readonly<{ head: string; src: string }>; bindingSourceGroup: string }>;
const durable = (path: string, value: unknown) => {
  writeFileSync(path, `${json(value)}\n`, { flag: 'wx' });
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  const folder = openSync(dirname(path), 'r'); try { fsyncSync(folder); } finally { closeSync(folder); }
};
const observe = <T>(work: () => T) => {
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!, prepare = DatabaseSync.prototype.prepare;
  const count = (db: Db) => Number(Reflect.apply(prepare, db, ['SELECT total_changes() AS n']).get()!.n);
  let owner: Db | null = null, before = -1; const writes: { index: number; totalChanges: number }[] = [];
  const capture: typeof prepare = function (this: Db, ...args: Parameters<typeof prepare>) {
    if (owner === null && /^SELECT \* FROM batted_world_field_actions/.test(args[0])) { owner = this; before = count(this); }
    return Reflect.apply(prepare, this, args);
  };
  Object.defineProperty(DatabaseSync.prototype, 'prepare', { ...descriptor, value: capture });
  const witnesses = [/^INSERT INTO batted_world_field_actions VALUES/, /^INSERT INTO batted_world_field_heads VALUES/]
    .map((sql, index) => witnessSqliteWrite(sql, db => { assert.equal(db, owner); writes.push({ index, totalChanges: count(db) }); return true; }));
  try {
    const value = work(); assert(owner); const after = count(owner);
    return { value, counters: { before, after, delta: after - before, writes, witnessed: witnesses.map(w => w.wasReached()) } };
  } finally {
    try { while (witnesses.length) witnesses.pop()!.close(); }
    finally { const unchanged = DatabaseSync.prototype.prepare === capture; Object.defineProperty(DatabaseSync.prototype, 'prepare', descriptor); assert(unchanged); }
  }
};
const append = (rows: ReturnType<typeof geometryRows>, table: string, row: object) => {
  assert(rows.tables[table], `preinstalled owner table is missing: ${table}`);
  const rowid = Math.max(0, ...rows.tables[table].map(bytes => Number(JSON.parse(bytes).__rowid))) + 1;
  rows.tables[table].push(json({ __rowid: rowid, ...row }));
};
const snapshot = <T>(db: Db, work: () => T) => withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db, work));

it('EPB-F01 advances the actual v2 field root by one accepted existing integration step', () => {
  const manifest = process.env.EPISODE_PARTICIPANT_INPUT; assert(manifest);
  const input = JSON.parse(readFileSync(manifest, 'utf8')) as Input; assert.equal(input.schema, 'episode_binding_v2_field_input_v1');
  const pins = [input.input, input.receipt, input.terminal, input.config, input.bindingInput, input.acceptedField, input.fixtureAudit];
  const checkPins = () => { for (const pin of pins) assert.equal(geometryFileHash(pin.path), pin.sha256); geometryClosed(input.input.path); };
  checkPins();
  const receipt = JSON.parse(readFileSync(input.receipt.path, 'utf8')), terminal = JSON.parse(readFileSync(input.terminal.path, 'utf8'));
  const config = JSON.parse(readFileSync(input.config.path, 'utf8')), bindingInput = JSON.parse(readFileSync(input.bindingInput.path, 'utf8'));
  const proposal = JSON.parse(readFileSync(input.acceptedField.path, 'utf8')), audit = JSON.parse(readFileSync(input.fixtureAudit.path, 'utf8'));
  const source = proposal.field as AcceptedBattedWorldFieldAction;
  assert.equal(proposal.schema, 'episode_binding_v2_field_fixture_proposal_v1'); assert.equal(proposal.nativeExecutionReleased, false);
  assert.equal(proposal.purpose, 'one existing integration step'); assert.deepEqual(proposal.input, input.input);
  assert.deepEqual(proposal.bindingReceipt, input.receipt); assert.deepEqual(proposal.bindingTerminal, input.terminal);
  assert.equal(proposal.bindingValueHash, receipt.valueHash); assert.deepEqual(audit.proposal, input.acceptedField);
  assert.equal(audit.nativeOwnerAuthenticationReplayed, false); assert.equal(audit.inputBytesAndSidecarAbsencePreserved, true);
  assert.equal(receipt.schema, 'episode_participant_stage_receipt_v1'); assert.equal(receipt.stage, 'binding'); assert.equal(receipt.verified, true);
  assert.equal(receipt.destinationPath, input.input.path); assert.equal(receipt.destinationSha256, input.input.sha256);
  assert.equal(receipt.manifestSha256, input.bindingInput.sha256);
  assert.deepEqual(receipt.sourceIdentity, input.bindingSourceIdentity); assert.deepEqual(config.sourceIdentity, input.bindingSourceIdentity);
  assert.deepEqual(bindingInput.sourceIdentity, input.bindingSourceIdentity); assert.equal(bindingInput.stage, 'binding');
  assert.equal(terminal.status, 'passed'); assert.deepEqual(terminal.failures, []); assert.deepEqual(terminal.before, terminal.after);
  assert.equal(terminal.configSha256, input.config.sha256); assert.equal(terminal.before.source.sha256, input.bindingSourceGroup);
  assert.equal(config.inputs.source.sha256, input.bindingSourceGroup); assert.equal(terminal.originalChildExit, 0);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.equal(terminal.groupChildExits.length, terminal.ownedIdentities.length);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((v: { identity: unknown }) => json(v.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert.equal(terminal.tests.passedCases, 1); assert.equal(terminal.tests.expectedFailedCases, 0); assert.equal(terminal.tests.skipped.length, 4);
  assert(terminal.tests.skipped.every((v: { status: string; credit: number }) => v.status === 'skipped' && v.credit === 0));
  assert.deepEqual(receipt.exactAdditions, { binding: 1 }); assert.equal(receipt.freshWriter.delta, 1);
  assert.equal(receipt.retryWriter.delta, 0); assert.deepEqual(receipt.retryWriter.writes, []);
  for (const flag of ['allConnectionsClosedReopened', 'authorityFreeRetry', 'zeroWriteRetry', 'v1ConsumerRejected', 'v1ParticipantGuardPreserved']) assert.equal(receipt[flag], true);
  const provenance = receipt.inputProvenance; assert.equal(provenance.kind, 'qualified_empty_binding_bootstrap_v1');
  assert.equal(provenance.standaloneInventoryAuthenticationRepeated, false);
  const prior = provenance.response.inputProvenance.inherited.inherited;
  assert.equal(prior.kind, 'audited_inventory_and_native_readback_v1'); assert.equal(prior.priorAttempt.status, 'failed');
  assert.equal(prior.priorAttempt.aggregateCredit, 0); assert.equal(prior.priorAttempt.originalCloseSuccess, 'unknown');
  const directory = mkdtempSync(join(tmpdir(), 'episode-v2-field-')), path = join(directory, 'field.sqlite');
  copyFileSync(input.input.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), input.input.sha256);
  const resources: { close(): void }[] = [];
  const track = <T extends { close(): void }>(value: T): T => { resources.push(value); return value; };
  const drain = () => { const errors: unknown[] = []; while (resources.length) try { resources.pop()!.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, 'field test resource cleanup failed'); };
  const checkpoint = (phase: string, evidence: object) => durable(join(directory, `${phase}.checkpoint.json`), {
    schema: 'episode_binding_v2_field_checkpoint_v1', phase, sourceIdentity: input.sourceIdentity,
    manifestSha256: geometryFileHash(manifest), independentlyQualified: false, ...evidence });
  try {
    const db = track(new DatabaseSync(path)); db.exec('PRAGMA query_only=ON'); const before = geometryRows(db);
    assert.equal(hash(before), receipt.afterRowsHash);
    const binding = snapshot(db, () => battedEpisodeFieldBindingEvidenceFromSqlite(db).read(source.episodeFieldBinding!.sourceId)); assert(binding);
    assert.equal(hash(binding), receipt.valueHash); assert.equal(binding.source.version, 'batted_episode_field_binding_v2');
    const root = { rootKind: 'episode_field_binding_v2' as const, episodeFieldBinding: binding, response: binding.response, geometry: binding.calibration };
    assert.equal(battedWorldFieldSourceRootIdentity(source), battedWorldFieldRootIdentity(root));
    assert.strictEqual(battedWorldFieldGeometry({ ...root, source }), binding.geometry);
    const world = binding.response.touch.worldContact, flight = world.flight, initial = flight.flight.initialBall;
    const clock = flight.source.execution.ballFlightParameters, throughTick = initial.tick + clock.integrationStepTicks;
    assert(Number.isSafeInteger(initial.tick) && Number.isSafeInteger(clock.integrationStepTicks) && clock.integrationStepTicks > 0);
    assert(Number.isSafeInteger(throughTick) && throughTick > initial.tick); assert(Number.isSafeInteger(clock.ticksPerSecond) && clock.ticksPerSecond > 0);
    assert.deepEqual(audit.clock, { initialBallTick: initial.tick, ticksPerSecond: clock.ticksPerSecond,
      integrationStepTicks: clock.integrationStepTicks, throughTick });
    const commands = world.source.commands.map(c => ({ playerId: c.playerId, bodyAcceleration: c.bodyAcceleration,
      primitiveMotions: c.primitiveMotions.map(p => ({ role: p.role, offsetAcceleration: p.offsetAcceleration })) }));
    assert.equal(json(source), json({ sourceId: 'fixture-next-episode-field-motion', sourceVersion: 'fixture-episode-v2-field',
      responseSourceId: binding.source.responseSourceId, geometrySourceId: binding.source.fieldCalibrationSourceId,
      episodeFieldBinding: { version: binding.source.version, sourceId: binding.source.sourceId }, previousFieldSourceId: null,
      availableAtTick: initial.tick, throughTick, commands }));
    const keys = world.actors.map(a => json([a.playerId, a.primitive.role])); assert.equal(keys.length, 50); assert.equal(new Set(keys).size, 50);
    assert.deepEqual(commands.flatMap(c => c.primitiveMotions.map(p => json([c.playerId, p.role]))).sort(), [...keys].sort());
    for (const actor of world.actors) {
      const p = actor.primitive; assert.equal(p.ticksPerSecond, clock.ticksPerSecond); assert.equal(p.startTick, initial.tick); assert.equal(p.endTick, initial.tick);
      for (const vector of [p.startCenter, p.startVelocity, p.acceleration]) assert(Object.values(vector).every(Number.isFinite));
    }
    for (const table of ['batted_world_field_actions', 'batted_world_field_heads'])
      assert.equal(db.prepare(`SELECT count(*) AS n FROM main.${table} WHERE physical_pitch_source_id=?`).get(binding.physicalPitchSourceId)!.n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM main.actual_live_play_runtimes WHERE game_id=? AND play_id=?').get(binding.gameId, binding.playId)!.n, 0);
    assert.deepEqual(geometryRows(db), before); assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0);
    checkpoint('field-root-authenticated', { bindingHash: hash(binding), rootHash: hash(root), rowsHash: hash(before), sourceHash: hash(source), throughTick });
    const owner = track(openSqliteBattedWorldFieldStore(path, battedContactResponseEvidenceFromSqlite(db), battedWorldBaseGeometryEvidenceFromSqlite(db), {
      readAcceptedGeometry: () => null, readAcceptedAction: id => id === source.sourceId ? source : null }));
    assert.deepEqual(geometryRows(db), before);
    const accepted = observe(() => owner.accept(source.sourceId)), value = accepted.value;
    checkpoint('field-accept-returned', { valueHash: hash(value), freshWriter: accepted.counters, semanticAssertionsCompleted: false });
    assert.deepEqual(accepted.counters, { before: 0, after: 2, delta: 2, witnessed: [true, true], writes: [{ index: 0, totalChanges: 1 }, { index: 1, totalChanges: 2 }] });
    assert.equal(value.rootKind, 'episode_field_binding_v2'); assert.equal(json(value.source), json(source));
    assert.equal(hash(value.episodeFieldBinding), receipt.valueHash); assert.equal(json(value.response), json(binding.response));
    assert.equal(json(value.geometry), json(binding.calibration)); assert.equal(battedWorldFieldEpisodeBindingHash(value), receipt.valueHash);
    assert.equal(value.revision, 1); assert.equal(json(value.history), json([source]));
    const moment = value.field.motion.world.moment; assert.equal(moment.originTick, initial.tick);
    assert(moment.elapsedSeconds > 0 && moment.elapsedSeconds <= clock.integrationStepTicks / clock.ticksPerSecond);
    assert.equal(value.field.motion.actors.length, 50);
    for (const actor of value.field.motion.actors) {
      const original = world.actors.filter(a => a.playerId === actor.playerId && a.primitive.role === actor.primitive.role); assert.equal(original.length, 1);
      assert.equal(json(actor.primitive.startVelocity), json(original[0].primitive.startVelocity));
      assert.equal(json(actor.primitive.startCenter), json(original[0].primitive.startCenter)); assert.equal(actor.primitive.endTick, throughTick);
    }
    const prefix = battedWorldFieldPhysicalPrefix({ baseField: value, fields: [value], executions: [] });
    const expected = structuredClone(before);
    append(expected, 'batted_world_field_actions', { source_id: source.sourceId, physical_pitch_source_id: binding.physicalPitchSourceId,
      response_source_id: source.responseSourceId, geometry_source_id: source.geometrySourceId, previous_source_id: null, revision: 1,
      game_id: value.response.model.gameId, source_json: json(source), source_hash: hash(source), snapshot_json: json(value), snapshot_hash: hash(value) });
    append(expected, 'batted_world_field_heads', { physical_pitch_source_id: binding.physicalPitchSourceId, response_source_id: source.responseSourceId,
      geometry_source_id: source.geometrySourceId, source_id: source.sourceId, revision: 1 });
    assert.deepEqual(geometryRows(db), expected); assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0);
    const outcome = { worldKind: value.field.motion.world.kind, responseKind: value.field.motion.response.kind,
      originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, ballTick: moment.ball.tick, baseContactCount: value.field.baseContacts.length };
    checkpoint('field-write-qualified', { valueHash: hash(value), rowsHash: hash(expected), freshWriter: accepted.counters, prefixHash: hash(prefix), outcome, retryAndReopenCompleted: false });
    drain(); geometryClosed(path);
    const peer = track(new DatabaseSync(path)); peer.exec('PRAGMA query_only=ON');
    const retryOwner = track(openSqliteBattedWorldFieldStore(path, battedContactResponseEvidenceFromSqlite(peer), battedWorldBaseGeometryEvidenceFromSqlite(peer)));
    const retry = observe(() => retryOwner.accept(source.sourceId)); assert.equal(json(retry.value), json(value));
    assert.deepEqual(retry.counters, { before: 0, after: 0, delta: 0, writes: [], witnessed: [false, false] });
    checkpoint('field-retry-returned', { valueHash: hash(value), retryWriter: retry.counters, rowsHash: hash(geometryRows(peer)), freshReadCompleted: false });
    assert.deepEqual(geometryRows(peer), expected); drain(); geometryClosed(path);
    const fresh = track(new DatabaseSync(path)); fresh.exec('PRAGMA query_only=ON');
    const reread = snapshot(fresh, () => battedWorldFieldEvidenceFromSqlite(fresh).read(source.sourceId)); assert(reread); assert.equal(json(reread), json(value));
    assert.equal(hash(battedWorldFieldPhysicalPrefix({ baseField: reread, fields: [reread], executions: [] })), hash(prefix));
    assert.deepEqual(geometryRows(fresh), expected); assert.equal(fresh.prepare('SELECT total_changes() AS n').get()!.n, 0);
    assert.equal(fresh.isTransaction, false); drain(); geometryClosed(path); checkPins();
    durable(join(directory, 'field-receipt.json'), { schema: 'episode_binding_v2_field_receipt_v1', verified: true, sourceIdentity: input.sourceIdentity,
      manifestSha256: geometryFileHash(manifest), acceptedFieldSha256: input.acceptedField.sha256, inputSha256: input.input.sha256,
      destinationPath: path, destinationSha256: geometryFileHash(path), bindingReceiptSha256: input.receipt.sha256, bindingHash: receipt.valueHash,
      sourceHash: hash(source), valueHash: hash(value), beforeRowsHash: hash(before), afterRowsHash: hash(expected), exactAdditions: { fieldAction: 1, fieldHead: 1 },
      freshWriter: accepted.counters, retryWriter: retry.counters, outcome, prefixHash: hash(prefix), originalBindingProvenance: provenance,
      allConnectionsClosedReopened: true, authorityFreeRetry: true, zeroWriteRetry: true, fieldContinuationExecuted: true,
      venuePolicyAccepted: false, runtimeRegistered: false, terminalPlayClaimed: false });
  } finally { drain(); geometryClosed(path); checkPins(); }
});
