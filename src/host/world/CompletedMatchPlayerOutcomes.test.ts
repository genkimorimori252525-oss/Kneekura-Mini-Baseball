import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync as NativeDatabase } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { SqliteOfficialStateStore, type PersistOfficialFinalInput, type PersistOfficialPlayInput } from '../SqliteOfficialStateStore';
import { openSqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import { deriveOfficialPendingNonLiveResult } from '../OfficialPendingPostPlay';
import { foulTerminalCompletedOfficial } from '../OfficialTerminalPostPlayReceipt';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteOfficialPlayerOutcomeStore } from './SqliteOfficialPlayerOutcomeStore';
import type { OfficialPlayerOutcomeSource, OfficialPlayerOutcomeAttribution } from './OfficialPlayerOutcomeEvidenceFromSqlite';
import type { FoulTerminalFinalCompletion } from './ActualFoulTerminalPostPlayCompletion';
import { readPhysicalClosureScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';

// Original physical attribution, reserved release and terminal completion are
// explicit lower-owner substitutions. Official applications, scoring derivation,
// contiguous history/line score, census, Native transactions and outcome storage
// are real. These finite cases do not qualify a genuine physical game.
vi.mock('./OfficialPlayerOutcomeEvidenceFromSqlite', async original => ({
  ...await original<typeof import('./OfficialPlayerOutcomeEvidenceFromSqlite')>(),
  deriveOfficialPlayerOutcomeFromSqlite(db: NativeDatabase, source: OfficialPlayerOutcomeSource) {
    if (!db.isTransaction) throw new Error('fixture requires the owned Native transaction');
    const row = db.prepare('SELECT evidence_json FROM test_outcome_originals WHERE owner=? AND source_id=?').get(source.owner, source.sourceId);
    if (!row) throw new Error('fixture original outcome missing');
    return JSON.parse(String(row.evidence_json));
  },
}));
// This fixture labels synthetic strikeouts as each physical owner; the terminal
// scoring original is substituted with that same real archived scoring row.
vi.mock('./ActualFoulTerminalScoringEvidenceFromSqlite', () => ({
  terminalScoringProof: (_db: NativeDatabase, read: () => unknown) => read(),
  foulTerminalScoringEvidenceFromSqlite(db: NativeDatabase) {
    return { prepare(sourceId: string) {
      const row = db.prepare('SELECT request_json,result_json FROM official_scoring_applications WHERE closure_id=?').get(sourceId);
      return row ? { input: JSON.parse(String(row.request_json)).input, result: JSON.parse(String(row.result_json)) } : null;
    } };
  },
}));
const releases = vi.hoisted(() => ({ finalAllowed: [] as boolean[] }));
vi.mock('./SamePlateAppearanceTerminalActivation', () => ({
  assertSamePaTerminalApplicationCompleted(_db: NativeDatabase, _id: string, allowFinal = false) { releases.finalAllowed.push(allowFinal); },
}));
vi.mock('../OfficialTerminalPostPlayCompletion', async original => ({
  ...await original<typeof import('../OfficialTerminalPostPlayCompletion')>(),
  readOfficialCompletedTerminalMatch() { return null; },
}));
vi.mock('./ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite', () => ({
  foulTerminalPostPlayCompletionEvidenceFromSqlite(db: NativeDatabase) {
    return { read(sourceId: string) {
      const row = db.prepare('SELECT original_json FROM test_terminal_original WHERE source_id=?').get(sourceId);
      if (!row) return null;
      return JSON.parse(String(row.original_json));
    } };
  },
}));

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const handles: { close(): void }[] = [];
const keep = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
afterEach(() => { for (const handle of handles.splice(0).reverse()) handle.close(); releases.finalAllowed.length = 0; });
const owners: OfficialPlayerOutcomeSource['owner'][] = ['physical_play_closures', 'actual_live_play_closures',
  'actual_foul_terminal_applications', 'pa_terminal_v1_transitions', 'physical_play_closures', 'pa_terminal_v1_transitions'];
const scope = { careerId: 'career', gameId: 'game' };
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'completed-outcomes-')), 'fixture.sqlite');
  const match = keep(new SqliteOfficialStateStore(path)), scoring = keep(openSqliteOfficialScoringStore(path));
  const db = keep(new DatabaseSync(path));
  const binding = match.registerOfficialFixture({ gameId: 'game', venueId: 'venue', fixtureEventId: 'fixture', fixtureRevision: 0 });
  match.initializeMatch('game', { ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top', outs: 0,
    balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 0 });
  const originals: OfficialPlayerOutcomeAttribution[] = [], applications: (PersistOfficialPlayInput | PersistOfficialFinalInput)[] = [];
  for (let i = 0; i < 6; i++) {
    const before = match.getMatch('game')!.matchState;
    let timeline = createCanonicalPlateAppearanceTimeline(before, 100 * i);
    for (let pitch = 1; pitch <= 3; pitch++) timeline = recordCountedPitch(timeline, 100 * i + pitch, { kind: 'called_strike' });
    let ledger = createPlayAdjudicationLedger({ playId: i, ruleProfileId: before.ruleProfileId, playEnd: null });
    ledger = recordCorrectRuleSnapshot(ledger, 0, { eventId: `rule-${i}`, snapshotId: `rule-${i}`, tick: 100 * i + 4,
      evidenceRevision: 1, ruling: { outsAfter: before.outs + 1, basesAfter: before.bases, scoredRunnerIds: [] } });
    ledger = closeOfficialPlay(ledger, 1, { eventId: `close-${i}`, closureId: `closure-${i}`, tick: 100 * i + 5 });
    const common = { kind: 'non_live' as const, matchId: 'game', applicationId: `official-${i}`, expectedDurableRevision: i,
      match: before, timeline, adjudication: ledger, context: { kind: 'strikeout' as const } };
    const application: PersistOfficialPlayInput | PersistOfficialFinalInput = i === 5 ? { ...common, game: {
      seasonId: 'edition', homeClubId: 'home', awayClubId: 'away', venueBinding: binding,
      policy: { version: 'fixture', minimumInnings: 1, maximumInnings: 1, tiesAllowed: true },
      lineScore: { innings: [{ inning: 1, awayRuns: 0, homeRuns: 0 }], totals: {
        away: { runs: 0, hits: 0, errors: 0 }, home: { runs: 0, hits: 0, errors: 0 } } },
    } } : { ...common, nextStartedAtTick: 100 * i + 6, worldSetup: {
      baseCenters: { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
      defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const).map((registeredPosition, j) => ({
        playerId: `defender-${j}`, registeredPosition, position: { x: j, z: j } })), activePreviousPlayControllerIds: [],
    } };
    if ('game' in application) match.applyAndFinalize(application); else match.applyAndActivate(application);
    const score = scoring.apply({ scoringApplicationId: `score-${i}`, officialApplication: application });
    const batterSide = before.half === 'top' ? 'AWAY' : 'HOME';
    const participant = (side: 'HOME' | 'AWAY') => ({ gameId: 'game', careerId: 'career', competitionEditionId: 'edition', gameDay: 5,
      clubId: side === 'HOME' ? 'home' : 'away', side, playerId: side, personId: `person-${side}`, personLinkSourceId: `person-${side}`,
      rosterRevision: 1, fixtureEventId: 'fixture' });
    const batter = participant(batterSide), pitcher = participant(batterSide === 'HOME' ? 'AWAY' : 'HOME');
    originals.push({ kind: 'attributed', source: { owner: owners[i], sourceId: `closure-${i}` }, sourceProofHash: `fixture-proof-${i}`,
      attributionId: json(['official_player_outcome_v1', 'career', 'game', i]), careerId: 'career', competitionEditionId: 'edition',
      gameId: 'game', playId: i, gameDay: 5, batterPlayerId: batter.playerId, pitcherPlayerId: pitcher.playerId,
      classification: 'strikeout', batter, pitcher, batterPersonHash: 'batter-proof', pitcherPersonHash: 'pitcher-proof',
      officialApplicationId: `official-${i}`, durableRevision: i + 1, scoring: score });
    applications.push(application);
  }
  db.exec(`CREATE TABLE test_outcome_originals(owner TEXT,source_id TEXT,evidence_json TEXT,PRIMARY KEY(owner,source_id));
    CREATE TABLE test_terminal_original(source_id TEXT PRIMARY KEY,original_json TEXT);`);
  for (const owner of new Set(owners)) db.exec(`CREATE TABLE ${owner}(source_id TEXT PRIMARY KEY,game_id TEXT,play_id INTEGER,
    application_id TEXT,source_json TEXT,${owner === 'pa_terminal_v1_transitions' ? 'snapshot_json' : 'proposal_json'} TEXT,result_json TEXT);`);
  const put = (value: OfficialPlayerOutcomeAttribution) => db.prepare('INSERT OR REPLACE INTO test_outcome_originals VALUES(?,?,?)')
    .run(value.source.owner, value.source.sourceId, json(value));
  for (const value of originals) {
    put(value);
    db.prepare(`INSERT INTO ${value.source.owner} VALUES(?,?,?,?,?,?,?)`).run(value.source.sourceId, 'game', value.playId,
      value.officialApplicationId, json({ sourceId: value.source.sourceId, applicationId: value.officialApplicationId }), '{}', '{}');
  }
  const open = () => keep(openSqliteOfficialPlayerOutcomeStore(path)), store = open();
  const retained = () => ({ applications: db.prepare('SELECT * FROM official_player_outcome_applications ORDER BY attribution_id').all(),
    heads: db.prepare('SELECT * FROM official_player_outcome_heads').all() });
  const foulFinal = () => {
    const finalInput = applications[5] as Extract<PersistOfficialFinalInput, { kind: 'non_live' }>, { game, ...body } = finalInput;
    const { lineScore: _lineScore, venueBinding, ...gamePolicy } = game;
    if (!venueBinding) throw new Error('fixture final requires its registered venue binding');
    const boundGame = { ...gamePolicy, venueBinding };
    const proposal = { source: { sourceId: 'closure-5', applicationId: 'official-5', sourceVersion: 'fixture' }, gameId: 'game', playId: 5,
      originalOfficialRevision: 5, applicationBody: { ...body, mode: 'non_live_pending_post_play_v1' as const, game: boundGame } };
    const origin = { owner: 'actual_foul_terminal_applications' as const, sourceId: 'closure-5', sourceVersion: 'fixture',
      sourceHash: hash(proposal.source), snapshotHash: hash(proposal) };
    const pendingInput = { ...body, mode: 'non_live_pending_post_play_v1' as const, game: boundGame, origin };
    const pending = deriveOfficialPendingNonLiveResult(pendingInput, 6);
    const scoredInput = { scoringApplicationId: 'score-5', officialApplication: pendingInput };
    db.prepare('UPDATE official_scoring_applications SET request_json=? WHERE scoring_application_id=?').run(json({ input: scoredInput, evidence: null }), 'score-5');
    const scored = db.prepare('SELECT * FROM official_scoring_applications WHERE scoring_application_id=?').get('score-5')!;
    const completion = { version: 'actual_foul_terminal_post_play_completion_v2', kind: 'game_final', completionId: 'completion',
      terminalReference: origin, source: { sourceId: 'setup' }, sourceHash: 'c'.repeat(64), snapshotHash: 'd'.repeat(64),
      scoringReference: { scoringApplicationId: 'score-5', rowHash: hash(scored) }, finalResult: match.getMatch('game')!.finalResult,
    } as unknown as FoulTerminalFinalCompletion;
    const official = foulTerminalCompletedOfficial(pending, completion);
    db.prepare('UPDATE applications SET request_hash=?,result_json=? WHERE application_id=?').run(pending.pendingPostPlay.requestHash, json(official), 'official-5');
    db.prepare('INSERT INTO test_terminal_original VALUES(?,?)').run('closure-5', json({ proposal, status: 'POST_PLAY_COMPLETED_FINAL', result: { official: pending, completion } }));
    db.prepare('DELETE FROM pa_terminal_v1_transitions WHERE source_id=?').run('closure-5');
    db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?)').run('closure-5', 'game', 5, 'official-5', '{}', '{}', '{}');
    originals[5] = { ...originals[5], source: { owner: 'actual_foul_terminal_applications', sourceId: 'closure-5' } }; put(originals[5]);
    return pending.pendingPostPlay.requestHash;
  };
  return { db, store, open, originals, retained, put, foulFinal };
};

