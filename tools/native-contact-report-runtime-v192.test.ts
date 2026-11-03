import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createWorldBoundOriginalContactsV190 } from '../src/host/world/WorldBoundOriginalContactsV190.test-support';
import { officialPitchWorkloadFixture } from '../src/host/world/OfficialPitchWorkloadFixtures.test-support';
import { nativeBattingContactObservationTablesV188 as observationTables } from '../src/host/world/SqliteNativeBattingContactObservationStoreV188';
import { assertNativeContactReportSubjectV192FromSqlite as subject, readNativeContactReportV192FromSqlite as read,
  collectNativeContactReportObservationsV192 as collect } from './native-contact-report-runtime-v192';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const directories: string[] = [], stores: { close(): void }[] = [], scope = { careerId: 'career-a', playerId: 'away-1' };
afterEach(() => {
  while (stores.length) stores.pop()!.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('native-contact-runtime-v192-')) throw new Error('runtime cleanup escaped its directory');
    rmSync(target, { recursive: true, force: true });
  }
});
const track = <T extends { close(): void }>(value: T): T => { stores.push(value); return value; };
const path = () => { const directory = mkdtempSync(join(tmpdir(), 'native-contact-runtime-v192-')); directories.push(directory); return join(directory, 'world.sqlite'); };
const noModel = (subjectScope = scope) => ({ scope: subjectScope, model: null, policy: null, worldRevision: 0 });
const frozen = (value: unknown): void => { if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen); } };
const emptyPhysicalFixture = () => { const database = path(), fixture = officialPitchWorkloadFixture(true, true, database, true); stores.push({ close: fixture.close }); return { database, fixture }; };
const state = (db: InstanceType<typeof DatabaseSync>) => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get()!.query_only,
  changes: db.prepare('SELECT total_changes() n').get()!.n, schema: db.prepare('PRAGMA main.schema_version').get()!.schema_version });
const readonly = <T>(db: InstanceType<typeof DatabaseSync>, body: () => T): T => {
  db.exec('BEGIN'); db.exec('PRAGMA query_only=1');
  try { return body(); } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};
const physicalHash = (db: InstanceType<typeof DatabaseSync>) => {
  const excluded = Object.values(observationTables), catalog = db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all()
    .filter(row => !excluded.includes(String(row.tbl_name) as typeof excluded[number]));
  const tables = catalog.filter(row => row.type === 'table').map(row => {
    const name = String(row.name).replaceAll('"', '""'); return [row.name, db.prepare(`SELECT * FROM main."${name}"`).all()];
  });
  return createHash('sha256').update(JSON.stringify({ catalog, tables })).digest('hex');
};
const metadataTables = (db: InstanceType<typeof DatabaseSync>) => db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name IN (?,?) ORDER BY name")
  .all(observationTables.journal, observationTables.head).map(row => row.name);

it('NCR192-N01 collects true Native contacts idempotently and exports no default measurement model', () => {
  const database = path(), fixture = createWorldBoundOriginalContactsV190(database), db = track(new DatabaseSync(database));
  const physicalBefore = physicalHash(db), input = { scope: { ...fixture.scope }, careerCalendarEditionId: fixture.careerCalendarEditionId };
  const first = collect(database, input); expect(first.boundary).toBe('NATIVE_CONTACT_OBSERVATION_COLLECTION_ONLY');
  expect(first.registeredReferenceCount).toBe(2); expect(first.inventoryHash).toMatch(/^[0-9a-f]{64}$/);
  expect(first.source?.owner).toBe('BATTING_CONTACT'); expect(first.source?.revision).toBe(2); frozen(first);
  input.scope.playerId = 'changed-input'; expect(first.scope).toEqual(fixture.scope);
  const second = collect(database, { scope: fixture.scope, careerCalendarEditionId: fixture.careerCalendarEditionId });
  expect(second).toStrictEqual(first); expect(second.source).not.toBe(first.source); expect(second.scope).not.toBe(first.scope);
  const beforeRead = state(db), report = read(db, noModel(fixture.scope));
  expect(report).toMatchObject({ status: 'UNAVAILABLE', reasons: ['NO_MEASUREMENT_MODEL'], source: first.source,
    sampleCount: null, episodeCount: null, evidenceSpanDays: null, lineDriveFraction: null, model: null,
    modelCalibration: 'UNCONFIRMED', physicsEffects: 'NONE' });
  frozen(report); expect(state(db)).toStrictEqual(beforeRead); expect(physicalHash(db)).toBe(physicalBefore);
});

