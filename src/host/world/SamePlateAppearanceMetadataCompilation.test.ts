import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { readSamePaLifecycleClaimRows } from './SamePlateAppearanceLifecycleClaimGuard';
import { withSamePaContinuationReadPhase as phase } from './SamePlateAppearanceContinuationFromSqlite';
import { sqliteMetadataAll } from './SqliteMetadataStatementScope';
import { sqliteJsonMetadataNodes } from './SqliteOwnershipMetadata';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('compiles lifecycle metadata once per Native proof while executing each original document and preserving hidden claims', () => {
  const db = new DatabaseSync(':memory:');
  // Structural metadata fixture only. No complete player, TAKE or lifecycle
  // authority is substituted for a production owner in this mechanics test.
  const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
  const source = { sourceId: 'prefix', sourceVersion: 'fixture-v1', capability: 'same_pa_lifecycle_prefix_v1',
    enrollmentReference: ref('same_pa_enrollments', 'root'), anchorViewReference: ref('pa_continuation_v1_execution_views', 'anchor'),
    eventReferences: [ref('pa_take_successor_v1_pitch_actions', 'take')] };
  for (const ddl of Object.values(samePaLifecycleSchema)) db.exec(ddl);
  for (const [table, id] of [['pa_continuation_v1_execution_views', 'anchor'], ['pa_take_successor_v1_pitch_actions', 'take']]) {
    db.exec(`CREATE TABLE ${table}(source_id TEXT,enrollment_source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
    const original = { enrollmentReference: ref('same_pa_enrollments', 'root') };
    db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?)`).run(id, 'root', json(original), json({ source: original }));
  }
  const snapshot = { source }, columns = db.prepare('PRAGMA table_info(pa_lifecycle_v1_work_prefixes)').all();
  const values = columns.map(c => c.name === 'source_id' ? 'prefix' : c.name === 'source_version' ? 'fixture-v1'
    : c.name === 'play_id' ? 1 : c.name === 'enrollment_source_id' ? 'root' : c.name === 'source_json' ? json(source)
    : c.name === 'snapshot_json' ? json(snapshot) : c.name === 'source_hash' ? hash(source) : c.name === 'snapshot_hash' ? hash(snapshot) : 'fixture');
  db.prepare('INSERT INTO pa_lifecycle_v1_work_prefixes VALUES(' + values.map(() => '?').join(',') + ')').run(...values);
  const prepare = db.prepare, compiles = new Map<string, number>(), executions = new Map<string, number>();
  db.prepare = function(sql, ...options) {
    const statement = prepare.call(this, sql, ...options);
    if (sql.includes('$document')) {
      compiles.set(sql, (compiles.get(sql) ?? 0) + 1);
      const all = statement.all;
      statement.all = function(...args) { executions.set(sql, (executions.get(sql) ?? 0) + 1); return Reflect.apply(all, this, args); };
    }
    return statement;
  };
  try {
    db.exec('PRAGMA query_only=1; BEGIN');
    phase(db, () => {
      const first = readSamePaLifecycleClaimRows(db);
      expect(first.map(r => r.enrollmentSourceIds)).toEqual([['root']]);
      expect(readSamePaLifecycleClaimRows(db)).toEqual(first);
    });
    expect(compiles.size).toBeGreaterThan(0);
    expect([...compiles.values()].every(n => n === 1)).toBe(true);
    expect([...executions.values()].every(n => n > 1)).toBe(true);
    db.exec('COMMIT; PRAGMA query_only=0');
    db.prepare('UPDATE pa_continuation_v1_execution_views SET snapshot_json=?').run('{"source":{"enrollmentReference":{"sourceId":"root"},"enrollmentReferenc\\u0065":{"sourceId":"foreign"}}}');
    db.exec('PRAGMA query_only=1; BEGIN');
    expect(phase(db, () => readSamePaLifecycleClaimRows(db)[0].enrollmentSourceIds)).toEqual(['foreign', 'root']);
    expect([...compiles.values()].every(n => n === 2)).toBe(true);
  } finally { db.prepare = prepare; if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('disposes metadata compilation with failed or replaced continuation transactions', () => {
  const db = new DatabaseSync(':memory:'), prepare = db.prepare;
  const sql = `SELECT atom FROM (${sqliteJsonMetadataNodes('$document', ['sourceId'])}) WHERE type='text'`;
  let compiles = 0;
  db.prepare = function(query, ...options) { if (query === sql) compiles++; return prepare.call(this, query, ...options); };
  const read = () => sqliteMetadataAll(db, sql, '{"sourceId":"first","source\\u0049d":"second"}').map(r => r.atom);
  try {
    db.exec('PRAGMA query_only=1; BEGIN');
    expect(() => phase(db, () => { expect(read()).toEqual(['first', 'second']); throw new Error('abort'); })).toThrow('abort');
    expect(phase(db, read)).toEqual(['first', 'second']); expect(compiles).toBe(2);
    expect(() => phase(db, () => { read(); db.exec('COMMIT; BEGIN'); read(); })).toThrow();
    expect(phase(db, read)).toEqual(['first', 'second']); expect(compiles).toBe(4);
  } finally { db.prepare = prepare; if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});
