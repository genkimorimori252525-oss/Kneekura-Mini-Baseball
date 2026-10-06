// Physical/adjudication inputs are synthetic mocked boundaries, not original-chain
// acceptance. Legal closure, ten-role workload, attendance, outbox and season/Club
// effects below use their real SQLite owners.
import { afterEach, expect, it, vi } from 'vitest';
import { appendFileSync } from 'node:fs';
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
import { actualDomesticFixture } from './ActualLiveDomesticGameSettlement.test-support';
import { settleActualLiveDomesticGame, settleDomesticGame, prepareDomesticMatch, reviseDomesticSeasonSchedule } from './DomesticSeasonRuntime';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, closeOfficialPlay } from '../../core/adjudication/PlayAdjudicationLedger';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { openSqliteMatchdayAttendanceStore } from './SqliteMatchdayAttendanceStore';
import { openSqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const phase = (name: string) => {
  if (process.env.BASEBALL_WORLD_PHASE_LOG) appendFileSync(process.env.BASEBALL_WORLD_PHASE_LOG, JSON.stringify({ at: new Date().toISOString(), phase: name, ...process.memoryUsage() }) + '\n');
};
phase('imports_ready');
const fixture = () => actualDomesticFixture(physical, cleanup, phase);
const count = (f: ReturnType<typeof fixture>, table: string) => f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n;

it('assembles the original actual final into existing World owners without recharging workload', () => {
  const f = fixture(); f.complete();
  const original = f.closure.read('closure')!.proposal.application;
  const result = settleActualLiveDomesticGame(f.stores, f.request);
  expect(f.outbox.read('apply')!.request.finalInput).toEqual(original);
  expect(result.final.result.lineScore.totals).toEqual({ away: { runs: 1, hits: 7, errors: 2 }, home: { runs: 2, hits: 8, errors: 1 } });
  expect(result.world).toMatchObject({ applicationId: 'apply', seasonRevision: 1, clubRevision: 1 });
  expect(result.world.settlement.economy.applications[0].basis).toMatchObject({ attendance: 120, amount: 600, attendanceFactId: 'gate' });
  expect(f.world.readClub('career-a', 'club-a')!.state.live.finance.cash).toBe(1600);
  expect(f.world.readSeason('career-a', 'league-season-1')!.results).toHaveLength(1);
  expect(f.match.getMatch('series:1')).toMatchObject({ durableRevision: 1, activation: null, nextWorld: null });
  expect(settleActualLiveDomesticGame(f.stores, f.request)).toEqual(result);
  expect(count(f, 'applications')).toBe(1);
  expect(count(f, 'world_settlement_applications')).toBe(1);
  expect(count(f, 'world_player_workload_activities')).toBe(10);
});

it.each(['closure_missing', 'official_pending', 'roles_pending', 'role_missing', 'assessment_missing', 'scorer_missing', 'scorer_wrong', 'fixture_wrong', 'fixture_missing'] as const)(
  'rejects missing or changed original completion evidence before outbox admission: %s', fault => {
    const f = fixture();
    if (fault !== 'closure_missing') f.closure.enqueue('closure');
    if (fault !== 'closure_missing' && fault !== 'official_pending') f.closure.resume('closure');
    if (!['closure_missing', 'official_pending', 'roles_pending'].includes(fault)) f.settleRoles();
    f.attendance.accept('gate', 'league-season-1');
    if (fault === 'role_missing') f.db.exec("DELETE FROM world_player_workload_activities WHERE player_id='HOME-8'");
    if (fault === 'assessment_missing') f.db.exec("DELETE FROM actual_role_workload_assessments WHERE player_id='HOME-8'");
    if (fault === 'scorer_missing') f.db.exec("UPDATE actual_live_play_closures SET source_json=json_remove(source_json,'$.finalScoring')");
    if (fault === 'scorer_wrong') f.db.exec("UPDATE actual_live_play_closures SET source_json=json_set(source_json,'$.finalScoring.scorerId','forged')");
    if (fault === 'fixture_wrong') f.db.exec("UPDATE official_fixtures SET venue_id='foreign'");
    if (fault === 'fixture_missing') f.db.exec('DELETE FROM official_fixtures');
    expect(() => settleActualLiveDomesticGame(f.stores, f.request)).toThrow(/closure|official|workload|scor|fixture|final|archive/);
    expect(f.outbox.read('apply')).toBeNull();
    expect(f.world.readSeason('career-a', 'league-season-1')!.revision).toBe(0);
  });

it.each(['missing', 'wrong_game', 'caller_count'] as const)('requires the exact independently accepted gate fact: %s', fault => {
  const f = fixture(); f.closure.submit('closure'); f.settleRoles();
  if (fault !== 'missing') {
    f.attendance.accept('gate', 'league-season-1');
    const changed = { ...f.gate, ...(fault === 'wrong_game' ? { gameId: 'series:2' } : { count: 121 }) };
    // Keep the stored identity/JSON mirrors authentic where possible. The gate
    // owner must still reject a game/venue mismatch; no count may be inferred.
    if (fault === 'wrong_game') f.db.prepare('UPDATE world_matchday_attendance SET game_id=?,fact_json=?').run(changed.gameId, json(changed));

  }
  const request = fault === 'caller_count' ? { ...f.request, attendance: { ...f.gate, count: 121 } } : f.request;
  expect(() => settleActualLiveDomesticGame(f.stores, request)).toThrow(/gate|attendance|settlement input/);
  expect(f.outbox.read('apply')).toBeNull();
});

it.each(['expectedSeasonRevision', 'expectedClubRevision'] as const)('rejects stale %s without freezing an unusable request', key => {
  const f = fixture(); f.complete();
  expect(() => settleActualLiveDomesticGame(f.stores, { ...f.request, [key]: 1 })).toThrow(/stale/);
  expect(f.outbox.read('apply')).toBeNull();
  expect(f.world.readClub('career-a', 'club-a')!.revision).toBe(0);
});

it('retains Match final and the original request when World commit fails, then reopens and resumes once', () => {
  const f = fixture(); f.complete();
  f.db.exec("CREATE TRIGGER fail_world BEFORE INSERT ON world_settlement_applications BEGIN SELECT RAISE(ABORT,'test World write interrupted'); END;");
  expect(() => settleActualLiveDomesticGame(f.stores, f.request)).toThrow(/World write interrupted/);
  expect(f.match.getMatch('series:1')!.finalResult?.applicationId).toBe('apply');
  expect(f.outbox.read('apply')!.status).toBe('PENDING');
  expect(f.world.readSeason('career-a', 'league-season-1')!.revision).toBe(0);
  expect(f.world.readClub('career-a', 'club-a')!.revision).toBe(0);
  expect(count(f, 'world_player_workload_activities')).toBe(10);
  f.db.exec('DROP TRIGGER fail_world');
  const reopened = f.reopen(), result = settleActualLiveDomesticGame(reopened, f.request);
  expect(result.world.seasonRevision).toBe(1);
  expect(reopened.outbox.read('apply')!.status).toBe('COMPLETED');
  expect(settleActualLiveDomesticGame(reopened, f.request)).toEqual(result);
});

function advanceClub(f: ReturnType<typeof fixture>) {
  const club = f.world.readClub('career-a', 'club-a')!.state;
  const economy = f.keep(openSqliteClubEconomyStore(f.path));
  economy.apply({ applicationId: 'later-sponsor', expectedClubRevision: club.revision, club,
    history: f.world.readClubHistory('career-a', 'club-a')!, wageSchedules: f.request.wageSchedules,
    sources: [{ kind: 'STRUCTURAL_REVENUE', fact: { factId: 'sponsor-fact', careerId: 'career-a', clubId: 'club-a', season: 1,
      category: 'commercial', settlementRef: 'sponsor-settlement', sourceEventId: 'sponsor-paid', receivedAtDay: 12,
      availableAtDay: 12, capacityRevisionAtReceipt: club.revision, amount: 200, currency: 'SIM' },
      policy: { policyId: 'fixture-structural', version: 'v1', careerId: 'career-a', clubId: 'club-a', season: 1,
        availableAtDay: 12, currency: 'SIM', maximumSeasonAmount: 700, allowedCategories: ['commercial'] } }] });
}
function advancePlayer(f: ReturnType<typeof fixture>) {
  const recovery = { sourceEventId: 'later-recovery', careerId: 'career-a', playerId: 'HOME-8', kind: 'RECOVERY' as const,
    sourceVersion: 'fixture-v1', evidenceId: 'accepted-later-recovery', atDay: 12, durationHours: 1, quality: 1, medicalAvailability: 1 };
  const owner = f.keep(openSqlitePlayerWorkloadRecoveryStore(f.path, f.personLinks, {
    readAcceptedBaseline: () => null, readAcceptedActivity: id => id === recovery.sourceEventId ? recovery : null }));
  owner.apply(recovery.sourceEventId, 1);
}
it.each([false, true])('retries frozen World evidence after later legitimate Club/Player changes; outbox completion interrupted=%s', interrupted => {
  const f = fixture(); f.complete();
  if (interrupted) f.db.exec("CREATE TRIGGER fail_outbox BEFORE UPDATE ON world_settlement_outbox BEGIN SELECT RAISE(ABORT,'test outbox completion interrupted'); END;");
  let result;
  if (interrupted) {
    expect(() => settleActualLiveDomesticGame(f.stores, f.request)).toThrow(/outbox completion interrupted/);
    expect(f.outbox.read('apply')!.status).toBe('PENDING');
    f.db.exec('DROP TRIGGER fail_outbox');
  } else result = settleActualLiveDomesticGame(f.stores, f.request);
  const worldApplication = f.world.readApplication('apply');
  advanceClub(f); advancePlayer(f); advanceSeason(f);
  expect(f.world.readClub('career-a', 'club-a')!.revision).toBe(3);
  expect(() => f.closure.readReadiness('closure')).toThrow(/current head/);
  const reopened = f.reopen(), retried = settleActualLiveDomesticGame(reopened, f.request);
  expect(retried.world).toEqual(worldApplication);
  if (result) expect(retried).toEqual(result);
  expect(reopened.world.readClub('career-a', 'club-a')!.revision).toBe(3);
  expect(reopened.world.readSeason('career-a', 'league-season-1')!.revision).toBe(2);
  expect(reopened.outbox.read('apply')!.status).toBe('COMPLETED');
  expect(reopened.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n).toBe(11);
});

it.each(['revenue', 'wages', 'day', 'season_revision', 'club_revision', 'attendance'] as const)('does not silently accept changed retry input: %s', field => {
  const f = fixture(); f.complete(); settleActualLiveDomesticGame(f.stores, f.request);
  const changed = { ...f.request };
  if (field === 'revenue') changed.revenuePolicy = { ...changed.revenuePolicy, recognizedMinorUnitsPerAttendee: 6 };
  if (field === 'wages') changed.wageSchedules = { ...changed.wageSchedules, clubId: 'club-b' };
  if (field === 'day') changed.finalizedAtDay = 12;
  if (field === 'season_revision') changed.expectedSeasonRevision = 1;
  if (field === 'club_revision') changed.expectedClubRevision = 1;
  if (field === 'attendance') changed.attendanceFactId = 'another-gate';
  expect(() => settleActualLiveDomesticGame(f.stores, changed)).toThrow(/frozen|gate|attendance/);
  expect(f.world.readSeason('career-a', 'league-season-1')!.revision).toBe(1);
  expect(count(f, 'world_player_workload_activities')).toBe(10);
});

it('authenticates the World application even when the outbox already says completed', () => {
  const f = fixture(); f.complete(); settleActualLiveDomesticGame(f.stores, f.request);
  f.db.exec('DELETE FROM world_settlement_applications');
  expect(() => settleActualLiveDomesticGame(f.stores, f.request)).toThrow(/World|world/);
});

function advanceSeason(f: ReturnType<typeof fixture>) {
  const before = { ...f.before, playId: 8, strikes: 2 };
  const prepared = prepareDomesticMatch(f.stores, { careerId: 'career-a', seasonId: 'league-season-1', gameId: 'series:2', matchState: before });
  const timeline = recordCountedPitch(createCanonicalPlateAppearanceTimeline(before, 100), 101, { kind: 'swinging_strike' });
  let adjudication = createPlayAdjudicationLedger({ playId: 8, ruleProfileId: before.ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: 'second-rule', tick: 102, snapshotId: 'second-rule', evidenceRevision: 1,
    ruling: { outsAfter: 3, basesAfter: before.bases, scoredRunnerIds: [] } });
  adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'second-close', closureId: 'second-closure', tick: 103 });
  const first = f.outbox.read('apply')!.request.finalInput;
  const finalInput = { kind: 'non_live' as const, matchId: 'series:2', applicationId: 'second-final', expectedDurableRevision: 0,
    match: before, timeline, adjudication, context: { kind: 'strikeout' as const }, game: { ...first.game, venueBinding: prepared.fixture.binding } };
  const homeClub = f.world.readClub('career-a', 'club-a')!, season = f.world.readSeason('career-a', 'league-season-1')!;
  const gate = { ...f.gate, factId: 'second-gate', gameId: 'series:2', sourceEventId: 'second-turnstile', observedAtDay: 12, availableAtDay: 12,
    venueRevisionAtObservation: homeClub.revision };
  const attendance = f.keep(openSqliteMatchdayAttendanceStore(f.path, f.stores, { readAcceptedGateCount: id => id === gate.factId ? gate : null }));
  attendance.accept(gate.factId, 'league-season-1');
  return settleDomesticGame({ ...f.stores, attendance }, { finalInput, expectedSeasonRevision: season.revision, expectedClubRevision: homeClub.revision,
    worldInput: { schedule: season.schedule, priorResults: season.results, standingsPolicy: season.standingsPolicy, homeClub: homeClub.state,
      homeClubHistory: f.world.readClubHistory('career-a', 'club-a')!, attendance: gate, wageSchedules: f.request.wageSchedules,
      revenuePolicy: f.request.revenuePolicy, finalizedAtDay: 12 } });
}