it('delivers all four discovered owners once, aggregates and retries after reopen', () => {
  const f = fixture(), result = f.store.applyCompletedGame(scope), before = f.retained();
  expect(result.coverage).toBe('all_official_plays_attributed');
  expect(result.plays.map(play => play.outcome)).toEqual(f.originals);
  expect(releases.finalAllowed).toContain(true);
  expect(before.applications).toHaveLength(6);
  expect(f.store.aggregate({ ...scope, competitionEditionId: 'edition', playerId: 'AWAY', asOfDay: 5 }).batting.classifiedPlays).toBe(3);
  f.store.close(); expect(f.open().applyCompletedGame(scope)).toEqual(result); expect(f.retained()).toEqual(before);
});
it('keeps missing, ambiguous and unsupported originals explicit while admitting supported plays', () => {
  const f = fixture();
  f.db.exec("DELETE FROM physical_play_closures WHERE source_id='closure-0'");
  f.db.exec("INSERT INTO physical_play_closures VALUES('rival','game',1,'official-1','{}','{}','{}')");
  f.db.prepare('UPDATE test_outcome_originals SET evidence_json=? WHERE source_id=?').run(json({ kind: 'unavailable',
    source: f.originals[2].source, reason: 'supported_official_scoring_missing' }), 'closure-2');
  const result = f.store.applyCompletedGame(scope);
  expect(result.coverage).toBe('attributed_supported_plays_only');
  expect(result.plays.slice(0, 3).map(play => play.outcome)).toMatchObject([
    { reason: 'original_owner_missing' }, { reason: 'original_owner_ambiguous' }, { reason: 'supported_official_scoring_missing' }]);
  expect(f.retained().applications).toHaveLength(3);
});
it('rejects an array-wrapped owner application claim under another indexed identity', () => {
  const f = fixture();
  f.db.exec(`INSERT INTO physical_play_closures VALUES('hidden','other',99,'other','{"applicationId":["other","official-0"]}','{}','{}')`);
  expect(() => f.store.applyCompletedGame(scope)).toThrow('original owner identity'); expect(f.retained().applications).toHaveLength(0);
});
it('rolls back the whole game when a later original has the wrong Career', () => {
  const f = fixture(); f.put({ ...f.originals[5], careerId: 'wrong-career' });
  expect(() => f.store.applyCompletedGame(scope)).toThrow('attribution scope'); expect(f.retained().applications).toHaveLength(0);
  expect(f.retained().heads).toHaveLength(0);
});
it.each(['proof', 'owner', 'application', 'fixture'] as const)('reauthenticates %s after completed delivery', change => {
  const f = fixture(); f.store.applyCompletedGame(scope); const before = f.retained();
  if (change === 'proof') f.put({ ...f.originals[0], sourceProofHash: 'changed' });
  if (change === 'owner') f.db.exec("DELETE FROM physical_play_closures WHERE source_id='closure-0'");
  if (change === 'application') f.db.exec("DELETE FROM official_scoring_applications WHERE official_application_id='official-0'");
  if (change === 'fixture') f.db.exec("UPDATE official_fixtures SET fixture_event_id='other'");
  expect(() => f.store.applyCompletedGame(scope)).toThrow(); expect(f.retained()).toEqual(before);
});
it('rolls back an INSERT-trigger change of final evidence and all prior admissions', () => {
  const f = fixture();
  f.db.exec(`CREATE TRIGGER changed_final AFTER INSERT ON official_player_outcome_applications WHEN NEW.play_id=5 BEGIN
    UPDATE applications SET request_hash='changed' WHERE application_id='official-5'; END`);
  expect(() => f.store.applyCompletedGame(scope)).toThrow(); expect(f.retained().applications).toHaveLength(0);
  expect(f.db.prepare("SELECT request_hash FROM applications WHERE application_id='official-5'").get()!.request_hash).not.toBe('changed');
});
it('delivers a completed foul final with its pending hash and retains the prior-play rejection', () => {
  const f = fixture(), pendingHash = f.foulFinal();
  expect(f.store.applyCompletedGame(scope).coverage).toBe('all_official_plays_attributed');
  expect(f.db.prepare("SELECT request_hash FROM applications WHERE application_id='official-5'").get()!.request_hash).toBe(pendingHash);
  expect(() => readPhysicalClosureScoringHistory(f.db, { gameId: 'game', officialRevision: 6 })).toThrow('terminal final result cannot precede a later play');
});
it('rejects a competing physical result raw game/play claim before writing outcomes', () => {
  const f = fixture();
  f.db.prepare('INSERT INTO physical_play_closures VALUES(?,?,?,?,?,?,?)').run('raw-rival', 'other', 99, 'other-application', '{}', '{}',
    json({ sourceId: 'raw-rival', gameId: 'game', playId: 1 }));
  expect(() => f.store.applyCompletedGame(scope)).toThrow('original owner identity differs');
  expect(f.retained()).toEqual({ applications: [], heads: [] });
});
it('reauthenticates unavailable evidence after later writes and rolls back a changed result', () => {
  const f = fixture(), unavailable = { kind: 'unavailable', source: f.originals[0].source, reason: 'original_batter_missing' };
  f.db.prepare('UPDATE test_outcome_originals SET evidence_json=? WHERE source_id=?').run(json(unavailable), 'closure-0');
  f.db.exec('CREATE TABLE test_restored_original(evidence_json TEXT)');
  f.db.prepare('INSERT INTO test_restored_original VALUES(?)').run(json(f.originals[0]));
  f.db.exec(`CREATE TRIGGER restore_unavailable AFTER INSERT ON official_player_outcome_applications WHEN NEW.play_id=5 BEGIN
    UPDATE test_outcome_originals SET evidence_json=(SELECT evidence_json FROM test_restored_original) WHERE source_id='closure-0'; END`);
  expect(() => f.store.applyCompletedGame(scope)).toThrow('unavailable original changed during admission');
  expect(f.retained()).toEqual({ applications: [], heads: [] });
  expect(JSON.parse(String(f.db.prepare("SELECT evidence_json FROM test_outcome_originals WHERE source_id='closure-0'").get()!.evidence_json))).toEqual(unavailable);
});

it.each([false, true])('reads completed original pitching responsibility without rewriting archives (foul final: %s)', foul => {
  const f = fixture(); if (foul) f.foulFinal(); f.store.applyCompletedGame(scope);
  const archive = () => ({ official: f.db.prepare('SELECT * FROM applications ORDER BY application_id').all(),
    scoring: f.db.prepare('SELECT * FROM official_scoring_applications ORDER BY scoring_application_id').all() });
  const originalArchives = archive();
  const before = f.retained(), result = f.store.readCompletedGamePitching(scope);
  expect(result?.runs).toEqual([]);
  expect(result?.outcomes).toHaveLength(6);
  expect(result?.judgmentSourceEventId).toBeNull();
  expect(f.store.aggregate({ careerId: 'career', competitionEditionId: 'edition', playerId: 'AWAY', asOfDay: 5 }).pitchingResponsibility)
    .toMatchObject({ coverage: 'completed_attributed_games_only', gameIds: ['game'], runsAllowed: { value: 0 }, earnedRuns: { value: 0 } });
  f.store.close(); expect(f.open().readCompletedGamePitching(scope)).toEqual(result); expect(f.retained()).toEqual(before); expect(archive()).toEqual(originalArchives);
});