it('NCR192-N02 recognizes a normal roster-backed person without actors or contact as unregistered', () => {
  const { database, fixture } = emptyPhysicalFixture(), db = fixture.db;
  expect(db.prepare("SELECT name FROM main.sqlite_master WHERE name IN ('physical_pitch_progress_actions','physical_plate_appearance_actors')").all()).toEqual([]);
  readonly(db, () => { const link = subject(db, scope); expect(link.playerId).toBe(scope.playerId); expect(link.personId).toBe('person-away-1'); frozen(link); });
  const physicalBefore = physicalHash(db), report = read(db, noModel());
  expect(report).toMatchObject({ status: 'UNAVAILABLE', reasons: ['NO_REGISTERED_CONTACTS'], source: null, sampleCount: null, episodeCount: null });
  expect(metadataTables(db)).toEqual([]);
  expect(collect(database, { scope })).toStrictEqual({ boundary: 'NATIVE_CONTACT_OBSERVATION_COLLECTION_ONLY', scope,
    registeredReferenceCount: 0, source: null, inventoryHash: null });
  expect(physicalHash(db)).toBe(physicalBefore);
});

it.each([{ ...scope, playerId: 'unknown-player' }, { ...scope, careerId: 'unknown-career' }])
('NCR192-B01 rejects an unknown subject before creating observation storage: %j', unknownScope => {
  const { database, fixture } = emptyPhysicalFixture(), db = fixture.db, before = physicalHash(db);
  expect(() => read(db, noModel(unknownScope))).toThrow(/subject/);
  expect(() => collect(database, { scope: unknownScope })).toThrow(/subject/);
  expect(metadataTables(db)).toEqual([]); expect(physicalHash(db)).toBe(before);
});

it.each(['row', 'source', 'roster'] as const)
('NCR192-C01 delegates link and roster corruption to the normal Owner: %s', corruption => {
  const { database, fixture } = emptyPhysicalFixture(), db = fixture.db;
  if (corruption === 'row') db.prepare("UPDATE main.world_player_person_links SET person_id='forged-person' WHERE career_id=? AND player_id=?").run(scope.careerId, scope.playerId);
  else if (corruption === 'source') db.prepare("UPDATE main.world_player_person_links SET source_json='{}' WHERE career_id=? AND player_id=?").run(scope.careerId, scope.playerId);
  else db.prepare("UPDATE main.world_roster_heads SET roster_json='{}' WHERE career_id=?").run(scope.careerId);
  const before = physicalHash(db);
  expect(() => read(db, noModel())).toThrow(); expect(() => collect(database, { scope })).toThrow();
  expect(metadataTables(db)).toEqual([]); expect(physicalHash(db)).toBe(before);
});

it.each(['missing', 'view', 'ambiguous'] as const)
('NCR192-C02 rejects missing, replaced or ambiguous subject namespaces: %s', mode => {
  const { database, fixture } = emptyPhysicalFixture(), db = fixture.db;
  db.exec('ALTER TABLE main.world_player_person_links RENAME TO preserved_person_links');
  if (mode === 'view') db.exec('CREATE VIEW world_player_person_links AS SELECT * FROM preserved_person_links');
  if (mode === 'ambiguous') {
    db.exec('CREATE TABLE world_player_person_links AS SELECT * FROM preserved_person_links');
    db.prepare('INSERT INTO world_player_person_links SELECT * FROM preserved_person_links WHERE career_id=? AND player_id=?').run(scope.careerId, scope.playerId);
  }
  const before = physicalHash(db);
  expect(() => read(db, noModel())).toThrow(/subject/); expect(() => collect(database, { scope })).toThrow(/subject/);
  expect(metadataTables(db)).toEqual([]); expect(physicalHash(db)).toBe(before);
});

