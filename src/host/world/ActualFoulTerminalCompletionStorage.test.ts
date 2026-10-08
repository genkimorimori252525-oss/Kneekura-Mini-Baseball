import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as evidence from './ActualFoulTerminalApplicationEvidenceFromSqlite';

// Synthetic storage/malformed-stage tests only. No original or completed
// effects are manufactured or accepted by these rows.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const completionSql = evidence.foulTerminalAcknowledgementTableSql.replace(
  "OR (status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' AND result_json IS NOT NULL)))",
  "OR (status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' AND result_json IS NOT NULL)\n    OR (status='POST_PLAY_COMPLETED_CONTINUING' AND result_json IS NOT NULL)))");
const assertStorage = evidence.assertFoulTerminalApplicationStorage as
  (db: InstanceType<typeof DatabaseSync>, required?: 'acknowledgement' | 'completion') => boolean;
const withSchema = (sql: string | null, body: (db: InstanceType<typeof DatabaseSync>) => void) => {
  const db = new DatabaseSync(':memory:');
  try { if (sql) db.exec(sql); body(db); } finally { db.close(); }
};
it('CP-S01 exports the exact completion CHECK while preserving all prior arms', () => {
  expect((evidence as unknown as Record<string, unknown>).foulTerminalCompletionTableSql,
    'COMPLETION_SCHEMA_EXPORT_MISSING').toBe(completionSql);
});
it('CP-S02 completion capability supports default acknowledgement and completion admission without writes', () => withSchema(completionSql, db => {
  const before = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
  const changes = db.prepare('SELECT total_changes() AS n').get();
  for (const required of [undefined, 'acknowledgement', 'completion'] as const) expect(assertStorage(db, required)).toBe(true);
  expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
  expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
}));
it('CP-S03 completion requirement excludes both legacy and acknowledgement schemas', () => {
  for (const sql of [evidence.foulTerminalApplicationTableSql, evidence.foulTerminalAcknowledgementTableSql]) {
    withSchema(sql, db => expect(() => assertStorage(db, 'completion'), 'COMPLETION_PREREQUISITE_MISSING').toThrow(/completion.*prerequisite/));
  }
});
it('CP-S04 admitted completion storage grants neither public nor immutable completed evidence', () => withSchema(completionSql, db => {
  db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    'terminal','game',7,'apply','pitch','end','child','POST_PLAY_COMPLETED_CONTINUING','{}','bad','{}','bad','{}');
  const before = db.prepare('SELECT total_changes() AS n').get();
  for (const reader of [evidence.foulTerminalApplicationEvidenceFromSqlite, evidence.foulTerminalAcknowledgementAncestryFromSqlite]) {
    expect(() => reader(db).read('terminal')).toThrow('invalid accepted foul terminal application Source');
  }
  expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
}));
it('CP-S05 absent storage remains absent for every capability', () => withSchema(null, db => {
  for (const required of [undefined, 'acknowledgement', 'completion'] as const) expect(assertStorage(db, required)).toBe(false);
  expect(db.prepare('SELECT * FROM sqlite_master').all()).toEqual([]);
}));
it('CP-S06 rejects altered CHECK literals nullability and surplus capability arms', () => {
  for (const sql of [completionSql.replace('COMPLETED_CONTINUING', 'COMPLETED_ CONTINUING'),
    completionSql.replace("status='POST_PLAY_COMPLETED_CONTINUING' AND result_json IS NOT NULL", "status='POST_PLAY_COMPLETED_CONTINUING' AND result_json IS NULL"),
    completionSql.replace("status='QUEUED'", "status IN ('QUEUED','UNREQUESTED')")]) {
    withSchema(sql, db => { for (const required of [undefined, 'acknowledgement', 'completion'] as const)
      expect(() => assertStorage(db, required)).toThrow(/schema|constraints/); });
  }
});
it('CP-S07 completion CHECK enforces each preserved status and result nullability', () => withSchema(completionSql, db => {
  const insert = (status: string, result: string | null) => db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    'terminal','game',7,'apply','pitch','end','child',status,'{}','bad','{}','bad',result);
  for (const status of ['QUEUED','OFFICIAL_APPLIED_PENDING_POST_PLAY','OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY','POST_PLAY_COMPLETED_CONTINUING']) {
    const result = status === 'QUEUED' ? null : '{}';
    insert(status,result); db.exec('DELETE FROM actual_foul_terminal_applications');
    expect(() => insert(status,result === null ? '{}' : null)).toThrow(/CHECK/);
  }
  expect(() => insert('UNSUPPORTED','{}')).toThrow(/CHECK/);
}));
