import type { DatabaseSync } from 'node:sqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';

/** A journal session seals its already completed reserved physical cut. This
 * metadata fence never recursively reads the seed while a producer is proving
 * an original archive. Replays do not invoke this first-adoption guard. */
export const assertNoSamePaCatchReviewSeal = (db: Pick<DatabaseSync, 'prepare'>, gameId: string, playId: number) => {
  if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='actual_post_play_review_sessions'").get()) return;
  const rows = db.prepare(`SELECT source_id FROM main.actual_post_play_review_sessions WHERE
    (game_id=$game OR ${claim('snapshot_json', ['scope','gameId'], '$game')}
      OR ${claim('snapshot_json', ['value','seed','gameId'], '$game')})
    AND (play_id=$play OR ${claim('snapshot_json', ['scope','playId'], '$play',true)}
      OR ${claim('snapshot_json', ['value','seed','playId'], '$play',true)})`).all({ game: gameId, play: playId });
  if (rows.length) throw new Error('same-PA physical cut sealed by post-play review');
};
