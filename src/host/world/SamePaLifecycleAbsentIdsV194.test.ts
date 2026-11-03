import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it } from 'vitest';
import { samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { readSamePaLifecycleSetFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

const { DatabaseSync: Native, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const connections: DatabaseSync[] = [];
const claims = 'pa_v194_claims';
const owners = { calibration: 'pa_lifecycle_v1_execution_calibrations', total: 'pa_lifecycle_v1_total_assessments' } as const;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Real Native SQLite and the exact regular storage schema. All inserted rows
 * below are metadata-only absence/corruption fixtures, never accepted physics. */
const fixture = (installed = true) => {
  const db = new Native(':memory:'); connections.push(db);
  if (installed) db.exec(Object.values(samePaLifecycleSchema).join(';'));
  db.exec(`CREATE TABLE ${claims}(source_id TEXT PRIMARY KEY,source_json TEXT NOT NULL,snapshot_json TEXT NOT NULL)`);
  return db;
};
afterEach(() => { for (const db of connections.splice(0).reverse()) { db.setAuthorizer(null); if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } });
const read = (db: DatabaseSync, kind: 'total' | 'calibration', ids: readonly string[]) =>
  withBattedVenueLegalReadSnapshot(db, () => readSamePaLifecycleSetFromSqlite(db, kind, ids));
const claim = (db: DatabaseSync, id: string, source: unknown, snapshot: unknown = {}) =>
  db.prepare(`INSERT INTO ${claims} VALUES(?,?,?)`).run(id, JSON.stringify(source), JSON.stringify(snapshot));
const reference = (kind: keyof typeof owners, sourceId: string) => ({ owner: owners[kind], sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const invalidMetadataRow = (db: DatabaseSync, owner: string, id: string,
  source: unknown = { sourceId: id, capability: 'invalid-metadata-only-v194' }, snapshot: unknown = { source: { sourceId: id } }) => {
  const columns = db.prepare(`PRAGMA main.table_info(${owner})`).all();
  const values = columns.map(column => column.name === 'source_id' ? id : column.name === 'source_json' ? JSON.stringify(source)
    : column.name === 'snapshot_json' ? JSON.stringify(snapshot) : column.name === 'source_hash' ? hash(source)
      : column.name === 'snapshot_hash' ? hash(snapshot) : column.type === 'INTEGER' ? 0 : id + ':' + column.name);
  db.prepare(`INSERT INTO ${owner} VALUES(${columns.map(() => '?').join(',')})`).run(...values);
};

it('LCA194-P01 does not repeat the typed-ref JSON census once per absent batch ID', () => {
  const db = fixture(); claim(db, 'unrelated', { nested: { owner: 'another_owner', sourceId: 'other' } });
  const measure = (ids: readonly string[]) => {
    const counts = { sourceJsonReads: 0, snapshotJsonReads: 0, catalogNameReads: 0 };
    db.setAuthorizer((code, table, column, database) => {
      if (code === constants.SQLITE_READ && database === 'main') {
        if (table === claims && column === 'source_json') counts.sourceJsonReads++;
        if (table === claims && column === 'snapshot_json') counts.snapshotJsonReads++;
        if (table === 'sqlite_master' && column === 'name') counts.catalogNameReads++;
      }
      return constants.SQLITE_OK;
    });
    try { expect(read(db, 'calibration', ids)).toStrictEqual(ids.map(() => null)); }
    finally { db.setAuthorizer(null); }
    return counts;
  };
  const one = measure(['absent:one']), batch = measure(Array.from({ length: 32 }, (_, i) => 'absent:' + (31 - i)));
  console.info('LCA194-P01 Native SQL preparation observations', JSON.stringify({ one, batch }));
  expect(one.sourceJsonReads).toBeGreaterThan(0); expect(one.snapshotJsonReads).toBeGreaterThan(0);
  expect(batch.sourceJsonReads).toBeGreaterThan(0); expect(batch.snapshotJsonReads).toBeGreaterThan(0);
  // Catalog totals also include each identity's unchanged schema/index proof;
  // they are reported above, not constrained as an absence-only operation.
  expect(batch.sourceJsonReads).toBeLessThanOrEqual(one.sourceJsonReads);
  expect(batch.snapshotJsonReads).toBeLessThanOrEqual(one.snapshotJsonReads);
});

it.each(['total', 'calibration'] as const)('LCA194-A01 retains every absent %s position including duplicates', kind => {
  const db = fixture();
  const ids = ['absent:z', 'absent:a', 'absent:z', 'absent:b', 'absent:a'];
  const input = [...ids];
  expect(read(db, kind, ids)).toStrictEqual([null, null, null, null, null]); expect(ids).toStrictEqual(input);
  expect(read(db, kind, [])).toStrictEqual([]);
});

it.each(['source', 'snapshot'] as const)('LCA194-A02 rejects a deleted owner still claimed in the %s JSON mirror', mirror => {
  const db = fixture(), ref = reference('calibration', 'deleted-owner');
  claim(db, 'survivor', mirror === 'source' ? { deep: [ref] } : {}, mirror === 'snapshot' ? { source: { deep: [ref] } } : {});
  expect(() => read(db, 'calibration', ['unclaimed', ref.sourceId])).toThrow(/owner missing with surviving typed claims/);
});

it('LCA194-A03 rejects surviving typed claims when the complete lifecycle namespace is absent', () => {
  const db = fixture(false), ref = reference('total', 'missing-namespace-owner'); claim(db, 'survivor', { ref });
  expect(() => read(db, 'total', [ref.sourceId, 'unclaimed'])).toThrow(/owner missing with surviving typed claims/);
});

it('LCA194-A04 requires owner and textual sourceId in the same JSON object', () => {
  const db = fixture(), id = 'not-a-typed-claim';
  claim(db, 'nonclaims', { a: { owner: owners.calibration }, b: { sourceId: id } }, [
    { owner: 'another_owner', sourceId: id }, { owner: owners.calibration, sourceId: 12 }, JSON.stringify(reference('calibration', id)),
  ]);
  expect(read(db, 'calibration', [id, '12'])).toStrictEqual([null, null]);
});

it.each(['source', 'snapshot'] as const)('LCA194-A05 rejects an indexed owner moved under another ID through the %s mirror', mirror => {
  const db = fixture(), id = 'requested-owner', moved = 'moved-indexed-owner';
  invalidMetadataRow(db, owners.calibration, moved, { sourceId: mirror === 'source' ? id : moved }, { source: { sourceId: mirror === 'snapshot' ? id : moved } });
  expect(() => read(db, 'calibration', [id])).toThrow(/identity alias differs/);
});

it('LCA194-A06 rejects a row moved to a different lifecycle owner table', () => {
  const db = fixture(), id = 'moved-owner-table'; invalidMetadataRow(db, owners.total, id);
  expect(() => read(db, 'calibration', [id])).toThrow(/identity alias differs/);
});

it('LCA194-A07 rejects multiple lifecycle metadata claims for one requested identity', () => {
  const db = fixture(), id = 'multiply-claimed';
  invalidMetadataRow(db, owners.calibration, 'alias-one', { sourceId: id });
  invalidMetadataRow(db, owners.total, 'alias-two', { sourceId: id });
  expect(() => read(db, 'calibration', [id])).toThrow(/identity alias differs/);
});

it.each(['extra-index', 'missing-table'] as const)('LCA194-A08 preserves exact storage authentication for %s', change => {
  const db = fixture();
  db.exec(change === 'extra-index' ? `CREATE INDEX v194_extra ON ${owners.calibration}(player_id)` : `DROP TABLE ${owners.total}`);
  expect(() => read(db, 'calibration', ['absent'])).toThrow(/storage is partial or malformed/);
});

it('LCA194-A09 does not hide an existing malformed record among absent IDs', () => {
  const db = fixture(); invalidMetadataRow(db, owners.calibration, 'existing-corrupt');
  expect(() => read(db, 'calibration', ['absent:first', 'existing-corrupt', 'absent:last'])).toThrow(/invalid.*lifecycle.*Source/i);
});

it('LCA194-A10 preserves the first rejection in caller order across existing and absent identities', () => {
  const db = fixture(), orphan = reference('calibration', 'orphan');
  invalidMetadataRow(db, owners.calibration, 'existing-corrupt'); claim(db, 'survivor', { orphan });
  expect(() => read(db, 'calibration', ['existing-corrupt', orphan.sourceId])).toThrow(/invalid.*lifecycle.*Source/i);
  expect(() => read(db, 'calibration', [orphan.sourceId, 'existing-corrupt'])).toThrow(/owner missing with surviving typed claims/);
});

it('LCA194-A11 rechecks typed claims in a later snapshot instead of retaining prior absence', () => {
  const db = fixture(), ref = reference('calibration', 'later-claim');
  expect(read(db, 'calibration', [ref.sourceId, ref.sourceId])).toStrictEqual([null, null]);
  claim(db, 'new-survivor', {}, { nested: ref });
  expect(() => read(db, 'calibration', [ref.sourceId, 'unclaimed'])).toThrow(/owner missing with surviving typed claims/);
});

it('LCA194-A12 preserves the caller read transaction, savepoint, authorizer and rows after rejection', () => {
  const db = fixture(), ref = reference('calibration', 'orphan'); claim(db, 'survivor', { ref });
  const before = db.prepare('SELECT total_changes() n').get()!.n;
  db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v194');
  db.setAuthorizer((code, table) => code === constants.SQLITE_DELETE && table === claims ? constants.SQLITE_DENY : constants.SQLITE_OK);
  expect(() => read(db, 'calibration', [ref.sourceId, 'another'])).toThrow(/owner missing with surviving typed claims/);
  expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
  expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before);
  expect(() => db.prepare(`DELETE FROM ${claims} WHERE 0`)).toThrow(/not authorized/);
  db.exec('ROLLBACK TO caller_v194; RELEASE caller_v194; ROLLBACK');
});

it('LCA194-A13 rejects an earlier orphan before a later claim table READ denied by the Native authorizer', () => {
  const db = fixture(), ref = reference('calibration', 'first-absent-orphan');
  claim(db, 'early-survivor', { ref });
  const later = 'batting_v194_later_claims';
  db.exec(`CREATE TABLE ${later}(source_json TEXT NOT NULL,snapshot_json TEXT NOT NULL)`);
  db.prepare(`INSERT INTO ${later} VALUES(?,?)`).run('{}', '{}');
  let laterDeniedReads = 0;
  db.setAuthorizer((code, table, column, database) => {
    if (code === constants.SQLITE_READ && database === 'main' && table === later && column === 'source_json') {
      laterDeniedReads++; return constants.SQLITE_DENY;
    }
    return constants.SQLITE_OK;
  });
  expect(() => read(db, 'calibration', [ref.sourceId, 'second-absent'])).toThrow(/owner missing with surviving typed claims/);
  expect(laterDeniedReads).toBe(0);
});

it('LCA194-A14 preserves a sparse absent-ID array without visiting or filling its hole', () => {
  const db = fixture(), ids = new Array<string>(3), expected = new Array<null>(3);
  ids[0] = 'sparse:first'; ids[2] = 'sparse:last'; expected[0] = null; expected[2] = null;
  const result = read(db, 'calibration', ids);
  expect(result).toStrictEqual(expected); expect(result).toHaveLength(3);
  expect(Object.hasOwn(result, 1)).toBe(false); expect(Object.hasOwn(ids, 1)).toBe(false);
  expect(ids[0]).toBe('sparse:first'); expect(ids[2]).toBe('sparse:last');
});

it('LCA194-A15 preserves the public reader result for 33 valid absent IDs', () => {
  const db = fixture(), ids = Array.from({ length: 33 }, (_, i) => 'above32:' + (32 - i)), input = [...ids];
  expect(read(db, 'calibration', ids)).toStrictEqual(Array.from({ length: 33 }, () => null));
  expect(ids).toStrictEqual(input);
});

it('LCA194-A16 retains Native-bound orphan rejection for a lone high surrogate ID', () => {
  const db = fixture(), requestedId = '\ud800', ref = reference('calibration', '\ufffd');
  claim(db, 'replacement-character-survivor', { ref });
  expect(() => read(db, 'calibration', [requestedId, 'another-absent'])).toThrow(/owner missing with surviving typed claims/);
});

const expectUnsupportedMirrorFallback = (db: DatabaseSync, table: string, orphanId: string) => {
  const observe = (ids: readonly string[], rejects: boolean) => {
    const counts = { sourceJsonReads: 0, snapshotJsonReads: 0 };
    db.setAuthorizer((code, name, column, database) => {
      if (code === constants.SQLITE_READ && database === 'main' && name === table) {
        if (column === 'source_json') counts.sourceJsonReads++;
        if (column === 'snapshot_json') counts.snapshotJsonReads++;
      }
      return constants.SQLITE_OK;
    });
    try {
      if (rejects) expect(() => read(db, 'calibration', ids)).toThrow(/owner missing with surviving typed claims/);
      else expect(read(db, 'calibration', ids)).toStrictEqual(ids.map(() => null));
    } finally { db.setAuthorizer(null); }
    return counts;
  };
  const one = observe(['unsupported:unclaimed'], false);
  const batch = observe(['unsupported:unclaimed', orphanId], true);
  const laterBatch = observe(['unsupported:unclaimed', orphanId], true);
  console.info('LCA194 unsupported mirror Native SQL preparation observations', JSON.stringify({ table, one, batch, laterBatch }));
  expect(one.sourceJsonReads).toBeGreaterThan(0); expect(one.snapshotJsonReads).toBeGreaterThan(0);
  expect(batch.sourceJsonReads).toBeGreaterThan(one.sourceJsonReads);
  expect(batch.snapshotJsonReads).toBeGreaterThan(one.snapshotJsonReads);
  expect(laterBatch).toStrictEqual(batch);
};

it('LCA194-A17 retains per-ID Native scanning for ordinary BLOB JSON mirrors', () => {
  const db = fixture(), table = 'pa_v194_blob_claims', ref = reference('calibration', 'blob:later-orphan');
  db.exec(`CREATE TABLE ${table}(source_json BLOB NOT NULL,snapshot_json BLOB NOT NULL)`);
  db.prepare(`INSERT INTO ${table} VALUES(?,?)`).run(Buffer.from('{}'), Buffer.from(JSON.stringify({ ref })));
  expectUnsupportedMirrorFallback(db, table, ref.sourceId);
});

it('LCA194-A18 retains per-ID Native scanning for available FTS5 virtual JSON mirrors', context => {
  const db = fixture(), table = 'pa_v194_fts_claims', ref = reference('calibration', 'fts:later-orphan');
  try { db.exec(`CREATE VIRTUAL TABLE ${table} USING fts5(source_json,snapshot_json)`); }
  catch (error) {
    if (!/no such module: fts5/i.test(String(error))) throw error;
    console.info('LCA194-A18 skipped: this Native SQLite runtime has no fts5 module:', String(error));
    context.skip(); return;
  }
  db.prepare(`INSERT INTO ${table}(source_json,snapshot_json) VALUES(?,?)`).run('{}', JSON.stringify({ ref }));
  expectUnsupportedMirrorFallback(db, table, ref.sourceId);
});
