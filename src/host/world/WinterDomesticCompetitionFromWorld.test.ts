import { expect, it } from 'vitest';
import type { CanonicalMatchState } from
  '../../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { createBaseScheduleSnapshot } from
  '../../core/world/competition/LeagueSchedule';
import { buildOfficialStandings } from
  '../../core/world/competition/OfficialStandings';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import { projectWinterDomesticCompetitionFromWorld } from
  './WinterDomesticCompetitionFromWorld';

const clubs = Array.from({ length: 6 }, (_, index) => `club-${index + 1}`);
let nextDay = 0;
const pairs = clubs.flatMap((homeClubId, homeIndex) =>
  clubs.slice(homeIndex + 1).map((awayClubId) =>
    ({ homeClubId, awayClubId, gameCount: 20 })));
const series = pairs.flatMap((pair) =>
  Array.from({ length: 5 }, (_, part) => {
    const value = { seriesId: `${pair.homeClubId}:${pair.awayClubId}:${part}`,
      homeClubId: pair.homeClubId, awayClubId: pair.awayClubId,
      startsOnDay: nextDay, gameCount: 4 as const };
    nextDay += 4;
    return value;
  }));
const baseSchedule = createBaseScheduleSnapshot({
  seasonId: 'season-1', leagueId: 'league-010',
  calendarProfileVersion: 'league-calendar-v1',
  generatorVersion: 'generator-v1', scheduleSeed: 'seed-1',
  opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 100, memberClubIds: clubs,
  opponentMatrix: pairs,
  allowedDays: Array.from({ length: nextDay }, (_, index) => index),
  reservedWindows: [], series,
});
const schedule = captureOfficialStandingsSchedule(baseSchedule, []);
const standingsPolicy = { version: 'standings-v1',
  tieCreditNumerator: 1, tieCreditDenominator: 2,
  runDifferentialCapPerGame: 10 };
const roundGames = clubs.slice(0, 4).flatMap((homeClubId, homeIndex) =>
  clubs.slice(0, 4).filter((awayClubId) =>
    awayClubId !== homeClubId).map((awayClubId, offset) => ({
    gameId: `round-${homeIndex}-${offset}`,
    day: 300 + homeIndex * 3 + offset,
    homeClubId, awayClubId,
  })));
const officialResult = (game: { gameId: string;
  homeClubId: string; awayClubId: string }, index: number): OfficialGameResult => {
  const homeWins = clubs.indexOf(game.homeClubId)
    < clubs.indexOf(game.awayClubId);
  const homeRuns = homeWins ? 1 : 0;
  const awayRuns = homeWins ? 0 : 1;
  return {
    gameId: game.gameId, seasonId: 'season-1',
    homeClubId: game.homeClubId, awayClubId: game.awayClubId,
    homeRuns, awayRuns,
    winnerClubId: homeWins ? game.homeClubId : game.awayClubId,
    completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('rules-v1'),
    gamePolicyVersion: 'completion-v1',
    closureId: `closure-${index}`, applicationId: `application-${index}`,
    durableRevision: 1,
    venueBinding: { gameId: game.gameId, venueId: 'venue-1',
      fixtureEventId: `fixture-${index}`, fixtureRevision: 0 },
    lineScore: { innings: Array.from({ length: 9 }, (_, inning) => ({
      inning: inning + 1,
      homeRuns: inning === 0 ? homeRuns : 0,
      awayRuns: inning === 0 ? awayRuns : 0 })),
    totals: { home: { runs: homeRuns, hits: 1, errors: 0 },
      away: { runs: awayRuns, hits: 1, errors: 0 } } },
  };
};
const results = baseSchedule.games.map(officialResult);
const roundResults = roundGames.map((game, index) =>
  officialResult(game, results.length + index));
const byGame = new Map([...results, ...roundResults].map((result) =>
  [result.gameId, result]));
const world = { careerId: 'career-1', seasonId: 'season-1',
  revision: results.length, schedule, standingsPolicy, results,
  standings: { kind: 'OFFICIAL' as const,
    snapshot: buildOfficialStandings(schedule, results, standingsPolicy) } };
const archive = { careerId: 'career-1', seasonId: 'season-1',
  revision: 0, baseSchedule, revisions: [], acceptedAtDays: [] };
const matchState: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('rules-v1'),
  inning: 9, half: 'bottom', outs: 3, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { home: 1, away: 0 }, playId: 9,
};
const stores = {
  world: { readSeason: () => world },
  archive: { read: () => archive },
  match: {
    getMatch: (gameId: string) => {
      const finalResult = byGame.get(gameId);
      return finalResult ? { durableRevision: 1, matchState,
        activation: null, nextWorld: null, finalResult } : null;
    },
    getOfficialFixture: (gameId: string) =>
      byGame.get(gameId)?.venueBinding ?? null,
  },
};
const request = { careerId: 'career-1', seasonId: 'season-1',
  version: 'winter-v1', roundGames,
  roundTiebreakPolicy: standingsPolicy,
  tiebreakPlans: [], finalPlan: null,
  qualificationPolicyVersion: 'qual-v1',
  competitionEditionId: 'continental-2027', berthCount: 2,
  alreadyQualifiedClubIds: [],
  eligibilityByClubId: Object.fromEntries(clubs.map((clubId) =>
    [clubId, { eligible: true }])),
};

it('advances a completed official winter round to the final series', () => {
  const projected = projectWinterDomesticCompetitionFromWorld(stores,
    request);
  expect(projected?.snapshot).toBeNull();
  expect(projected?.postseason.nextFinal).toEqual({
    higherSeedClubId: 'club-1', lowerSeedClubId: 'club-2', bestOf: 7,
  });
});

it('waits for every round final and rejects an unbound final', () => {
  const missing = roundGames[0].gameId;
  expect(projectWinterDomesticCompetitionFromWorld({ ...stores,
    match: { ...stores.match,
      getMatch: (gameId: string) => gameId === missing
        ? null : stores.match.getMatch(gameId) } }, request)).toBeNull();
  expect(() => projectWinterDomesticCompetitionFromWorld({ ...stores,
    match: { ...stores.match,
      getOfficialFixture: (gameId: string) => gameId === missing
        ? null : stores.match.getOfficialFixture(gameId) } }, request))
    .toThrow('durable Match fixture');
});
