import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from
  '../../core/model/CanonicalMatchState';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { createBaseScheduleSnapshot } from
  '../../core/world/competition/LeagueSchedule';
import { buildOfficialStandings } from
  '../../core/world/competition/OfficialStandings';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import { readCompletedDomesticSeason } from
  './DomesticSeasonRuntime';

const baseSchedule = createBaseScheduleSnapshot({
  seasonId: 'season-1', leagueId: 'league-1',
  calendarProfileVersion: 'calendar-v1',
  generatorVersion: 'generator-v1',
  scheduleSeed: 'seed-1',
  opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 2,
  memberClubIds: ['club-a', 'club-b'],
  opponentMatrix: [{ homeClubId: 'club-a',
    awayClubId: 'club-b', gameCount: 2 }],
  allowedDays: [10, 11], reservedWindows: [],
  series: [{ seriesId: 'series-1',
    homeClubId: 'club-a', awayClubId: 'club-b',
    startsOnDay: 10, gameCount: 2 }],
});
const schedule = captureOfficialStandingsSchedule(baseSchedule, []);
const standingsPolicy = { version: 'standings-v1',
  tieCreditNumerator: 1, tieCreditDenominator: 2,
  runDifferentialCapPerGame: 10 };
const fixture = { gameId: 'series-1:1',
  venueId: 'stadium-a', fixtureEventId: 'fixture-1',
  fixtureRevision: 0 };
const result: OfficialGameResult = { gameId: fixture.gameId,
  seasonId: 'season-1', homeClubId: 'club-a',
  awayClubId: 'club-b', homeRuns: 1, awayRuns: 0,
  winnerClubId: 'club-a', completionReason: 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId('rules-v1'),
  gamePolicyVersion: 'completion-v1',
  closureId: 'closure-1', applicationId: 'application-1',
  durableRevision: 1, venueBinding: fixture,
  lineScore: { innings: Array.from({ length: 9 }, (_, inning) => ({
    inning: inning + 1, homeRuns: inning === 0 ? 1 : 0,
    awayRuns: 0,
  })), totals: { home: { runs: 1, hits: 1, errors: 0 },
    away: { runs: 0, hits: 0, errors: 0 } } },
};
const secondFixture = { ...fixture,
  gameId: 'series-1:2', fixtureEventId: 'fixture-2' };
const secondResult: OfficialGameResult = { ...result,
  gameId: secondFixture.gameId,
  closureId: 'closure-2', applicationId: 'application-2',
  venueBinding: secondFixture };
const matchState: CanonicalMatchState = {
  ruleProfileId: result.ruleProfileId, inning: 9,
  half: 'bottom', outs: 3, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { home: 1, away: 0 }, playId: 9,
};
const archive = { careerId: 'career-a',
  seasonId: 'season-1', revision: 0,
  baseSchedule, revisions: [], acceptedAtDays: [] };
const world = { careerId: 'career-a',
  seasonId: 'season-1', revision: 1,
  schedule, standingsPolicy, results: [result, secondResult],
  standings: { kind: 'OFFICIAL' as const,
    snapshot: buildOfficialStandings(schedule,
      [result, secondResult], standingsPolicy) } };
const stores = {
  world: { readSeason: () => world },
  archive: { read: () => archive },
  match: { getMatch: (gameId: string) => ({ durableRevision: 1,
    matchState, activation: null, nextWorld: null,
    finalResult: gameId === fixture.gameId ? result
      : secondResult }),
  getOfficialFixture: (gameId: string) =>
    gameId === fixture.gameId ? fixture : secondFixture },
};

it('reads completion only when archived schedule, World result and Match final agree', () => {
  expect(readCompletedDomesticSeason(stores,
    'career-a', 'season-1')).toEqual({ archive, world });
  const provisional = { ...stores,
    world: { readSeason: () => ({ ...world,
      standings: { kind: 'PROVISIONAL' as const,
        seasonId: 'season-1', leagueId: 'league-1',
        tiebreakPolicyVersion: 'standings-v1',
        scheduleRevisionEventIds: [], rows: [],
        provisionalGroups: [], unplayedClubIds: [],
        playedGameIds: [], pendingGameIds: [fixture.gameId],
        resultApplicationIds: [] } }) } };
  expect(readCompletedDomesticSeason(provisional,
    'career-a', 'season-1')).toBeNull();
  const mismatched = { ...stores,
    match: { ...stores.match, getMatch: () => ({
      ...stores.match.getMatch(fixture.gameId),
      finalResult: null }) } };
  expect(() => readCompletedDomesticSeason(mismatched,
    'career-a', 'season-1')).toThrow('durable Match final');
});
