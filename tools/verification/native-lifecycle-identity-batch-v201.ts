import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { samePaLifecycleTables } from '../../src/host/world/SamePlateAppearanceLifecycle';
import { assertSamePaLifecycleStorage } from '../../src/host/world/SamePlateAppearanceLifecycleStorage';
import { samePaMetadataClaim as claim } from '../../src/host/world/SamePlateAppearanceReservationGuard';
import { samePaText } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import { sqliteMetadataClaimRows } from '../../src/host/world/SqliteMetadataStatementScope';
import { sqliteJsonMetadataNodes as nodes } from '../../src/host/world/SqliteOwnershipMetadata';

export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
export const assertLifecycleIdentityExperimentStorageV201 = assertSamePaLifecycleStorage;
type Kind = keyof typeof samePaLifecycleTables;
type Row = Record<string, SQLOutputValue>;
type Candidate = { table: string; rowid: string; row: Row };
type Request = { inputPosition: number; requestedId: string; candidates: Candidate[]; aliasReject: boolean; missingFallbackRequired: boolean };
const rowidAlias = '__candidate_rowid_v201__';
const tables = Object.values(samePaLifecycleTables);
const predicate = (binding: string) => `source_id=${binding} OR ${claim('source_json', ['sourceId'], binding)} OR ${claim('snapshot_json', ['source', 'sourceId'], binding)}`;
const row = (table: string, raw: Row): Candidate => {
  const record = { ...raw }, rowid = String(record[rowidAlias]); delete record[rowidAlias];
  return { table, rowid, row: record };
};
const order = (candidates: Candidate[]) => candidates.sort((a, b) => {
  const byTable = tables.indexOf(a.table as typeof tables[number]) - tables.indexOf(b.table as typeof tables[number]);
  return byTable || (BigInt(a.rowid) < BigInt(b.rowid) ? -1 : BigInt(a.rowid) > BigInt(b.rowid) ? 1 : 0);
});
const request = (kind: Kind, requestedId: string, inputPosition: number, candidates: Candidate[]): Request => ({
  inputPosition, requestedId, candidates: order(candidates),
  aliasReject: candidates.length > 1 || candidates.length === 1 && (candidates[0].table !== samePaLifecycleTables[kind] || candidates[0].row.source_id !== requestedId),
  // The experiment does not perform or replace assertNoSurvivingLifecycleClaim.
  missingFallbackRequired: candidates.length === 0,
});
const result = (mode: 'LEGACY_SCALAR' | 'NATIVE_POSITION_BATCH', requests: Request[]) => ({ mode, requests,
  normalOwnerProof: false as const, scope: 'RAW_IDENTITY_CANDIDATES_ONLY_NO_BEHAVIORAL_ADMISSION' as const });

/** Exact existing typed-claim WHERE and fresh public helper. The caller must
 * authenticate the regular lifecycle schema separately, outside SQL timing. */
export const collectScalarLifecycleIdentityCandidatesV201 = (db: DatabaseSync, kind: Kind, ids: readonly string[]) => result('LEGACY_SCALAR', ids.map((id, index) =>
  request(kind, id, index, tables.flatMap(table => sqliteMetadataClaimRows(db,
    `SELECT *,CAST(rowid AS TEXT) AS ${rowidAlias} FROM main.${table} WHERE ${predicate('$id')}`, id).map(value => row(table, value))))));

/** Candidate experiment only: one fresh prepare per table, no statement or
 * proof cache. Matching input positions remain Native booleans; decoded atoms
 * never become JavaScript identity keys. Missing claims retain legacy fallback. */
export const collectBatchLifecycleIdentityCandidatesV201 = (db: DatabaseSync, kind: Kind, ids: readonly string[]) => {
  if (!['total', 'calibration'].includes(kind) || ids.length < 2 || ids.length > 32
    || !Array.from(ids).every(samePaText)) return collectScalarLifecycleIdentityCandidatesV201(db, kind, ids);
  const bindings = Object.fromEntries(ids.map((id, index) => ['id' + index, id]));
  const parameters = ids.map((_id, index) => '$id' + index).join(',');
  const matches = ids.map((_id, index) => `(${predicate('$id' + index)}) AS matched_${index}`).join(',');
  const candidates = ids.map((): Candidate[] => []);
  for (const table of tables) {
    const values = db.prepare(`SELECT *,CAST(rowid AS TEXT) AS ${rowidAlias},${matches} FROM main.${table}
      WHERE source_id IN (${parameters}) OR EXISTS(SELECT 1 FROM (${nodes('source_json', ['sourceId'])}
        UNION ALL ${nodes('snapshot_json', ['source', 'sourceId'])}) identity
        WHERE identity.type='text' AND identity.atom IN (${parameters}))`).all(bindings);
    for (const value of values) {
      const record = { ...value };
      const positions = ids.map((_id, index) => value['matched_' + index] === 1);
      for (let index = 0; index < ids.length; index++) delete record['matched_' + index];
      const candidate = row(table, record);
      for (let index = 0; index < ids.length; index++) if (positions[index]) candidates[index].push(candidate);
    }
  }
  return result('NATIVE_POSITION_BATCH', ids.map((id, index) => request(kind, id, index, candidates[index])));
};
