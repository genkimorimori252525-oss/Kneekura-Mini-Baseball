import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { assertSamePaAssessmentProvenanceV129 } from './SamePaAssessmentProvenanceV129';
import { battingAssessmentOwners } from './BattingAssessmentOwnership';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

type Mode = 'all' | 'provenance-only';
type Expected = Readonly<{ table: string; sourceId: string }>;
// Invoke the actual helper with the planned fifth argument. The baseline JS
// ignores it, producing a semantic RED rather than a missing export/import.
const assert = assertSamePaAssessmentProvenanceV129 as (db: DatabaseSync, id: string, expected: Expected, message?: string, mode?: Mode) => void;
const tables = [...battingAssessmentOwners, 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations',
  'pa_dispatch_v1_execution_calibrations', 'reserved_pa_total_assessments', 'actual_role_workload_assessments',
  'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_calibrations'];
const table = tables[0], expected = { table, sourceId: 'owner-a' }, message = 'V130 original assessment ownership conflict';
function fixture() {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(':memory:');
  for (const name of tables) db.exec(`CREATE TABLE ${name}(source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
  return db;
}
const phase = <T>(db: DatabaseSync, body: () => T): T => {
  db.exec('BEGIN'); db.exec('PRAGMA query_only=1');
  try { return withSamePaContinuationReadPhase(db, body); }
  finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};
const insert = (db: DatabaseSync, owner: string, id: string, source = '{}', snapshot = '{}') =>
  db.prepare(`INSERT INTO ${owner} VALUES(?,?,?)`).run(id, source, snapshot);
const check = (db: DatabaseSync, id: string, own: Expected, mode: Mode) => assert(db, id, own, message, mode);
const legacy = (db: DatabaseSync, id: string, mode: Mode) => db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id
  ${mode === 'all' ? `OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}` : ''}
  OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')}
  OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`).all({ id });

it.each(['source', 'snapshot'] as const)('permits a foreign %s sourceId-only claim under the original three conditions, while default/all retain five-condition rejection', mirror => {
  const db = fixture(), id = 'source-only-assessment';
  try {
    insert(db, table, 'foreign-row', mirror === 'source' ? '{"sourceId":"source-only-assessment"}' : '{}',
      mirror === 'snapshot' ? '{"source":{"sourceId":"source-only-assessment"}}' : '{}');
    expect(legacy(db, id, 'provenance-only')).toEqual([]);
    expect(legacy(db, id, 'all').map(row => row.source_id)).toEqual(['foreign-row']);
    expect(() => phase(db, () => check(db, id, expected, 'provenance-only'))).not.toThrow();
    expect(() => phase(db, () => check(db, id, expected, 'all'))).toThrow(message);
    expect(() => phase(db, () => assertSamePaAssessmentProvenanceV129(db, id, expected, message))).toThrow(message);
  } finally { db.close(); }
});

it.each(['canonical', 'source provenance', 'snapshot provenance'] as const)('rejects a foreign %s claim under both modes and preserves the original error message', path => {
  const db = fixture(), id = 'conflicting-assessment';
  try {
    insert(db, table, path === 'canonical' ? id : 'foreign-row', path === 'source provenance'
      ? '{"provenance":{"assessmentSourceId":"conflicting-assessment"}}' : '{}', path === 'snapshot provenance'
      ? '{"source":{"provenance":{"assessmentSourceId":"conflicting-assessment"}}}' : '{}');
    for (const mode of ['all', 'provenance-only'] as const) {
      expect(legacy(db, id, mode)).toHaveLength(1);
      expect(() => phase(db, () => check(db, id, expected, mode))).toThrow(message);
    }
  } finally { db.close(); }
});

