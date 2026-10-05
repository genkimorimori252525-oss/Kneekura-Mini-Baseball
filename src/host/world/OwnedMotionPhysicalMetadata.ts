import { sqliteMetadataGet, sqliteMetadataAll } from './SqliteMetadataStatementScope';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches,
  type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import type { DefensiveDb } from './ActualDefensiveContext';
import { ownedScheduledMotionSnapshotFormat } from './OwnedScheduledMotionArchive';
type Row = Readonly<{ source_id: string; physical_pitch_source_id: string; base_field_source_id: string; previous_source_id: string | null;
  revision: number; game_id: string; source_json: string; snapshot_json: string }>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
/** Ownership metadata only; opaque future domain payload remains outside the requested replay. */
export const assertOwnedMotionPhysicalMetadata = (db: DefensiveDb, row: Row, prefix: readonly Row[]) => {
  const valid = (document: string) => !!sqliteMetadataGet(db, 'SELECT json_valid(?) AS valid', document)!.valid;
  const sourceIdentity = (r: Row) => ({ sourceId: r.source_id, baseFieldSourceId: r.base_field_source_id, previousExecutionSourceId: r.previous_source_id });
  const object = (document: string, path: SqliteJsonMetadataPath, expected: Record<string, string | number | null>) => {
    const values = sqliteMetadataAll(db, `SELECT n.type,CASE WHEN n.type='object' THEN ${projection('n.value', Object.keys(expected))} END AS metadata
      FROM (${nodes('$document', path)}) n`, document);
    if (values.length !== 1 || values[0].type !== 'object' || !matches(values[0].metadata as string, expected)) {
      throw new Error('actual field execution ownership metadata mirror differs');
    }
  };
  const version = (document: string, path: SqliteJsonMetadataPath) => {
    const values = sqliteMetadataAll(db, `SELECT type,atom FROM (${nodes('$document', [...path, 'sourceVersion'])})`, document);
    if (values.length !== 1 || values[0].type !== 'text' || !id(values[0].atom)) throw new Error('actual field execution Source version metadata differs');
    return values[0].atom;
  };
  const shape = (document: string, path: SqliteJsonMetadataPath, keys: readonly string[], count = 1) => {
    const values = sqliteMetadataAll(db, `SELECT n.type,CASE WHEN n.type='object' THEN
      (SELECT json_group_array(key) FROM json_each(n.value)) END AS keys FROM (${nodes('$document', path)}) n`, document);
    const wanted = JSON.stringify([...keys].sort());
    if (values.length !== count || values.some(value => value.type !== 'object'
      || JSON.stringify((JSON.parse(value.keys as string) as string[]).sort()) !== wanted)) {
      throw new Error('actual field execution archive format metadata differs');
    }
  };
  const text = (document: string, path: SqliteJsonMetadataPath) => {
    const values = sqliteMetadataAll(db, `SELECT type,atom FROM (${nodes('$document', path)})`, document);
    if (values.length !== 1 || values[0].type !== 'text' || !id(values[0].atom)) {
      throw new Error('actual field execution archive text metadata differs');
    }
  };
  const sourceValid = valid(row.source_json), snapshotValid = valid(row.snapshot_json);
  let sourceVersion: string | null = null;
  if (sourceValid) { object(row.source_json, [], sourceIdentity(row)); sourceVersion = version(row.source_json, []); }
  if (snapshotValid) {
    // Format selects only ownership metadata paths. It does not authorize a saved
    // manifest or require replaying opaque future Source/action payloads. The own
    // bounded reader separately rederives and compares every expected archive byte.
    const formats = sqliteMetadataAll(db, `SELECT type,atom FROM (${nodes('$document', ['snapshotFormat'])})`, row.snapshot_json);
    if (formats.length && (formats.length !== 1 || formats[0].type !== 'text' || formats[0].atom !== ownedScheduledMotionSnapshotFormat)) {
      throw new Error('actual field execution archive format metadata differs');
    }
    const manifest = formats.length === 1;
    object(row.snapshot_json, [], { revision: row.revision }); object(row.snapshot_json, ['source'], sourceIdentity(row));
    const snapshotVersion = version(row.snapshot_json, ['source']);
    if (sourceVersion !== null && sourceVersion !== snapshotVersion) throw new Error('actual field execution Source version mirror differs');
    object(row.snapshot_json, ['baseField'], {});
    object(row.snapshot_json, ['baseField', 'source'], { sourceId: row.base_field_source_id });
    if (manifest) {
      shape(row.snapshot_json, [], ['snapshotFormat', 'source', 'baseField', 'revision', 'history', 'execution']);
      shape(row.snapshot_json, ['baseField'], ['source', 'sourceHash', 'snapshotHash', 'physicalPitchSourceId', 'gameId']);
      shape(row.snapshot_json, ['baseField', 'source'], ['sourceId', 'sourceVersion']);
      object(row.snapshot_json, ['baseField'], { physicalPitchSourceId: row.physical_pitch_source_id, gameId: row.game_id });
      version(row.snapshot_json, ['baseField', 'source']);
      text(row.snapshot_json, ['baseField', 'sourceHash']); text(row.snapshot_json, ['baseField', 'snapshotHash']);
      shape(row.snapshot_json, ['history', { array: 'all' }],
        ['sourceId', 'sourceVersion', 'baseFieldSourceId', 'previousExecutionSourceId', 'sourceHash'], row.revision);
    } else {
      for (const path of [['baseField', 'response'], ['baseField', 'response', 'touch'],
        ['baseField', 'response', 'touch', 'worldContact'], ['baseField', 'response', 'touch', 'worldContact', 'flight']] as const) {
        object(row.snapshot_json, path, {});
      }
      object(row.snapshot_json, ['baseField', 'response', 'model'], { gameId: row.game_id });
      object(row.snapshot_json, ['baseField', 'response', 'touch', 'worldContact', 'flight', 'source'], { physicalPitchSourceId: row.physical_pitch_source_id });
    }
    const history = sqliteMetadataAll(db, `SELECT n.type FROM (${nodes('$document', ['history'])}) n`, row.snapshot_json);
    const entries = sqliteMetadataAll(db, `SELECT n.type,${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", Object.keys(sourceIdentity(row)))} AS metadata,
      ${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", ['sourceVersion'])} AS version,
      ${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", ['sourceHash'])} AS hash
      FROM (${nodes('$document', ['history', { array: 'all' }])}) n`, row.snapshot_json);
    if (history.length !== 1 || history[0].type !== 'array' || entries.length !== row.revision
      || entries.some((entry, i) => entry.type !== 'object' || !prefix[i] || !matches(entry.metadata as string, sourceIdentity(prefix[i])))) {
      throw new Error('actual field execution history metadata mirror differs');
    }
    for (const [i, entry] of entries.entries()) {
      const metadata = JSON.parse(entry.version as string) as [string, string, unknown][];
      if (metadata.length !== 1 || metadata[0][1] !== 'text' || !id(metadata[0][2])
        || valid(prefix[i].source_json) && metadata[0][2] !== version(prefix[i].source_json, [])) throw new Error('actual field execution history version metadata differs');
      if (manifest) {
        const hashes = JSON.parse(entry.hash as string) as [string, string, unknown][];
        if (hashes.length !== 1 || hashes[0][1] !== 'text' || !id(hashes[0][2])) throw new Error('actual field execution history digest metadata differs');
      }
    }
  }
};
