import { createCanonicalLineScoreSnapshot } from '../../model/CanonicalLineScoreSnapshot';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { OfficialStandingRow, OfficialStandingsSchedule,
  StandingsTiebreakPolicy } from './OfficialStandings';

export type ProvisionalOfficialStandings = Readonly<{
  kind: 'PROVISIONAL';
  seasonId: string;
  leagueId: string;
  tiebreakPolicyVersion: string;
  scheduleRevisionEventIds: readonly string[];
  rows: readonly OfficialStandingRow[];
  /** Winning-credit percentage groups, without final-season tiebreaks. */
  provisionalGroups: readonly (readonly string[])[];
  unplayedClubIds: readonly string[];
  playedGameIds: readonly string[];
  pendingGameIds: readonly string[];
  resultApplicationIds: readonly string[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
const nonnegative = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const add = (a: number, b: number): number => {
  const sum = BigInt(a) + BigInt(b);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('provisional standings count overflow');
  }
  return Number(sum);
};
const addSigned = (a: number, b: number): number => {
  const sum = BigInt(a) + BigInt(b);
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (sum > limit || sum < -limit) {
    throw new Error('provisional standings run differential overflow');
  }
  return Number(sum);
};

/** Records only accepted games; official title ranking waits for the full schedule. */
export const projectProvisionalOfficialStandings = (
  schedule: OfficialStandingsSchedule,
  results: readonly OfficialGameResult[],
  policy: StandingsTiebreakPolicy,
): ProvisionalOfficialStandings => {
  if (!schedule || !id(schedule.seasonId) || !id(schedule.leagueId)
    || !Array.isArray(schedule.memberClubIds)
    || !Array.isArray(schedule.games)
    || !Array.isArray(schedule.revisionEventIds)
    || !Number.isSafeInteger(schedule.regularSeasonGamesPerClub)
    || schedule.regularSeasonGamesPerClub <= 0
    || !policy || !id(policy.version)
    || !nonnegative(policy.tieCreditNumerator)
    || !Number.isSafeInteger(policy.tieCreditDenominator)
    || policy.tieCreditDenominator <= 0
    || policy.tieCreditNumerator > policy.tieCreditDenominator
    || !nonnegative(policy.runDifferentialCapPerGame)
    || !Array.isArray(results)
    || results.length >= schedule.games.length) {
    throw new Error('invalid provisional standings schedule or policy');
  }
  const members = new Set(schedule.memberClubIds);
  const scheduled = new Map(schedule.games.map((game) => [game.gameId, game]));
  if (members.size !== schedule.memberClubIds.length
    || schedule.memberClubIds.some((clubId) => !id(clubId))
    || scheduled.size !== schedule.games.length
    || schedule.revisionEventIds.some((eventId) => !id(eventId))
    || new Set(schedule.revisionEventIds).size
      !== schedule.revisionEventIds.length) {
    throw new Error('invalid provisional standings identity');
  }
  const scheduledCounts = new Map(schedule.memberClubIds.map((clubId) =>
    [clubId, 0]));
  for (const game of schedule.games) {
    if (!id(game.gameId) || !members.has(game.homeClubId)
      || !members.has(game.awayClubId)
      || game.homeClubId === game.awayClubId) {
      throw new Error('invalid provisional standings scheduled game');
    }
    scheduledCounts.set(game.homeClubId,
      add(scheduledCounts.get(game.homeClubId)!, 1));
    scheduledCounts.set(game.awayClubId,
      add(scheduledCounts.get(game.awayClubId)!, 1));
  }
  if ([...scheduledCounts.values()].some((count) =>
    count !== schedule.regularSeasonGamesPerClub)) {
    throw new Error('provisional schedule has incomplete club game counts');
  }
  const rows = new Map(schedule.memberClubIds.map((clubId) => [clubId, {
    clubId, games: 0, wins: 0, losses: 0, ties: 0, runsFor: 0,
    runsAgainst: 0, cappedRunDifferential: 0,
  }]));
  const seenGames = new Set<string>();
  const seenApplications = new Set<string>();
  for (const result of results) {
    const game = scheduled.get(result?.gameId);
    if (!game || seenGames.has(result.gameId)
      || !id(result.applicationId) || !id(result.closureId)
      || seenApplications.has(result.applicationId)
      || result.seasonId !== schedule.seasonId
      || result.homeClubId !== game.homeClubId
      || result.awayClubId !== game.awayClubId
      || !nonnegative(result.homeRuns)
      || !nonnegative(result.awayRuns)) {
      throw new Error('nonunique or mismatched provisional official result');
    }
    const winner = result.homeRuns > result.awayRuns
      ? result.homeClubId : result.awayRuns > result.homeRuns
        ? result.awayClubId : null;
    const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
    if (result.winnerClubId !== winner
      || lineScore.totals.home.runs !== result.homeRuns
      || lineScore.totals.away.runs !== result.awayRuns) {
      throw new Error('provisional official result contradicts score');
    }
    seenGames.add(result.gameId);
    seenApplications.add(result.applicationId);
    const home = rows.get(result.homeClubId)!;
    const away = rows.get(result.awayClubId)!;
    home.games = add(home.games, 1);
    away.games = add(away.games, 1);
    home.runsFor = add(home.runsFor, result.homeRuns);
    home.runsAgainst = add(home.runsAgainst, result.awayRuns);
    away.runsFor = add(away.runsFor, result.awayRuns);
    away.runsAgainst = add(away.runsAgainst, result.homeRuns);
    const capped = Math.max(-policy.runDifferentialCapPerGame,
      Math.min(policy.runDifferentialCapPerGame,
        result.homeRuns - result.awayRuns));
    home.cappedRunDifferential = addSigned(home.cappedRunDifferential,
      capped);
    away.cappedRunDifferential = addSigned(away.cappedRunDifferential,
      -capped);
    if (winner === null) {
      home.ties = add(home.ties, 1);
      away.ties = add(away.ties, 1);
    } else if (winner === result.homeClubId) {
      home.wins = add(home.wins, 1);
      away.losses = add(away.losses, 1);
    } else {
      away.wins = add(away.wins, 1);
      home.losses = add(home.losses, 1);
    }
  }
  const rowValues = [...rows.values()].sort((a, b) =>
    compareText(a.clubId, b.clubId));
  const credit = (row: OfficialStandingRow): bigint =>
    BigInt(row.wins) * BigInt(policy.tieCreditDenominator)
      + BigInt(row.ties) * BigInt(policy.tieCreditNumerator);
  const played = rowValues.filter((row) => row.games > 0).sort((a, b) => {
    const left = credit(a) * BigInt(b.games);
    const right = credit(b) * BigInt(a.games);
    return left > right ? -1 : left < right ? 1
      : compareText(a.clubId, b.clubId);
  });
  const provisionalGroups: string[][] = [];
  for (const row of played) {
    const priorId = provisionalGroups[provisionalGroups.length - 1]?.[0];
    const prior = priorId === undefined ? null : rows.get(priorId)!;
    if (!prior || credit(prior) * BigInt(row.games)
      !== credit(row) * BigInt(prior.games)) {
      provisionalGroups.push([row.clubId]);
    } else {
      provisionalGroups[provisionalGroups.length - 1]!.push(row.clubId);
    }
  }
  return Object.freeze({ kind: 'PROVISIONAL',
    seasonId: schedule.seasonId, leagueId: schedule.leagueId,
    tiebreakPolicyVersion: policy.version,
    scheduleRevisionEventIds: Object.freeze([...schedule.revisionEventIds]),
    rows: Object.freeze(rowValues.map((row) => Object.freeze({ ...row }))),
    provisionalGroups: Object.freeze(provisionalGroups.map((group) =>
      Object.freeze(group))),
    unplayedClubIds: Object.freeze(rowValues.filter((row) => row.games === 0)
      .map((row) => row.clubId)),
    playedGameIds: Object.freeze(results.map((result) => result.gameId)),
    pendingGameIds: Object.freeze(schedule.games.filter((game) =>
      !seenGames.has(game.gameId)).map((game) => game.gameId)),
    resultApplicationIds: Object.freeze(results.map((result) =>
      result.applicationId)),
  });
};
