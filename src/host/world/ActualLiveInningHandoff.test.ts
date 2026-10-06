// The already authenticated physical graph is mocked. This suite proves the legal
// closure handoff and SQLite transaction only, never physical/Native acceptance.
import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const physical = vi.hoisted(() => ({ adjudication: null as any, end: null as any, baseField: null as any, players: [] as any[] }));
vi.mock('./ActualLiveAdjudicationFromSqlite', () => ({ actualLiveAdjudicationEvidenceFromSqlite: () => ({
  read: () => physical.adjudication,
  // Both reader shapes substitute the same synthetic physical boundary.
  readWithClosureInputs: () => ({ value: physical.adjudication, end: physical.end,
    prefix: { baseField: physical.baseField, fields: [], executions: [{ source: { sourceId: physical.end.source.executionSourceId } }] } }),
}) }));
vi.mock('./SqliteActualFirstBasePlayEndStore', () => ({ actualFirstBaseClosedEvidenceFromSqlite: () => ({ read: () => physical.end }) }));
// Preserve the real traversal, transaction snapshot and cleanup guards.
vi.mock('./SqliteBattedWorldFieldStore', async importOriginal => ({
  ...await importOriginal<typeof import('./SqliteBattedWorldFieldStore')>(),
  battedWorldFieldEvidenceFromSqlite: () => ({ read: () => physical.baseField, scope: () => [] }),
}));
vi.mock('./SqliteBattedWorldFieldExecutionStore', async importOriginal => ({
  ...await importOriginal<typeof import('./SqliteBattedWorldFieldExecutionStore')>(),
  battedWorldFieldExecutionEvidenceFromSqlite: () => ({ scope: () => [] }),
}));
vi.mock('./ActualPlayerKinematicsFromPrefix', () => ({ actualPlayersKinematicsFromPrefix: () => physical.players }));
import { openSqliteActualLivePlayClosureStore } from './SqliteActualLivePlayClosureStore';
import { actualLivePlayClosureInput } from './ActualLivePlayClosureSource';
import { assertPriorActualLiveClosureCompleted } from './ActualLivePlayClosureEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const policy = { version: 'accepted-nine-inning-v1', minimumInnings: 9, tiesAllowed: false };
const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
function fixture(patch: Partial<CanonicalMatchState> = {}, includePolicy = true, scoredRunnerIds: readonly string[] = []) {
  const directory = mkdtempSync(join(tmpdir(), 'actual-inning-handoff-')), path = join(directory, 'state.sqlite');
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
  const match: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top', outs: 2,
    balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 7, ...patch };
  const setup = (side: 'HOME' | 'AWAY'): BetweenPlayWorldSetup => ({ baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
    defenders: positions.map((registeredPosition, i) => ({ playerId: `${side}-${i}`, registeredPosition, position: { x: i, z: i } })), activePreviousPlayControllerIds: [] });
  const oldSide = match.half === 'top' ? 'HOME' : 'AWAY', nextSide = match.outs === 2 ? oldSide === 'HOME' ? 'AWAY' : 'HOME' : oldSide;
  const nextSetup = setup(nextSide), originalWorld = setup(oldSide), batterId = `${oldSide === 'HOME' ? 'AWAY' : 'HOME'}-0`;
  const official = new SqliteOfficialStateStore(path);
  official.registerOfficialFixture({ gameId: 'game', venueId: 'venue', fixtureEventId: 'fixture', fixtureRevision: 0 });
  official.initializeMatch('game', match); official.close();
  const db = new DatabaseSync(path); cleanups.push(() => db.close());
  db.exec(`CREATE TABLE actual_live_adjudications(source_id TEXT);
    CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT,PRIMARY KEY(game_id,player_id));
    CREATE TABLE world_season_heads(career_id TEXT,season_id TEXT,schedule_json TEXT);
    CREATE TABLE world_player_person_links(source_id TEXT,career_id TEXT,player_id TEXT,person_id TEXT,roster_revision INTEGER,accepted_at_day INTEGER,source_json TEXT);`);
  db.prepare('INSERT INTO world_season_heads VALUES(?,?,?)').run('career', 'season', JSON.stringify({ seasonId: 'season', games: [{ gameId: 'game', homeClubId: 'home', awayClubId: 'away' }] }));
  const bindings: OfficialParticipantBinding[] = [];
  for (const side of ['HOME', 'AWAY'] as const) for (let i = 0; i < 9; i++) {
    const playerId = `${side}-${i}`, personId = `person-${playerId}`, personLinkSourceId = `link-${playerId}`;
    const binding: OfficialParticipantBinding = { gameId: 'game', careerId: 'career', competitionEditionId: 'season', gameDay: 2,
      clubId: side === 'HOME' ? 'home' : 'away', side, playerId, personId, personLinkSourceId, rosterRevision: 0, fixtureEventId: 'fixture' };
    bindings.push(binding); db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game', playerId, JSON.stringify(binding));
    const person = { sourceId: personLinkSourceId, careerId: 'career', playerId, personId, sourceRecordId: `intake-${playerId}`,
      sourceVersion: 'v1', acceptedRevision: 0, acceptedAtDay: 1, rosterRevision: 0 };
    db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(personLinkSourceId, 'career', playerId, personId, 0, 1, json(person));
  }
  const originalBindings = [bindings.find(b => b.playerId === batterId)!, ...bindings.filter(b => b.side === oldSide)];
  const playEnd = { kind: 'play_end' as const, tick: 10, reason: 'live_action_complete' as const };
  const root = createPlayAdjudicationLedger({ playId: match.playId, ruleProfileId: match.ruleProfileId, playEnd });
  const ledger = recordCorrectRuleSnapshot(root, 0, { eventId: 'rule', tick: 10, snapshotId: 'rule', evidenceRevision: 1,
    ruling: { outsAfter: match.outs + 1, basesAfter: match.bases, scoredRunnerIds } });
  const timeline = { playId: match.playId, startedAtTick: 0, lastEventTick: 10, nextSequence: 1,
    status: { kind: 'live_ball_complete' as const, count: { balls: 0, strikes: 0 }, contactTick: 1, playEndTick: 10,
      disposition: { kind: 'fair' as const, fairDeterminationTick: 2 } }, events: [{ kind: 'LiveBallPlayEnded' as const, sequence: 0, tick: 10, payload: { playEnd } }] };
  physical.adjudication = { kind: 'official_ready', pendingReasons: [], source: { sourceId: 'adjudication', physicalEndSourceId: 'end' },
    ledger, originalMatch: match, timeline: { kind: 'projected', timeline }, endReference: { sourceId: 'end', snapshotHash: 'physical-hash' },
    wholeHistoryReference: { hash: 'history-hash' } };
  physical.end = { gameId: 'game', playId: match.playId, playEnd, source: { sourceId: 'end', baseFieldSourceId: 'field', executionSourceId: 'execution' }, futureWork: ['retained-original-work'] };
  physical.baseField = { source: { sourceId: 'field' }, geometry: { geometry: { baseGeometry: { bases: Object.fromEntries(Object.entries(nextSetup.baseCenters).map(([base, center]) => [base, { region: { center } }])) } } },
    response: { touch: { worldContact: { flight: { physicalPitch: { frame: { match, officialRevision: 0, activation: null,
      world: originalWorld, batterActor: { binding: originalBindings[0] }, bindings: originalBindings.slice(1) } } } } } } };
  physical.players = originalBindings.map(b => ({ playerId: b.playerId, personId: b.personId, activeCommand: { sourceId: `command-${b.playerId}` } }));
  const source = { sourceId: 'closure', sourceVersion: 'v1', adjudicationSourceId: 'adjudication', applicationId: 'apply', closureTick: 11,
    nextStartedAtTick: 12, controllerReset: 'rule_system_retire_original_play' as const, worldSetup: nextSetup,
    ...(includePolicy ? { gamePolicy: policy } : {}) };
  const owner = openSqliteActualLivePlayClosureStore(path, { readAcceptedClosure: id => id === source.sourceId ? source : null });
  cleanups.push(() => owner.close());
  return { path, db, owner, source, match, bindings, oldSide, nextSide };
}
function continuing(result: ReturnType<ReturnType<typeof openSqliteActualLivePlayClosureStore>['resume']>) {
  if (!('activation' in result.official)) throw new Error('test expected a continuing official application');
  return result.official;
}
it('hands a third out to explicitly supplied bound defenders without charging them for the old play', () => {
  const f = fixture(), physicalBefore = json(physical), result = f.owner.submit('closure');
  expect(result.official).toMatchObject({ activation: { nextMatchState: { inning: 1, half: 'bottom', outs: 0, playId: 8 } } });
  expect(continuing(result).nextWorld.defenders.map(d => d.playerId)).toEqual(positions.map((_, i) => `AWAY-${i}`));
  expect(result.scoring.kind).toBe('unsupported');
  expect(result.workload.participants).toHaveLength(10);
  expect(result.workload.participants.map(p => p.playerId)).toEqual(['AWAY-0', ...positions.map((_, i) => `HOME-${i}`)]);
  expect(result.nextPhysicalPlay).toEqual({ kind: 'blocked', reason: 'actual_role_workload_pending' });
  expect(json(physical)).toBe(physicalBefore);
  expect(f.owner.submit('closure')).toEqual(result);
  expect(f.db.prepare('SELECT count(*) AS n FROM applications').get()!.n).toBe(1);
  f.owner.close(); const reopened = openSqliteActualLivePlayClosureStore(f.path);
  try { expect(reopened.resume('closure')).toEqual(result); } finally { reopened.close(); }
});
it('hands bottom-third-out to the next inning using the opposite accepted lineup', () => {
  const f = fixture({ inning: 2, half: 'bottom' });
  expect(continuing(f.owner.submit('closure')).activation.nextMatchState).toMatchObject({ inning: 3, half: 'top', outs: 0 });
});
it('requires explicit game policy at the inning boundary and refuses arbitrary H/E input', () => {
  const f = fixture({}, false);
  expect(() => f.owner.submit('closure')).toThrow(/policy|transition.*unsupported/);
  expect(() => actualLivePlayClosureInput({ ...f.source, gamePolicy: policy, lineScore: { hits: 0 } } as any, 'closure')).toThrow();
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
});
it('keeps a final third out pending instead of starting the unplayed bottom half or inventing scoring', () => {
  const f = fixture({ inning: 9, score: { away: 1, home: 2 } });
  expect(() => f.owner.submit('closure')).toThrow(/game final.*scoring/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
  expect(f.db.prepare('SELECT state_json FROM matches').get()!.state_json).toBe(json(f.match));
});
it('keeps a completed bottom half pending when a winner is known', () => {
  const f = fixture({ inning: 9, half: 'bottom', score: { away: 1, home: 2 } });
  expect(() => f.owner.submit('closure')).toThrow(/game final.*scoring/);
});
it('allows a tied extra inning under the accepted unlimited policy', () => {
  const f = fixture({ inning: 9, half: 'bottom', score: { away: 2, home: 2 } });
  expect(continuing(f.owner.submit('closure')).activation.nextMatchState).toMatchObject({ inning: 10, half: 'top', outs: 0 });
});
it.each(['wrong_side', 'missing_binding', 'wrong_person', 'duplicate_role'] as const)('rejects an invalid next defensive handoff: %s', fault => {
  const f = fixture();
  if (fault === 'wrong_side') f.source.worldSetup = { ...f.source.worldSetup, defenders: f.source.worldSetup.defenders.map((d, i) => i ? d : { ...d, playerId: 'HOME-0' }) };
  if (fault === 'missing_binding') f.db.prepare('DELETE FROM official_participant_bindings WHERE player_id=?').run('AWAY-8');
  if (fault === 'wrong_person') f.db.prepare("UPDATE world_player_person_links SET person_id='wrong' WHERE player_id=?").run('AWAY-8');
  if (fault === 'duplicate_role') f.source.worldSetup = { ...f.source.worldSetup, defenders: f.source.worldSetup.defenders.map((d, i) => i ? d : { ...d, registeredPosition: 'C' }) };
  expect(() => f.owner.submit('closure')).toThrow();
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
});
it('rolls back a writer-local next-lineup mutation and preserves exact accepted policy on retry', () => {
  const f = fixture(); f.owner.enqueue('closure');
  f.db.exec("CREATE TRIGGER corrupt_lineup AFTER INSERT ON applications BEGIN DELETE FROM official_participant_bindings WHERE player_id='AWAY-8'; END;");
  expect(() => f.owner.resume('closure')).toThrow(/binding|participant/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
  expect(f.db.prepare('SELECT * FROM official_participant_bindings WHERE player_id=?').get('AWAY-8')).toBeTruthy();
  f.db.exec('DROP TRIGGER corrupt_lineup');
  const accepted = f.owner.resume('closure');
  expect(accepted.official.receipt.durableRevision).toBe(1);
  const row = f.db.prepare('SELECT * FROM actual_live_play_closures').get()!;
  expect(row.source_hash).toBe(hash(f.source));
  f.source.gamePolicy = { ...policy, minimumInnings: 8 };
  expect(() => f.owner.resume('closure')).toThrow(/frozen differently/);
});
it('preserves the old same-inning source and its original defensive roles', () => {
  const f = fixture({ outs: 0 }, false), result = f.owner.submit('closure');
  expect(continuing(result).activation.nextMatchState).toMatchObject({ inning: 1, half: 'top', outs: 1 });
  expect(result.scoring.kind).toBe('unsupported');
  expect(hash(f.owner.read('closure')!.proposal)).toBe('7db89ccfe78c46c09f59c0745b2aa79c7867db92175eedb68cdc0e46637cda83');
});

it.each([true, false])('refuses same-half walkoff activation with explicit policy present=%s', includePolicy => {
  const f = fixture({ inning: 9, half: 'bottom', outs: 0, score: { away: 2, home: 2 } }, includePolicy, ['HOME-0']);
  expect(() => f.owner.submit('closure')).toThrow(includePolicy ? /game final.*scoring/ : /policy/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
  expect(f.db.prepare('SELECT state_json FROM matches').get()!.state_json).toBe(json(f.match));
});

it('rejects a game policy inconsistent with the already accepted non-live owner', () => {
  const f = fixture();
  f.db.exec('CREATE TABLE IF NOT EXISTS physical_closure_game_policies(game_id TEXT PRIMARY KEY,policy_json TEXT NOT NULL)');
  f.db.prepare('INSERT INTO physical_closure_game_policies VALUES(?,?)').run('game', json({ seasonId: 'season', homeClubId: 'home', awayClubId: 'away', policy: { ...policy, minimumInnings: 7 } }));
  expect(() => f.owner.submit('closure')).toThrow(/policy/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
});
it('rolls back a writer-local shared game-policy mutation', () => {
  const f = fixture(); f.owner.enqueue('closure');
  f.db.exec("CREATE TRIGGER corrupt_policy AFTER INSERT ON applications BEGIN UPDATE physical_closure_game_policies SET policy_json='{}' WHERE game_id='game'; END;");
  expect(() => f.owner.resume('closure')).toThrow(/policy/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
  const restored = JSON.parse(String(f.db.prepare('SELECT policy_json FROM physical_closure_game_policies WHERE game_id=?').get('game')!.policy_json));
  expect(restored.policy).toEqual(policy);
  f.db.exec('DROP TRIGGER corrupt_policy');
  expect(f.owner.resume('closure').official.receipt.durableRevision).toBe(1);
});
it.each(['missing_revision', 'negative_revision', 'duplicate_key'] as const)('refuses malformed newly entering binding before enqueue: %s', fault => {
  const f = fixture(), row = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get('AWAY-8')!;
  const binding = JSON.parse(String(row.binding_json));
  if (fault === 'missing_revision') delete binding.rosterRevision;
  if (fault === 'negative_revision') binding.rosterRevision = -1;
  const raw = fault === 'duplicate_key' ? String(row.binding_json).replace('"playerId":', '"playerId":"hidden-foreign-player","playerId":') : JSON.stringify(binding);
  f.db.prepare('UPDATE official_participant_bindings SET binding_json=? WHERE player_id=?').run(raw, 'AWAY-8');
  expect(() => f.owner.enqueue('closure')).toThrow(/binding/);
  expect(f.db.prepare('SELECT * FROM actual_live_play_closures').all()).toEqual([]);
});
it('reopens an already-applied legacy same-half go-ahead without allowing fresh policy-free activation', () => {
  const f = fixture({ inning: 1, half: 'bottom', outs: 0 }, true, ['HOME-0']);
  const accepted = f.owner.submit('closure'), saved = f.owner.read('closure')!;
  // Reconstruct the exact pre-policy archive layout: policy is not part of the
  // official application/result, so all existing official-writer bytes stay intact.
  const source = { ...saved.source } as any; delete source.gamePolicy;
  const proposal = { ...saved.proposal, source } as any; delete proposal.gamePolicy; delete proposal.nextActors;
  f.db.prepare('UPDATE actual_live_play_closures SET source_json=?,source_hash=?,proposal_json=?,proposal_hash=?')
    .run(json(source), hash(source), json(proposal), hash(proposal));
  f.owner.close(); const reopened = openSqliteActualLivePlayClosureStore(f.path);
  try { expect(reopened.read('closure')!.result).toEqual(accepted); expect(reopened.resume('closure')).toEqual(accepted); }
  finally { reopened.close(); }
});
it.each(['playerId', 'clubId', 'fixtureEventId', 'careerId', 'competitionEditionId', 'gameDay'] as const)('rejects next binding scope mismatch in %s', key => {
  const f = fixture(), row = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get('AWAY-8')!;
  const binding = { ...JSON.parse(String(row.binding_json)), [key]: key === 'gameDay' ? 3 : 'foreign' };
  f.db.prepare('UPDATE official_participant_bindings SET binding_json=? WHERE player_id=?').run(JSON.stringify(binding), 'AWAY-8');
  expect(() => f.owner.enqueue('closure')).toThrow(/binding/);
});
it.each(['AWAY-7', 'HOME-7'])('rejects a coherently linked duplicate next Person from %s', alias => {
  const f = fixture(), row = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get('AWAY-8')!;
  const binding = { ...JSON.parse(String(row.binding_json)), personId: `person-${alias}` };
  const linkRow = f.db.prepare('SELECT source_json FROM world_player_person_links WHERE player_id=?').get('AWAY-8')!;
  const link = { ...JSON.parse(String(linkRow.source_json)), personId: binding.personId };
  f.db.prepare('UPDATE official_participant_bindings SET binding_json=? WHERE player_id=?').run(JSON.stringify(binding), 'AWAY-8');
  f.db.prepare('UPDATE world_player_person_links SET person_id=?,source_json=? WHERE player_id=?').run(binding.personId, json(link), 'AWAY-8');
  expect(() => f.owner.enqueue('closure')).toThrow(/Person/);
});

function acceptedFinalScoring(f: ReturnType<typeof fixture>, currentHomeRuns = 0) {
  const source = f.source as any;
  source.worldSetup = null; source.nextStartedAtTick = null;
  source.finalScoring = { sourceId: 'final-score', sourceVersion: 'accepted-aggregate-v1', sourceKind: 'official_scorer_aggregate', scorerId: 'accepted-scorer',
    gameId: 'game', seasonId: 'season', closureSourceId: 'closure', playId: f.match.playId, expectedDurableRevision: 0, recordedAtTick: 11,
    adjudicationReference: { sourceId: 'adjudication', snapshotHash: hash(physical.adjudication) },
    venueBinding: { gameId: 'game', venueId: 'venue', fixtureEventId: 'fixture', fixtureRevision: 0 },
    lineScore: { innings: Array.from({ length: f.match.inning }, (_, i) => ({ inning: i + 1,
      awayRuns: i ? 0 : f.match.score.away,
      homeRuns: i === f.match.inning - 1 ? f.match.half === 'top' ? null : currentHomeRuns : i ? 0 : f.match.score.home })),
      totals: { away: { runs: f.match.score.away, hits: 7, errors: 2 }, home: { runs: f.match.score.home + currentHomeRuns, hits: 8, errors: 1 } } } };
  return source.finalScoring;
}
it('finalizes from accepted nonzero aggregate scoring without fabricating a next defensive world or per-play classification', () => {
  const f = fixture({ inning: 9, score: { away: 1, home: 2 } }), scoring = acceptedFinalScoring(f), before = json(physical);
  const result = f.owner.submit('closure') as any;
  expect(result.official.result).toMatchObject({ completionReason: 'HOME_LEADS_AFTER_TOP', homeRuns: 2, awayRuns: 1, lineScore: scoring.lineScore });
  expect(result.official.activation).toBeUndefined(); expect(result.official.nextWorld).toBeUndefined();
  expect(result.scoring.kind).toBe('unsupported');
  expect(result.workload.participants).toHaveLength(10);
  expect(result.nextPhysicalPlay).toEqual({ kind: 'not_applicable', reason: 'game_final' });
  expect(result.controllerReset).toMatchObject({ previousPlayId: 7, nextPlayId: null, atTick: 11 });
  expect(result.controllerReset.retired).toHaveLength(10);
  expect(json(physical)).toBe(before);
  expect(f.owner.readReadiness('closure')).toMatchObject({ kind: 'game_final', reason: 'game_final', settlement: { kind: 'pending' } });
  expect(f.owner.submit('closure')).toEqual(result);
  f.owner.close(); const reopened = openSqliteActualLivePlayClosureStore(f.path);
  try { expect(reopened.resume('closure')).toEqual(result); expect(reopened.read('closure')!.result).toEqual(result); }
  finally { reopened.close(); }
  const official = new SqliteOfficialStateStore(f.path);
  try { expect(official.getMatch('game')).toMatchObject({ durableRevision: 1, activation: null, nextWorld: null, finalResult: result.official.result }); }
  finally { official.close(); }
  expect(f.db.prepare('SELECT count(*) AS n FROM applications').get()!.n).toBe(1);
});
it('finalizes an explicit accepted walkoff line score using the same preserved closure', () => {
  const f = fixture({ inning: 9, half: 'bottom', outs: 0, score: { away: 2, home: 2 } }, true, ['HOME-0']);
  acceptedFinalScoring(f, 1);
  expect((f.owner.submit('closure').official as any).result).toMatchObject({ completionReason: 'WALK_OFF', homeRuns: 3, awayRuns: 2 });
});
it('leaves a final with no aggregate input named pending even when no next setup is supplied', () => {
  const f = fixture({ inning: 9, score: { away: 1, home: 2 } });
  Object.assign(f.source, { worldSetup: null, nextStartedAtTick: null });
  expect(() => f.owner.submit('closure')).toThrow(/game final.*scoring/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
});
it.each(['source_kind', 'game', 'season', 'closure', 'play', 'revision', 'adjudication', 'fixture', 'recorded_tick', 'missing_hits', 'missing_errors', 'wrong_runs', 'unplayed_bottom'] as const)(
  'rejects unbound or incomplete accepted final scoring: %s', fault => {
    const f = fixture({ inning: 9, score: { away: 1, home: 2 } }), score = acceptedFinalScoring(f);
    if (fault === 'source_kind') score.sourceKind = 'physical_truth';
    if (fault === 'game') score.gameId = 'other';
    if (fault === 'season') score.seasonId = 'other';
    if (fault === 'closure') score.closureSourceId = 'other';
    if (fault === 'play') score.playId++;
    if (fault === 'revision') score.expectedDurableRevision++;
    if (fault === 'adjudication') score.adjudicationReference.snapshotHash = 'foreign';
    if (fault === 'fixture') score.venueBinding.fixtureEventId = 'foreign';
    if (fault === 'recorded_tick') score.recordedAtTick = 10;
    if (fault === 'missing_hits') delete score.lineScore.totals.away.hits;
    if (fault === 'missing_errors') delete score.lineScore.totals.home.errors;
    if (fault === 'wrong_runs') score.lineScore.totals.home.runs++;
    if (fault === 'unplayed_bottom') score.lineScore.innings[8].homeRuns = 0;
    expect(() => f.owner.submit('closure')).toThrow();
    expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
  });
it('rejects a same-total aggregate that moves the current walkoff run into an earlier inning', () => {
  const f = fixture({ inning: 9, half: 'bottom', outs: 0, score: { away: 2, home: 2 } }, true, ['HOME-0']), score = acceptedFinalScoring(f, 1);
  score.lineScore.innings[0].homeRuns++; score.lineScore.innings[8].homeRuns--;
  expect(() => f.owner.submit('closure')).toThrow(/current.*half|run.*delta/);
});
it('rejects a final context on a continuing game rather than silently discarding it', () => {
  const f = fixture({ inning: 8, score: { away: 1, home: 2 } }); acceptedFinalScoring(f);
  expect(() => f.owner.submit('closure')).toThrow(/final|continu/);
});
it('rolls back writer-local mutation of accepted aggregate source and final Match payload', () => {
  const f = fixture({ inning: 9, score: { away: 1, home: 2 } }); acceptedFinalScoring(f); f.owner.enqueue('closure');
  f.db.exec("CREATE TRIGGER corrupt_score AFTER INSERT ON applications BEGIN UPDATE actual_live_play_closures SET source_json=json_set(source_json,'$.finalScoring.lineScore.totals.home.hits',99); END;");
  expect(() => f.owner.resume('closure')).toThrow(/archive|Source|scor/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
  f.db.exec('DROP TRIGGER corrupt_score');
  f.db.exec("CREATE TRIGGER corrupt_final AFTER INSERT ON applications BEGIN UPDATE matches SET durable_revision=2,activation_json='{}' WHERE match_id='game'; END;");
  expect(() => f.owner.resume('closure')).toThrow(/written Match/);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual([]);
  f.db.exec('DROP TRIGGER corrupt_final');
  expect((f.owner.resume('closure').official as any).result.completionReason).toBe('HOME_LEADS_AFTER_TOP');
});
it('remains terminal after all ten original workload effects settle and denies another physical activation', async () => {
  const f = fixture({ inning: 9, score: { away: 1, home: 2 } });
  physical.adjudication.endReference = { owner: 'actual_first_base_play_ends', sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
  physical.adjudication.wholeHistoryReference = { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' };
  acceptedFinalScoring(f); f.owner.submit('closure');
  const p = f.owner.read('closure')!.proposal;
  const baselines = new Map<string, any>(), assessments = new Map<string, any>();
  for (const a of p.actors) {
    const playerId = a.binding.playerId;
    baselines.set(`baseline:${playerId}`, { sourceId: `baseline:${playerId}`, sourceVersion: 'synthetic-fixture', personLinkSourceId: a.binding.personLinkSourceId,
      careerId: a.binding.careerId, playerId, createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5,
      policy: { policyId: 'synthetic-fixture', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
    assessments.set(`assessment:${playerId}`, { sourceId: `assessment:${playerId}`, sourceVersion: 'synthetic-fixture', closureSourceId: 'closure',
      physicalEndReference: p.physicalEndReference, wholeHistoryReference: p.wholeHistoryReference,
      participantReference: { playerId, bindingHash: hash(a.binding), personHash: hash(a.person) }, effortUnits: 1,
      provenance: { assessmentSourceId: `accepted:${playerId}`, assessmentVersion: 'fixture', calibrationSourceId: 'synthetic-calibration', calibrationVersion: 'fixture' } });
  }
  const { openSqliteActualRoleWorkloadStore } = await import('./SqliteActualRoleWorkloadStore');
  const workload = openSqliteActualRoleWorkloadStore(f.path, { readLink: id => {
    const row = f.db.prepare('SELECT source_json FROM world_player_person_links WHERE source_id=?').get(id);
    return row ? JSON.parse(String(row.source_json)) : null;
  } }, { readAcceptedBaseline: id => baselines.get(id) ?? null, readAcceptedAssessment: id => assessments.get(id) ?? null });
  cleanups.push(() => workload.close());
  for (const id of baselines.keys()) workload.initializeBaseline(id);
  workload.acceptAssessments([...assessments.keys()]);
  expect(workload.settle('closure').kind).toBe('complete');
  expect(f.owner.readReadiness('closure')).toMatchObject({ kind: 'game_final', reason: 'game_final', settlement: { kind: 'complete' } });
  const { readActualLivePhysicalActivation } = await import('./ActualLivePhysicalActivation');
  expect(() => readActualLivePhysicalActivation(f.db, 'game', 'apply')).toThrow(/game_final/);
  expect(workload.settle('closure').kind).toBe('complete');
  expect(f.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n).toBe(10);
});
it('rejects post-commit terminal Match revision/payload corruption on read, retry and reopen', () => {
  const f = fixture({ inning: 9, score: { away: 1, home: 2 } }); acceptedFinalScoring(f); f.owner.submit('closure');
  f.db.exec("UPDATE matches SET durable_revision=2,state_json='{}',activation_json='{}' WHERE match_id='game'");
  expect(() => f.owner.read('closure')).toThrow(/written Match/);
  expect(() => f.owner.resume('closure')).toThrow(/written Match/);
  f.owner.close(); const reopened = openSqliteActualLivePlayClosureStore(f.path);
  try { expect(() => reopened.read('closure')).toThrow(/written Match/); }
  finally { reopened.close(); }
});
it.each(['missing_policy', 'accepted_final_policy'] as const)('keeps legacy go-ahead history readable but fences current physical admission: %s', mode => {
  const f = fixture({ inning: 1, half: 'bottom', outs: 0 }, true, ['HOME-0']);
  const accepted = f.owner.submit('closure'), saved = f.owner.read('closure')!;
  const source = { ...saved.source } as any; delete source.gamePolicy;
  const proposal = { ...saved.proposal, source } as any; delete proposal.gamePolicy; delete proposal.nextActors;
  f.db.prepare('UPDATE actual_live_play_closures SET source_json=?,source_hash=?,proposal_json=?,proposal_hash=?')
    .run(json(source), hash(source), json(proposal), hash(proposal));
  if (mode === 'missing_policy') f.db.exec('DELETE FROM physical_closure_game_policies');
  else f.db.prepare('UPDATE physical_closure_game_policies SET policy_json=?').run(json({ seasonId: 'season', homeClubId: 'home', awayClubId: 'away', policy: { ...policy, minimumInnings: 1 } }));
  expect(f.owner.read('closure')!.result).toEqual(accepted);
  expect(f.owner.readReadiness('closure')).toMatchObject({ kind: 'pending', reason: mode === 'missing_policy' ? 'game_policy_pending' : 'game_final_scoring_pending' });
  expect(() => assertPriorActualLiveClosureCompleted(f.db, 'apply')).toThrow(/policy|final/);
});
