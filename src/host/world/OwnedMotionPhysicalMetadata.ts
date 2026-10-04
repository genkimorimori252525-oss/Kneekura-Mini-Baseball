import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches,
  type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import type { DefensiveDb } from './ActualDefensiveContext';
type Row = Readonly<{ source_id: string; physical_pitch_source_id: string; base_field_source_id: string; previous_source_id: string | null;
  revision: number; game_id: string; source_json: string; snapshot_json: string }>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
/** Ownership metadata only; opaque future domain payload remains outside the requested replay. */
export const assertOwnedMotionPhysicalMetadata = (db: DefensiveDb, row: Row, prefix: readonly Row[]) => {
  const valid = (document: string) => !!db.prepare('SELECT json_valid(?) AS valid').get(document)!.valid;
  const sourceIdentity = (r: Row) => ({ sourceId: r.source_id, baseFieldSourceId: r.base_field_source_id, previousExecutionSourceId: r.previous_source_id });
  const object = (document: string, path: SqliteJsonMetadataPath, expected: Record<string, string | number | null>) => {
    const values = db.prepare(`SELECT n.type,CASE WHEN n.type='object' THEN ${projection('n.value', Object.keys(expected))} END AS metadata
      FROM (${nodes('$document', path)}) n`).all({ document });
    if (values.length !== 1 || values[0].type !== 'object' || !matches(values[0].metadata as string, expected)) {
      throw new Error('actual field execution ownership metadata mirror differs');
    }
  };
  const version = (document: string, path: SqliteJsonMetadataPath) => {
    const values = db.prepare(`SELECT type,atom FROM (${nodes('$document', [...path, 'sourceVersion'])})`).all({ document });
    if (values.length !== 1 || values[0].type !== 'text' || !id(values[0].atom)) throw new Error('actual field execution Source version metadata differs');
    return values[0].atom;
  };
  const sourceValid = valid(row.source_json), snapshotValid = valid(row.snapshot_json);
  let sourceVersion: string | null = null;
  if (sourceValid) { object(row.source_json, [], sourceIdentity(row)); sourceVersion = version(row.source_json, []); }
  if (snapshotValid) {
    object(row.snapshot_json, [], { revision: row.revision }); object(row.snapshot_json, ['source'], sourceIdentity(row));
    const snapshotVersion = version(row.snapshot_json, ['source']);
    if (sourceVersion !== null && sourceVersion !== snapshotVersion) throw new Error('actual field execution Source version mirror differs');
    object(row.snapshot_json, ['baseField'], {});
    object(row.snapshot_json, ['baseField', 'source'], { sourceId: row.base_field_source_id });
    for (const path of [['baseField', 'response'], ['baseField', 'response', 'touch'],
      ['baseField', 'response', 'touch', 'worldContact'], ['baseField', 'response', 'touch', 'worldContact', 'flight']] as const) {
      object(row.snapshot_json, path, {});
    }
    object(row.snapshot_json, ['baseField', 'response', 'model'], { gameId: row.game_id });
    object(row.snapshot_json, ['baseField', 'response', 'touch', 'worldContact', 'flight', 'source'], { physicalPitchSourceId: row.physical_pitch_source_id });
    const history = db.prepare(`SELECT n.type FROM (${nodes('$document', ['history'])}) n`).all({ document: row.snapshot_json });
    const entries = db.prepare(`SELECT n.type,${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", Object.keys(sourceIdentity(row)))} AS metadata,
      ${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", ['sourceVersion'])} AS version
      FROM (${nodes('$document', ['history', { array: 'all' }])}) n`).all({ document: row.snapshot_json });
    if (history.length !== 1 || history[0].type !== 'array' || entries.length !== row.revision
      || entries.some((entry, i) => entry.type !== 'object' || !prefix[i] || !matches(entry.metadata as string, sourceIdentity(prefix[i])))) {
      throw new Error('actual field execution history metadata mirror differs');
    }
    for (const [i, entry] of entries.entries()) {
      const metadata = JSON.parse(entry.version as string) as [string, string, unknown][];
      if (metadata.length !== 1 || metadata[0][1] !== 'text' || !id(metadata[0][2])
        || valid(prefix[i].source_json) && metadata[0][2] !== version(prefix[i].source_json, [])) throw new Error('actual field execution history version metadata differs');
    }
  }
};