it('NCR192-B02 rejects nonexistent and non-file paths without creating a database', () => {
  const database = path(), directory = directories.at(-1)!;
  expect(() => collect(database, { scope })).toThrow(); expect(existsSync(database)).toBe(false);
  expect(() => collect(directory, { scope })).toThrow(/regular file/); expect(existsSync(database)).toBe(false);
});

it('NCR192-B03 requires a real query-only borrowed snapshot for the subject reader', () => {
  const db = track(new DatabaseSync(path())); let called = false;
  const fake = { isTransaction: true, prepare() { called = true; throw new Error('fake SQL'); } };
  expect(() => subject(fake as unknown as InstanceType<typeof DatabaseSync>, scope)).toThrow(/actual Native/); expect(called).toBe(false);
  const before = state(db); expect(() => subject(db, scope)).toThrow(/query-only Native snapshot/); expect(state(db)).toStrictEqual(before);
  db.exec('BEGIN'); const txBefore = state(db);
  try { expect(() => subject(db, scope)).toThrow(/query-only Native snapshot/); expect(state(db)).toStrictEqual(txBefore); }
  finally { db.exec('ROLLBACK'); }
});

it.each(['attached', 'temp'] as const)('NCR192-B04 rejects attached and TEMP authority: %s', mode => {
  const db = track(new DatabaseSync(path()));
  if (mode === 'attached') db.exec("ATTACH ':memory:' AS extra"); else db.exec('CREATE TEMP TABLE world_player_person_links(source_id TEXT)');
  const before = state(db); expect(() => read(db, noModel())).toThrow(/main-only/); expect(state(db)).toStrictEqual(before);
});

it('NCR192-N03 keeps caller transaction, savepoint and authorizer after both valid and failed report reads', () => {
  const { fixture } = emptyPhysicalFixture(), db = fixture.db;
  db.setAuthorizer((code, table) => code === constants.SQLITE_DELETE && table === 'world_player_person_links' ? constants.SQLITE_DENY : constants.SQLITE_OK);
  try {
    readonly(db, () => {
      db.exec('SAVEPOINT ncr192_caller'); const before = state(db);
      expect(read(db, noModel()).reasons).toEqual(['NO_REGISTERED_CONTACTS']);
      expect(() => read(db, noModel({ ...scope, playerId: 'unknown' }))).toThrow(/subject/); expect(state(db)).toStrictEqual(before);
      expect(() => db.prepare('DELETE FROM main.world_player_person_links WHERE 0')).toThrow(/authorized/i);
      db.exec('RELEASE ncr192_caller'); expect(db.isTransaction).toBe(true);
    });
  } finally { db.setAuthorizer(null); }
});

it('NCR192-C03 documents the Owner DDL boundary while failed capture rolls back all receipt/head rows', () => {
  const database = path(), fixture = createWorldBoundOriginalContactsV190(database), db = track(new DatabaseSync(database));
  const before = physicalHash(db); expect(metadataTables(db)).toEqual([]);
  expect(() => collect(database, { scope: fixture.scope, careerCalendarEditionId: 'missing-formal-edition' })).toThrow();
  expect(metadataTables(db)).toHaveLength(2);
  for (const name of Object.values(observationTables)) expect(db.prepare(`SELECT count(*) n FROM main.${name}`).get()!.n).toBe(0);
  expect(physicalHash(db)).toBe(before);
});

it.each([{ scope, model: null, policy: null, worldRevision: -1 }, { ...noModel(), extra: true }, { ...noModel(), model: undefined }])
('NCR192-B05 rejects invalid small report input before deriving a no-contact report: %j', input => {
  const { fixture } = emptyPhysicalFixture(); expect(() => read(fixture.db, input as Parameters<typeof read>[1])).toThrow();
});
