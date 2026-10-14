import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { assertSamePaAssessmentOwnership as check } from './SamePlateAppearanceAssessmentOwnership';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';

const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const databases: DatabaseSync[] = [];
const source = { sourceId: 'total', provenance: { assessmentSourceId: 'assessment' } };
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } });
const setup = () => {
  const db = new Native(':memory:'); databases.push(db);
  // This guard authenticates metadata identities; complete baseball owner
  // replay is covered separately by the saved genuine operation comparison.
  db.exec('CREATE TABLE reserved_pa_total_assessments(source_id TEXT,source_json TEXT,snapshot_json TEXT)');
  const insert = (id: string, assessment: string) => {
    const value = { sourceId: id, provenance: { assessmentSourceId: assessment } };
    db.prepare('INSERT INTO reserved_pa_total_assessments VALUES(?,?,?)').run(id, JSON.stringify(value), JSON.stringify({ source: value }));
  };
  insert('total', 'assessment'); insert('other', 'other-assessment');
  return { db, insert };
};
const proof = <T>(db: DatabaseSync, body: () => T): T => {
  db.exec('PRAGMA query_only=1; BEGIN');
  try { return withSamePaContinuationReadPhase(db, body); }
  finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};

it('reuses only completed assessment ownership while checking original namespaces on every call', () => {
  const { db } = setup(), prepare = db.prepare.bind(db); let ownershipReads = 0, namespaceReads = 0;
  vi.spyOn(db, 'prepare').mockImplementation(sql => {
    if (sql.startsWith('SELECT source_id FROM main.reserved_pa_total_assessments')) ownershipReads++;
    if (sql === 'SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)') namespaceReads++;
    return prepare(sql);
  });
  proof(db, () => {
    check(db, source); const firstNamespaces = namespaceReads;
    check(db, { ...source }); expect(ownershipReads).toBe(1); expect(namespaceReads).toBe(2 * firstNamespaces);
  });
  proof(db, () => check(db, source)); expect(ownershipReads).toBe(2);
  check(db, source); check(db, source); expect(ownershipReads).toBe(4);
});

it.each([
  { sourceId: 'other', provenance: source.provenance },
  { sourceId: source.sourceId, provenance: { assessmentSourceId: 'other-assessment' } },
])('keeps both source and assessment identities in the proof key: %j', changed => {
  const { db } = setup();
  expect(() => proof(db, () => {
    check(db, source);
    expect(() => check(db, changed)).toThrow(/duplicate|prior work/);
    expect(() => check(db, source)).toThrow(/expired/);
  })).toThrow(/expired/);
  expect(() => proof(db, () => check(db, source))).not.toThrow();
});

it('reauthenticates aliases inserted between proofs and rejects caught in-proof mutations', () => {
  const { db, insert } = setup();
  proof(db, () => check(db, source));
  expect(() => proof(db, () => {
    check(db, source); db.exec('PRAGMA query_only=0'); insert('alias', 'assessment'); db.exec('PRAGMA query_only=1');
    expect(() => check(db, source)).toThrow();
    expect(() => check(db, source)).toThrow(/expired/);
  })).toThrow(/expired/);
  expect(() => proof(db, () => check(db, source))).not.toThrow();
  insert('alias', 'assessment'); expect(() => proof(db, () => check(db, source))).toThrow(/duplicate|prior work/);
});

it('rejects TEMP owner replacement before a hit and never reads attached lookalikes', () => {
  const { db } = setup();
  db.exec("ATTACH ':memory:' AS foreign_owner; CREATE TABLE foreign_owner.reserved_pa_total_assessments(source_id,source_json,snapshot_json); INSERT INTO foreign_owner.reserved_pa_total_assessments VALUES('assessment','{}','{}')");
  expect(() => proof(db, () => { check(db, source); check(db, source); })).not.toThrow();
  expect(() => proof(db, () => {
    check(db, source); db.exec('PRAGMA query_only=0; CREATE TEMP TABLE reserved_pa_total_assessments(source_id); PRAGMA query_only=1');
    expect(() => check(db, source)).toThrow();
    expect(() => check(db, source)).toThrow(/expired/);
  })).toThrow(/expired/);
});
