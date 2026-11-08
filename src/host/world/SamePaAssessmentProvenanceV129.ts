import { createRequire } from 'node:module';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { battingAssessmentOwners } from './BattingAssessmentOwnership';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { sqliteMetadataClaimRows } from './SqliteMetadataStatementScope';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { assertNoMutableSamePaContinuationReadPhase, memoSamePaContinuationRead, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';

const tables = () => [...battingAssessmentOwners, 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations',
  'pa_dispatch_v1_execution_calibrations', 'reserved_pa_total_assessments', 'actual_role_workload_assessments',
  'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_calibrations'];

// Only these fixed, text-typed metadata paths are projected. Native SQL does
// the decoding, including duplicate/escaped containers; no Source body escapes.
const paths = [['source_json', ['sourceId']], ['snapshot_json', ['source', 'sourceId']],
  ['source_json', ['provenance', 'assessmentSourceId']], ['snapshot_json', ['source', 'provenance', 'assessmentSourceId']]] as const;
const canCensus = (db: DatabaseSync, table: string) => memoSamePaContinuationRead(db, 'assessment-census-eligibility-v129:' + table, () => {
  // Ordinary stored TEXT columns only. Virtual/generated columns may invoke a
  // function whose external state is outside the SQLite snapshot signature.
  const catalog = db.prepare(`PRAGMA main.table_list("${table}")`).all();
  if (!catalog.some(row => row.schema === 'main' && row.name === table && row.type === 'table')) return false;
  const columns = db.prepare(`PRAGMA main.table_xinfo("${table}")`).all();
  if (!['source_id', 'source_json', 'snapshot_json'].every(name => columns.some(column =>
    column.name === name && column.hidden === 0 && String(column.type).toUpperCase() === 'TEXT'))) return false;
  // Do not materialize unrelated BLOB/INTEGER owner IDs. The original WHERE
  // may never return them, and reading an unrelated int64 as a number can fail.
  return !db.prepare(`SELECT 1 FROM main.${table} WHERE typeof(source_id)<>'text' LIMIT 1`).get();
});
const typedClaims = (db: DatabaseSync, table: string) => memoSamePaContinuationRead(db, 'assessment-typed-census-v129:' + table, () => {
  const projection = paths.map(([document, path], index) => `(SELECT json_group_array(hex(CAST(n.atom AS BLOB)))
    FROM (${nodes(document, path)}) n WHERE n.type='text') AS metadata_claims_${index}`).join(',');
  const rows = db.prepare(`SELECT source_id,${projection} FROM main.${table}`).all();
  const indices = paths.map(() => new Map<string, Set<SQLOutputValue>>());
  for (const row of rows) for (let path = 0; path < paths.length; path++) {
    for (const key of JSON.parse(String(row['metadata_claims_' + path])) as string[]) {
      const index = indices[path];
      let owners = index.get(key); if (!owners) { owners = new Set(); index.set(key, owners); }
      owners.add(row.source_id);
    }
  }
  // The Map and raw owner IDs stay private. Callers receive no mutable rows,
  // BLOBs, Source bodies, or reusable admission proof.
  return indices;
});

/** Exact existing assessment ownership check. This is not an owner/admission
 * authenticator and never returns Source bodies or reusable authority. */
export const assertSamePaAssessmentProvenanceV129 = (db: DatabaseSync, id: string,
  expected: Readonly<{ table: string; sourceId: string }>, errorMessage = 'same-PA assessment provenance ownership differs',
  claimsMode: 'all' | 'provenance-only' = 'all'): void => {
  const inspect = (reuse: boolean) => {
    // Match SQLite's bound text bytes, including invalid Unicode replacement,
    // rather than changing atom=$id into JavaScript Unicode equality.
    const key = reuse ? String(db.prepare('SELECT hex(CAST(? AS BLOB)) AS claim_key').get(id)!.claim_key) : '';
    for (const table of tables()) {
      const catalog = db.prepare(reuse ? 'SELECT type FROM main.sqlite_master WHERE name=?' : 'SELECT 1 FROM main.sqlite_master WHERE name=?').get(table);
      if (!catalog) continue;
      if (reuse && catalog.type === 'table' && canCensus(db, table)) {
        // Keep canonical-column affinity/collation and raw source_id types in
        // the original SQL. A view may execute a function, so never census it.
        const canonical = db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id`).all({ id });
        if (canonical.some(row => table !== expected.table || row.source_id !== expected.sourceId)
          || typedClaims(db, table).slice(claimsMode === 'all' ? 0 : 2).some(index =>
            [...(index.get(key) ?? [])].some(owner => table !== expected.table || owner !== expected.sourceId))) throw new Error(errorMessage);
        continue;
      }
      const sourceIds = claimsMode === 'all' ? ` OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}` : '';
      const rows = sqliteMetadataClaimRows(db, `SELECT source_id FROM main.${table} WHERE source_id=$id${sourceIds} OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')}
        OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`, id);
      if (rows.some(row => table !== expected.table || row.source_id !== expected.sourceId)) throw new Error(errorMessage);
    }
  };
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) {
    assertNoMutableSamePaContinuationReadPhase(db); return inspect(false);
  }
  return withSamePaContinuationReadPhase(db, () => { assertBodyCompositionNativeConnection(db); inspect(true); });
};
