import { defensiveMetadataId as idClaim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import type { PostPlayReviewDb, PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';
import { actualLivePlayId as id } from './ActualLivePlayScope';

export const postPlayTableExists = (db: PostPlayReviewDb, table: string) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
export type PostPlayRow = Record<string, import('node:sqlite').SQLOutputValue>;
const numberClaim = (column: string, path: readonly string[], parameter: string) =>
  `EXISTS(SELECT 1 FROM (${nodes(column, path)}) n WHERE n.atom=${parameter})`;
export const postPlayReviewIdentityRow = (db: PostPlayReviewDb, kind: 'session' | 'event', sourceId: string): PostPlayRow | null => {
  if (!id(sourceId)) throw new Error('invalid post-play Source identity');
  const table = kind === 'session' ? 'actual_post_play_review_sessions' : 'actual_post_play_review_events';
  const path = kind === 'session' ? ['value', 'source', 'sourceId'] : ['headSourceId'];
  const rows = db.prepare(`SELECT * FROM ${table} WHERE source_id=$id OR ${idClaim('source_json', ['sourceId'], '$id')}
    OR ${idClaim('snapshot_json', path, '$id')}`).all({ id: sourceId });
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('post-play Source identity ownership differs');
  return rows[0] ?? null;
};
export const postPlayReviewSessionClaims = (db: PostPlayReviewDb, adjudicationSourceId: string, scope: Pick<PostPlayReviewNativeScope,
  'gameId' | 'playId' | 'physicalPitchSourceId'>) => {
  if (!postPlayTableExists(db, 'actual_post_play_review_sessions')) return [];
  return db.prepare(`SELECT * FROM actual_post_play_review_sessions WHERE adjudication_source_id=$seed
    OR ${idClaim('source_json', ['adjudicationSourceId'], '$seed')}
    OR ${idClaim('snapshot_json', ['value', 'source', 'adjudicationSourceId'], '$seed')}
    OR physical_pitch_source_id=$pitch OR ${idClaim('snapshot_json', ['value', 'seed', 'physicalPitchSourceId'], '$pitch')}
    OR ((game_id=$game OR ${idClaim('snapshot_json', ['scope', 'gameId'], '$game')}
      OR ${idClaim('snapshot_json', ['value', 'seed', 'gameId'], '$game')})
    AND (play_id=$play OR ${numberClaim('snapshot_json', ['scope', 'playId'], '$play')}
      OR ${numberClaim('snapshot_json', ['value', 'seed', 'playId'], '$play')})) ORDER BY source_id`)
    .all({ seed: adjudicationSourceId, pitch: scope.physicalPitchSourceId, game: scope.gameId, play: scope.playId });
};
export const postPlayReviewEventRows = (db: PostPlayReviewDb, sessionSourceId: string) => db.prepare(`SELECT * FROM actual_post_play_review_events
  WHERE session_source_id=$id OR ${idClaim('source_json', ['sessionSourceId'], '$id')}
    OR ${idClaim('snapshot_json', ['source', 'sourceId'], '$id')} ORDER BY revision,source_id`).all({ id: sessionSourceId });
export const postPlayReviewHeadRows = (db: PostPlayReviewDb, sessionSourceId: string) => db.prepare(`SELECT * FROM actual_post_play_review_heads
  WHERE session_source_id=$id OR head_source_id=$id OR head_source_id IN
    (SELECT source_id FROM actual_post_play_review_events WHERE session_source_id=$id
      OR ${idClaim('source_json', ['sessionSourceId'], '$id')} OR ${idClaim('snapshot_json', ['source', 'sourceId'], '$id')})
  ORDER BY session_source_id`).all({ id: sessionSourceId });

export const assertNoPostPlayClosureReservation = (db: PostPlayReviewDb, adjudicationSourceId: string, scope: PostPlayReviewNativeScope) => {
  if (!postPlayTableExists(db, 'actual_live_play_closures')) return;
  const rows = db.prepare(`SELECT source_id FROM actual_live_play_closures WHERE
    ${idClaim('source_json', ['adjudicationSourceId'], '$seed')}
    OR ${idClaim('proposal_json', ['adjudicationReference', 'sourceId'], '$seed')}
    OR ((game_id=$game OR ${idClaim('proposal_json', ['gameId'], '$game')})
      AND (play_id=$play OR ${numberClaim('proposal_json', ['playId'], '$play')}))`)
    .all({ seed: adjudicationSourceId, game: scope.gameId, play: scope.playId });
  if (rows.length) throw new Error('post-play review is reserved by a queued or applied official closure');
};
/** Until the separately versioned closure pin is adopted, v1 cannot omit this owner. */
export const assertNoUnpinnedPostPlayReview = (db: PostPlayReviewDb, adjudicationSourceId: string,
  scope: Pick<PostPlayReviewNativeScope, 'gameId' | 'playId' | 'physicalPitchSourceId'>) => {
  if (postPlayReviewSessionClaims(db, adjudicationSourceId, scope).length) throw new Error('actual official closure requires a pinned post-play review revision');
};
