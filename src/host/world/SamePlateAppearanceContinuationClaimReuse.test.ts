import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { readSamePaContinuationClaimRows, readSamePaSuccessorWorkClaimRows } from './SamePlateAppearanceContinuationClaimGuard';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { samePaContinuationSchema } from './SamePlateAppearanceContinuationStorage';
import { samePaTakeSuccessorSchema } from './SamePlateAppearanceTakeSuccessorStorage';

const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const databases: DatabaseSync[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } });
const setup = () => {
  const db = new Native(':memory:'); databases.push(db);
  for (const ddl of [...Object.values(samePaContinuationSchema), ...Object.values(samePaTakeSuccessorSchema)]) db.exec(ddl);
  return db;
};
const proof = <T>(db: DatabaseSync, read: () => T): T => {
  db.exec('PRAGMA query_only=1; BEGIN');
  try { return withSamePaContinuationReadPhase(db, read); }
  finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};
const orphan = (db: DatabaseSync) => {
  const columns = db.prepare('PRAGMA table_info(pa_take_successor_v1_action_plans)').all();
  const values = columns.map(c => c.name === 'play_id' ? 1 : ['source_json', 'snapshot_json'].includes(String(c.name)) ? '{}' : 'orphan');
  db.prepare('INSERT INTO pa_take_successor_v1_action_plans VALUES(' + values.map(() => '?').join(',') + ')').run(...values);
};

it('shares a completed Native ownership census across successor and lifecycle coverage reads only within one proof', () => {
  const db = setup(), prepare = db.prepare.bind(db); let censuses = 0;
  vi.spyOn(db, 'prepare').mockImplementation(sql => {
    if (sql === 'SELECT * FROM main."pa_take_successor_v1_action_plans"') censuses++;
    return prepare(sql);
  });
  const read = () => {
    expect(readSamePaSuccessorWorkClaimRows(db, { enrollmentSourceId: 'absent' })).toEqual([]);
    expect(readSamePaContinuationClaimRows(db, 'absent')).toEqual([]);
  };
  proof(db, read); expect(censuses).toBe(1);
  proof(db, read); expect(censuses).toBe(2);
  read(); expect(censuses).toBe(4); // Ordinary mutable callers never borrow the completed census.
});

it('reauthenticates surviving orphan claims inserted between independent proofs', () => {
  const db = setup(), read = () => readSamePaContinuationClaimRows(db, 'absent');
  expect(proof(db, read)).toEqual([]);
  orphan(db);
  expect(() => proof(db, read)).toThrow();
});

it('does not retain a partially inspected census after a caught owner failure', () => {
  const db = setup(); orphan(db);
  expect(() => proof(db, () => {
    expect(() => readSamePaContinuationClaimRows(db, 'absent')).toThrow();
    expect(() => readSamePaSuccessorWorkClaimRows(db, { enrollmentSourceId: 'absent' })).toThrow(/expired/);
  })).toThrow(/expired/);
  db.exec('DELETE FROM pa_take_successor_v1_action_plans');
  expect(proof(db, () => readSamePaContinuationClaimRows(db, 'absent'))).toEqual([]);
});

it('rejects attached owners before a census hit and keeps caught failures expired after detach', () => {
  const db = setup();
  expect(() => proof(db, () => {
    expect(readSamePaContinuationClaimRows(db, 'absent')).toEqual([]);
    db.exec("ATTACH ':memory:' AS other_owner");
    expect(() => readSamePaContinuationClaimRows(db, 'absent')).toThrow(/original main owners/);
    db.exec('DETACH other_owner');
    expect(() => readSamePaContinuationClaimRows(db, 'absent')).toThrow(/expired/);
  })).toThrow(/expired/);
  expect(proof(db, () => readSamePaContinuationClaimRows(db, 'absent'))).toEqual([]);
});
