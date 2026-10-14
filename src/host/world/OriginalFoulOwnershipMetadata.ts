import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type FoulMetadataScalar = string | number | null;
/** Existing foul metadata traversal, shared without parsing future payloads.
 * It preserves duplicate/escaped keys and flattens arrays at each path depth. */
export const originalFoulMetadataValues = (db: Pick<DatabaseSync, 'prepare'>, document: string, path: readonly string[]): FoulMetadataScalar[] => db.prepare(`
    WITH RECURSIVE metadata(depth,value,type,atom) AS (
      SELECT 0,CASE WHEN json_valid($document) THEN $document ELSE 'null' END,
        json_type(CASE WHEN json_valid($document) THEN $document ELSE 'null' END),NULL
      UNION ALL
      SELECT m.depth+CASE WHEN m.type='object' THEN 1 ELSE 0 END,c.value,c.type,c.atom
      FROM metadata m,json_each(CASE WHEN m.type IN ('object','array') THEN m.value ELSE '{}' END) c
      WHERE (m.type='object' AND m.depth<$length AND c.key=json_extract($path,'$['||m.depth||']'))
        OR (m.type='array' AND m.depth<=$length)
    ) SELECT atom FROM metadata WHERE depth=$length AND type NOT IN ('object','array')`)
    .all({ document, path: json(path), length: path.length }).map(r => r.atom as FoulMetadataScalar);

export type FoulMetadataRow = Readonly<{ source_id: string; source_json: string; snapshot_json: string }>;
export const originalFoulSourceValues = (db: Pick<DatabaseSync, 'prepare'>, row: FoulMetadataRow, key: string) => [
  ...originalFoulMetadataValues(db, row.source_json, [key]),
  ...originalFoulMetadataValues(db, row.snapshot_json, ['source', key]),
  ...originalFoulMetadataValues(db, row.snapshot_json, ['history', key]),
];
export const originalFoulSourceIds = (db: Pick<DatabaseSync, 'prepare'>, row: FoulMetadataRow) =>
  [row.source_id, ...originalFoulSourceValues(db, row, 'sourceId')].filter((v): v is string => typeof v === 'string');

/** Preserve each reference object's owner/source pairing while retaining array
 * alternatives and duplicate containers at every declared metadata path. */
export const originalFoulReferenceIds = (db: Pick<DatabaseSync, 'prepare'>, document: string,
  path: readonly string[], owner: string): FoulMetadataScalar[] => db.prepare(`
    WITH RECURSIVE references_metadata(depth,value,type) AS (
      SELECT 0,CASE WHEN json_valid($document) THEN $document ELSE 'null' END,
        json_type(CASE WHEN json_valid($document) THEN $document ELSE 'null' END)
      UNION ALL
      SELECT parent.depth+CASE WHEN parent.type='object' THEN 1 ELSE 0 END,child.value,child.type
      FROM references_metadata parent,
        json_each(CASE WHEN parent.type IN ('object','array') THEN parent.value ELSE '{}' END) child
      WHERE (parent.type='object' AND parent.depth<$length AND child.key=json_extract($path,'$['||parent.depth||']'))
        OR (parent.type='array' AND parent.depth<=$length)
    ) SELECT value FROM references_metadata WHERE depth=$length AND type='object'`)
  .all({ document, path: json(path), length: path.length }).flatMap(row => typeof row.value === 'string'
    && originalFoulMetadataValues(db, row.value, ['owner']).includes(owner)
    ? originalFoulMetadataValues(db, row.value, ['sourceId']) : []);
