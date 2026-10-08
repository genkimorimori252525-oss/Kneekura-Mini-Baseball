import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync as Database, SQLOutputValue } from 'node:sqlite';
import { expect } from 'vitest';
import { officialStateHash as hash, officialStateSerialized as json } from '../OfficialStateEncoding';
import { assertClosedTerminalSidecars, retainedTerminalProducer, type ProducerReceipt } from './ActualFoulTerminalCutover.test-support';
import type { AcknowledgementRunner, Applied } from './ActualFoulTerminalAcknowledgementWire.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
export const terminalTable = 'actual_foul_terminal_applications';
export const terminalColumns = ['source_id','game_id','play_id','application_id','physical_pitch_source_id','physical_end_source_id',
  'official_obligation_key','status','source_json','source_hash','proposal_json','proposal_hash','result_json'] as const;
/** Exact frozen 28868f1 schema. This test copy does not follow production's new
 * schema constant and is not a new application owner. */
export const frozenTerminalSql = `CREATE TABLE IF NOT EXISTS main.actual_foul_terminal_applications(
  source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,application_id TEXT NOT NULL UNIQUE,
  physical_pitch_source_id TEXT NOT NULL UNIQUE,physical_end_source_id TEXT NOT NULL UNIQUE,official_obligation_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,proposal_json TEXT NOT NULL,proposal_hash TEXT NOT NULL,result_json TEXT,
  UNIQUE(game_id,play_id),CHECK((status='QUEUED' AND result_json IS NULL)
    OR (status='OFFICIAL_APPLIED_PENDING_POST_PLAY' AND result_json IS NOT NULL)))`;
export const acknowledgedTerminalSql = frozenTerminalSql.replace(
  "OR (status='OFFICIAL_APPLIED_PENDING_POST_PLAY' AND result_json IS NOT NULL)))",
  "OR (status='OFFICIAL_APPLIED_PENDING_POST_PLAY' AND result_json IS NOT NULL)\n    OR (status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' AND result_json IS NOT NULL)))");
