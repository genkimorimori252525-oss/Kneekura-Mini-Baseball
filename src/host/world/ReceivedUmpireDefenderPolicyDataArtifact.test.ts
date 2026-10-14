import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants as fsConstants, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { openSqliteReceivedUmpireDefenderPolicyDataStore, type AcceptedReceivedUmpireDefenderPolicyData } from './SqliteReceivedUmpireDefenderPolicyDataStore';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type FilePin = Readonly<{ path: string; sha256: string }>;
type Row = Record<string, unknown>;
type Input = Readonly<{
  schema: 'received_policy_data_private_copy_plan_v1'; state: 'released_for_inert_private_copy'; implementationHead: string;
  sourcePinFile: FilePin; lineagePins: readonly (FilePin & { step: string; kind: 'database' | 'receipt' | 'terminal' | 'report' })[];
  originAuthentication: FilePin; database: FilePin;
  sidecars: readonly { suffix: string; exists: boolean; bytes?: number; sha256?: string }[];
  policy: AcceptedReceivedUmpireDefenderPolicyData; originalFieldingRow: Row; originalPersonRow: Row;
  syntheticFixture: FilePin;
}>;
const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const file = (pin: FilePin) => {
  expect(isAbsolute(pin.path)).toBe(true); expect(realpathSync(pin.path)).toBe(pin.path);
  const bytes = readFileSync(pin.path); expect(sha(bytes)).toBe(pin.sha256); return bytes;
};
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const census = (db: InstanceType<typeof DatabaseSync>) => {
  const schema = db.prepare('SELECT rowid AS __rowid,* FROM main.sqlite_master ORDER BY type,name').all();
  const names = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return { schema, tables: names.map(row => ({ name: String(row.name),
    rows: db.prepare(`SELECT rowid AS __rowid,* FROM main.${quote(String(row.name))}`).all().map(stable).sort() })) };
};
const newTable = 'world_received_umpire_defender_policy_data';
const indexes = [`sqlite_autoindex_${newTable}_1`, `sqlite_autoindex_${newTable}_2`];
const newSchema = `CREATE TABLE world_received_umpire_defender_policy_data (
  source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
  person_link_source_id TEXT NOT NULL, fielding_model_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
  source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
  UNIQUE(career_id,player_id))`;
const checkOriginals = (before: ReturnType<typeof census>, after: ReturnType<typeof census>) => {
  expect(after.tables.filter(table => table.name !== newTable)).toEqual(before.tables);
  expect(after.schema.filter(row => row.tbl_name !== newTable)).toEqual(before.schema);
  expect(after.tables).toHaveLength(70);
  const added = after.schema.filter(row => row.tbl_name === newTable);
  expect(added.map(row => row.name).sort()).toEqual([...indexes, newTable].sort());
  const table = added.find(row => row.name === newTable)!;
  expect(table.type).toBe('table'); expect(String(table.sql).replace(/\s/g, '')).toBe(newSchema.replace(/\s/g, ''));
  for (const index of added.filter(row => row.name !== newTable)) {
    expect(index).toMatchObject({ type: 'index', tbl_name: newTable, sql: null }); expect(Number(index.rootpage)).toBeGreaterThan(0);
  }
  expect(after.tables.find(table => table.name === newTable)!.rows).toHaveLength(1);
};
const selected = process.env.BASEBALL_RECEIVED_POLICY_DATA_INPUT && process.env.BASEBALL_RECEIVED_POLICY_DATA_OUTPUT;

