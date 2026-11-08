import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { readSamePaLifecycleSetFromSqlite as readSet, withSamePaLifecycleReadPhase as phase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaLifecycleTables as tables } from './SamePlateAppearanceLifecycle';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaLifecycleIdentityCandidatesV202 as candidates } from './SamePaLifecycleIdentityCandidatesV202';
import * as metadata from './SqliteMetadataStatementScope';

const { DatabaseSync: Native, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const opened: DatabaseSync[] = [];
const fixture = () => { const db = new Native(':memory:'); opened.push(db); db.exec(Object.values(samePaLifecycleSchema).join(';')); return db; };
afterEach(() => { vi.restoreAllMocks(); for (const db of opened.splice(0)) { db.setAuthorizer(null); if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } });
const put = (db: DatabaseSync, table: keyof typeof samePaLifecycleSchema, id: string, source = JSON.stringify({ sourceId: id }), snapshot = JSON.stringify({ source: { sourceId: id } }), huge = false) => {
  const columns = db.prepare(`PRAGMA main.table_info(${table})`).all();
  const values = columns.map(column => column.name === 'source_id' ? id : column.name === 'source_json' ? source : column.name === 'snapshot_json' ? snapshot
    : column.type === 'INTEGER' ? huge ? 9007199254740993n : 0 : id + ':' + String(column.name));
  db.prepare(`INSERT INTO ${table} VALUES(${columns.map(() => '?').join(',')})`).run(...values);
};
const scalar = (db: DatabaseSync, id: string) => Object.values(tables).flatMap(table => metadata.sqliteMetadataClaimRows(db,
  `SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`, id).map(row => ({ table, row })));
const readonly = (db: DatabaseSync) => db.exec('PRAGMA query_only=1; BEGIN');

it('LIC202-P01 retains normal missing results without per-ID scalar candidate scans', () => {
  const db = fixture(); db.exec('PRAGMA query_only=1; BEGIN');
  const scalarQueries = vi.spyOn(metadata, 'sqliteMetadataClaimRows');
  expect(readSet(db, 'total', ['not-present:first', 'not-present:second'])).toStrictEqual([null, null]);
  expect(scalarQueries.mock.calls.filter(([, sql]) => sql.startsWith('SELECT * FROM main.pa_lifecycle_v1_'))).toHaveLength(0);
});

it('LIC202-C01 matches every scalar row across six owners, both mirrors and duplicate decoded paths', () => {
  const db = fixture();
  for (const [index, table] of Object.values(tables).entries()) put(db, table, 'alias:' + index,
    index % 2 ? '{}' : '{"sourceId":"other","source\\u0049d":"target"}',
    index % 2 ? '{"source":{"sourceId":"other"},"source":{"sourceId":"target"}}' : '{}');
  const group = candidates(db, 'total', ['target', 'other', 'missing'])!;
  expect(group.read('target')).toStrictEqual(scalar(db, 'target')); expect(group.read('target')).toHaveLength(6);
  expect(group.read('other')).toStrictEqual(scalar(db, 'other')); expect(group.read('missing')).toStrictEqual([]); group.clear();
  expect(() => group.read('target')).toThrow(/scope expired/);
});

it('LIC202-C02 uses Native match positions for surrogate replacement and duplicate input strings', () => {
  const db = fixture(); put(db, tables.total, '\ufffd');
  const group = candidates(db, 'total', ['\ud800', '\ufffd', '\ud800'])!;
  expect(group.read('\ud800')).toStrictEqual(scalar(db, '\ud800')); expect(group.read('\ufffd')).toStrictEqual(scalar(db, '\ufffd'));
  readonly(db); expect(() => readSet(db, 'total', ['\ud800', 'missing'])).toThrow(/identity alias differs/);
});

it('LIC202-C03 ignores malformed and mistyped JSON candidates but keeps direct row claims', () => {
  const db = fixture(); put(db, tables.total, 'broken', '{', '{'); put(db, tables.total, 'numeric', '{"sourceId":7}', '{"source":{"sourceId":7}}');
  const group = candidates(db, 'total', ['broken', '7', 'missing'])!;
  for (const id of ['broken', '7', 'missing']) expect(group.read(id)).toStrictEqual(scalar(db, id));
  expect(group.read('broken')).toHaveLength(1); expect(group.read('7')).toStrictEqual([]);
});

it.each(['outcome', 'reset'] as const)('LIC202-A01 normal TOTAL reader rejects a %s mirror claiming its id', kind => {
  const db = fixture(); put(db, tables[kind], 'alias', '{"sourceId":"target"}', '{}'); readonly(db);
  expect(() => readSet(db, 'total', ['target', 'missing'])).toThrow(/identity alias differs/);
});

it('LIC202-A02 normal reader rejects two claims before attempting normal Source parsing', () => {
  const db = fixture(); put(db, tables.total, 'target', '{', '{'); put(db, tables.view, 'alias', '{}', '{"source":{"sourceId":"target"}}'); readonly(db);
  expect(() => readSet(db, 'total', ['target', 'missing'])).toThrow(/identity alias differs/);
});

it('LIC202-O01 defers a later out-of-range INTEGER until the current malformed Source is rejected', () => {
  const db = fixture(); put(db, tables.total, 'first', '{', '{}'); put(db, tables.total, 'later', undefined, undefined, true); readonly(db);
  expect(() => readSet(db, 'total', ['first', 'later'])).toThrow(SyntaxError);
});

it('LIC202-O02 retains an earlier surviving-claim rejection before a later descendant authorizer denial', () => {
  const db = fixture(); db.exec('CREATE TABLE pa_lic202_early(source_json TEXT,snapshot_json TEXT); CREATE TABLE batting_lic202_later(source_json TEXT,snapshot_json TEXT)');
  db.prepare('INSERT INTO pa_lic202_early VALUES(?,?)').run(JSON.stringify({ ref: { owner: tables.total, sourceId: 'orphan' } }), '{}');
  let denied = 0; readonly(db); db.setAuthorizer((code, table, column) => {
    if (code === constants.SQLITE_READ && table === 'batting_lic202_later' && column === 'source_json') { denied++; return constants.SQLITE_DENY; }
    return constants.SQLITE_OK;
  });
  expect(() => readSet(db, 'total', ['orphan', 'missing'])).toThrow(/owner missing with surviving typed claims/); expect(denied).toBe(0);
});

it('LIC202-F01 falls back only when the caller denies the additional hidden ROWID read', () => {
  const db = fixture(); let denied = 0; readonly(db);
  db.setAuthorizer((code, table, column) => {
    if (code === constants.SQLITE_READ && table?.startsWith('pa_lifecycle_v1_') && column?.toLowerCase() === 'rowid') { denied++; return constants.SQLITE_DENY; }
    return constants.SQLITE_OK;
  });
  expect(readSet(db, 'total', ['missing:first', 'missing:second'])).toStrictEqual([null, null]); expect(denied).toBeGreaterThan(0);
  expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
});

it('LIC202-F02 propagates a source_json authorization denial without a scalar retry', () => {
  const db = fixture(); readonly(db); const old = vi.spyOn(metadata, 'sqliteMetadataClaimRows');
  db.setAuthorizer((code, table, column) => code === constants.SQLITE_READ && table === tables.total && column === 'source_json' ? constants.SQLITE_DENY : constants.SQLITE_OK);
  expect(() => readSet(db, 'total', ['missing:first', 'missing:second'])).toThrow(/source_json.*prohibited/);
  expect(old).not.toHaveBeenCalled();
});

it('LIC202-F03 leaves sparse, empty, oversized and unsupported kinds on the original scalar path', () => {
  const db = fixture(); readonly(db); const sparse = new Array<string>(3), expected = new Array<null>(3); sparse[0] = 'first'; sparse[2] = 'last'; expected[0] = null; expected[2] = null;
  expect(readSet(db, 'total', sparse)).toStrictEqual(expected); expect(readSet(db, 'total', [])).toStrictEqual([]);
  expect(readSet(db, 'total', Array.from({ length: 33 }, (_, index) => 'id:' + index))).toStrictEqual(Array.from({ length: 33 }, () => null));
  expect(candidates(db, 'total', sparse)).toBe(null); expect(candidates(db, 'total', [''])).toBe(null);
  expect(candidates(db, 'prefix' as 'total', ['first', 'second'])).toBe(null);
});

it.each(['matched_0', 'rowid'] as const)('LIC202-S01 rejects unexpected %s columns through the unchanged schema guard', column => {
  const db = fixture(); db.exec(`ALTER TABLE ${tables.total} ADD COLUMN ${column} TEXT`); readonly(db);
  expect(() => readSet(db, 'total', ['first', 'second'])).toThrow(/storage is partial or malformed/);
});

it('LIC202-S02 rejects an extra index before candidate collection', () => {
  const db = fixture(); db.exec(`CREATE INDEX lic202_extra ON ${tables.total}(player_id)`); readonly(db);
  expect(() => readSet(db, 'total', ['first', 'second'])).toThrow(/storage is partial or malformed/);
});

it('LIC202-T01 preserves caller savepoint, query_only, authorizer and total changes', () => {
  const db = fixture(); readonly(db); db.exec('SAVEPOINT caller_lic202');
  db.setAuthorizer(code => code === constants.SQLITE_ATTACH ? constants.SQLITE_DENY : constants.SQLITE_OK);
  const before = db.prepare('SELECT total_changes() n').get()!.n;
  expect(readSet(db, 'calibration', ['first', 'second'])).toStrictEqual([null, null]);
  expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1); expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before);
  expect(() => db.prepare("ATTACH DATABASE ':memory:' AS denied_lic202")).toThrow(/not authorized/);
  db.exec('ROLLBACK TO caller_lic202; RELEASE caller_lic202; ROLLBACK');
});

