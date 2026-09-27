import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { OfficialStandingsSnapshot } from
  '../../core/world/competition/OfficialStandings';
import { projectTeamTraitAnalyticsFromWorld } from
  './TeamTraitAnalyticsFromWorld';

const result = (index: number, homeRuns: number,
  awayRuns: number): OfficialGameResult => ({
  gameId: `game-${index}`, seasonId: 'season-1',
  homeClubId: 'club-a', awayClubId: `opponent-${index}`,
  homeRuns, awayRuns,
  winnerClubId: homeRuns > awayRuns ? 'club-a'
    : `opponent-${index}`,
  completionReason: 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId('test-rules'),
  gamePolicyVersion: 'test-game-v1',
  closureId: `closure-${index}`,
  applicationId: `application-${index}`,
  durableRevision: index,
  lineScore: { innings: Array.from({ length: 9 }, (_, inning) => ({
    inning: inning + 1,
    homeRuns: inning === 0 ? homeRuns : 0,
    awayRuns: inning === 0 ? awayRuns : 0,
  })), totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
    away: { runs: awayRuns, hits: 0, errors: 0 } } },
});
const games = [result(1, 0, 1), result(2, 1, 2),
  result(3, 0, 2)];
const standings: OfficialStandingsSnapshot = {
  seasonId: 'season-1', leagueId: 'league-1',
  tiebreakPolicyVersion: 'standings-v1',
  scheduleRevisionEventIds: [],
  resultApplicationIds: games.map(game => game.applicationId),
  orderedClubIds: ['club-a'], unresolvedTieGroups: [],
  tiebreakResolutions: [], rows: [{ clubId: 'club-a',
    games: 3, wins: 0, losses: 3, ties: 0,
    runsFor: 1, runsAgainst: 5, cappedRunDifferential: 0 }],
};
const policy = { policyId: 'analytic', version: 'v1',
  seasonId: 'season-1', minimumGames: 3,
  residualThresholdWins: { numerator: 1,
    denominator: 4 },
  lowRunsAllowedMaximum: 2, lowRunSupportMaximum: 1,
  highRunSupportMinimum: 5,
  highRunsAllowedMinimum: 5,
  minimumPatternGames: 2 };
const sources = {
  world: { readSeason: (careerId: string, seasonId: string) =>
    careerId === 'career-a' && seasonId === 'season-1'
      ? { careerId, seasonId,
        standings: { kind: 'OFFICIAL' as const,
          snapshot: standings }, results: games } : null },
  policy: { readAcceptedPolicy: (sourceId: string) =>
    sourceId === 'policy-1' ? { sourceId,
      careerId: 'career-a', policy } : null },
};
const input = { careerId: 'career-a', seasonId: 'season-1',
  clubId: 'club-a', policySourceId: 'policy-1' };

it('projects a non-causal Team Trait descriptor from official World results', () => {
  const descriptors = projectTeamTraitAnalyticsFromWorld(
    sources, input);
  expect(descriptors).toContainEqual(expect.objectContaining({
    family: 'PITCHING_GEMS_UNSUPPORTED',
    kind: 'ANALYTIC_DESCRIPTOR', polarity: 'NEGATIVE',
    evidenceCount: 3,
    sourceApplicationIds: ['application-1',
      'application-2', 'application-3'],
  }));
  expect(descriptors[0]).not.toHaveProperty('abilityModifier');
  expect(() => projectTeamTraitAnalyticsFromWorld(sources,
    { ...input, policySourceId: 'missing' }))
    .toThrow('accepted World sources');
  expect(() => projectTeamTraitAnalyticsFromWorld(sources,
    { ...input, seasonId: 'other' }))
    .toThrow('accepted World sources');
  const provisional = { ...sources,
    world: { readSeason: (careerId: string, seasonId: string) => ({
      careerId, seasonId, results: games,
      standings: { kind: 'PROVISIONAL' as const,
        seasonId, leagueId: 'league-1',
        tiebreakPolicyVersion: 'standings-v1',
        scheduleRevisionEventIds: [], rows: standings.rows,
        provisionalGroups: [], unplayedClubIds: [],
        playedGameIds: games.map(game => game.gameId),
        pendingGameIds: ['game-4'],
        resultApplicationIds: standings.resultApplicationIds },
    }) } };
  expect(() => projectTeamTraitAnalyticsFromWorld(
    provisional, input)).toThrow('completed official season');
});
