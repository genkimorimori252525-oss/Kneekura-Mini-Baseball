import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import type { ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
/** Exact Source mirrors for the two downstream owners; schema column names are never caller input. */
export const actualLiveAdjudicationIdentityRow = (db: ActualAdjudicationDb,
  owner: 'actual_live_adjudications' | 'actual_live_play_closures', sourceId: string) => {
  if (!sourceId || sourceId !== sourceId.trim()) throw new Error('invalid actual official Source identity');
  const column = owner === 'actual_live_adjudications' ? 'snapshot_json' : 'proposal_json';
  const rows = db.prepare(`SELECT * FROM ${owner} WHERE source_id=$id
    OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim(column, ['source', 'sourceId'], '$id')}`).all({ id: sourceId });
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('actual official Source identity ownership differs');
  const row = rows[0]; if (!row) return null;
  for (const [name, path] of [['source_json', ['sourceId']], [column, ['source', 'sourceId']]] as const) {
    const metadata = db.prepare(`SELECT count(*) AS n,sum(o.type='text' AND o.atom=$id) AS matched
      FROM (${nodes('$document', path)}) o`).get({ document: String(row[name]), id: sourceId });
    if (!metadata || metadata.n !== 1 || metadata.matched !== 1) throw new Error('actual official Source identity mirror differs');
  }
  return row;
};
