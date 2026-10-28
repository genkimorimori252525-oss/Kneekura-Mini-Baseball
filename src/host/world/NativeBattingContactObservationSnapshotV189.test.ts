import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createWorldBoundOriginalContactV187 } from './WorldBoundOriginalContactV187.test-support';
import { nativeBattingContactObservationTablesV188 as tables, openSqliteNativeBattingContactObservationStoreV188 as open,
  readNativeBattingContactObservationSnapshotV189FromSqlite as read } from './SqliteNativeBattingContactObservationStoreV188';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope = { careerId: 'career-a', playerId: 'away-1' }, directories: string[] = [], stores: { close(): void }[] = [];
afterEach(() => {
  while (stores.length) stores.pop()!.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('borrowed-observations-v189-')) throw new Error('borrowed observation cleanup escaped its directory');
    rmSync(target, { recursive: true, force: true });
  }
});
const track = <T extends { close(): void }>(value: T): T => { stores.push(value); return value; };
const path = () => { const directory = mkdtempSync(join(tmpdir(), 'borrowed-observations-v189-')); directories.push(directory); return join(directory, 'world.sqlite'); };
const state = (db: InstanceType<typeof DatabaseSync>) => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get()!.query_only,
  changes: db.prepare('SELECT total_changes() n').get()!.n, schemaVersion: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  tempSchemaVersion: db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
  schema: db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all() });
const inSnapshot = <T>(db: InstanceType<typeof DatabaseSync>, body: () => T): T => {
  db.exec('BEGIN'); db.exec('PRAGMA query_only=1');
  try { return body(); } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};
const frozen = (value: unknown): void => { if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen); } };
const expectLossless = (actual: unknown, expected: unknown): void => {
  if (!actual || typeof actual !== 'object' || !expected || typeof expected !== 'object') { expect(Object.is(actual, expected)).toBe(true); return; }
  expect(Array.isArray(actual)).toBe(Array.isArray(expected)); expect(Object.keys(actual)).toStrictEqual(Object.keys(expected));
  for (const key of Object.keys(expected)) expectLossless((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key]);
};
const detached = (actual: unknown, expected: unknown): void => {
  if (!actual || typeof actual !== 'object') return;
  expect(actual).not.toBe(expected);
  for (const key of Object.keys(actual)) detached((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key]);
};

it('BOR189-E01 returns null without installing missing metadata and accepts a fully installed empty namespace', () => {
  const database = path(), db = track(new DatabaseSync(database));
  inSnapshot(db, () => { const before = state(db); expect(read(db, scope)).toBeNull(); expect(state(db)).toStrictEqual(before); });
  track(open(database)).close();
  inSnapshot(db, () => { const before = state(db); expect(read(db, scope)).toBeNull(); expect(state(db)).toStrictEqual(before); });
});

it('BOR189-B01 rejects a structural connection without consulting its methods', () => {
  let calls = 0;
  const fake = { isTransaction: true, prepare() { calls++; throw new Error('fake SQL was called'); } };
  expect(() => read(fake as unknown as InstanceType<typeof DatabaseSync>, scope)).toThrow(/actual Native/); expect(calls).toBe(0);
});

it.each(['no_snapshot', 'write_transaction', 'query_only_without_transaction'] as const)
('BOR189-B02 requires an existing query-only transaction: %s', mode => {
  const db = track(new DatabaseSync(path()));
  if (mode === 'write_transaction') db.exec('BEGIN');
  if (mode === 'query_only_without_transaction') db.exec('PRAGMA query_only=1');
  const before = state(db);
  try { expect(() => read(db, scope)).toThrow(/query-only Native snapshot/); expect(state(db)).toStrictEqual(before); }
  finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
});

it.each(['attached', 'temp_table', 'temp_view'] as const)
('BOR189-B03 rejects non-main authority before the missing-schema null path: %s', mode => {
  const db = track(new DatabaseSync(path()));
  if (mode === 'attached') db.exec("ATTACH ':memory:' AS extra");
  else if (mode === 'temp_table') db.exec(`CREATE TEMP TABLE ${tables.journal}(value TEXT)`);
  else db.exec(`CREATE TEMP VIEW ${tables.head} AS SELECT 'shadow' AS value`);
  inSnapshot(db, () => { const before = state(db); expect(() => read(db, scope)).toThrow(/main-only/); expect(state(db)).toStrictEqual(before); });
});

