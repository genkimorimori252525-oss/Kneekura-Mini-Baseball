import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from '../competition/OfficialGameCompletion';
import type { OfficialStandingsSnapshot } from '../competition/OfficialStandings';
import { analyzeTeamSynchrony } from './TeamSynchrony';

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
  const wins = games.filter((game) => game.winnerClubId === 'club-a').length;
  const ties = games.filter((game) => game.winnerClubId === null).length;
  return { seasonId: 'season-1', leagueId: 'league-1',
    tiebreakPolicyVersion: 'standings-v1', scheduleRevisionEventIds: [],
    resultApplicationIds: games.map((game) => game.applicationId),
    orderedClubIds: ['club-a'], unresolvedTieGroups: [],
    tiebreakResolutions: [], rows: [{ clubId: 'club-a',
      games: games.length, wins, losses: games.length - wins - ties, ties,
      runsFor: games.reduce((sum, game) => sum +
        (game.homeClubId === 'club-a' ? game.homeRuns : game.awayRuns), 0),
      runsAgainst: games.reduce((sum, game) => sum +
        (game.homeClubId === 'club-a' ? game.awayRuns : game.homeRuns), 0),
      cappedRunDifferential: 0,
    }] };
};

it('measures negative alignment against all independent offense-pitching pairings', () => {
  const games = [result(1, 5, 1), result(2, 1, 5),
    result(3, 2, 4)];
  const analysis = analyzeTeamSynchrony('club-a', standings(games), games);
  expect(analysis).toMatchObject({ scope: 'DESCRIPTOR_ONLY',
    clubId: 'club-a', seasonId: 'season-1', games: 3,
    actualHalfWinUnits: 2, independentPairingHalfWinSum: 8,
    alignmentResidualWinsNumerator: -2,
    alignmentResidualWinsDenominator: 6 });
  expect(Object.isFrozen(analysis.sourceApplicationIds)).toBe(true);
  expect(analysis).not.toHaveProperty('winProbabilityModifier');
  expect(analyzeTeamSynchrony('club-a', standings(games),
    [...games].reverse())).toEqual(analysis);
});

it('changes only the descriptor when the same distributions pair differently', () => {
  const games = [result(1, 5, 4), result(2, 1, 1),
    result(3, 2, 5)];
  const analysis = analyzeTeamSynchrony('club-a', standings(games), games);
  expect(analysis).toMatchObject({ actualHalfWinUnits: 3,
    independentPairingHalfWinSum: 8,
    alignmentResidualWinsNumerator: 1,
    alignmentResidualWinsDenominator: 6 });
});

it('orients away-club runs and counts official ties as half-wins', () => {
  const away = { ...result(2, 4, 2),
    homeClubId: 'opponent-2', awayClubId: 'club-a',
    winnerClubId: 'opponent-2' };
  const games = [result(1, 3, 1), away, result(3, 0, 0)];
  expect(analyzeTeamSynchrony('club-a', standings(games), games))
    .toMatchObject({ actualWins: 1, actualTies: 1,
      actualHalfWinUnits: 3,
      independentPairingHalfWinSum: 9,
      alignmentResidualWinsNumerator: 0 });
});

it('rejects missing, duplicate, contradictory and wrong-season official evidence', () => {
  const games = [result(1, 5, 1), result(2, 1, 5),
    result(3, 2, 4)];
  const table = standings(games);
  expect(() => analyzeTeamSynchrony('club-a', table,
    games.slice(0, 2))).toThrow('standings');
  expect(() => analyzeTeamSynchrony('club-a', table,
    [games[0]!, games[0]!, games[2]!])).toThrow('duplicate');
  expect(() => analyzeTeamSynchrony('club-a', table,
    [{ ...games[0]!, winnerClubId: 'opponent-1' },
      ...games.slice(1)])).toThrow('result');
  expect(() => analyzeTeamSynchrony('club-a', table,
    [{ ...games[0]!, seasonId: 'other' },
      ...games.slice(1)])).toThrow('season');
});
