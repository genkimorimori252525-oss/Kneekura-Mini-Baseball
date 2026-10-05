import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { playerRunnerDecisionMotionModelEvidenceFromSqlite } from './SqlitePlayerRunnerDecisionMotionModelStore';

it('reads a missing runner model without requiring intake or roster schema', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    // Own the only handle even when reader construction fails. This is an empty
    // installed model owner, not an intake fixture or accepted Person snapshot.
    db.exec(`CREATE TABLE world_player_runner_decision_motion_models (
      source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, capability TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
      person_link_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
      source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
      UNIQUE(career_id,player_id));`);
    expect(db.prepare('SELECT count(*) AS n FROM world_player_runner_decision_motion_models').get()!.n).toBe(0);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('world_player_person_links','world_roster_heads')").all()).toEqual([]);
    let own: ReturnType<typeof playerRunnerDecisionMotionModelEvidenceFromSqlite>;
    try { own = playerRunnerDecisionMotionModelEvidenceFromSqlite(db); }
    catch (error) {
      if (error instanceof Error && error.message === 'no such table: world_player_person_links') {
        throw new Error('missing runner model read eagerly requires unavailable intake schema');
      }
      throw error;
    }
    expect(own.read('missing-runner-model')).toBeNull();
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('world_player_person_links','world_roster_heads')").all()).toEqual([]);
  } finally { db.close(); }
});