it.each(['journal', 'head', 'view'] as const)
('BOR189-C01 rejects partial or replaced observation metadata without repair: %s', mode => {
  const db = track(new DatabaseSync(path()));
  if (mode === 'view') db.exec(`CREATE VIEW ${tables.journal} AS SELECT 1 AS value`);
  else db.exec(`CREATE TABLE ${tables[mode]}(value TEXT)`);
  inSnapshot(db, () => { const before = state(db); expect(() => read(db, scope)).toThrow(/journal schema/); expect(state(db)).toStrictEqual(before); });
});

it('BOR189-C02 rejects orphan metadata while preserving caller transaction, savepoint and authorizer after failure', () => {
  const database = path(); track(open(database)).close(); const db = track(new DatabaseSync(database));
  db.prepare(`INSERT INTO main.${tables.head}(career_id,player_id,career_day_one,revision,last_receipt_hash) VALUES(?,?,?,?,?)`)
    .run(scope.careerId, scope.playerId, '2031-01-01', 1, 'a'.repeat(64));
  db.setAuthorizer((code, table) => code === constants.SQLITE_DELETE && table === tables.journal ? constants.SQLITE_DENY : constants.SQLITE_OK);
  try {
    inSnapshot(db, () => {
      db.exec('SAVEPOINT borrowed_failure_caller'); const before = state(db);
      expect(() => read(db, scope)).toThrow(/journal\/head history/); expect(state(db)).toStrictEqual(before);
      expect(read(db, { ...scope, playerId: 'unregistered' })).toBeNull();
      expect(() => db.prepare(`DELETE FROM main.${tables.journal} WHERE 0`)).toThrow(/authorized/i);
      db.exec('RELEASE borrowed_failure_caller'); expect(db.isTransaction).toBe(true);
    });
  } finally { db.setAuthorizer(null); }
});

it('BOR189-N01 borrows a genuine registered Native snapshot losslessly without consuming or owning the caller connection', () => {
  // Explicitly authored physical placement proves the Native reader, not normal AI or a complete batting population.
  const database = path(), fixture = createWorldBoundOriginalContactV187(database), owner = track(open(database));
  const expected = owner.capture(fixture.scope, { careerCalendarEditionId: fixture.careerCalendarEditionId })!; owner.close();
  const db = track(new DatabaseSync(database, { readOnly: true })), inputScope = { ...fixture.scope };
  db.setAuthorizer((code, table) => code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH
    || code === constants.SQLITE_DELETE && table === tables.journal ? constants.SQLITE_DENY : constants.SQLITE_OK);
  try {
    inSnapshot(db, () => {
      db.exec('SAVEPOINT borrowed_success_caller'); const before = state(db), first = read(db, inputScope)!;
      expectLossless(first, expected); frozen(first); expect(state(db)).toStrictEqual(before);
      inputScope.playerId = 'changed-input'; expect(first.scope).toStrictEqual(fixture.scope);
      expect(() => read(db, { ...fixture.scope, playerId: '' })).toThrow(/subject scope/); expect(state(db)).toStrictEqual(before);
      const second = read(db, fixture.scope)!; expectLossless(second, first); detached(second, first);
      const v = fixture.expectedPhysical.contact.exitVelocity, s = fixture.expectedPhysical.contact.exitSpin, bytes = Buffer.alloc(48);
      [v.x, v.y, v.z, s.x, s.y, s.z].forEach((value, index) => bytes.writeDoubleBE(value, index * 8));
      expect(first.receipts[0].measurementBitHash).toBe(createHash('sha256').update(bytes).digest('hex'));
      expectLossless(first.measurements[0].evidence.contact.exitVelocity, v); expectLossless(first.measurements[0].evidence.contact.exitSpin, s);
      expect(state(db)).toStrictEqual(before); expect(() => db.prepare(`DELETE FROM main.${tables.journal} WHERE 0`)).toThrow(/authorized/i);
      db.exec('RELEASE borrowed_success_caller'); expect(db.isTransaction).toBe(true);
    });
    expect(db.prepare('SELECT 1 AS still_open').get()!.still_open).toBe(1); expect(db.isTransaction).toBe(false);
  } finally { db.setAuthorizer(null); }
});
