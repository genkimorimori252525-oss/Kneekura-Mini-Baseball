import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it } from 'vitest';
import { samePaLifecycleSchema } from '../../src/host/world/SamePlateAppearanceLifecycleStorage';
import { collectScalarLifecycleIdentityCandidatesV201 as scalar, collectBatchLifecycleIdentityCandidatesV201 as batch,
  assertLifecycleIdentityExperimentStorageV201 as storage } from './native-lifecycle-identity-batch-v201';

const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const tables = ['pa_lifecycle_v1_work_prefixes', 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_views', 'pa_lifecycle_v1_execution_calibrations'] as const;
const opened: DatabaseSync[] = [];
const fixture = () => { const db = new Native(':memory:'); opened.push(db); db.exec(Object.values(samePaLifecycleSchema).join(';')); expect(storage(db)).toBe(true); return db; };
afterEach(() => { for (const db of opened.splice(0)) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } });
const put = (db: DatabaseSync, table: keyof typeof samePaLifecycleSchema, id: string, source = JSON.stringify({ sourceId: id }), snapshot = JSON.stringify({ source: { sourceId: id } }), rowid?: string) => {
  const columns = db.prepare(`PRAGMA main.table_info(${table})`).all();
  const values = columns.map(column => column.name === 'source_id' ? id : column.name === 'source_json' ? source : column.name === 'snapshot_json' ? snapshot
    : column.type === 'INTEGER' ? 0 : id + ':' + String(column.name));
  db.prepare(`INSERT INTO ${table}(${rowid ? 'rowid,' : ''}${columns.map(c => c.name).join(',')}) VALUES(${Array.from({ length: values.length + (rowid ? 1 : 0) }, () => '?').join(',')})`)
    .run(...(rowid ? [BigInt(rowid), ...values] : values));
};
const equivalent = (db: DatabaseSync, kind: Parameters<typeof scalar>[1], ids: readonly string[]) => {
  const old = scalar(db, kind, ids), next = batch(db, kind, ids); expect(next.requests).toStrictEqual(old.requests); return next;
};

it('LIB201-01 returns complete literal rows and exact rowids without authenticating them', () => {
  const db = fixture(); put(db, tables[1], 'one', undefined, undefined, '9007199254740993'); put(db, tables[1], 'two');
  const result = equivalent(db, 'total', ['one', 'two']); expect(result.mode).toBe('NATIVE_POSITION_BATCH');
  expect(result.normalOwnerProof).toBe(false); expect(result.requests.map(r => r.aliasReject)).toStrictEqual([false, false]);
  expect(result.requests[0].candidates[0].rowid).toBe('9007199254740993');
  expect(result.requests[0].candidates[0].row).toStrictEqual({ ...db.prepare(`SELECT * FROM ${tables[1]} WHERE source_id=?`).get('one') });
});

it.each(['source', 'snapshot'] as const)('LIB201-02 preserves duplicate and escaped identity keys in %s mirror', mirror => {
  const db = fixture(), source = '{"sourceId":"other","source\\u0049d":"target"}', snapshot = '{"source":{"sourceId":"other"},"source":{"sourceId":"target"}}';
  put(db, tables[1], 'alias', mirror === 'source' ? source : '{}', mirror === 'snapshot' ? snapshot : '{}');
  const result = equivalent(db, 'total', ['target', 'other']);
  expect(result.requests.map(r => r.candidates.map(c => c.row.source_id))).toStrictEqual([['alias'], ['alias']]);
  expect(result.requests.every(r => r.aliasReject)).toBe(true);
});

it('LIB201-03 rejects aliases across all four tables and duplicate direct-plus-mirror claims', () => {
  const db = fixture(); for (const table of tables) put(db, table, 'shared');
  put(db, tables[1], 'fifth', '{"sourceId":"shared"}', '{"source":{"sourceId":"shared"}}');
  const result = equivalent(db, 'total', ['shared', 'missing']);
  expect(result.requests[0].candidates).toHaveLength(5); expect(result.requests[0].aliasReject).toBe(true);
  expect(result.requests[1].missingFallbackRequired).toBe(true);
});

it('LIB201-04 retains Native replacement binding and original-string alias decisions per position', () => {
  const db = fixture(); put(db, tables[1], '\ufffd');
  const result = equivalent(db, 'total', ['\ud800', '\ufffd', '\ud800']);
  expect(result.requests.map(r => r.candidates.length)).toStrictEqual([1, 1, 1]);
  expect(result.requests.map(r => r.aliasReject)).toStrictEqual([true, false, true]);
});

