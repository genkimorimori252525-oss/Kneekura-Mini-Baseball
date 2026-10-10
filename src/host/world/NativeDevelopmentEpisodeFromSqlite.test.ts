import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { practiceFixture } from './PitchPracticeAttempt.test-support';
import { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';
import { readNativeDevelopmentEpisodeFromSqlite as read } from './NativeDevelopmentEpisodeFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { managerRosterEvidenceFromSqlite } from './SqliteManagerRosterDecisionStore';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('reads the exact original roster prefix after writers close and rejects original provenance corruption', async () => {
  const f = await practiceFixture(cleanup), saved = f.sources.episodes.read('episode')!;
  expect(f.count('world_development_roster_origins')).toBe(1);
  const original = f.snapshot('world_development_initiations');
  f.close();
  const db = new DatabaseSync(f.path); cleanup.push(() => db.close());
  db.exec('BEGIN');
  const roster = managerRosterEvidenceFromSqlite(db);
  try {
    expect(read(db, 'episode', 2)).toEqual(saved);
    expect(read(db, 'episode', 1)?.episode.stage).toBe('ENGAGED');
    expect(JSON.stringify(db.prepare('SELECT * FROM world_development_initiations ORDER BY rowid').all())).toBe(original);
    db.exec("UPDATE world_development_roster_origins SET origin_hash='broken'");
    expect(() => read(db, 'episode', 2)).toThrow('archive');
  } finally { db.exec('ROLLBACK'); }
  expect(() => roster.readExecution('promotion-execution')).toThrow('active transaction');
});

it('requires reacquiring the original roster inputs and rolls back a corrupt archive admission', async () => {
  const f = await practiceFixture(cleanup), original = f.snapshot('world_development_initiations');
  f.db.exec('DELETE FROM world_development_roster_origins');
  f.db.exec('BEGIN');
  try { expect(() => read(f.db, 'episode', 2)).toThrow('archive is missing'); }
  finally { f.db.exec('ROLLBACK'); }
  f.db.exec("CREATE TRIGGER corrupt_roster_archive AFTER INSERT ON world_development_roster_origins BEGIN UPDATE world_development_roster_origins SET origin_hash='broken'; END");
  expect(() => f.sources.episodes.archiveRosterOrigin('episode')).toThrow('archive');
  expect(f.count('world_development_roster_origins')).toBe(0);
  f.db.exec('DROP TRIGGER corrupt_roster_archive');
  const accepted = f.sources.episodes.archiveRosterOrigin('episode');
  expect(accepted.episode.revision).toBe(1);
  expect(f.sources.episodes.archiveRosterOrigin('episode')).toEqual(accepted);
  expect(f.snapshot('world_development_initiations')).toBe(original);
});

it('replays the existing practice-origin boundary without a live discovery provider', () => {
  const f = practiceOriginBehaviorFixture(cleanup), first = f.episodes.applyPractice(f.packet.request);
  f.appraisals.clear(); f.policies.clear();
  f.base.db.exec('BEGIN');
  try {
    expect(read(f.base.db, first.episode.episodeId, first.episode.revision)).toEqual(first);
    f.base.db.prepare('UPDATE pitch_practice_attempts SET immutable_hash=? WHERE attempt_id=?').run(json('broken'), f.origin.completed.attemptId);
    expect(() => read(f.base.db, first.episode.episodeId, first.episode.revision)).toThrow();
  } finally { f.base.db.exec('ROLLBACK'); }
});

it.each(['change', 'delete'] as const)('rolls back original initiation %s during roster archive INSERT', async action => {
  const f = await practiceFixture(cleanup);
  f.db.exec('DELETE FROM world_development_roster_origins');
  const before = f.snapshot('world_development_initiations');
  const mutation = action === 'change' ? "UPDATE world_development_initiations SET current_json='{}' WHERE episode_id=NEW.episode_id;"
    : 'DELETE FROM world_development_initiations WHERE episode_id=NEW.episode_id;';
  f.db.exec(`CREATE TRIGGER corrupt_original_initiation AFTER INSERT ON world_development_roster_origins BEGIN ${mutation} END`);
  expect(() => f.sources.episodes.archiveRosterOrigin('episode')).toThrow('original initiation changed');
  expect(f.count('world_development_roster_origins')).toBe(0);
  expect(f.snapshot('world_development_initiations')).toBe(before);
});
