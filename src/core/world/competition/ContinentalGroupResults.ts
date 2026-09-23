import type { OfficialGameResult } from './OfficialGameCompletion';
import { buildOfficialStandings, type OfficialStandingsSnapshot,
  type StandingsTiebreakPolicy } from './OfficialStandings';
import type { ContinentalHomeAssignment } from './ContinentalHomeFairness';

export type ContinentalGroupGame = Readonly<{
  gameId: string;
  seriesId: string;
  gameIndex: 1 | 2 | 3;
  homeClubId: string;
  awayClubId: string;
}>;
export type ContinentalGroupGamePlan = Readonly<{
  competitionId: string;
  editionId: string;
  drawPolicyVersion: string;
  homeFairnessPolicyVersion: string;
  groups: readonly Readonly<{
    groupIndex: number;
    memberClubIds: readonly string[];
    games: readonly ContinentalGroupGame[];
  }>[];
}>;
export type ContinentalGroupResultsSnapshot = Readonly<{
  competitionId: string;
  editionId: string;
  gamePlan: ContinentalGroupGamePlan;
  tiebreakPolicyVersion: string;
  tiebreakPolicy: StandingsTiebreakPolicy;
  groups: readonly Readonly<{
    groupIndex: number;
    standings: OfficialStandingsSnapshot;
    qualifierClubIds: readonly string[] | null;
  }>[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const pairKey = (first: string, second: string): string =>
  JSON.stringify([first, second].sort());

/** Pins game identities, never a date or a synthetic result. */
export const createContinentalGroupGamePlan = (
  assignment: ContinentalHomeAssignment,
): ContinentalGroupGamePlan => {
  if (!id(assignment?.competitionId) || !id(assignment.editionId)
    || !id(assignment.drawPolicyVersion)
    || !id(assignment.homeFairnessPolicyVersion)
    || !Array.isArray(assignment.groups) || assignment.groups.length !== 4
    || !Array.isArray(assignment.groupClubIds)
    || assignment.groupClubIds.length !== 4) {
    throw new Error('invalid continental home assignment');
  }
  const seenSeries = new Set<string>();
  const seenClubs = new Set<string>();
  const assignedGroups: ContinentalHomeAssignment['groups'] = assignment.groups;
  const groups = assignedGroups.map((group, groupIndex) => {
    const memberClubIds = assignment.groupClubIds[groupIndex];
    if (group.groupIndex !== groupIndex || !Array.isArray(memberClubIds)
      || memberClubIds.length !== 4 || memberClubIds.some((clubId) =>
        !id(clubId) || seenClubs.has(clubId))
      || new Set(memberClubIds).size !== 4
      || !Array.isArray(group.series) || group.series.length !== 6) {
      throw new Error('invalid continental group membership or series');
    }
    memberClubIds.forEach((clubId) => seenClubs.add(clubId));
    const members = new Set(memberClubIds);
    const seenPairs = new Set<string>();
    const homeCounts = new Map(memberClubIds.map((clubId) => [clubId, 0]));
    const seriesList: ContinentalHomeAssignment['groups'][number]['series'] =
      group.series;
    const games = seriesList.flatMap((series) => {
      if (!id(series.seriesId) || seenSeries.has(series.seriesId)
        || series.gamesPerSeries !== 3
        || !members.has(series.homeClubId)
        || !members.has(series.awayClubId)
        || series.homeClubId === series.awayClubId) {
        throw new Error('invalid or duplicate continental group series');
      }
      seenSeries.add(series.seriesId);
      const pair = pairKey(series.homeClubId, series.awayClubId);
      if (seenPairs.has(pair)) {
        throw new Error('continental group series must cover each pair once');
      }
      seenPairs.add(pair);
      homeCounts.set(series.homeClubId,
        homeCounts.get(series.homeClubId)! + 1);
      return ([1, 2, 3] as const).map((gameIndex) => Object.freeze({
        gameId: JSON.stringify(['continental-group-game',
          series.seriesId, gameIndex]),
        seriesId: series.seriesId, gameIndex,
        homeClubId: series.homeClubId,
        awayClubId: series.awayClubId,
      }));
    });
    if ([...homeCounts.values()].some((count) => count < 1 || count > 2)
      || !Array.isArray(group.homeSeriesCounts)
      || group.homeSeriesCounts.length !== 4
      || (group.homeSeriesCounts as ContinentalHomeAssignment['groups'][number]['homeSeriesCounts'])
        .some((entry) =>
        homeCounts.get(entry.clubId) !== entry.count)) {
      throw new Error('continental group home allocation is inconsistent');
    }
    return Object.freeze({ groupIndex,
      memberClubIds: Object.freeze([...memberClubIds]),
      games: Object.freeze(games) });
  });
  return Object.freeze({ competitionId: assignment.competitionId,
    editionId: assignment.editionId,
    drawPolicyVersion: assignment.drawPolicyVersion,
    homeFairnessPolicyVersion: assignment.homeFairnessPolicyVersion,
    groups: Object.freeze(groups) });
};

const snapshotGamePlan = (plan: ContinentalGroupGamePlan):
ContinentalGroupGamePlan => {
  if (!id(plan?.competitionId) || !id(plan.editionId)
    || !id(plan.drawPolicyVersion) || !id(plan.homeFairnessPolicyVersion)
    || !Array.isArray(plan.groups) || plan.groups.length !== 4) {
    throw new Error('invalid continental group game plan');
  }
  const plannedGroups: ContinentalGroupGamePlan['groups'] = plan.groups;
  const allClubs = new Set<string>();
  const allSeries = new Set<string>();
  const allGames = new Set<string>();
  const groups = plannedGroups.map((group, groupIndex) => {
    if (group?.groupIndex !== groupIndex
      || !Array.isArray(group.memberClubIds)
      || group.memberClubIds.length !== 4
      || group.memberClubIds.some((clubId) => !id(clubId)
        || allClubs.has(clubId))
      || new Set(group.memberClubIds).size !== 4
      || !Array.isArray(group.games) || group.games.length !== 18) {
      throw new Error('invalid continental group game plan');
    }
    const memberClubIds: readonly string[] = group.memberClubIds;
    memberClubIds.forEach((clubId) => allClubs.add(clubId));
    const memberSet = new Set(memberClubIds);
    const bySeries = new Map<string, ContinentalGroupGame[]>();
    const appearances = new Map(memberClubIds.map((clubId) => [clubId, 0]));
    const homeGames = new Map(memberClubIds.map((clubId) => [clubId, 0]));
    const games = (group.games as readonly ContinentalGroupGame[]).map((game) => {
      if (!id(game?.seriesId) || !id(game.gameId)
        || ![1, 2, 3].includes(game.gameIndex)
        || game.gameId !== JSON.stringify(['continental-group-game',
          game.seriesId, game.gameIndex])
        || allGames.has(game.gameId)
        || !memberSet.has(game.homeClubId)
        || !memberSet.has(game.awayClubId)
        || game.homeClubId === game.awayClubId) {
        throw new Error('invalid continental group game identity or membership');
      }
      allGames.add(game.gameId);
      appearances.set(game.homeClubId, appearances.get(game.homeClubId)! + 1);
      appearances.set(game.awayClubId, appearances.get(game.awayClubId)! + 1);
      homeGames.set(game.homeClubId, homeGames.get(game.homeClubId)! + 1);
      bySeries.set(game.seriesId,
        [...(bySeries.get(game.seriesId) ?? []), game]);
      return Object.freeze({ ...game });
    });
    const pairs = new Set<string>();
    if (bySeries.size !== 6
      || [...bySeries].some(([seriesId, entries]) => {
        if (allSeries.has(seriesId)) return true;
        allSeries.add(seriesId);
        const first = entries[0];
        const pair = pairKey(first.homeClubId, first.awayClubId);
        if (pairs.has(pair)) return true;
        pairs.add(pair);
        return entries.length !== 3
          || new Set(entries.map((entry) => entry.gameIndex)).size !== 3
          || entries.some((entry) => entry.homeClubId !== first.homeClubId
            || entry.awayClubId !== first.awayClubId);
      })
      || [...appearances.values()].some((count) => count !== 9)
      || [...homeGames.values()].some((count) => count !== 3 && count !== 6)) {
      throw new Error('continental group game plan must contain six legal series');
    }
    return Object.freeze({ groupIndex,
      memberClubIds: Object.freeze([...memberClubIds]),
      games: Object.freeze(games) });
  });
  return Object.freeze({ competitionId: plan.competitionId,
    editionId: plan.editionId, drawPolicyVersion: plan.drawPolicyVersion,
    homeFairnessPolicyVersion: plan.homeFairnessPolicyVersion,
    groups: Object.freeze(groups) });
};

/** Ranks only 72 matching official results; unresolved cutoff ties remain open. */
export const finalizeContinentalGroupResults = (
  plan: ContinentalGroupGamePlan,
  results: readonly OfficialGameResult[],
  policy: StandingsTiebreakPolicy,
): ContinentalGroupResultsSnapshot => {
  const snapshot = snapshotGamePlan(plan);
  const plannedGroups = snapshot.groups;
  const allGames = plannedGroups.flatMap((group) => group.games);
  if (allGames.length !== 72 || !Array.isArray(results)
    || results.length !== allGames.length) {
    throw new Error('continental groups require complete official results');
  }
  const expected = new Set(allGames.map((game) => game.gameId));
  if (expected.size !== 72 || results.some((result) =>
    !expected.has(result.gameId))
    || new Set(results.map((result) => result.gameId)).size !== 72
    || new Set(results.map((result) => result.applicationId)).size !== 72) {
    throw new Error('continental group results require unique planned games');
  }
  const byGame = new Map(results.map((result) => [result.gameId, result]));
  const groups = plannedGroups.map((group, groupIndex) => {
    if (group.groupIndex !== groupIndex
      || group.memberClubIds.length !== 4 || group.games.length !== 18) {
      throw new Error('invalid continental group game plan');
    }
    const standings = buildOfficialStandings({
      seasonId: snapshot.editionId, leagueId: snapshot.competitionId,
      memberClubIds: group.memberClubIds,
      regularSeasonGamesPerClub: 9,
      games: group.games, revisionEventIds: [],
    }, group.games.map((game) => byGame.get(game.gameId)!), policy);
    const topTwo = standings.rows.slice(0, 2).map((row) => row.clubId);
    const cutoffUnresolved = standings.unresolvedTieGroups.some((tie) =>
      tie.some((clubId) => topTwo.includes(clubId)));
    return Object.freeze({ groupIndex,
      standings,
      qualifierClubIds: cutoffUnresolved ? null : Object.freeze(topTwo) });
  });
  return Object.freeze({ competitionId: snapshot.competitionId,
    editionId: snapshot.editionId, gamePlan: snapshot,
    tiebreakPolicyVersion: policy.version,
    tiebreakPolicy: Object.freeze({ version: policy.version,
      tieCreditNumerator: policy.tieCreditNumerator,
      tieCreditDenominator: policy.tieCreditDenominator,
      runDifferentialCapPerGame: policy.runDifferentialCapPerGame }),
    groups: Object.freeze(groups) });
};
