import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { samePaLifecycleTables as tables } from './SamePlateAppearanceLifecycle';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';

type Candidate = { table: string; row: Record<string, SQLOutputValue> };
type Locations = Map<string, { table: string; rowids: string[] }[]>;
export type SamePaLifecycleIdentityCandidatesV202 = {
  kind: 'total' | 'calibration'; ids: ReadonlySet<string>; read(id: string): Candidate[] | null; clear(): void;
};
const predicate = (binding: string) => `source_id=${binding} OR ${claim('source_json', ['sourceId'], binding)} OR ${claim('snapshot_json', ['source', 'sourceId'], binding)}`;

/** Raw locators only, subordinate to the caller's authenticated immutable
 * lifecycle phase. Every scan/hydration uses a fresh Native statement. */
export const samePaLifecycleIdentityCandidatesV202 = (db: Pick<DatabaseSync, 'prepare'>,
  kind: 'total' | 'calibration', ids: readonly string[]): SamePaLifecycleIdentityCandidatesV202 | null => {
  if (kind !== 'total' && kind !== 'calibration' || !Array.isArray(ids) || ids.length < 2 || ids.length > 32 || !Array.from(ids).every(samePaText)) return null;
  const ordered = [...new Set(ids)], targets = new Set(ordered);
  const bindings = Object.fromEntries(ordered.map((id, index) => ['id' + index, id]));
  const parameters = ordered.map((_id, index) => '$id' + index).join(',');
  const matches = ordered.map((_id, index) => `(${predicate('$id' + index)}) AS matched_${index}`).join(',');
  let locations: Locations | undefined, legacy = false, closed = false;
  const scan = (): Locations => {
    const found: Locations = new Map(ordered.map(id => [id, []]));
    for (const table of Object.values(tables)) {
      // Do not hydrate future input rows: a later out-of-range INTEGER must
      // not overtake the current input's normal Source/alias rejection.
      const rows = db.prepare(`SELECT CAST(rowid AS TEXT) AS native_rowid,${matches} FROM main.${table}
        WHERE source_id IN (${parameters}) OR EXISTS(SELECT 1 FROM (${nodes('source_json', ['sourceId'])}
          UNION ALL ${nodes('snapshot_json', ['source', 'sourceId'])}) identity
          WHERE identity.type='text' AND identity.atom IN (${parameters})) ORDER BY rowid`).all(bindings);
      for (let index = 0; index < ordered.length; index++) {
        const rowids = rows.filter(row => row['matched_' + index] === 1).map(row => String(row.native_rowid));
        if (rowids.length) found.get(ordered[index])!.push({ table, rowids });
      }
    }
    return found;
  };
  return { kind, ids: targets, read(id) {
    if (closed) throw new Error('lifecycle identity candidate scope expired');
    if (legacy || !targets.has(id)) return null;
    if (!locations) {
      try { locations = scan(); }
      catch (error) {
        // SELECT * did not require hidden ROWID authorization. Only this
        // explicit unsupported capability returns to the original scalar SQL.
        const nativeError = error as { code?: unknown; errcode?: unknown; message?: unknown } | null;
        if (!nativeError || nativeError.code !== 'ERR_SQLITE_ERROR' || nativeError.errcode !== 23 || typeof nativeError.message !== 'string'
          || !/access to (?:main\.)?pa_lifecycle_v1_[a-z_]+\.ROWID is prohibited\b/i.test(nativeError.message)) throw error;
        legacy = true; return null;
      }
    }
    return locations.get(id)!.flatMap(({ table, rowids }) => {
      const values = Object.fromEntries(rowids.map((value, index) => ['row' + index, value]));
      return db.prepare(`SELECT * FROM main.${table} WHERE rowid IN (${rowids.map((_value, index) => '$row' + index).join(',')}) ORDER BY rowid`)
        .all(values).map(row => ({ table, row }));
    });
  }, clear() { closed = true; locations?.clear(); locations = undefined; } };
};
