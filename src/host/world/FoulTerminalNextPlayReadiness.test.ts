import { expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { withFoulTerminalOriginalScope } from './FoulTerminalCompletionAncestryGuard';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

// These deliberately skeletal Native rows test rejection/census boundaries.
// They are not accepted physical histories or completed terminal artifacts.
test('TN-S01 structural retained foul end requires an authenticated scoped owner', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE applications(application_id TEXT,match_id TEXT,result_json TEXT);
      CREATE TABLE actual_foul_play_ends(game_id TEXT,play_id INTEGER);`);
    db.prepare('INSERT INTO applications VALUES(?,?,?)').run('app','game',JSON.stringify({ receipt:{applicationId:'app',previousPlayId:1} }));
    db.prepare('INSERT INTO actual_foul_play_ends VALUES(?,?)').run('game',1);
    expect(() => assertPriorPhysicalClosureCompleted(db,'app'),'RETAINED_FOUL_END_CENSUS_MISSING').toThrow(/owner|closure/);
  } finally { db.close(); }
});
test('TN-S02 structural activation census rejects self forward and foreign original ancestry before dispatch', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE applications(application_id TEXT,match_id TEXT,result_json TEXT)');
    for (const [game,previous] of [['game',2],['game',3],['foreign',1],['game',0]] as const) {
      db.exec('DELETE FROM applications');
      db.prepare('INSERT INTO applications VALUES(?,?,?)').run('app',game,JSON.stringify({receipt:{applicationId:'app',previousPlayId:previous},activation:{previousPlayId:previous,nextMatchState:{playId:previous+1}}}));
      expect(() => withFoulTerminalOriginalScope(db,'terminal-2','game',2, () => assertPriorPhysicalClosureCompleted(db,'app')),
        'PRIOR_ACTIVATION_ANCESTRY_NOT_ENFORCED').toThrow(/ancestry/);
    }
  } finally { db.close(); }
});
