import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { assertSamePaAssessmentProvenanceV129 as assert } from './SamePaAssessmentProvenanceV129';
import { battingAssessmentOwners } from './BattingAssessmentOwnership';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

const tables = [...battingAssessmentOwners, 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations',
  'pa_dispatch_v1_execution_calibrations', 'reserved_pa_total_assessments', 'actual_role_workload_assessments',
  'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_calibrations'];
const first = tables[0], second = tables[1];
const expected = { table: first, sourceId: 'owner-a' };

// Primitive metadata only: no Actor, admitted assessment or behavioral Source
// is fabricated. All reads and mutations use this actual Native connection.
function fixture(options: { untypedLast?: boolean } = {}) {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(':memory:');
  for (const table of tables) db.exec(`CREATE TABLE ${table}(source_id ${options.untypedLast && table === tables.at(-1) ? '' : 'TEXT COLLATE NOCASE'},source_json TEXT,snapshot_json TEXT)`);
  return db;
}
const phase = <T>(db: DatabaseSync, body: () => T): T => {
  db.exec('BEGIN'); db.exec('PRAGMA query_only=1');
  try { return withSamePaContinuationReadPhase(db, body); }
  finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};
const insert = (db: DatabaseSync, table: string, id: string, source: string, snapshot = '{}') =>
  db.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run(id, source, snapshot);

function probe<T>(db: DatabaseSync, body: (p: { counts(): number[]; failNext(table: string): void }) => T): T {
  const original = db.prepare, own = Object.getOwnPropertyDescriptor(db, 'prepare');
  const counts = new Map<string, number>(); let failedTable: string | undefined;
  Object.defineProperty(db, 'prepare', { configurable: true, writable: true, value: function(sql: string) {
    // Count only the expensive typed JSON scan. The canonical-only indexed
    // source_id comparison remains fresh under SQLite affinity/collation.
    const typedScan = /^SELECT source_id\b/.test(sql) && (sql.includes('EXISTS') || sql.includes('metadata_claims_0'));
    const statement = original.call(db, sql), table = typedScan ? /\bFROM main\.([a-z0-9_]+)/.exec(sql)?.[1] : undefined;
    if (table && tables.includes(table)) {
      const all = statement.all.bind(statement);
      statement.all = ((...args: Parameters<typeof statement.all>) => {
        counts.set(table, (counts.get(table) ?? 0) + 1);
        if (failedTable === table) { failedTable = undefined; throw new Error('injected assessment census SQL failure'); }
        return all(...args);
      }) as typeof statement.all;
    }
    return statement;
  } });
  try { return body({ counts: () => tables.map(t => counts.get(t) ?? 0), failNext: table => { failedTable = table; } }); }
  finally { if (own) Object.defineProperty(db, 'prepare', own); else Reflect.deleteProperty(db, 'prepare'); }
}

it('shares one primitive census per table across sibling different-ID reads, then reruns every table in a new phase', () => {
  const db = fixture();
  try {
    insert(db, first, 'owner-a', '{"provenance":{"assessmentSourceId":"assessment-a"}}');
    insert(db, second, 'owner-b', '{"provenance":{"assessmentSourceId":"assessment-b"}}');
    probe(db, p => {
      phase(db, () => {
        withSamePaLifecycleReadPhase(db, () => assert(db, 'assessment-a', expected));
        expect(p.counts()).toEqual(tables.map(() => 1));
        withSamePaLifecycleReadPhase(db, () => assert(db, 'assessment-b', { table: second, sourceId: 'owner-b' }));
        assert(db, 'unclaimed-assessment', expected);
        expect(p.counts()).toEqual(tables.map(() => 1));
      });
      phase(db, () => assert(db, 'assessment-a', expected));
      expect(p.counts()).toEqual(tables.map(() => 2));
    });
  } finally { db.close(); }
});