it.runIf(!!selected)('RP-A01 qualified after-observation copy adds only one inert policy baseline and survives close reopen retry', () => {
  const path = process.env.BASEBALL_RECEIVED_POLICY_DATA_INPUT!;
  expect(isAbsolute(path)).toBe(true); expect(realpathSync(path)).toBe(path);
  const input = JSON.parse(readFileSync(path, 'utf8')) as Input;
  expect(input.schema).toBe('received_policy_data_private_copy_plan_v1');
  expect(input.state, 'independent code review clearance must precede any copy or Native open').toBe('released_for_inert_private_copy');
  const sourcePins = JSON.parse(file(input.sourcePinFile).toString('utf8'));
  expect(sourcePins.head).toBe('bf4fab7ac79a02a139621be371a297c8b38e76d4');
  expect(input.lineagePins).toHaveLength(36);
  expect(input.lineagePins).toEqual(sourcePins.lineage.flatMap((stage: { completedStep: string; pins: Record<string, FilePin> }) =>
    Object.entries(stage.pins).map(([kind, pin]) => ({ step: stage.completedStep, kind, path: pin.path, sha256: pin.sha256 }))));
  const steps = ['scheduled-call', 'call-due', 'operative-call', 'send', 'before-observation', 'reception-cut', 'receive', 'after-observation', 'expected-input'];
  for (const [position, step] of steps.entries()) {
    const pins = input.lineagePins.filter(pin => pin.step === step);
    expect(pins.map(pin => pin.kind).sort()).toEqual(['database', 'receipt', 'report', 'terminal']);
    for (const pin of pins) file(pin);
    const receiptPin = pins.find(pin => pin.kind === 'receipt')!, terminalPin = pins.find(pin => pin.kind === 'terminal')!;
    const databasePin = pins.find(pin => pin.kind === 'database')!, reportPin = pins.find(pin => pin.kind === 'report')!;
    const receipt = JSON.parse(file(receiptPin).toString('utf8')), terminal = JSON.parse(file(terminalPin).toString('utf8'));
    expect(receipt).toMatchObject({ originalDatabaseSha256: '691c1640471fd268eea26c61f65699b7ca1c94566f4baa70344d86e0687ab810',
      originalAuthenticationReceiptSha256: '42f7643108db8249abe1384854af739dbd59fb4b6dff4428314cb35f3d5d189f', bridgeCredit: 0, recoveredPR350Credit: 0 });
    expect(receipt.completedStep).toBe(step); expect(receipt.outputDatabaseSha256).toBe(databasePin.sha256);
    expect(terminal).toMatchObject({ status: 'passed', originalChildExit: 0, failures: [], remainingOwnedProcesses: [],
      tests: { passedCases: 1, expectedFailedCases: 0, skipped: [], reportSha256: reportPin.sha256 } });
    expect(JSON.parse(file(reportPin).toString('utf8'))).toMatchObject({ success: true, numTotalTests: 1, numPassedTests: 1,
      numFailedTests: 0, numPendingTests: 0, numTodoTests: 0 });
    if (position) expect(receipt.predecessorReceiptSha256).toBe(input.lineagePins.find(pin => pin.step === steps[position - 1] && pin.kind === 'receipt')!.sha256);
  }
  expect(input.database.sha256).toBe('b281f59e66237b93b33d985db53f260566fcbf5facc07eb477e5eb5baf4c4c7f');
  expect(input.database.path).toBe(input.lineagePins.find(pin => pin.step === 'after-observation' && pin.kind === 'database')!.path);
  expect(input.originAuthentication.sha256).toBe('42f7643108db8249abe1384854af739dbd59fb4b6dff4428314cb35f3d5d189f'); file(input.originAuthentication);
  const checkInputBytes = () => {
    file(input.database);
    for (const sidecar of input.sidecars) {
      const path = input.database.path + sidecar.suffix;
      expect(existsSync(path)).toBe(sidecar.exists);
      if (sidecar.exists) { expect(statSync(path).size).toBe(sidecar.bytes); expect(sha(readFileSync(path))).toBe(sidecar.sha256); }
    }
  };
  checkInputBytes(); expect(input.sidecars.find(sidecar => sidecar.suffix === '-wal')).toMatchObject({ exists: true, bytes: 0 });
  expect(input.sidecars.find(sidecar => sidecar.suffix === '-journal')).toMatchObject({ exists: false });
  expect(input.syntheticFixture.path).toBe('src/core/sim/fielding/ReceivedUmpireDefenderReplan.contract.test-support.ts');
  expect(sha(readFileSync(input.syntheticFixture.path))).toBe(input.syntheticFixture.sha256);
  expect(input.syntheticFixture.sha256).toBe('7e1ad727c1dbfaadfb143a37989aa8a161d767cba52672ce434e0af0692a4eb4');
  expect(input.policy).toEqual({ sourceId: 'received-input-policy-data-synthetic-v1', sourceVersion: 'synthetic-core-contract-7e1ad727-v1',
    capability: 'received_umpire_defender_policy_data_v1', provenance: 'explicit_imported_policy_data_v1',
    careerId: 'career-a', playerId: 'home-1', personLinkSourceId: 'intake-home-1', fieldingModelSourceId: 'observation-fielding-home-1', acceptedAtDay: 10,
    profiles: { out: { ballPursuitPriority: 0.1, holdPriority: 0.9 }, safe: { ballPursuitPriority: 0.9, holdPriority: 0.1 } } });
  const output = process.env.BASEBALL_RECEIVED_POLICY_DATA_OUTPUT!;
  expect(isAbsolute(output)).toBe(true); expect(existsSync(output)).toBe(false);
  mkdirSync(output, { mode: 0o700 }); const copy = join(output, 'policy-data.sqlite'); copyFileSync(input.database.path, copy, fsConstants.COPYFILE_EXCL);
  expect(sha(readFileSync(copy))).toBe(input.database.sha256);
  const checkpoints: { phase: string; sidecars: { suffix: string; exists: boolean; bytes: number }[] }[] = [];
  const standalone = (phase: string) => {
    const sidecars = ['-wal', '-journal'].map(suffix => {
      const exists = existsSync(copy + suffix), bytes = exists ? statSync(copy + suffix).size : 0;
      expect(bytes, `${phase}: ${suffix} must be absent or empty after closing every handle`).toBe(0);
      return { suffix, exists, bytes };
    });
    checkpoints.push({ phase, sidecars });
  };
  standalone('exclusive-copy');
  let db = new DatabaseSync(copy, { readOnly: true });
  let before: ReturnType<typeof census>, durable: ReturnType<ReturnType<typeof openSqliteReceivedUmpireDefenderPolicyDataStore>['accept']>;
  try {
    before = census(db); expect(before.tables).toHaveLength(69); expect(before.tables.reduce((n, table) => n + table.rows.length, 0)).toBe(135);
    expect(db.prepare('SELECT * FROM world_player_fielding_models WHERE source_id=?').get(input.policy.fieldingModelSourceId)).toEqual(input.originalFieldingRow);
    expect(db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(input.policy.personLinkSourceId)).toEqual(input.originalPersonRow);
    expect(db.prepare('SELECT count(*) AS n FROM actual_live_play_admissions').get()).toEqual({ n: 24 });
    for (const [table, source_id, revision] of [['batted_world_field_execution_heads', 'received-input-reception-cut', 10],
      ['actual_field_observation_heads', 'received-input-after', 3], ['actual_defensive_decision_heads', 'scheduled-decision-home-1', 1],
      ['actual_locomotion_heads', 'scheduled-motor-home-1', 1]] as const) expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual([
        expect.objectContaining({ source_id, revision })]);
    const fieldingModel = playerFieldingModelEvidenceFromSqlite(db).read(input.policy.fieldingModelSourceId)!;
    const person = playerPersonLinkEvidenceFromSqlite(db).readLink(input.policy.personLinkSourceId);
    expect(fieldingModel.person).toEqual(person); expect(person!.personId).toBe('person-home-1');
    durable = { source: input.policy, fieldingModel };
  } finally { db.close(); }
  standalone('original-read-closed');
  const expectedRow = { __rowid: 1, source_id: input.policy.sourceId, source_version: input.policy.sourceVersion,
    career_id: input.policy.careerId, player_id: input.policy.playerId, person_link_source_id: input.policy.personLinkSourceId,
    fielding_model_source_id: input.policy.fieldingModelSourceId, accepted_at_day: input.policy.acceptedAtDay,
    source_json: stable(input.policy), source_hash: sha(stable(input.policy)), snapshot_json: stable(durable), snapshot_hash: sha(stable(durable)) };
  const exec = DatabaseSync.prototype.exec, prepare = DatabaseSync.prototype.prepare;
  const writerConnections: InstanceType<typeof DatabaseSync>[] = [];
  const inserts: { sql: string; changes: number | bigint; lastInsertRowid: number | bigint }[] = [];
  const accounting: { phase: string; before: number | bigint; after: number | bigint }[] = [];
  const execHook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !writerConnections.includes(this)) writerConnections.push(this);
    return exec.call(this, sql);
  });
  const prepareHook = vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
    const statement = prepare.call(this, sql);
    if (/INSERT INTO (?:main\.)?world_received_umpire_defender_policy_data/.test(sql)) {
      const run = statement.run;
      statement.run = function(this: typeof statement, ...args: Parameters<typeof run>) {
        const result = run.apply(this, args); inserts.push({ sql, changes: result.changes, lastInsertRowid: result.lastInsertRowid }); return result;
      } as typeof run;
    }
    return statement;
  });
  const changes = (connection: InstanceType<typeof DatabaseSync>) => Number(connection.prepare('SELECT total_changes() AS n').get()!.n);
  let after: ReturnType<typeof census>;
  try {
    const owner = openSqliteReceivedUmpireDefenderPolicyDataStore(copy, { readAcceptedPolicyData: id => id === input.policy.sourceId ? input.policy : null });
    try {
      expect(writerConnections).toHaveLength(1); const connection = writerConnections[0], before = changes(connection);
      expect(owner.accept(input.policy.sourceId)).toEqual(durable); const accepted = changes(connection);
      expect(accepted - before).toBe(1); accounting.push({ phase: 'accept', before, after: accepted });
      expect(inserts).toHaveLength(1); expect(inserts[0]).toMatchObject({ changes: 1, lastInsertRowid: 1 });
      expect(owner.accept(input.policy.sourceId)).toEqual(durable);
      expect(changes(connection)).toBe(accepted); accounting.push({ phase: 'same-source-retry', before: accepted, after: changes(connection) });
    } finally { owner.close(); }
    standalone('accept-and-retry-closed');
    db = new DatabaseSync(copy, { readOnly: true });
    try {
      after = census(db); checkOriginals(before, after);
      expect(db.prepare(`SELECT rowid AS __rowid,* FROM main.${newTable}`).all()).toEqual([expectedRow]);
    } finally { db.close(); }
    standalone('first-census-closed');
    const reopened = openSqliteReceivedUmpireDefenderPolicyDataStore(copy);
    try {
      expect(writerConnections).toHaveLength(2); const connection = writerConnections[1], before = changes(connection);
      expect(reopened.read(input.policy.sourceId)).toEqual(durable); expect(reopened.accept(input.policy.sourceId)).toEqual(durable);
      expect(changes(connection)).toBe(before); accounting.push({ phase: 'reopened-authority-free-read-retry', before, after: changes(connection) });
      expect(inserts).toHaveLength(1);
    } finally { reopened.close(); }
    standalone('reopened-owner-closed');
  } finally { prepareHook.mockRestore(); execHook.mockRestore(); }
  db = new DatabaseSync(copy, { readOnly: true });
  try {
    expect(census(db)).toEqual(after); checkOriginals(before, census(db));
    expect(db.prepare(`SELECT rowid AS __rowid,* FROM main.${newTable}`).all()).toEqual([expectedRow]);
  } finally { db.close(); }
  standalone('final-census-closed');
  checkInputBytes(); for (const pin of input.lineagePins) file(pin);
  writeFileSync(join(output, 'policy-data-proof.json'), JSON.stringify({ schema: 'received_policy_data_private_copy_proof_v1',
    implementationHead: input.implementationHead, originalDatabaseSha256: input.database.sha256, outputDatabaseSha256: sha(readFileSync(copy)),
    lineageFilesVerified: 36, originalTablesPreserved: 69, originalRowsPreserved: 135, originalAdmissionsPreserved: 24,
    addedTables: [newTable], addedIndexes: indexes, addedRows: 1, beforeCensusSha256: sha(stable(before)), afterCensusSha256: sha(stable(after)),
    durableSha256: sha(stable(durable)), storedRowSha256: sha(stable(expectedRow)), writerWitness: inserts, writeAccounting: accounting,
    standaloneMainFileChecks: checkpoints, originalDataAndSchemaRowidsPreserved: true, closedReopenedAuthorityFreeRetry: true, liveAvailabilityCredit: 0, receivedProcessCredit: 0,
    motorRenewalCredit: 0, productionCalibrationCredit: 0 }, null, 2) + '\n');
});