it('LIC202-T02 expires the enclosing proof after DML and rollback even when rows and query_only are restored', () => {
  const db = fixture(); readonly(db);
  expect(() => phase(db, () => {
    expect(readSet(db, 'total', ['first', 'second'])).toStrictEqual([null, null]);
    db.exec('PRAGMA query_only=0; SAVEPOINT mutation_lic202'); put(db, tables.total, 'first');
    db.exec('ROLLBACK TO mutation_lic202; RELEASE mutation_lic202; PRAGMA query_only=1');
    expect(db.prepare(`SELECT count(*) n FROM ${tables.total}`).get()!.n).toBe(0);
    expect(() => readSet(db, 'total', ['first', 'second'])).toThrow(/differs|expired/);
  })).toThrow(/differs|expired/);
});

it('LIC202-T03 discards completed candidate cohorts before a later phase reads changed rows', () => {
  const db = fixture(); readonly(db);
  expect(readSet(db, 'total', ['first', 'second'])).toStrictEqual([null, null]);
  db.exec('PRAGMA query_only=0'); put(db, tables.outcome, 'new-alias', '{"sourceId":"first"}', '{}'); db.exec('PRAGMA query_only=1');
  expect(() => readSet(db, 'total', ['first', 'second'])).toThrow(/identity alias differs/);
});