it('LIB201-05 ignores malformed or mistyped JSON claims and retains direct malformed rows', () => {
  const db = fixture(); put(db, tables[1], 'malformed', '{', '{'); put(db, tables[1], 'numeric', '{"sourceId":7}', '{"source":{"sourceId":7}}');
  const result = equivalent(db, 'total', ['malformed', '7', 'missing']);
  expect(result.requests.map(r => r.candidates.length)).toStrictEqual([1, 0, 0]);
  expect(result.requests.map(r => r.missingFallbackRequired)).toStrictEqual([false, true, true]);
});

it('LIB201-06 keeps missing surviving-claim checks outside this candidate-only experiment', () => {
  const db = fixture(); db.exec('CREATE TABLE pa_lib201_descendant(source_json TEXT,snapshot_json TEXT)');
  db.prepare('INSERT INTO pa_lib201_descendant VALUES(?,?)').run(JSON.stringify({ ref: { owner: tables[1], sourceId: 'orphan' } }), '{}');
  const result = equivalent(db, 'total', ['orphan', 'unclaimed']);
  expect(result.requests.every(r => r.missingFallbackRequired && !r.aliasReject)).toBe(true); expect(result.normalOwnerProof).toBe(false);
});

it('LIB201-07 preserves empty, sparse, oversized and unsupported caller inputs through fresh scalar fallback', () => {
  const db = fixture(), sparse = new Array<string>(3); sparse[0] = 'first'; sparse[2] = 'last';
  for (const ids of [[], [''], [' one ', 'two'], sparse, Array.from({ length: 33 }, (_, i) => 'id:' + i)]) {
    const result = equivalent(db, 'total', ids); expect(result.mode).toBe('LEGACY_SCALAR');
    if (ids === sparse) expect(Object.hasOwn(result.requests, 1)).toBe(false);
  }
  expect(equivalent(db, 'prefix', ['first', 'second']).mode).toBe('LEGACY_SCALAR');
});

it('LIB201-08 prepares fresh SQL after mutation and preserves caller readonly/savepoint state', () => {
  const db = fixture(); put(db, tables[1], 'mutable', '{"sourceId":"first"}', '{}');
  expect(equivalent(db, 'total', ['first', 'second']).requests.map(r => r.candidates.length)).toStrictEqual([1, 0]);
  db.prepare(`UPDATE ${tables[1]} SET source_json=? WHERE source_id=?`).run('{"sourceId":"second"}', 'mutable');
  db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_lib201');
  const state = () => ({ transaction: db.isTransaction, q: db.prepare('PRAGMA query_only').get()!.query_only, changes: db.prepare('SELECT total_changes() n').get()!.n });
  const before = state(); expect(equivalent(db, 'total', ['first', 'second']).requests.map(r => r.candidates.length)).toStrictEqual([0, 1]);
  expect(state()).toStrictEqual(before); db.exec('ROLLBACK TO caller_lib201; RELEASE caller_lib201; ROLLBACK');
});

it.each([
  { kind: 'total', target: 'pa_lifecycle_v1_total_assessments', claimant: 'pa_lifecycle_v1_outcomes', mirror: 'source' },
  { kind: 'calibration', target: 'pa_lifecycle_v1_execution_calibrations', claimant: 'pa_lifecycle_v1_resets', mirror: 'snapshot' },
] as const)('LIB201-09 rejects $claimant $mirror mirror alias against $kind identity', ({ kind, target, claimant, mirror }) => {
  const db = fixture(), id = 'six-table-' + kind;
  put(db, target, id);
  put(db, claimant, 'alias-' + kind, mirror === 'source' ? JSON.stringify({ sourceId: id }) : '{}',
    mirror === 'snapshot' ? JSON.stringify({ source: { sourceId: id } }) : '{}');
  const result = equivalent(db, kind, [id, 'unclaimed']);
  expect(result.mode).toBe('NATIVE_POSITION_BATCH');
  expect(result.requests[0].candidates.map(candidate => candidate.table)).toContain(target);
  expect(result.requests[0].candidates.map(candidate => candidate.table)).toContain(claimant);
  expect(result.requests[0].candidates).toHaveLength(2); expect(result.requests[0].aliasReject).toBe(true);
  expect(result.requests[1].missingFallbackRequired).toBe(true); expect(result.normalOwnerProof).toBe(false);
});
