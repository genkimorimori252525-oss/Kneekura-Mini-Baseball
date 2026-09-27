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
import { projectNorthAmericaDomesticCompetitionFromWorld } from
  './NorthAmericaDomesticCompetitionFromWorld';

const clubs = Array.from({ length: 30 }, (_, index) => `club-${index + 1}`);
const pairRows = clubs.flatMap((homeClubId, homeIndex) =>
  clubs.slice(homeIndex + 1).map((awayClubId, offset) => {
    const distance = Math.min(offset + 1, 30 - (offset + 1));
    return { homeClubId, awayClubId,
      gameCount: distance <= 8 || distance === 15 ? 6 : 5 };
  }));
let nextDay = 0;
const series = pairRows.flatMap((pair) =>
  (pair.gameCount === 6 ? [3, 3] : [3, 2]).map((gameCount, part) => {
    const value = { seriesId: `${pair.homeClubId}:${pair.awayClubId}:${part}`,
      homeClubId: pair.homeClubId, awayClubId: pair.awayClubId,
      startsOnDay: nextDay, gameCount: gameCount as 2 | 3 | 4 };
    nextDay += gameCount;
    return value;
  }));
const baseSchedule = createBaseScheduleSnapshot({
  seasonId: 'season-1', leagueId: 'league-008',
  calendarProfileVersion: 'league-calendar-v1',
  generatorVersion: 'generator-v1', scheduleSeed: 'seed-1',
  opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 162, memberClubIds: clubs,
  opponentMatrix: pairRows,
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
  completionReason: 'BOTTOM_COMPLETE',
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
const conferenceAlignment = { version: 'conferences-v1',
  seasonId: 'season-1', leagueId: 'league-008',
  groups: [{ groupId: 'a', clubIds: clubs.slice(0, 15) },
    { groupId: 'b', clubIds: clubs.slice(15) }] };
const divisionAlignment = { version: 'divisions-v1',
  seasonId: 'season-1', leagueId: 'league-008',
  groups: Array.from({ length: 6 }, (_, index) => ({
    groupId: `division-${index + 1}`,
    clubIds: clubs.slice(index * 5, index * 5 + 5),
  })) };
const request = { careerId: 'career-1', seasonId: 'season-1',
  conferenceAlignment, divisionAlignment,
  policy: { version: 'north-america-v1',
    championshipHigherSeedConferenceId: 'a',
    bracket: { seedSources: ['DIVISION_WINNER_1', 'DIVISION_WINNER_2',
      'DIVISION_WINNER_3', 'WILD_CARD_1', 'WILD_CARD_2',
      'WILD_CARD_3'] as const,
    wildCardPairings: [[3, 6], [4, 5]] as const,
    divisionByes: [1, 2], divisionPairings: [[1, 1], [2, 0]] as const } },
  conferencePlans: [{ conferenceId: 'a', series: [] },
    { conferenceId: 'b', series: [] }],
  championshipPlan: null, qualificationPolicyVersion: 'qual-v1',
  competitionEditionId: 'continental-2027', berthCount: 2,
  alreadyQualifiedClubIds: [],
  eligibilityByClubId: Object.fromEntries(clubs.map((clubId) =>
    [clubId, { eligible: true }])),
};

it('projects division champions and the bracket from a complete durable season', () => {
  const projected = projectNorthAmericaDomesticCompetitionFromWorld(stores,
    request);
  expect(projected?.snapshot).toBeNull();
  expect(projected?.postseason.conferenceSeeds[0]
    .divisionWinnerClubIds).toEqual(['club-1', 'club-6', 'club-11']);
  expect(projected?.postseason.nextConferenceSeries.filter((entry) =>
    entry.conferenceId === 'a').map((entry) => entry.stage))
    .toEqual(['wild-card-1', 'wild-card-2']);
});

it('refuses a conference plan outside the accepted alignment', () => {
  expect(() => projectNorthAmericaDomesticCompetitionFromWorld(stores,
    { ...request, conferencePlans: [{ conferenceId: 'a', series: [] },
      { conferenceId: 'other', series: [] }] }))
    .toThrow('conference plans mismatch');
});
