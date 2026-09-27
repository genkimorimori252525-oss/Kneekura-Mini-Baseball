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
import { projectProvisionalOfficialStandings } from
  '../../core/world/competition/ProvisionalOfficialStandings';
import { projectDirectDomesticCompetitionFromWorld } from
  './DirectDomesticCompetitionFromWorld';

const clubs = Array.from({ length: 12 }, (_, index) => `club-${index + 1}`);
let nextDay = 0;
const series = clubs.flatMap((homeClubId, homeIndex) =>
  clubs.slice(homeIndex + 1).flatMap((awayClubId) =>
    ([4, 3, 3] as const).map((gameCount, part) => {
      const value = { seriesId: `${homeClubId}:${awayClubId}:${part}`,
        homeClubId, awayClubId, startsOnDay: nextDay, gameCount };
      nextDay += gameCount;
      return value;
    })));
const baseSchedule = createBaseScheduleSnapshot({
  seasonId: 'season-1', leagueId: 'league-005',
  calendarProfileVersion: 'league-calendar-v1',
  generatorVersion: 'generator-v1', scheduleSeed: 'seed-1',
  opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 110, memberClubIds: clubs,
  opponentMatrix: clubs.flatMap((homeClubId, homeIndex) =>
    clubs.slice(homeIndex + 1).map((awayClubId) =>
      ({ homeClubId, awayClubId, gameCount: 10 }))),
  allowedDays: Array.from({ length: nextDay }, (_, index) => index),
  reservedWindows: [], series,
});
const schedule = captureOfficialStandingsSchedule(baseSchedule, []);
const standingsPolicy = { version: 'standings-v1',
  tieCreditNumerator: 1, tieCreditDenominator: 2,
  runDifferentialCapPerGame: 10 };
const results: OfficialGameResult[] = baseSchedule.games.map((game, index) => ({
  gameId: game.gameId, seasonId: 'season-1',
  homeClubId: game.homeClubId, awayClubId: game.awayClubId,
  homeRuns: 1, awayRuns: 0, winnerClubId: game.homeClubId,
  completionReason: 'BOTTOM_COMPLETE' as const,
  ruleProfileId: asRuleProfileId('rules-v1'),
  gamePolicyVersion: 'completion-v1',
  closureId: `closure-${index}`, applicationId: `application-${index}`,
  durableRevision: 1,
  venueBinding: { gameId: game.gameId, venueId: 'venue-1',
    fixtureEventId: `fixture-${index}`, fixtureRevision: 0 },
  lineScore: { innings: Array.from({ length: 9 }, (_, inning) => ({
    inning: inning + 1, homeRuns: inning === 0 ? 1 : 0,
    awayRuns: 0 })),
  totals: { home: { runs: 1, hits: 1, errors: 0 },
    away: { runs: 0, hits: 0, errors: 0 } } },
}));
const byGame = new Map(results.map((result) => [result.gameId, result]));
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
  postseasonEntries: [], qualificationPolicyVersion: 'qualification-v1',
  competitionEditionId: 'continental-2027', berthCount: 2,
  alreadyQualifiedClubIds: [],
  eligibilityByClubId: Object.fromEntries(clubs.map((clubId) =>
    [clubId, { eligible: true }])),
};

it('advances a complete durable table season to both titles and berth provenance', () => {
  const projected = projectDirectDomesticCompetitionFromWorld(stores, request);
  expect(projected?.postseason.status).toBe('COMPLETE');
  expect(projected?.snapshot?.regularSeasonTitleSnapshot.winnerClubId)
    .toBe('club-1');
  expect(projected?.snapshot?.domesticChampionSnapshot.championClubId)
    .toBe('club-1');
  expect(projected?.snapshot?.continentalQualification.entrantClubIds)
    .toEqual(['club-1', 'club-2']);
  expect(projected?.snapshot?.continentalQualification.provenance[0]
    .sourceType).toBe('DOMESTIC_CHAMPION');
});

it('refuses advancement before World and each durable Match final agree', () => {
  expect(projectDirectDomesticCompetitionFromWorld({ ...stores,
    world: { readSeason: () => ({ ...world,
      standings: projectProvisionalOfficialStandings(schedule,
        results.slice(0, -1), standingsPolicy) }) } },
  request)).toBeNull();
  expect(() => projectDirectDomesticCompetitionFromWorld({ ...stores,
    match: { ...stores.match, getMatch: (gameId: string) =>
      gameId === results[0].gameId ? null : stores.match.getMatch(gameId) } },
  request)).toThrow('durable Match final');
});
