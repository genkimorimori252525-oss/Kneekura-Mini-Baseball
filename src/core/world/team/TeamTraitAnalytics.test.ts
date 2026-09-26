import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from '../competition/OfficialGameCompletion';
import type { OfficialStandingsSnapshot } from '../competition/OfficialStandings';
import { deriveTeamTraitAnalyticDescriptors } from './TeamTraitAnalytics';

const result = (index: number, runsFor: number,
  runsAgainst: number): OfficialGameResult => ({
  gameId: `game-${index}`, seasonId: 'season-1',
  homeClubId: 'club-a', awayClubId: `opponent-${index}`,
  homeRuns: runsFor, awayRuns: runsAgainst,
  winnerClubId: runsFor === runsAgainst ? null
    : runsFor > runsAgainst ? 'club-a' : `opponent-${index}`,
  completionReason: runsFor === runsAgainst ? 'TIE_LIMIT'
    : 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId('test-rules'),
  gamePolicyVersion: 'test-game-v1',
  closureId: `closure-${index}`,
  applicationId: `application-${index}`, durableRevision: index,
  lineScore: { innings: Array.from({ length: 9 }, (_, inning) => ({
    inning: inning + 1,
    homeRuns: inning === 0 ? runsFor : 0,
    awayRuns: inning === 0 ? runsAgainst : 0,
  })), totals: {
    home: { runs: runsFor, hits: 0, errors: 0 },
    away: { runs: runsAgainst, hits: 0, errors: 0 },
  } },
});
const standings = (games: readonly OfficialGameResult[]): OfficialStandingsSnapshot => {
  const wins = games.filter((game) =>
    game.winnerClubId === 'club-a').length;
  const ties = games.filter((game) =>
    game.winnerClubId === null).length;
  return { seasonId: 'season-1', leagueId: 'league-1',
    tiebreakPolicyVersion: 'standings-v1',
    scheduleRevisionEventIds: [],
    resultApplicationIds: games.map((game) => game.applicationId),
    orderedClubIds: ['club-a'], unresolvedTieGroups: [],
    tiebreakResolutions: [], rows: [{ clubId: 'club-a',
      games: games.length, wins,
      losses: games.length - wins - ties, ties,
      runsFor: games.reduce((sum, game) => sum + game.homeRuns, 0),
      runsAgainst: games.reduce((sum, game) =>
        sum + game.awayRuns, 0), cappedRunDifferential: 0,
    }] };
};
const policy = { policyId: 'synthetic-analytic-traits', version: 'v1',
  seasonId: 'season-1', minimumGames: 3,
  residualThresholdWins: { numerator: 1, denominator: 4 },
  lowRunsAllowedMaximum: 2, lowRunSupportMaximum: 1,
  highRunSupportMinimum: 5, highRunsAllowedMinimum: 5,
  minimumPatternGames: 2 };

it('projects negative alignment from official paired results without gameplay effects', () => {
  const games = [result(1, 5, 1), result(2, 1, 5),
    result(3, 2, 4)];
  const descriptor = deriveTeamTraitAnalyticDescriptors('club-a',
    standings(games), games, policy);
  expect(descriptor).toMatchObject([{ family: 'TEAM_SYNCHRONY',
    kind: 'ANALYTIC_DESCRIPTOR', polarity: 'NEGATIVE',
    sourceApplicationIds: ['application-1', 'application-2',
      'application-3'] }]);
  expect(descriptor[0]).not.toHaveProperty('winProbabilityModifier');
  expect(deriveTeamTraitAnalyticDescriptors('club-a',
    standings(games), [...games].reverse(), policy))
    .toEqual(descriptor);
});

it('keeps repeated pitching-without-support and squandered-support patterns separate', () => {
  const unsupported = [result(1, 0, 1), result(2, 1, 2),
    result(3, 0, 2)];
  expect(deriveTeamTraitAnalyticDescriptors('club-a',
    standings(unsupported), unsupported, policy))
    .toContainEqual(expect.objectContaining({
      family: 'PITCHING_GEMS_UNSUPPORTED',
      sourceApplicationIds: ['application-1', 'application-2',
        'application-3'],
    }));
  const squandered = [result(1, 5, 6), result(2, 7, 8),
    result(3, 0, 2)];
  expect(deriveTeamTraitAnalyticDescriptors('club-a',
    standings(squandered), squandered, policy))
    .toContainEqual(expect.objectContaining({
      family: 'RUN_SUPPORT_SQUANDERED',
      sourceApplicationIds: ['application-1', 'application-2'],
    }));
  const successful = [result(1, 1, 0), result(2, 1, 0),
    result(3, 8, 5)];
  expect(deriveTeamTraitAnalyticDescriptors('club-a',
    standings(successful), successful, policy).some((item) =>
    item.family === 'PITCHING_GEMS_UNSUPPORTED'
      || item.family === 'RUN_SUPPORT_SQUANDERED')).toBe(false);
});

it('requires season policy and matching official evidence', () => {
  const games = [result(1, 5, 1), result(2, 1, 5),
    result(3, 2, 4)];
  expect(() => deriveTeamTraitAnalyticDescriptors('club-a',
    standings(games), games, { ...policy,
      seasonId: 'other' })).toThrow('policy');
  expect(() => deriveTeamTraitAnalyticDescriptors('club-a',
    standings(games), games.slice(0, 2), policy))
    .toThrow('standings');
  expect(deriveTeamTraitAnalyticDescriptors('club-a',
    standings(games), games, { ...policy,
      residualThresholdWins: { numerator: 1, denominator: 2 } }))
    .toEqual([]);
});
