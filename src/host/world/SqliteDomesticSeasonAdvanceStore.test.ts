import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { nextPlan, state } from '../../core/world/club/ClubFixtures.test-support';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { projectProvisionalOfficialStandings } from '../../core/world/competition/ProvisionalOfficialStandings';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { initializeDomesticSeason, prepareDomesticMatch, settleDomesticGame } from './DomesticSeasonRuntime';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteDomesticCompetitionSeasonStore } from './SqliteDomesticCompetitionSeasonStore';
import { openSqliteMatchdayAttendanceStore } from './SqliteMatchdayAttendanceStore';
import { openSqliteOfficialWorldSettlementOutbox } from './SqliteOfficialWorldSettlementOutbox';
import { openSqliteClubSeasonTransitionStore } from './SqliteClubSeasonTransitionStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { openSqliteDomesticSeasonAdvanceStore, type AcceptedDomesticSeasonAdvance } from './SqliteDomesticSeasonAdvanceStore';
import type { MatchdayAttendanceFact } from '../../core/world/club/OfficialMatchdayRevenue';

const stores: { close(): void }[] = [];
afterEach(() => stores.splice(0).reverse().forEach((store) => store.close()));

it('actual frozen 108-game League and Native championship -> interrupted Club/calendar stages -> reopen/resume next World season', () => {
  const path = `file:domestic-advance-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path), archive = openSqliteDomesticScheduleStore(path);
  const match = new SqliteOfficialStateStore(`file:domestic-match-${crypto.randomUUID()}?mode=memory&cache=shared`);
  const cycle = openSqliteWorldCompetitionCycleStore(path), outbox = openSqliteOfficialWorldSettlementOutbox(path);
  stores.push(world, archive, match, cycle, outbox);
  cycle.initialize('career-a', worldCycleInput(0));
  const clubs = Array.from({ length: 4 }, (_, index) => {
    const original = state(), clubId = `club-${index + 1}`;
    return { ...original, identity: { ...original.identity, clubId }, season: { ...original.season,
      plan: { ...original.season.plan, financialProfile: { ...original.season.plan.financialProfile, leagueId: 'league-006' } } },
    live: { ...original.live, references: { ...original.live.references, rivalryStateRefs: [] } } };
  });
  const memberClubIds = clubs.map((club) => club.identity.clubId);
  const matrix = memberClubIds.flatMap((homeClubId) => memberClubIds.filter((awayClubId) => awayClubId !== homeClubId)
    .map((awayClubId) => ({ homeClubId, awayClubId, gameCount: 18 })));
  let day = 11;
  const series = matrix.flatMap((pair) => Array.from({ length: 6 }, (_, index) => {
    const value = { seriesId: `${pair.homeClubId}-${pair.awayClubId}-${index}`, homeClubId: pair.homeClubId,
      awayClubId: pair.awayClubId, startsOnDay: day, gameCount: 3 as const }; day += 3; return value;
  }));
  const baseSchedule = createBaseScheduleSnapshot({ seasonId: 'league-season-1', leagueId: 'league-006',
    calendarProfileVersion: 'league-calendar-v1', generatorVersion: 'generator-v1', scheduleSeed: 'seed-v1',
    opponentMatrixVersion: 'matrix-v1', regularSeasonGamesPerClub: 108, memberClubIds, opponentMatrix: matrix,
    allowedDays: Array.from({ length: day - 11 }, (_, index) => index + 11), reservedWindows: [], series });
  const standingsPolicy = { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 };
  const eventProfile = { version: 'events-v1', allStarEnabled: false, marketWindows: [], rosterExpansionEnabled: false,
    awardSelectionPolicyVersion: 'awards-v1' };
  const sources = { world, archive, match, cycle };
  initializeDomesticSeason(sources, { careerId: 'career-a', clubs, baseSchedule, standingsPolicy, eventProfile });
  const gates = new Map<string, MatchdayAttendanceFact>();
  const attendance = openSqliteMatchdayAttendanceStore(path, sources, { readAcceptedGateCount: (id) => gates.get(id) ?? null }); stores.push(attendance);
  const competition = openSqliteDomesticCompetitionSeasonStore(path, sources); stores.push(competition);
  const nextInput = { careerId: 'career-a', cycleOrdinal: 0, leagueRegion: 'ASIA_PACIFIC' as const,
    // Fixture numeric days retain their original Career-day anchor across years.
    seasonDayOne: '2031-01-01', standingsPolicy, eventProfile, generatorInput: {
      seasonId: 'league-season-2', leagueId: 'league-006', calendarProfileVersion: 'league-calendar-v1',
      generatorVersion: 'generator-v1', scheduleSeed: 'seed-v2', opponentMatrixVersion: 'matrix-v1', regularSeasonGamesPerClub: 108,
      memberClubIds, opponentMatrix: matrix, allowedDays: Array.from({ length: 350 }, (_, index) => index + 401),
      reservedWindows: [], preferredSeriesLength: 3 as const, minimumDaysBetweenRounds: 0 } };
  const accepted = new Map<string, AcceptedDomesticSeasonAdvance>();
  let progress = openSqliteDomesticSeasonAdvanceStore(path, { ...sources, competition }, { readAcceptedAdvance: (id) => accepted.get(id) ?? null }); stores.push(progress);
  const makeAdvance = (): AcceptedDomesticSeasonAdvance => ({ sourceId: 'advance-1', sourceVersion: 'v1', previousSeasonId: 'league-season-1', nextSeason: nextInput,
    clubTransitions: memberClubIds.map((clubId) => {
      const current = world.readClub('career-a', clubId)!.state, plan = { ...nextPlan(current), startsOnDay: 400 };
      const sourceId = `boundary-${clubId}`;
      return { sourceId, sourceVersion: 'v1', command: { eventId: sourceId, careerId: 'career-a', clubId, expectedRevision: current.revision,
        effectiveDay: 400, causeEventIds: [`approved-${sourceId}`], operations: [{ kind: 'CLOSE_SEASON', snapshotId: `snapshot-${clubId}`,
          resultRefs: { domesticResultRef: 'league-season-1', continentalResultRef: null, rosterSummaryRef: `accepted-roster-${clubId}`,
            fanbaseSummaryRef: `accepted-fans-${clubId}`, derivedSummaryRef: null } }, { kind: 'OPEN_SEASON', plan }] } };
    }) });
  accepted.set('advance-1', makeAdvance());
  expect(() => progress.submit('advance-1')).toThrow(/complete|champion/);
  expect(progress.read('advance-1')).toBeNull();

  const finalInput = (gameId: string, homeClubId: string, awayClubId: string, binding: { gameId: string; venueId: string; fixtureEventId: string; fixtureRevision: number }, homeRuns: number, awayRuns: number) => {
    const before = { ruleProfileId: asRuleProfileId('rules-v1'), inning: 9, half: 'bottom' as const, outs: 2, balls: 0, strikes: 2,
      bases: { first: null, second: null, third: null }, score: { home: homeRuns, away: awayRuns }, playId: 8 };
    match.initializeMatch(gameId, before);
    const timeline = recordCountedPitch(createCanonicalPlateAppearanceTimeline(before, 1000), 1100, { kind: 'swinging_strike' });
    let adjudication = createPlayAdjudicationLedger({ playId: 8, ruleProfileId: before.ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: `ruling-${gameId}`, tick: 1101,
      snapshotId: `ruling-${gameId}`, evidenceRevision: 1, ruling: { outsAfter: 3, basesAfter: before.bases, scoredRunnerIds: [] } });
    adjudication = closeOfficialPlay(adjudication, 1, { eventId: `closed-${gameId}`, closureId: `closure-${gameId}`, tick: 1102 });
    return { kind: 'non_live' as const, matchId: gameId, applicationId: `application-${gameId}`, expectedDurableRevision: 0,
      match: before, timeline, adjudication, context: { kind: 'strikeout' as const }, game: { seasonId: 'league-season-1',
        homeClubId, awayClubId, policy: { version: 'completion-v1', minimumInnings: 9, tiesAllowed: false }, venueBinding: binding,
        lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({ inning: index + 1, homeRuns: index === 0 ? homeRuns : 0,
          awayRuns: index === 0 ? awayRuns : 0 })), totals: { home: { runs: homeRuns, hits: homeRuns, errors: 0 },
          away: { runs: awayRuns, hits: awayRuns, errors: 0 } } } } };
  };
  for (const game of baseSchedule.games) {
    const highWins = Number(game.homeClubId.slice(-1)) < Number(game.awayClubId.slice(-1));
    const before = { ruleProfileId: asRuleProfileId('rules-v1'), inning: 9, half: 'bottom' as const, outs: 2, balls: 0, strikes: 2,
      bases: { first: null, second: null, third: null }, score: { home: highWins ? 1 : 0, away: highWins ? 0 : 1 }, playId: 8 };
    const prepared = prepareDomesticMatch(sources, { careerId: 'career-a', seasonId: 'league-season-1', gameId: game.gameId, matchState: before });
    const club = world.readClub('career-a', game.homeClubId)!.state;
    const gate = { factId: `gate-${game.gameId}`, careerId: 'career-a', sourceEventId: `turnstile-${game.gameId}`, gameId: game.gameId,
      stadiumId: club.institutional.stadium.stadiumId, observedAtDay: game.day, availableAtDay: game.day, venueRevisionAtObservation: club.revision, count: 1 };
    gates.set(gate.factId, gate); attendance.accept(gate.factId, 'league-season-1');
    const season = world.readSeason('career-a', 'league-season-1')!;
    settleDomesticGame({ ...sources, attendance, outbox }, { finalInput: finalInput(game.gameId, game.homeClubId, game.awayClubId,
      prepared.fixture.binding, highWins ? 1 : 0, highWins ? 0 : 1), expectedSeasonRevision: season.revision, expectedClubRevision: club.revision,
      worldInput: { schedule: season.schedule, priorResults: season.results, standingsPolicy, homeClub: club,
        homeClubHistory: world.readClubHistory('career-a', game.homeClubId)!, wageSchedules: createClubWageScheduleLedger('career-a', game.homeClubId),
        attendance: gate, revenuePolicy: { version: 'revenue-v1', availableAtDay: 10, seasonId: 'league-season-1', currency: 'SIM', recognizedMinorUnitsPerAttendee: 1 },
        finalizedAtDay: game.day } });
  }
  expect(world.readSeason('career-a', 'league-season-1')!.results).toHaveLength(216);
  const plan = { seriesId: 'final', seasonId: 'league-season-1', bestOf: 5, higherSeedClubId: 'club-1', lowerSeedClubId: 'club-2',
    scheduledGames: Array.from({ length: 5 }, (_, index) => ({ gameId: `final-${index}`, homeClubId: 'club-1', awayClubId: 'club-2' })) };
  const titleRequest = { kind: 'DIRECT' as const, input: { careerId: 'career-a', seasonId: 'league-season-1',
    postseasonPlans: [{ stage: 'final' as const, plan }], qualificationPolicyVersion: 'qualification-v1', competitionEditionId: 'continental-1',
    berthCount: 1, alreadyQualifiedClubIds: [], eligibilityByClubId: Object.fromEntries(memberClubIds.map((id) => [id, { eligible: true }])) } };
  expect(() => competition.finalize(titleRequest)).toThrow(/complete/);
  for (const game of plan.scheduledGames.slice(0, 3)) {
    const binding = { gameId: game.gameId, venueId: 'stadium-a', fixtureEventId: `fixture-${game.gameId}`, fixtureRevision: 0 };
    match.registerOfficialFixture(binding);
    match.applyAndFinalize(finalInput(game.gameId, game.homeClubId, game.awayClubId, binding, 1, 0));
  }
  expect(competition.finalize(titleRequest).domesticChampionSnapshot.championClubId).toBe('club-1');
  const request = makeAdvance(); accepted.set(request.sourceId, request);
  accepted.set('bad', { ...request, sourceId: 'bad', clubTransitions: request.clubTransitions.slice(1) });
  expect(() => progress.submit('bad')).toThrow(/member/);
  expect(progress.read('bad')).toBeNull();
  const invalidRequests: AcceptedDomesticSeasonAdvance[] = [
    { ...request, nextSeason: { ...nextInput, generatorInput: { ...nextInput.generatorInput, leagueId: 'other-league' } } },
    { ...request, nextSeason: { ...nextInput, generatorInput: { ...nextInput.generatorInput, allowedDays: [401] } } },
    { ...request, nextSeason: { ...nextInput, generatorInput: { ...nextInput.generatorInput, regularSeasonGamesPerClub: 105,
      opponentMatrix: matrix.map((pair) => ({ ...pair, gameCount: pair.homeClubId < pair.awayClubId ? 18 : 17 })) } } },
    { ...request, clubTransitions: request.clubTransitions.map((record, index) => index === 0
      ? { ...record, command: { ...record.command, expectedRevision: 1000 } } : record) },
    { ...request, clubTransitions: request.clubTransitions.map((record, index) => index === 0
      ? { ...record, command: { ...record.command, effectiveDay: 65, operations: record.command.operations.map((operation) => operation.kind === 'OPEN_SEASON'
        ? { ...operation, plan: { ...operation.plan, startsOnDay: 65 } } : operation) } } : record) },
    { ...request, clubTransitions: request.clubTransitions.map((record, index) => index === 0
      ? { ...record, command: { ...record.command, operations: record.command.operations.map((operation) => operation.kind === 'CLOSE_SEASON'
        ? { ...operation, resultRefs: { ...operation.resultRefs, domesticResultRef: 'unrelated-season' } } : operation) } } : record) },
    { ...request, clubTransitions: request.clubTransitions.map((record, index) => index === 0
      ? { ...record, command: { ...record.command, operations: record.command.operations.map((operation) => operation.kind === 'OPEN_SEASON'
        ? { ...operation, plan: { ...operation.plan, financialProfile: { ...operation.plan.financialProfile, currency: 'OTHER' } } } : operation) } } : record) },
  ];
  for (const [index, invalid] of invalidRequests.entries()) {
    const id = `invalid-${index}`; accepted.set(id, { ...invalid, sourceId: id });
    expect(() => progress.submit(id)).toThrow();
    expect(progress.read(id)).toBeNull();
    expect(memberClubIds.map((clubId) => world.readClub('career-a', clubId)!.state.season.plan.season)).toEqual([1, 1, 1, 1]);
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path); stores.push(db);
  progress.enqueue('advance-1');
  const conflicting = { ...world.readSeason('career-a', 'league-season-1')!.schedule, seasonId: 'league-season-2' };
  const canonical = (input: unknown) => JSON.stringify(input, (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
  db.prepare(`INSERT INTO world_season_heads (career_id, season_id, league_id, revision, schedule_json, policy_json, results_json, standings_json)
    VALUES ('career-a', 'league-season-2', 'league-006', 0, ?, ?, '[]', ?)`)
    .run(canonical(conflicting), canonical(standingsPolicy), canonical(projectProvisionalOfficialStandings(conflicting, [], standingsPolicy)));
  expect(() => progress.resume('advance-1')).toThrow(/corrupt|calendar/);
  expect(memberClubIds.map((id) => world.readClub('career-a', id)!.state.season.plan.season)).toEqual([1, 1, 1, 1]);
  db.exec("DELETE FROM world_season_heads WHERE career_id='career-a' AND season_id='league-season-2'");
  db.exec("CREATE TRIGGER fail_boundary BEFORE UPDATE ON world_club_heads WHEN NEW.club_id='club-2' BEGIN SELECT RAISE(ABORT, 'member stage interrupted'); END;");
  expect(() => progress.submit('advance-1')).toThrow('member stage interrupted');
  expect(progress.read('advance-1')?.status).toBe('PENDING');
  expect(memberClubIds.map((id) => world.readClub('career-a', id)!.state.season.plan.season)).toEqual([1, 1, 1, 1]);
  expect(world.readSeason('career-a', 'league-season-2')).toBeNull();
  accepted.set('advance-1', { ...request, sourceVersion: 'changed' });
  expect(() => progress.resume('advance-1')).toThrow(/frozen/);
  accepted.set('advance-1', request);
  db.exec('DROP TRIGGER fail_boundary');
  db.exec("CREATE TRIGGER fail_next_events BEFORE INSERT ON world_league_season_events WHEN NEW.season_id='league-season-2' BEGIN SELECT RAISE(ABORT, 'event phase interrupted'); END;");
  expect(() => progress.submit('advance-1')).toThrow('event phase interrupted');
  expect(progress.read('advance-1')?.status).toBe('PENDING');
  expect(memberClubIds.map((id) => world.readClub('career-a', id)!.state.season.plan.season)).toEqual([2, 2, 2, 2]);
  expect(archive.read('career-a', 'league-season-2')!.baseSchedule.games).toHaveLength(216);
  expect(archive.read('career-a', 'league-season-2')!.baseSchedule.reservedWindows)
    .toContainEqual({ kind: 'WORLD', startsOnDay: 426, endsOnDay: 445 });
  expect(archive.readEvents('career-a', 'league-season-2')).toBeNull();
  progress.close(); progress = openSqliteDomesticSeasonAdvanceStore(path, { ...sources, competition }); stores.push(progress);
  db.exec('DROP TRIGGER fail_next_events');
  const completed = progress.resume('advance-1');
  expect(completed.seasonId).toBe('league-season-2');
  expect(progress.read('advance-1')?.status).toBe('COMPLETED');
  expect(archive.readEvents('career-a', 'league-season-2')!.profile).toEqual(eventProfile);
  expect(progress.resume('advance-1')).toEqual(completed);
  const later = openSqliteClubSeasonTransitionStore(path, { readAcceptedTransition: (sourceId) => {
    const clubId = sourceId.slice('later-'.length), current = world.readClub('career-a', clubId)!.state;
    return { sourceId, sourceVersion: 'v1', command: { eventId: sourceId, careerId: 'career-a', clubId, expectedRevision: current.revision,
      effectiveDay: 800, causeEventIds: ['later-accepted'], operations: [{ kind: 'CLOSE_SEASON', snapshotId: sourceId,
        resultRefs: { domesticResultRef: 'league-season-2', continentalResultRef: null, rosterSummaryRef: 'later-roster', fanbaseSummaryRef: 'later-fans', derivedSummaryRef: null } },
      { kind: 'OPEN_SEASON', plan: { ...nextPlan(current), startsOnDay: 800 } }] } };
  } }); stores.push(later);
  later.applyBatch(memberClubIds.map((id) => `later-${id}`));
  expect(progress.resume('advance-1')).toEqual(completed);
  db.exec("UPDATE world_domestic_season_advances SET result_json='{}' WHERE source_id='advance-1'");
  expect(() => progress.read('advance-1')).toThrow(/corrupt/);
}, 120_000);