it('matches all five original SQL identity conditions including escaped duplicates and text-only JSON claims', () => {
  const db = fixture({ untypedLast: true });
  try {
    insert(db, first, 'owner-a', '{"sourceId":"source-a","provenance":{"assessmentSourceId":"assessment-a"}}',
      '{"source":{"sourceId":"snapshot-a","provenance":{"assessmentSourceId":"snapshot-assessment-a"}}}');
    insert(db, first, 'escaped-owner', '{"provenance":{"assessmentSourceId":"escaped-first","assessmentSource\\u0049d":"escaped-second"}}');
    insert(db, first, 'duplicate-provenance', '{"provenance":{"assessmentSourceId":"duplicate-first"},"proven\\u0061nce":{"assessmentSourceId":"duplicate-second"}}');
    insert(db, first, 'number-owner', '{"sourceId":42,"provenance":{"assessmentSourceId":42}}', '{"source":{"sourceId":42,"provenance":{"assessmentSourceId":42}}}');
    insert(db, first, 'array-owner', '{"sourceId":["array-hidden"],"provenance":[{"assessmentSourceId":"array-hidden"}]}');
    insert(db, first, 'invalid-json-owner', '{invalid', 'null');
    insert(db, first, 'unicode-owner', '{"sourceId":"日本語","source\\u0049d":"😀","provenance":{"assessmentSourceId":"nul\\u0000tail","assessmentSource\\u0049d":"\\ud800"}}',
      '{"source":{"sourceId":"\\udfff","provenance":{"assessmentSourceId":"pair\\ud83d\\ude00"}}}');
    insert(db, second, 'replacement-owner', '{"sourceId":"�"}');
    db.prepare(`INSERT INTO ${tables.at(-1)} VALUES(?,?,?)`).run(42, '{}', '{}');
    db.prepare(`INSERT INTO ${second} VALUES(?,?,?)`).run(new Uint8Array([111, 119, 110]), '{"provenance":{"assessmentSourceId":"blob-claim"}}', '{}');
    insert(db, second, 'foreign-owner', '{"provenance":{"assessmentSourceId":"assessment-a"}}');
    insert(db, first, 'other-owner', '{"sourceId":"source-a"}');
    // A duplicate claim inside the expected row is legal under the original OR
    // query; duplicate rows/foreign owners must retain their original rejection.
    const cases = [
      ['owner-a', expected], ['OWNER-A', expected], ['source-a', expected], ['snapshot-a', expected], ['assessment-a', expected], ['snapshot-assessment-a', expected],
      ['escaped-first', { table: first, sourceId: 'escaped-owner' }], ['escaped-second', { table: first, sourceId: 'escaped-owner' }],
      ['duplicate-first', { table: first, sourceId: 'duplicate-provenance' }], ['duplicate-second', { table: first, sourceId: 'duplicate-provenance' }],
      ['42', expected], ['array-hidden', expected], ['null', expected], ['true', expected], ['absent', expected],
      ['blob-claim', { table: second, sourceId: '111,119,110' }],
      ...['日本語', '😀', 'nul\u0000tail', '\ud800', '\udfff', '�', 'pair😀'].map(id => [id, { table: first, sourceId: 'unicode-owner' }] as const),
    ] as const;
    for (const [id, own] of cases) {
      const originalRejects = tables.some(table => db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
        OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')} OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')}
        OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`).all({ id })
        .some(row => table !== own.table || row.source_id !== own.sourceId));
      if (originalRejects) expect(() => phase(db, () => assert(db, id, own))).toThrow(/ownership/);
      else expect(() => phase(db, () => assert(db, id, own))).not.toThrow();
    }
  } finally { db.close(); }
});

it.each(['DML', 'schema', 'namespace'] as const)('expires an empty census after %s, even if the failed read is caught', fault => {
  const db = fixture(); let failure: unknown, retry: unknown;
  try {
    expect(() => phase(db, () => {
      assert(db, 'empty-first', expected);
      if (fault === 'namespace') db.exec("ATTACH DATABASE ':memory:' AS unrelated_assessment_owner");
      else {
        db.exec('PRAGMA query_only=0');
        if (fault === 'DML') insert(db, second, 'foreign', '{"provenance":{"assessmentSourceId":"empty-first"}}');
        else db.exec('CREATE TABLE changed_assessment_schema(n INTEGER)');
        db.exec('PRAGMA query_only=1');
      }
      try { assert(db, 'empty-second', expected); } catch (error) { failure = error; }
      try { assert(db, 'empty-first', expected); } catch (error) { retry = error; }
    })).toThrow();
    expect(failure).toBeInstanceOf(Error); expect(String(retry)).toMatch(/phase expired/);
    if (fault === 'namespace') db.exec('DETACH DATABASE unrelated_assessment_owner');
    expect(() => phase(db, () => assert(db, 'empty-first', expected))).not.toThrow();
  } finally { db.close(); }
});

it.each(['SQL', 'ownership', 'mutable-read'] as const)('poisons caught %s failures without reviving completed metadata', fault => {
  const db = fixture(); let failure: unknown, retry: unknown;
  try {
    insert(db, first, 'owner-a', '{"provenance":{"assessmentSourceId":"assessment-a"}}');
    probe(db, p => {
      expect(() => phase(db, () => {
        if (fault !== 'SQL') assert(db, 'assessment-a', expected);
        if (fault === 'SQL') p.failNext(second);
        if (fault === 'mutable-read') db.exec('PRAGMA query_only=0');
        try { assert(db, fault === 'ownership' ? 'assessment-a' : 'other-id', fault === 'ownership' ? { table: second, sourceId: 'wrong-owner' } : expected); }
        catch (error) { failure = error; }
        if (fault === 'mutable-read') db.exec('PRAGMA query_only=1');
        try { assert(db, 'assessment-a', expected); } catch (error) { retry = error; }
      })).toThrow(/phase expired/);
      expect(failure).toBeInstanceOf(Error); expect(String(retry)).toMatch(/phase expired/);
      if (fault === 'SQL') expect(String(failure)).toMatch(/injected assessment census SQL failure/);
    });
    expect(() => phase(db, () => assert(db, 'assessment-a', expected))).not.toThrow();
  } finally { db.close(); }
});

it('keeps inactive q0 and partial adapter reads fresh rather than sharing a census across operations', () => {
  const db = fixture();
  try {
    probe(db, p => {
      assert(db, 'first', expected); assert(db, 'second', expected);
      expect(p.counts()).toEqual(tables.map(() => 2));
      // Primitive metadata adapter only; no domain Owner is impersonated.
      const adapter = { prepare: db.prepare.bind(db) } as unknown as DatabaseSync;
      assert(adapter, 'third', expected); assert(adapter, 'fourth', expected);
      expect(p.counts()).toEqual(tables.map(() => 4));
    });
  } finally { db.close(); }
});

it.each(['generated column', 'view'] as const)('keeps a changing %s payload fresh inside one q1 phase, matching the original SQL', kind => {
  const db = fixture(); let payload = '{}', ownership: unknown, expired: unknown;
  try {
    db.function('claim_payload', { deterministic: true }, () => payload);
    db.exec('DROP TABLE ' + first);
    if (kind === 'generated column') {
      db.exec(`CREATE TABLE ${first}(source_id TEXT, source_json TEXT GENERATED ALWAYS AS(claim_payload()) VIRTUAL, snapshot_json TEXT)`);
      db.prepare(`INSERT INTO ${first}(source_id,snapshot_json) VALUES(?,?)`).run('foreign-row', '{}');
    } else db.exec(`CREATE VIEW ${first} AS SELECT 'foreign-row' AS source_id,claim_payload() AS source_json,'{}' AS snapshot_json`);
    try {
      phase(db, () => {
        assert(db, 'changed-claim', expected);
        payload = '{"provenance":{"assessmentSourceId":"changed-claim"}}';
        const original = db.prepare(`SELECT source_id FROM main.${first} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
          OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')} OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')}
          OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`).all({ id: 'changed-claim' });
        expect(original.map(row => row.source_id)).toEqual(['foreign-row']);
        try { assert(db, 'changed-claim', expected); } catch (error) { ownership = error; }
      });
    } catch (error) { expired = error; }
    expect(ownership).toBeInstanceOf(Error); expect(String(ownership)).toMatch(/ownership/);
    expect(String(expired)).toMatch(/phase expired/);
  } finally { db.close(); }
});

it('does not materialize an unrelated out-of-range integer source_id that the original SQL would not return', () => {
  const db = fixture({ untypedLast: true }), table = tables.at(-1)!;
  try {
    db.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run(9223372036854775807n, '{}', '{}');
    const id = 'absent-assessment';
    const original = db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
      OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')} OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')}
      OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`).all({ id });
    expect(original).toEqual([]);
    expect(() => phase(db, () => assert(db, id, expected))).not.toThrow();
  } finally { db.close(); }
});

it('preserves the exact legacy SELECT 1 catalog query for a partial q0 prepare adapter', () => {
  const db = fixture(); let catalogReads = 0;
  try {
    const adapter = { prepare(sql: string) {
      if (sql.includes('main.sqlite_master')) {
        expect(sql).toBe('SELECT 1 FROM main.sqlite_master WHERE name=?'); catalogReads++;
      }
      return db.prepare(sql);
    } } as unknown as DatabaseSync;
    assert(adapter, 'first-absent', expected); assert(adapter, 'second-absent', expected);
    expect(catalogReads).toBe(tables.length * 2);
  } finally { db.close(); }
});