it('LIC202-F04 observes the actual Native ROWID authorization error identity', () => {
  const db = fixture(); readonly(db);
  db.setAuthorizer((code, table, column) => code === constants.SQLITE_READ && table === tables.total && column?.toLowerCase() === 'rowid' ? constants.SQLITE_DENY : constants.SQLITE_OK);
  let failure: unknown;
  try { db.prepare(`SELECT CAST(rowid AS TEXT) FROM ${tables.total}`).all(); } catch (error) { failure = error; }
  expect(failure).toMatchObject({ code: 'ERR_SQLITE_ERROR', errcode: 23 });
  expect(String((failure as Error).message)).toMatch(/access to .*\.ROWID is prohibited/i);
  console.info('LIC202 Native authorization identity', JSON.stringify({ code: (failure as { code: string }).code,
    errcode: (failure as { errcode: number }).errcode, message: (failure as Error).message }));
});

it.each(['generic', 'non-auth-sqlite'] as const)('LIC202-F05 propagates a same-message %s failure without fallback', form => {
  const failure = Object.assign(new Error('access to pa_lifecycle_v1_total_assessments.ROWID is prohibited'),
    form === 'generic' ? {} : { code: 'ERR_SQLITE_ERROR', errcode: 1 });
  const group = candidates({ prepare() { throw failure; } }, 'total', ['first', 'second'])!;
  expect(() => group.read('first')).toThrow(failure);
});

it('LIC202-F06 keeps singleton selection and absence on the original scalar path', () => {
  const db = fixture(); readonly(db); const old = vi.spyOn(metadata, 'sqliteMetadataClaimRows');
  expect(candidates(db, 'total', ['single'])).toBe(null);
  expect(readSet(db, 'total', ['single'])).toStrictEqual([null]);
  expect(old.mock.calls.filter(([, sql]) => sql.startsWith('SELECT * FROM main.pa_lifecycle_v1_'))).toHaveLength(6);
});
