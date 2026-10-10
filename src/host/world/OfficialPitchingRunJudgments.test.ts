import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync as Native } from 'node:sqlite';
import type { OfficialPitchingRunOriginal } from './OfficialPitchingRunEvidenceFromSqlite';
import type { OfficialPitchingRunJudgment } from '../../core/world/competition/OfficialPitchingRunResponsibility';
import { openSqliteOfficialPlayerOutcomeStore } from './SqliteOfficialPlayerOutcomeStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Only the complete original-game producer is substituted. The outcome owner,
// accepted judgment, Native transaction, replay and post-write checks are real.
vi.mock('./OfficialPitchingRunEvidenceFromSqlite', () => ({
  readOfficialPitchingRunOriginal(db: Native, careerId: string, gameId: string) {
    if (!db.isTransaction) throw new Error('fixture requires an owned transaction');
    const row = db.prepare('SELECT original_json FROM test_pitching_original WHERE career_id=? AND game_id=?').get(careerId, gameId);
    return row ? JSON.parse(String(row.original_json)) as OfficialPitchingRunOriginal : null;
  },
}));
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const handles: { close(): void }[] = [];
const keep = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
afterEach(() => { for (const h of handles.splice(0).reverse()) h.close(); });
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'pitching-run-judgment-')), 'fixture.sqlite'), db = keep(new DatabaseSync(path));
  db.exec('CREATE TABLE test_pitching_original(career_id TEXT, game_id TEXT, original_json TEXT)');
  const original = { careerId: 'career', gameId: 'game', competitionEditionId: 'edition', ruleProfileId: 'npb-2026', originalProofHash: 'original-proof', outcomes: [], runs: [{
    runId: 'run', gameId: 'game', scoringApplicationId: 'later', scoringPlayId: 2, fieldingSide: 'home', runnerId: 'A',
    runnerStintId: 'stint', runnerEntryApplicationId: 'entry', responsibility: { pitcherPlayerId: 'Peter', entryApplicationId: 'entry', entryAttributionId: 'attribution', transferApplicationIds: [] },
    unavailableReason: null, runnerReachedOnError: false, pitcherEarned: null, teamEarned: null,
  }] };
  db.prepare('INSERT INTO test_pitching_original VALUES(?,?,?)').run('career', 'game', json(original));
  const evidence: OfficialPitchingRunJudgment = { schemaVersion: 1, sourceKind: 'official_pitching_run_scorer_judgment',
    sourceEventId: 'assessment', scorerId: 'scorer', ruleProfileId: 'npb-2026', careerId: 'career', gameId: 'game', originalProofHash: 'original-proof',
    runs: [{ runId: 'run', runnerStintId: 'stint', responsiblePitcherId: 'Peter', responsibilityEntryApplicationId: 'entry', pitcherEarned: true, teamEarned: false }] };
  const open = (accepted = false) => keep(openSqliteOfficialPlayerOutcomeStore(path, accepted ? { readAcceptedPitchingRunJudgment: () => evidence } : undefined));
  const store = open(true), scope = { careerId: 'career', gameId: 'game' };
  const census = () => ({ original: db.prepare('SELECT * FROM test_pitching_original').all(),
    judgments: db.prepare('SELECT * FROM official_player_pitching_run_judgments').all(),
    attributions: db.prepare('SELECT * FROM official_player_outcome_applications').all() });
  return { db, store, open, scope, census, evidence };
};
it('archives a separate accepted assessment and replays without authority after reopen', () => {
  const f = fixture(); expect(f.store.readCompletedGamePitching(f.scope)?.runs[0].pitcherEarned).toBeNull();
  const result = f.store.applyPitchingRunJudgment('assessment'), before = f.census();
  expect(result.runs[0]).toMatchObject({ pitcherEarned: true, teamEarned: false, responsibility: { pitcherPlayerId: 'Peter' } });
  expect(before.attributions).toEqual([]);
  f.store.close(); const reopened = f.open();
  expect(reopened.applyPitchingRunJudgment('assessment')).toEqual(result);
  expect(reopened.readCompletedGamePitching(f.scope)).toEqual(result); expect(f.census()).toEqual(before);
});
it('rejects a changed original on read and retry, and requires authority for first admission', () => {
  const f = fixture(); expect(() => f.open().applyPitchingRunJudgment('assessment')).toThrow('missing');
  f.store.applyPitchingRunJudgment('assessment');
  f.db.exec("UPDATE test_pitching_original SET original_json=json_set(original_json,'$.originalProofHash','changed')");
  expect(() => f.open().readCompletedGamePitching(f.scope)).toThrow();
  expect(() => f.open().applyPitchingRunJudgment('assessment')).toThrow();
});
it.each(['original', 'receipt'] as const)('rolls back AFTER INSERT tampering with %s before commit', target => {
  const f = fixture(); f.db.exec(target === 'original'
    ? "CREATE TRIGGER corrupt AFTER INSERT ON official_player_pitching_run_judgments BEGIN UPDATE test_pitching_original SET original_json=json_set(original_json,'$.originalProofHash','changed'); END"
    : "CREATE TRIGGER corrupt AFTER INSERT ON official_player_pitching_run_judgments BEGIN UPDATE official_player_pitching_run_judgments SET result_json='[]' WHERE source_event_id=NEW.source_event_id; END");
  const before = f.census(); expect(() => f.store.applyPitchingRunJudgment('assessment')).toThrow(); expect(f.census()).toEqual(before);
  f.db.exec('DROP TRIGGER corrupt'); expect(f.open(true).applyPitchingRunJudgment('assessment').runs[0].pitcherEarned).toBe(true);
});
