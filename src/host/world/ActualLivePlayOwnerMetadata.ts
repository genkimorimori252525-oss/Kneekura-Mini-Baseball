import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Owner = 'actual_live_play_runtimes' | 'actual_first_base_play_ends' | 'same_pa_enrollments'
  | 'reserved_pa_work_prefixes' | 'reserved_pa_total_assessments' | 'reserved_pa_execution_views';
/** Inspect every raw identity mirror before choosing a row. SQLite JSON metadata
 * iteration preserves escaped/duplicate keys that JSON.parse would collapse. */
export const actualLivePlayOwnerIdentityRow = (db: Db, owner: Owner, sourceId: string) => {
  if (!sourceId || sourceId !== sourceId.trim()) throw new Error('invalid actual live-play Source identity');
  const rows = db.prepare(`SELECT * FROM ${owner} WHERE source_id=$id
    OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}
    OR ${claim('snapshot_json', ['history', { array: 'all' }, 'sourceId'], '$id')}
    OR ${claim('snapshot_json', ['history', 'sourceId'], '$id')}`).all({ id: sourceId });
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('actual live-play Source identity ownership differs');
  const row = rows[0];
  if (!row) return null;
  for (const [column, path] of [['source_json', ['sourceId']], ['snapshot_json', ['source', 'sourceId']]] as const) {
    const metadata = db.prepare(`SELECT count(*) AS n,sum(o.type='text' AND o.atom=$id) AS matched
      FROM (${nodes('$document', path)}) o`).get({ document: String(row[column]), id: sourceId });
    if (!metadata || metadata.n !== 1 || metadata.matched !== 1) throw new Error('actual live-play Source identity mirror differs');
  }
  return row;
};

/** Complete terminal ownership census. Cached SQL scope columns are indexes,
 * never authority to hide an original runtime/game/pitch claim in raw mirrors. */
export const actualFirstBaseTerminalClaims = (db: Db, scope: Readonly<{
  gameId: string; playId: number; physicalPitchSourceId: string; runtimeSourceId: string;
}>) => db.prepare(`SELECT * FROM actual_first_base_play_ends WHERE (game_id=$game AND play_id=$play)
  OR physical_pitch_source_id=$pitch OR ${claim('source_json', ['runtimeSourceId'], '$runtime')}
  OR ${claim('snapshot_json', ['source', 'runtimeSourceId'], '$runtime')}
  OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')}
  OR (${claim('snapshot_json', ['gameId'], '$game')} AND EXISTS
    (SELECT 1 FROM (${nodes('snapshot_json', ['playId'])}) n WHERE n.atom=$play))`)
  .all({ game: scope.gameId, play: scope.playId, pitch: scope.physicalPitchSourceId, runtime: scope.runtimeSourceId });

/** Shared read/write census: the complete raw runtime scope is authoritative
 * even when a competing row has different cached game/play/pitch columns. */
export const actualLiveRuntimeClaims = (db: Db, scope: Readonly<{
  gameId: string; playId: number; physicalPitchSourceId?: string;
}>) => db.prepare(`SELECT * FROM actual_live_play_runtimes WHERE (game_id=$game AND play_id=$play)
  OR physical_pitch_source_id=$pitch OR ${claim('source_json', ['physicalPitchSourceId'], '$pitch')}
  OR ${claim('snapshot_json', ['source', 'physicalPitchSourceId'], '$pitch')}
  OR (${claim('snapshot_json', ['gameId'], '$game')} AND EXISTS
    (SELECT 1 FROM (${nodes('snapshot_json', ['playId'])}) n WHERE n.atom=$play))`)
  .all({ game: scope.gameId, play: scope.playId, pitch: scope.physicalPitchSourceId ?? null });