it.each([false, true])('preserves exact retry after an accepted unrelated schedule revision; pending receipt=%s', interrupted => {
  const f = fixture(); f.complete();
  if (interrupted) f.db.exec("CREATE TRIGGER fail_outbox BEFORE UPDATE ON world_settlement_outbox BEGIN SELECT RAISE(ABORT,'test receipt interrupted'); END;");
  if (interrupted) {
    expect(() => settleActualLiveDomesticGame(f.stores, f.request)).toThrow(/receipt interrupted/);
    f.db.exec('DROP TRIGGER fail_outbox');
  } else settleActualLiveDomesticGame(f.stores, f.request);
  const original = f.outbox.read('apply')!.request;
  reviseDomesticSeasonSchedule(f.stores, { careerId: 'career-a', seasonId: 'league-season-1', expectedRevision: 0,
    event: { eventId: 'rainout-second', gameId: 'series:2', newDay: 13, reason: 'RAINOUT' }, acceptedAtDay: 11 });
  const expected = f.world.readApplication('apply');
  const reopened = f.reopen(), result = settleActualLiveDomesticGame(reopened, f.request);
  expect(result.world).toEqual(expected);
  expect(reopened.outbox.read('apply')!.request).toEqual(original);
  expect(reopened.world.readSeason('career-a', 'league-season-1')!.schedule.revisionEventIds).toEqual(['rainout-second']);
});