const compact = (sql: string) => sql.replace(/\s+/g,'').replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i,'');
export const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
export const rawCensus = (db: Database, excluded: readonly string[] = []) => db.prepare(
  "SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
  .filter(row => !excluded.includes(String(row.name))).map(row => ({ table:row.name,
    rows:db.prepare('SELECT rowid AS __ack_rowid,* FROM main."' + String(row.name).replaceAll('"','""') + '" ORDER BY rowid').all() }));
export const schemaCensus = (db: Database) => ({
  main:db.prepare('SELECT rowid,* FROM main.sqlite_master ORDER BY type,name').all(),
  temp:db.prepare('SELECT rowid,* FROM temp.sqlite_master ORDER BY type,name').all(),
  mainVersion:db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  tempVersion:db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
  userVersion:db.prepare('PRAGMA main.user_version').get()!.user_version,
});
export const terminalSchema = (db: Database) => ({
  installed:db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE tbl_name=? ORDER BY type,name').all(terminalTable),
  columns:db.prepare('PRAGMA main.table_info(actual_foul_terminal_applications)').all(),
  indexes:db.prepare('PRAGMA main.index_list(actual_foul_terminal_applications)').all().map(index => ({
    ...index,unique:index.unique,partial:index.partial,origin:index.origin,
    columns:db.prepare('PRAGMA main.index_xinfo("' + String(index.name).replaceAll('"','""') + '")').all() })),
});
export const assertFrozenTerminalSchema = (db: Database) => {
  const rows = db.prepare('SELECT type,sql FROM main.sqlite_master WHERE name=?').all(terminalTable);
  if (rows.length !== 1 || rows[0].type !== 'table' || typeof rows[0].sql !== 'string'
    || compact(rows[0].sql) !== compact(frozenTerminalSql)) throw new Error('frozen terminal schema or constraints differ');
};

/** Only the already admitted retained producer is accepted; no generation or
 * discovery path exists in this acknowledgement controller. */
export const prepareLegacyPendingCopy = () => {
  if (!process.env.BASEBALL_GATE_RUNTIME || !process.env.BASEBALL_GATE_LOCKS) throw new Error('acknowledgement requires private controller runtime envelope');
  const producer = retainedTerminalProducer();
  if (!producer) throw new Error('acknowledgement requires explicit pinned genuine producer control');
  assertClosedTerminalSidecars(producer.sourcePath);
  const directory = mkdtempSync(join(tmpdir(),'terminal-official-acknowledgement-'));
  const path = join(directory,'pending-legacy-check.sqlite');
  console.info('TERMINAL_ACKNOWLEDGEMENT_PRIVATE_ARTIFACT=' + directory);
  copyFileSync(producer.sourcePath,path,constants.COPYFILE_EXCL);
  expect(fileHash(path)).toBe(producer.sourceSha256);
  const db = new DatabaseSync(path);
  try {
    expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(2);
    assertFrozenTerminalSchema(db);
    db.exec('BEGIN IMMEDIATE; PRAGMA user_version=3; COMMIT');
  } finally { db.close(); }
  expect(fileHash(producer.sourcePath)).toBe(producer.sourceSha256);
  return { producer,directory,path };
};

/** Controller-only private-copy rebuild. The caller just created this copy
 * with COPYFILE_EXCL; no production opener invokes this function. */
const extendPrivateTerminalCheck = (db: Database) => {
  assertFrozenTerminalSchema(db);
  const beforeSchema = schemaCensus(db), beforeTerminal = terminalSchema(db), beforeRows = rawCensus(db);
  expect(beforeSchema.userVersion).toBe(3);
  expect(beforeTerminal.installed.filter(row => row.type === 'trigger')).toEqual([]);
  expect(beforeTerminal.indexes).toHaveLength(6);
  expect(beforeTerminal.indexes.every(index => index.unique === 1 && index.partial === 0 && ['pk','u'].includes(String(index.origin)))).toBe(true);
  const rows = db.prepare('SELECT rowid AS __ack_rowid,* FROM main.actual_foul_terminal_applications ORDER BY rowid').all();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DROP TABLE main.actual_foul_terminal_applications');
    db.exec(acknowledgedTerminalSql);
    const insert = db.prepare('INSERT INTO main.actual_foul_terminal_applications(rowid,' + terminalColumns.join(',')
      + ') VALUES(' + Array(terminalColumns.length + 1).fill('?').join(',') + ')');
    for (const row of rows) insert.run(row.__ack_rowid,...terminalColumns.map(column => row[column]));
    expect(rawCensus(db)).toEqual(beforeRows);
    const afterSchema = schemaCensus(db), afterTerminal = terminalSchema(db);
    expect(afterSchema.main.filter(row => row.tbl_name !== terminalTable)).toEqual(beforeSchema.main.filter(row => row.tbl_name !== terminalTable));
    expect(afterSchema.temp).toEqual(beforeSchema.temp); expect(afterSchema.tempVersion).toBe(beforeSchema.tempVersion);
    expect(afterSchema.userVersion).toBe(3);
    expect(afterSchema.mainVersion).toBe(Number(beforeSchema.mainVersion) + 2);
    expect(afterTerminal.columns).toEqual(beforeTerminal.columns); expect(afterTerminal.indexes).toEqual(beforeTerminal.indexes);
    expect(afterTerminal.installed.filter(row => row.type !== 'table')).toEqual(beforeTerminal.installed.filter(row => row.type !== 'table'));
    expect(afterTerminal.installed.filter(row => row.type === 'table')).toHaveLength(1);
    expect(compact(String(afterTerminal.installed.find(row => row.type === 'table')!.sql))).toBe(compact(acknowledgedTerminalSql));
    expect(() => assertFrozenTerminalSchema(db)).toThrow('frozen terminal schema or constraints differ');
    db.exec('COMMIT');
    return { beforeSchema,afterSchema,beforeTerminal,afterTerminal,rawRowsSha256:hash(beforeRows) };
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
};

/** Close the exact live handles that established this pending receipt, record
 * applied-stage lineage, then create a second exclusive copy. This control is
 * specific to this in-process stage and cannot admit a retained applied file. */
export const closePendingAndPrepareAcknowledgementCopy = (input: {
  path:string; directory:string; producer:ProducerReceipt; applied:Applied;
  runner:AcknowledgementRunner; observer:Database; writerConnection:Database;
}) => {
  const { path,directory,producer,applied,runner,observer,writerConnection } = input;
  let runnerClosed = false,observerClosed = false,primary:unknown,bodyFailed = false;
  try {
  const terminal = observer.prepare('SELECT * FROM main.actual_foul_terminal_applications WHERE source_id=?').get(applied.source.sourceId)!;
  const application = observer.prepare('SELECT * FROM main.applications WHERE application_id=?').get(applied.source.applicationId)!;
  const match = observer.prepare('SELECT * FROM main.matches WHERE match_id=?').get(applied.proposal.gameId)!;
  expect(terminal.status).toBe('OFFICIAL_APPLIED_PENDING_POST_PLAY'); expect(terminal.result_json).toBe(json(applied.result));
  expect(application.result_json).toBe(json(applied.result.official));
  expect(match.activation_json).toBe(json({ pendingPostPlay:applied.result.official.pendingPostPlay }));
  expect(match.state_json).toBe(json(applied.result.official.receipt.appliedMatchState));
  expect(match.durable_revision).toBe(applied.result.official.receipt.durableRevision);
  expect(observer.isTransaction).toBe(false); expect(writerConnection.isTransaction).toBe(false);
  const rows = rawCensus(observer), schema = schemaCensus(observer);
  runnerClosed = true; runner.close(); observerClosed = true; observer.close();
  expect(() => writerConnection.prepare('SELECT 1')).toThrow(); expect(() => observer.prepare('SELECT 1')).toThrow();
  assertClosedTerminalSidecars(path);
  const manifestPath = process.env.TERMINAL_PENDING_CUTOVER_INPUT!;
  const control = { version:'owned_terminal_applied_acknowledgement_cutover_v1',
    originalProducerPath:producer.sourcePath,originalProducerSha256:producer.sourceSha256,
    producerControlPath:manifestPath,producerControlSha256:fileHash(manifestPath),
    sourcePath:path,sourceSha256:fileHash(path),sourceId:applied.source.sourceId,
    appliedSha256:hash(applied),mirrors:{ terminal,application,match },rawRowsSha256:hash(rows),schema,
    writerConnectionObservedClosed:true,observerConnectionObservedClosed:true };
  const controlPath = join(directory,'applied-cutover-control.json');
  writeFileSync(controlPath,JSON.stringify(control,null,2),{ flag:'wx' });
  const acknowledgementPath = join(directory,'acknowledgement-check.sqlite');
  copyFileSync(path,acknowledgementPath,constants.COPYFILE_EXCL);
  expect(fileHash(acknowledgementPath)).toBe(control.sourceSha256);
  const copy = new DatabaseSync(acknowledgementPath);
  try {
    expect(rawCensus(copy)).toEqual(rows); expect(schemaCensus(copy)).toEqual(schema);
    const delta = extendPrivateTerminalCheck(copy);
    writeFileSync(join(directory,'acknowledgement-cutover-receipt.json'),JSON.stringify({
      version:'owned_terminal_acknowledgement_check_cutover_v1',controlPath,controlSha256:fileHash(controlPath),
      destinationPath:acknowledgementPath,...delta },null,2),{ flag:'wx' });
  } finally { copy.close(); }
  assertClosedTerminalSidecars(acknowledgementPath);
  expect(fileHash(path)).toBe(control.sourceSha256); expect(fileHash(producer.sourcePath)).toBe(producer.sourceSha256);
  return acknowledgementPath;
  } catch (error) { primary = error; bodyFailed = true; throw error; }
  finally {
    const cleanup:unknown[] = [];
    if (!runnerClosed) { try { runner.close(); } catch (error) { cleanup.push(error); } }
    if (!observerClosed) { try { observer.close(); } catch (error) { cleanup.push(error); } }
    if (cleanup.length) throw new AggregateError(bodyFailed ? [primary,...cleanup] : cleanup,'pending cutover owned-handle cleanup failed');
  }
};

export const terminalRows = (db: Database): Record<string,SQLOutputValue>[] =>
  db.prepare('SELECT rowid AS __ack_rowid,* FROM main.actual_foul_terminal_applications ORDER BY rowid').all();
