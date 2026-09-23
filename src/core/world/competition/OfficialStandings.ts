import { createCanonicalLineScoreSnapshot } from '../../model/CanonicalLineScoreSnapshot';
import type { CurrentLeagueSchedule } from './LeagueSchedule';
import type { OfficialGameResult } from './OfficialGameCompletion';

export type StandingsTiebreakPolicy = Readonly<{
  version: string;
  tieCreditNumerator: number;
  tieCreditDenominator: number;
  runDifferentialCapPerGame: number;
}>;
export type OfficialStandingRow = Readonly<{
  clubId: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  runsFor: number;
  runsAgainst: number;
  cappedRunDifferential: number;
}>;
export type OfficialStandingsSnapshot = Readonly<{
  seasonId: string;
  leagueId: string;
  tiebreakPolicyVersion: string;
  scheduleRevisionEventIds: readonly string[];
  rows: readonly OfficialStandingRow[];
  orderedClubIds: readonly string[] | null;
  unresolvedTieGroups: readonly (readonly string[])[];
  resultApplicationIds: readonly string[];
  tiebreakResolutions: readonly Readonly<{
    policyVersion: string;
    gameId: string;
    applicationId: string;
    winnerClubId: string;
    loserClubId: string;
  }>[];
}>;
export type OfficialTiebreakGamePlan = Readonly<{
  version: string;
  gameId: string;
  seasonId: string;
  homeClubId: string;
  awayClubId: string;
}>;

const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Full-season ranking consumes only final results matched to scheduled games. */
export const buildOfficialStandings = (
  schedule: CurrentLeagueSchedule,
  results: readonly OfficialGameResult[],
  policy: StandingsTiebreakPolicy,
): OfficialStandingsSnapshot => {
  if (
    !policy.version
    || !Number.isSafeInteger(policy.tieCreditNumerator)
    || !Number.isSafeInteger(policy.tieCreditDenominator)
    || policy.tieCreditDenominator <= 0
    || policy.tieCreditNumerator < 0
    || policy.tieCreditNumerator > policy.tieCreditDenominator
    || !Number.isSafeInteger(policy.runDifferentialCapPerGame)
    || policy.runDifferentialCapPerGame < 0
  ) throw new Error('invalid versioned standings tiebreak policy');
  if (results.length !== schedule.games.length) {
    throw new Error('standings require complete official game results');
  }
  const games = new Map(schedule.games.map((game) => [game.gameId, game]));
  const seenGames = new Set<string>();
  const seenClosures = new Set<string>();
  const seenApplications = new Set<string>();
  const mutable = new Map(schedule.memberClubIds.map((clubId) => [clubId, {
    clubId, games: 0, wins: 0, losses: 0, ties: 0, runsFor: 0,
    runsAgainst: 0, cappedRunDifferential: 0,
  }]));
  for (const result of results) {
    const game = games.get(result.gameId);
    if (
      !game || seenGames.has(result.gameId)
      || seenClosures.has(result.closureId) || seenApplications.has(result.applicationId)
      || !result.closureId || !result.applicationId
      || result.seasonId !== schedule.seasonId
      || result.homeClubId !== game.homeClubId || result.awayClubId !== game.awayClubId
      || !Number.isSafeInteger(result.homeRuns) || result.homeRuns < 0
      || !Number.isSafeInteger(result.awayRuns) || result.awayRuns < 0
    ) throw new Error('official result does not match a unique scheduled game');
    const expectedWinner = result.homeRuns > result.awayRuns ? result.homeClubId
      : result.awayRuns > result.homeRuns ? result.awayClubId : null;
    const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
    if (
      result.winnerClubId !== expectedWinner
      || lineScore.totals.home.runs !== result.homeRuns
      || lineScore.totals.away.runs !== result.awayRuns
    ) throw new Error('official result contradicts its winner or line score');
    seenGames.add(result.gameId);
    seenClosures.add(result.closureId);
    seenApplications.add(result.applicationId);
    const home = mutable.get(result.homeClubId)!;
    const away = mutable.get(result.awayClubId)!;
    home.games += 1; away.games += 1;
    home.runsFor += result.homeRuns; home.runsAgainst += result.awayRuns;
    away.runsFor += result.awayRuns; away.runsAgainst += result.homeRuns;
    const capped = Math.max(-policy.runDifferentialCapPerGame,
      Math.min(policy.runDifferentialCapPerGame, result.homeRuns - result.awayRuns));
    home.cappedRunDifferential += capped;
    away.cappedRunDifferential -= capped;
    if (expectedWinner === null) {
      home.ties += 1; away.ties += 1;
    } else if (expectedWinner === result.homeClubId) {
      home.wins += 1; away.losses += 1;
    } else {
      away.wins += 1; home.losses += 1;
    }
  }
  if ([...mutable.values()].some((row) => row.games !== schedule.regularSeasonGamesPerClub)) {
    throw new Error('official standings do not cover every club game');
  }
  const rows = [...mutable.values()];
  const points = (wins: number, ties: number): bigint =>
    BigInt(wins) * BigInt(policy.tieCreditDenominator)
      + BigInt(ties) * BigInt(policy.tieCreditNumerator);
  const compareBig = (a: bigint, b: bigint): number => a < b ? -1 : a > b ? 1 : 0;
  const groupBy = <T>(
    groups: typeof rows[],
    value: (row: typeof rows[number], group: typeof rows) => T,
    compare: (a: T, b: T) => number,
  ): typeof rows[] => groups.flatMap((group) => {
    if (group.length < 2) return [group];
    const ranked = group.map((row) => ({ row, key: value(row, group) }))
      .sort((a, b) => compare(a.key, b.key) || compareText(a.row.clubId, b.row.clubId));
    const partitions: typeof rows[] = [];
    for (const item of ranked) {
      const last = partitions[partitions.length - 1];
      if (!last || compare(value(last[0], group), item.key) !== 0) partitions.push([item.row]);
      else last.push(item.row);
    }
    return partitions;
  });
  let groups: typeof rows[] = [rows];
  groups = groupBy(groups, (row) => points(row.wins, row.ties), (a, b) => compareBig(b, a));
  const headToHead = (row: typeof rows[number], group: typeof rows) => {
    const tied = new Set(group.map((item) => item.clubId));
    let wins = 0; let ties = 0; let played = 0;
    for (const result of results) {
      if (!tied.has(result.homeClubId) || !tied.has(result.awayClubId)) continue;
      if (result.homeClubId !== row.clubId && result.awayClubId !== row.clubId) continue;
      played += 1;
      if (result.winnerClubId === row.clubId) wins += 1;
      else if (result.winnerClubId === null) ties += 1;
    }
    return { points: points(wins, ties), games: played };
  };
  groups = groupBy(groups, (row, group) => {
    // A ratio with zero games is undefined. Skip this criterion for the
    // whole tied group when its opponent matrix offers no comparison.
    if (group.some((member) => headToHead(member, group).games === 0)) {
      return { points: BigInt(0), games: 0 };
    }
    return headToHead(row, group);
  }, (a, b) => compareBig(b.points * BigInt(a.games), a.points * BigInt(b.games)));
  groups = groupBy(groups, (row) => row.cappedRunDifferential, (a, b) => b - a);
  groups = groupBy(groups, (row) => row.runsAgainst, (a, b) => a - b);
  const unresolvedTieGroups = groups.filter((group) => group.length > 1)
    .map((group) => Object.freeze(group.map((row) => row.clubId).sort(compareText)));
  return Object.freeze({
    seasonId: schedule.seasonId,
    leagueId: schedule.leagueId,
    tiebreakPolicyVersion: policy.version,
    scheduleRevisionEventIds: Object.freeze([...schedule.revisionEventIds]),
    rows: Object.freeze(groups.flat().map((row) => Object.freeze({ ...row }))),
    orderedClubIds: unresolvedTieGroups.length > 0 ? null
      : Object.freeze(groups.flat().map((row) => row.clubId)),
    unresolvedTieGroups: Object.freeze(unresolvedTieGroups),
    resultApplicationIds: Object.freeze(results.map((result) => result.applicationId)),
    tiebreakResolutions: Object.freeze([]),
  });
};