it('rechecks the original role effects on completed retry rather than trusting only the cached World result', () => {
  const f = fixture(); f.complete(); settleActualLiveDomesticGame(f.stores, f.request);
  f.db.exec("DELETE FROM world_player_workload_activities WHERE player_id='HOME-8'");
  expect(() => settleActualLiveDomesticGame(f.stores, f.request)).toThrow(/workload/);
  expect(f.world.readSeason('career-a', 'league-season-1')!.revision).toBe(1);
});

it.each(['revenue', 'wages', 'day'] as const)('validates supplied initial %s before freezing the final application for retry', field => {
  const f = fixture(); f.complete();
  const invalid = structuredClone(f.request);
  if (field === 'revenue') invalid.revenuePolicy.recognizedMinorUnitsPerAttendee = -1;
  if (field === 'wages') invalid.wageSchedules = { ...invalid.wageSchedules, clubId: 'club-b' };
  if (field === 'day') invalid.finalizedAtDay = 10;
  expect(() => settleActualLiveDomesticGame(f.stores, invalid)).toThrow();
  expect(f.outbox.read('apply')).toBeNull();
  expect(f.world.readSeason('career-a', 'league-season-1')!.revision).toBe(0);
  expect(settleActualLiveDomesticGame(f.stores, f.request).world.seasonRevision).toBe(1);
  expect(count(f, 'world_player_workload_activities')).toBe(10);
});