it('shares one ordinary-TEXT projection per table across different IDs and modes, then reauthenticates a new phase', () => {
  const db = fixture(), original = db.prepare, own = Object.getOwnPropertyDescriptor(db, 'prepare');
  const scans = new Map<string, number>();
  try {
    insert(db, table, 'owner-a', '{"provenance":{"assessmentSourceId":"assessment-a"}}');
    insert(db, tables[1], 'owner-b', '{"sourceId":"source-only","provenance":{"assessmentSourceId":"assessment-b"}}');
    Object.defineProperty(db, 'prepare', { configurable: true, writable: true, value(sql: string) {
      const statement = original.call(db, sql), name = sql.startsWith('SELECT source_id') && sql.includes('metadata_claims_0')
        ? /\bFROM main\.([a-z0-9_]+)/.exec(sql)?.[1] : undefined;
      if (name && tables.includes(name)) {
        const all = statement.all.bind(statement);
        statement.all = ((...args: Parameters<typeof statement.all>) => { scans.set(name, (scans.get(name) ?? 0) + 1); return all(...args); }) as typeof statement.all;
      }
      return statement;
    } });
    const counts = () => tables.map(name => scans.get(name) ?? 0);
    phase(db, () => {
      withSamePaLifecycleReadPhase(db, () => check(db, 'assessment-a', expected, 'all'));
      expect(counts()).toEqual(tables.map(() => 1));
      withSamePaLifecycleReadPhase(db, () => check(db, 'assessment-b', { table: tables[1], sourceId: 'owner-b' }, 'provenance-only'));
      check(db, 'unclaimed', expected, 'provenance-only');
      check(db, 'source-only', { table: tables[1], sourceId: 'owner-b' }, 'all');
      expect(counts()).toEqual(tables.map(() => 1));
    });
    phase(db, () => check(db, 'assessment-a', expected, 'provenance-only'));
    expect(counts()).toEqual(tables.map(() => 2));
  } finally {
    if (own) Object.defineProperty(db, 'prepare', own); else Reflect.deleteProperty(db, 'prepare');
    db.close();
  }
});

it.each(['generated', 'untyped', 'view'] as const)('preserves mode-specific legacy SQL on a noneligible %s fallback and poisons a caught conflict', kind => {
  const db = fixture(); let payload = '{"sourceId":"fallback-source-only"}';
  try {
    db.exec('DROP TABLE ' + table);
    if (kind === 'untyped') {
      db.exec(`CREATE TABLE ${table}(source_id,source_json,snapshot_json)`);
      insert(db, table, 'foreign-row', payload);
    } else {
      db.function('v130_claim_payload', { deterministic: true }, () => payload);
      if (kind === 'generated') {
        db.exec(`CREATE TABLE ${table}(source_id TEXT,source_json TEXT GENERATED ALWAYS AS(v130_claim_payload()) VIRTUAL,snapshot_json TEXT)`);
        db.prepare(`INSERT INTO ${table}(source_id,snapshot_json) VALUES(?,?)`).run('foreign-row', '{}');
      } else db.exec(`CREATE VIEW ${table} AS SELECT 'foreign-row' AS source_id,v130_claim_payload() AS source_json,'{}' AS snapshot_json`);
    }
    expect(legacy(db, 'fallback-source-only', 'provenance-only')).toEqual([]);
    expect(legacy(db, 'fallback-source-only', 'all')).toHaveLength(1);
    expect(() => phase(db, () => check(db, 'fallback-source-only', expected, 'provenance-only'))).not.toThrow();
    expect(() => phase(db, () => check(db, 'fallback-source-only', expected, 'all'))).toThrow(message);
    payload = '{"provenance":{"assessmentSourceId":"fallback-conflict"}}';
    if (kind === 'untyped') db.prepare(`UPDATE ${table} SET source_json=?`).run(payload);
    let conflict: unknown, retry: unknown;
    expect(() => phase(db, () => {
      try { check(db, 'fallback-conflict', expected, 'provenance-only'); } catch (error) { conflict = error; }
      try { check(db, 'unclaimed-after-conflict', expected, 'all'); } catch (error) { retry = error; }
    })).toThrow(/phase expired/);
    expect(String(conflict)).toContain(message); expect(String(retry)).toMatch(/phase expired/);
  } finally { db.close(); }
});
