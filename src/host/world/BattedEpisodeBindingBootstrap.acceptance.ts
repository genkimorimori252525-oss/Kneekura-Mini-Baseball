import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { closeSync, constants, copyFileSync, fsyncSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { geometryClosed, geometryFileHash, geometryRows } from './ActualLiveBaseGeometryContinuation.test-support';
import { battedEpisodeFieldBindingEvidenceFromSqlite, openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
type Pin = Readonly<{ path: string; sha256: string }>;
type Input = Readonly<{ schema: 'episode_binding_bootstrap_input_v1'; input: Pin; receipt: Pin; terminal: Pin; config: Pin;
  responseInput: Pin; acceptedSources: Pin; sourceIdentity: Readonly<{ head: string; src: string }>;
  responseSourceIdentity: Readonly<{ head: string; src: string }>; responseSourceGroup: string }>;
const ownerTable = 'batted_episode_field_bindings', bindingId = 'fixture-next-episode-participant-binding';
const sourceHash = '96a7aa39d2fa08be681d778711be1acb60974977e3fc3af9527f7c0d72323486';
const changes = (db: Db) => Number(db.prepare('SELECT total_changes() AS n').get()!.n);
const expectedColumns = [
  ['source_id', 'TEXT', 0, 1], ['source_version', 'TEXT', 1, 0], ['binding_version', 'TEXT', 1, 0],
  ['game_id', 'TEXT', 1, 0], ['play_id', 'INTEGER', 1, 0], ['physical_pitch_source_id', 'TEXT', 1, 0],
  ['response_source_id', 'TEXT', 1, 0], ['field_calibration_source_id', 'TEXT', 1, 0],
  ['source_json', 'TEXT', 1, 0], ['source_hash', 'TEXT', 1, 0], ['snapshot_json', 'TEXT', 1, 0], ['snapshot_hash', 'TEXT', 1, 0],
] as const;
const expectedSql = `CREATE TABLE batted_episode_field_bindings (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
        binding_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL UNIQUE,
        response_source_id TEXT NOT NULL UNIQUE,field_calibration_source_id TEXT NOT NULL,
        source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const durable = (path: string, value: unknown) => {
  writeFileSync(path, `${json(value)}\n`, { flag: 'wx' });
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  const folder = openSync(dirname(path), 'r'); try { fsyncSync(folder); } finally { closeSync(folder); }
};

/** Observe the real constructor connection before/after its unchanged exec.
 * No SQL, argument, return value or production dependency is substituted. */
const openObserved = (path: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!, exec = DatabaseSync.prototype.exec;
  let calls = 0, before = -1, after = -1;
  const observed: typeof exec = function (this: Db, ...args: Parameters<typeof exec>) {
    const selected = args[0].includes('CREATE TABLE IF NOT EXISTS main.batted_episode_field_bindings');
    if (selected) { calls++; before = changes(this); }
    const value = Reflect.apply(exec, this, args);
    if (selected) after = changes(this);
    return value;
  };
  Object.defineProperty(DatabaseSync.prototype, 'exec', { ...descriptor, value: observed });
  try {
    const store = openSqliteBattedEpisodeFieldBindingStore(path);
    try {
      assert.equal(calls, 1); assert.equal(before, 0); assert.equal(after, 0);
      return { store, counters: { calls, before, after, delta: after - before } };
    } catch (error) { store.close(); throw error; }
  } finally {
    const unchanged = DatabaseSync.prototype.exec === observed;
    Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor); assert(unchanged, 'Native bootstrap observer changed');
  }
};

it('EPB-B00 installs only the normal empty binding owner after qualified response', () => {
  const manifest = process.env.EPISODE_PARTICIPANT_INPUT; assert(manifest);
  const input = JSON.parse(readFileSync(manifest, 'utf8')) as Input; assert.equal(input.schema, 'episode_binding_bootstrap_input_v1');
  const pins = [input.input, input.receipt, input.terminal, input.config, input.responseInput, input.acceptedSources];
  const checkPins = () => { for (const pin of pins) assert.equal(geometryFileHash(pin.path), pin.sha256); geometryClosed(input.input.path); };
  checkPins(); assert.equal(input.acceptedSources.sha256, sourceHash);
  const receipt = JSON.parse(readFileSync(input.receipt.path, 'utf8')), terminal = JSON.parse(readFileSync(input.terminal.path, 'utf8'));
  const config = JSON.parse(readFileSync(input.config.path, 'utf8')), responseInput = JSON.parse(readFileSync(input.responseInput.path, 'utf8'));
  assert.equal(receipt.schema, 'episode_participant_stage_receipt_v1'); assert.equal(receipt.stage, 'response'); assert.equal(receipt.verified, true);
  assert.equal(receipt.destinationPath, input.input.path); assert.equal(receipt.destinationSha256, input.input.sha256);
  assert.equal(receipt.manifestSha256, input.responseInput.sha256); assert.equal(receipt.acceptedSourcesSha256, sourceHash);
  assert.deepEqual(receipt.sourceIdentity, input.responseSourceIdentity); assert.deepEqual(config.sourceIdentity, input.responseSourceIdentity);
  assert.deepEqual(responseInput.sourceIdentity, input.responseSourceIdentity); assert.equal(responseInput.stage, 'response');
  assert.equal(terminal.status, 'passed'); assert.deepEqual(terminal.failures, []); assert.deepEqual(terminal.before, terminal.after);
  assert.equal(terminal.configSha256, input.config.sha256); assert.equal(terminal.before.source.sha256, input.responseSourceGroup);
  assert.equal(config.inputs.source.sha256, input.responseSourceGroup); assert.equal(terminal.originalChildExit, 0);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.equal(terminal.groupChildExits.length, terminal.ownedIdentities.length);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((v: { identity: unknown }) => json(v.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert.equal(terminal.tests.passedCases, 1); assert.equal(terminal.tests.expectedFailedCases, 0); assert.equal(terminal.tests.skipped.length, 4);
  assert(terminal.tests.skipped.every((v: { status: string; credit: number }) => v.status === 'skipped' && v.credit === 0));
  assert.deepEqual(receipt.exactAdditions, { response: 1 }); assert.equal(receipt.freshWriter.delta, 1); assert.deepEqual(receipt.freshWriter.witnessed, [true]);
  assert.equal(receipt.retryWriter.delta, 0); assert.deepEqual(receipt.retryWriter.writes, []); assert.deepEqual(receipt.retryWriter.witnessed, [false]);
  assert.equal(receipt.allConnectionsClosedReopened, true); assert.equal(receipt.authorityFreeRetry, true); assert.equal(receipt.zeroWriteRetry, true);
  const provenance = receipt.inputProvenance; assert.equal(provenance.kind, 'qualified_touch_owner_v1');
  assert.equal(provenance.receiptSha256, responseInput.lineage.receipt.sha256); assert.equal(provenance.terminalSha256, responseInput.lineage.terminal.sha256);
  assert.equal(provenance.originalAuthenticationRepeatedByTest, false);
  assert.equal(provenance.inherited.kind, 'qualified_contact_owner_v1');
  assert.equal(provenance.inherited.inherited.kind, 'audited_inventory_and_native_readback_v1');
  assert.equal(provenance.inherited.inherited.priorAttempt.status, 'failed'); assert.equal(provenance.inherited.inherited.priorAttempt.aggregateCredit, 0);
  assert.equal(provenance.inherited.inherited.priorAttempt.originalCloseSuccess, 'unknown');
  const directory = mkdtempSync(join(tmpdir(), 'episode-binding-bootstrap-')), path = join(directory, 'bootstrap.sqlite');
  copyFileSync(input.input.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), input.input.sha256);
  const resources: { close(): void }[] = [], track = <T extends { close(): void }>(v: T): T => { resources.push(v); return v; };
  const close = () => { const errors: unknown[] = []; while (resources.length) try { resources.pop()!.close(); } catch (e) { errors.push(e); }
    if (errors.length) throw new AggregateError(errors, 'bootstrap close failed'); };
  try {
    let db = track(new DatabaseSync(path)); const before = geometryRows(db); assert.equal(hash(before), receipt.afterRowsHash);
    assert(!Object.hasOwn(before.tables, ownerTable)); assert.equal(battedEpisodeFieldBindingEvidenceFromSqlite(db).read(bindingId), null);
    assert.deepEqual(geometryRows(db), before); assert.equal(changes(db), 0);
    const opened = openObserved(path), owner = track(opened.store);
    assert.equal(owner.read(bindingId), null);
    assert.throws(() => owner.accept(bindingId), /accepted episode field binding Source is missing/);
    const after = geometryRows(db), rows = after.schema.map(v => JSON.parse(v));
    assert.deepEqual(after.schema.slice(0, before.schema.length), before.schema); assert.equal(after.schema.length, before.schema.length + 4);
    assert.deepEqual(after.tables, { ...before.tables, [ownerTable]: [] });
    const added = rows.slice(before.schema.length), nextRowid = Math.max(...before.schema.map(v => JSON.parse(v).__schemaRowId)) + 1;
    assert.deepEqual(added.map(v => [v.__schemaRowId, v.type, v.name, v.tbl_name]), [
      [nextRowid, 'table', ownerTable, ownerTable], ...[1, 2, 3].map((n, i) => [nextRowid + i + 1, 'index', `sqlite_autoindex_${ownerTable}_${n}`, ownerTable]),
    ]);
    assert.equal(normalizeSql(added[0].sql), normalizeSql(expectedSql)); assert(added.slice(1).every(v => v.sql === null));
    assert(added.every(v => Number.isSafeInteger(v.rootpage) && v.rootpage > 0));
    assert.equal(new Set(added.map(v => v.rootpage)).size, 4);
    assert(!added.some(v => rows.slice(0, before.schema.length).some(old => old.rootpage === v.rootpage)));
    const columns = db.prepare(`PRAGMA main.table_info(${ownerTable})`).all();
    assert.deepEqual(columns.map(v => [v.name, v.type, v.notnull, v.pk]), expectedColumns);
    assert(columns.every(v => v.dflt_value === null));
    const indexes = db.prepare(`PRAGMA main.index_list(${ownerTable})`).all(); assert.equal(indexes.length, 3);
    const indexed = indexes.map(index => { assert.equal(index.unique, 1); assert.equal(index.partial, 0);
      const names = db.prepare(`PRAGMA main.index_info(${index.name})`).all().map(v => v.name); assert.equal(names.length, 1);
      return [index.origin, names[0]]; }).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    assert.deepEqual(indexed, [['u', 'physical_pitch_source_id'], ['u', 'response_source_id'], ['pk', 'source_id']]);
    assert.equal(changes(db), 0);
    durable(join(directory, 'schema-returned.checkpoint.json'), { sourceIdentity: input.sourceIdentity, manifestSha256: geometryFileHash(manifest),
      counters: opened.counters, beforeRowsHash: hash(before), afterRowsHash: hash(after), bindingRows: 0, independentlyQualified: false });
    close(); geometryClosed(path);
    db = track(new DatabaseSync(path)); const retry = openObserved(path); track(retry.store);
    assert.equal(retry.store.read(bindingId), null); assert.deepEqual(geometryRows(db), after); assert.equal(changes(db), 0);
    close(); geometryClosed(path); checkPins();
    durable(join(directory, 'bootstrap-receipt.json'), { schema: 'episode_binding_bootstrap_receipt_v1', sourceIdentity: input.sourceIdentity,
      manifestSha256: geometryFileHash(manifest), acceptedSourcesSha256: sourceHash, destinationPath: path, destinationSha256: geometryFileHash(path),
      inputSha256: input.input.sha256, beforeRowsHash: hash(before), afterRowsHash: hash(after),
      response: { receiptSha256: input.receipt.sha256, terminalSha256: input.terminal.sha256, configSha256: input.config.sha256,
        sourceIdentity: receipt.sourceIdentity, valueHash: receipt.valueHash, hashes: receipt.hashes, inputProvenance: receipt.inputProvenance },
      exactAdditions: { bindingTable: 1, automaticIndexes: 3, bindingRows: 0, dataChanges: 0 },
      freshConstructor: opened.counters, retryConstructor: retry.counters, missingBindingRead: true, missingAuthorityRejected: true,
      allConnectionsClosedReopened: true, schemaRetryUnchanged: true, verified: true, originalAuthenticationRepeated: false,
      bindingAcceptanceReleased: false });
  } finally { close(); geometryClosed(path); checkPins(); }
});