it.each(['club_basis', 'expected_revisions', 'standings_policy'] as const)('authenticates the retained completed outbox request against its World result: %s', corruption => {
  const f = fixture(); f.complete(); settleActualLiveDomesticGame(f.stores, f.request);
  const saved = f.outbox.read('apply')!.request;
  const stored = { ...saved, worldInput: { ...saved.worldInput } };
  const retry = { ...f.request };
  if (corruption === 'club_basis') stored.worldInput.homeClub = { ...stored.worldInput.homeClub, live: {
    ...stored.worldInput.homeClub.live, finance: { ...stored.worldInput.homeClub.live.finance, cash: 9999 } } };
  else if (corruption === 'expected_revisions') {
    stored.expectedSeasonRevision = 1; stored.expectedClubRevision = 1;
    retry.expectedSeasonRevision = 1; retry.expectedClubRevision = 1;
  } else stored.worldInput.standingsPolicy = { ...stored.worldInput.standingsPolicy, runDifferentialCapPerGame: 11 };
  f.db.prepare('UPDATE world_settlement_outbox SET request_json=? WHERE application_id=?').run(json(stored), 'apply');
  expect(() => settleActualLiveDomesticGame(f.stores, retry)).toThrow(/World|world|club|revision|history|STATE_INCONSISTENT: finance\.balances/);
  expect(f.world.readSeason('career-a', 'league-season-1')!.revision).toBe(1);
});

