import { createCanonicalLineScoreSnapshot } from '../../model/CanonicalLineScoreSnapshot';
import type { OfficialGameResult } from '../competition/OfficialGameCompletion';
import type { OfficialStandingsSnapshot } from '../competition/OfficialStandings';

/** Historical analysis only; its value is never a Match Core input. */
export type TeamSynchronyAnalysis = Readonly<{
  scope: 'DESCRIPTOR_ONLY';
  seasonId: string;
  leagueId: string;
  clubId: string;
  games: number;
  actualWins: number;
  actualTies: number;
  actualHalfWinUnits: number;
  independentPairingHalfWinSum: number;
  /** Exact residual in wins = numerator / denominator. */
  alignmentResidualWinsNumerator: number;
  alignmentResidualWinsDenominator: number;
  sourceApplicationIds: readonly string[];
  standingsPolicyVersion: string;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const score = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const safe = (value: bigint, field: string): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)
    || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`team synchrony ${field} overflow`);
  }
  return Number(value);
};
const lowerBound = (sorted: readonly number[], target: number,
  inclusive: boolean): number => {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle]! < target
      || (inclusive && sorted[middle] === target)) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

/**
 * Compares actual wins with every independent pairing of the same season's
 * scored and allowed runs. The analysis cannot change a future result.
 */
export const analyzeTeamSynchrony = (
  clubId: string,
  standings: OfficialStandingsSnapshot,
  results: readonly OfficialGameResult[],
): TeamSynchronyAnalysis => {
  if (!id(clubId) || !id(standings?.seasonId)
    || !id(standings.leagueId)
    || !id(standings.tiebreakPolicyVersion)
    || !Array.isArray(results) || results.length === 0) {
    throw new Error('invalid team synchrony season or club');
  }
  const row = standings.rows.find((item) => item.clubId === clubId);
  if (!row) throw new Error('team synchrony standings row is missing');
  const gameIds = results.map((game) => game.gameId);
  const applicationIds = results.map((game) => game.applicationId);
  if (new Set(gameIds).size !== results.length
    || new Set(applicationIds).size !== results.length) {
    throw new Error('duplicate team synchrony official result');
  }
  const offense: number[] = [];
  const allowed: number[] = [];
  let wins = 0;
  let ties = 0;
  for (const result of results) {
    if (result.seasonId !== standings.seasonId) {
      throw new Error('team synchrony result season mismatch');
    }
    if (!id(result.gameId) || !id(result.applicationId)
      || !id(result.closureId)
      || !score(result.homeRuns) || !score(result.awayRuns)
      || result.homeClubId === result.awayClubId
      || (result.homeClubId !== clubId
        && result.awayClubId !== clubId)
      || !standings.resultApplicationIds.includes(result.applicationId)) {
      throw new Error('invalid team synchrony official result');
    }
    const line = createCanonicalLineScoreSnapshot(result.lineScore);
    if (line.totals.home.runs !== result.homeRuns
      || line.totals.away.runs !== result.awayRuns) {
      throw new Error('team synchrony result line score mismatch');
    }
    const expectedWinner = result.homeRuns === result.awayRuns
      ? null : result.homeRuns > result.awayRuns
        ? result.homeClubId : result.awayClubId;
    if (expectedWinner !== result.winnerClubId) {
      throw new Error('team synchrony result winner mismatch');
    }
    if (expectedWinner === clubId) wins += 1;
    if (expectedWinner === null) ties += 1;
    offense.push(result.homeClubId === clubId
      ? result.homeRuns : result.awayRuns);
    allowed.push(result.homeClubId === clubId
      ? result.awayRuns : result.homeRuns);
  }
  const totalFor = offense.reduce((sum, runs) => sum + BigInt(runs), 0n);
  const totalAgainst = allowed.reduce((sum, runs) => sum + BigInt(runs), 0n);
  if (!score(row.games) || !score(row.wins)
    || !score(row.losses) || !score(row.ties)
    || !score(row.runsFor) || !score(row.runsAgainst)
    || row.games !== results.length || row.wins !== wins
    || row.ties !== ties
    || row.losses !== results.length - wins - ties
    || BigInt(row.runsFor) !== totalFor
    || BigInt(row.runsAgainst) !== totalAgainst) {
    throw new Error('team synchrony results do not match standings');
  }
  let pairedHalfWinSum = 0n;
  const orderedAllowed = [...allowed].sort((a, b) => a - b);
  for (const scored of offense) {
    const less = lowerBound(orderedAllowed, scored, false);
    const equal = lowerBound(orderedAllowed, scored, true) - less;
    pairedHalfWinSum += 2n * BigInt(less) + BigInt(equal);
  }
  const actualHalfWinUnits = 2 * wins + ties;
  const n = BigInt(results.length);
  const numerator = BigInt(actualHalfWinUnits) * n
    - pairedHalfWinSum;
  return Object.freeze({ scope: 'DESCRIPTOR_ONLY',
    seasonId: standings.seasonId, leagueId: standings.leagueId,
    clubId, games: results.length, actualWins: wins,
    actualTies: ties, actualHalfWinUnits,
    independentPairingHalfWinSum: safe(pairedHalfWinSum,
      'independent pairing'),
    alignmentResidualWinsNumerator: safe(numerator,
      'alignment residual'),
    alignmentResidualWinsDenominator: safe(2n * n,
      'alignment denominator'),
    sourceApplicationIds: Object.freeze([...applicationIds].sort()),
    standingsPolicyVersion: standings.tiebreakPolicyVersion,
  });
};