/** Applies one official deciding game to an unresolved two-club tie. */
export const applyOfficialTiebreakGame = (
  standings: OfficialStandingsSnapshot,
  plan: OfficialTiebreakGamePlan,
  result: OfficialGameResult,
): OfficialStandingsSnapshot => {
  const groupIndex = standings.unresolvedTieGroups.findIndex((group) =>
    group.length === 2 && group.includes(plan.homeClubId) && group.includes(plan.awayClubId));
  if (!plan.version || !plan.gameId || !plan.homeClubId || !plan.awayClubId
    || plan.homeClubId === plan.awayClubId || groupIndex < 0) {
    throw new Error('tiebreak game must resolve an official two-club tie');
  }
  if (plan.seasonId !== standings.seasonId || result.seasonId !== standings.seasonId) {
    throw new Error('tiebreak game season must match official standings');
  }
  const winner = result.homeRuns > result.awayRuns ? result.homeClubId
    : result.awayRuns > result.homeRuns ? result.awayClubId : null;
  const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
  if (result.gameId !== plan.gameId
    || result.homeClubId !== plan.homeClubId || result.awayClubId !== plan.awayClubId
    || !result.closureId || !result.applicationId
    || standings.resultApplicationIds.includes(result.applicationId)
    || standings.tiebreakResolutions.some((item) =>
      item.gameId === result.gameId || item.applicationId === result.applicationId)
    || winner === null || winner !== result.winnerClubId
    || lineScore.totals.home.runs !== result.homeRuns
    || lineScore.totals.away.runs !== result.awayRuns) {
    throw new Error('tiebreak requires a unique decided official game result');
  }
  const loser = winner === plan.homeClubId ? plan.awayClubId : plan.homeClubId;
  const positions = standings.rows.map((row) => row.clubId);
  const first = positions.findIndex((clubId) => clubId === winner || clubId === loser);
  if (first < 0 || positions[first + 1] !== (positions[first] === winner ? loser : winner)) {
    throw new Error('unresolved tiebreak group must remain adjacent in official standings');
  }
  positions.splice(first, 2, winner, loser);
  const rowsByClub = new Map(standings.rows.map((row) => [row.clubId, row]));
  const unresolvedTieGroups = standings.unresolvedTieGroups.filter((_, index) => index !== groupIndex);
  return Object.freeze({ ...standings,
    rows: Object.freeze(positions.map((clubId) => rowsByClub.get(clubId)!)),
    orderedClubIds: unresolvedTieGroups.length === 0 ? Object.freeze([...positions]) : null,
    unresolvedTieGroups: Object.freeze(unresolvedTieGroups),
    tiebreakResolutions: Object.freeze([...standings.tiebreakResolutions,
      Object.freeze({ policyVersion: plan.version, gameId: plan.gameId,
        applicationId: result.applicationId, winnerClubId: winner, loserClubId: loser })]),
  });
};