it('keeps a pre-World request pending when an unrelated rainout changes its first-write preconditions', () => {
  const f = fixture(); f.complete();
  f.db.exec("CREATE TRIGGER fail_world BEFORE INSERT ON world_settlement_applications BEGIN SELECT RAISE(ABORT,'test World write interrupted'); END;");
  expect(() => settleActualLiveDomesticGame(f.stores, f.request)).toThrow(/World write interrupted/);
  const original = f.outbox.read('apply')!.request;
  expect(f.world.readApplication('apply')).toBeNull();
  expect(f.world.readSeason('career-a', 'league-season-1')!.revision).toBe(0);
  f.db.exec('DROP TRIGGER fail_world');
  reviseDomesticSeasonSchedule(f.stores, { careerId: 'career-a', seasonId: 'league-season-1', expectedRevision: 0,
    event: { eventId: 'rainout-second', gameId: 'series:2', newDay: 13, reason: 'RAINOUT' }, acceptedAtDay: 11 });
  const reopened = f.reopen();
  expect(() => settleActualLiveDomesticGame(reopened, f.request)).toThrow('world standings projection mismatch');
  expect(reopened.world.readApplication('apply')).toBeNull();
  expect(reopened.world.readSeason('career-a', 'league-season-1')!.revision).toBe(0);
  expect(reopened.world.readClub('career-a', 'club-a')!.revision).toBe(0);
  expect(reopened.world.readSeason('career-a', 'league-season-1')!.standings).toMatchObject({ kind: 'PROVISIONAL', scheduleRevisionEventIds: ['rainout-second'] });
  expect(reopened.outbox.read('apply')!.request).toEqual(original);
  expect(reopened.outbox.read('apply')!.status).toBe('PENDING');
  expect(reopened.db.prepare('SELECT count(*) AS n FROM world_settlement_applications').get()!.n).toBe(0);
  expect(reopened.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n).toBe(10);
});
