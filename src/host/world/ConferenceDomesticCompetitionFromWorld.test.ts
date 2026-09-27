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
import { projectConferenceDomesticCompetitionFromWorld } from
  './ConferenceDomesticCompetitionFromWorld';

const clubs = Array.from({ length: 12 }, (_, index) => `club-${index + 1}`);
const pairRows = clubs.flatMap((homeClubId, homeIndex) =>
  clubs.slice(homeIndex + 1).map((awayClubId, offset) => ({
    homeClubId, awayClubId,
    gameCount: homeIndex % 2 === 0 && offset === 0 ? 20 : 10,
  })));
let nextDay = 0;
const series = pairRows.flatMap((pair) =>
  (pair.gameCount === 20 ? [4, 4, 4, 4, 4] : [4, 3, 3])
    .map((gameCount, part) => {
      const value = { seriesId: `${pair.homeClubId}:${pair.awayClubId}:${part}`,
        homeClubId: pair.homeClubId, awayClubId: pair.awayClubId,
        startsOnDay: nextDay, gameCount: gameCount as 2 | 3 | 4 };
      nextDay += gameCount;
      return value;
    }));
const baseSchedule = createBaseScheduleSnapshot({
  seasonId: 'season-1', leagueId: 'league-001',
  calendarProfileVersion: 'league-calendar-v1',
  generatorVersion: 'generator-v1', scheduleSeed: 'seed-1',
  opponentMatrixVersion: 'matrix-v1',
  regularSeasonGamesPerClub: 120, memberClubIds: clubs,
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
const alignment = { version: 'alignment-v1',
  seasonId: 'season-1', leagueId: 'league-001',
  groups: [{ groupId: 'group-a', clubIds: clubs.slice(0, 6) },
    { groupId: 'group-b', clubIds: clubs.slice(6) }] };
const request = { careerId: 'career-1', seasonId: 'season-1',
  alignment,
  policy: { version: 'japan-postseason-v1' as const,
    format: 'JAPAN' as const,
    championshipHigherSeedGroupId: 'group-a',
    qualificationPolicyVersion: 'qual-v1',
    qualificationPriorityGroupIds: ['group-a', 'group-b'] },
  groupPlans: [{ groupId: 'group-a', series: [] },
    { groupId: 'group-b', series: [] }],
  championshipPlan: null,
  competitionEditionId: 'continental-2027', berthCount: 2,
  alreadyQualifiedClubIds: [],
  eligibilityByClubId: Object.fromEntries(clubs.map((clubId) =>
    [clubId, { eligible: true }])),
};

it('projects official group pennants and next series from durable World results', () => {
  const projected = projectConferenceDomesticCompetitionFromWorld(stores,
    request);
  expect(projected?.snapshot).toBeNull();
  expect(projected?.postseason.groupPennantWinners).toEqual([
    { groupId: 'group-a', clubId: 'club-1' },
    { groupId: 'group-b', clubId: 'club-7' },
  ]);
  expect(projected?.postseason.nextGroupSeries).toEqual([
    { groupId: 'group-a', stage: 'preliminary',
      higherSeedClubId: 'club-2', lowerSeedClubId: 'club-3', bestOf: 3 },
    { groupId: 'group-b', stage: 'preliminary',
      higherSeedClubId: 'club-8', lowerSeedClubId: 'club-9', bestOf: 3 },
  ]);
});

it('rejects group plans outside the frozen alignment', () => {
  expect(() => projectConferenceDomesticCompetitionFromWorld(stores,
    { ...request, groupPlans: [{ groupId: 'group-a', series: [] },
      { groupId: 'other', series: [] }] })).toThrow('group plans mismatch');
});
