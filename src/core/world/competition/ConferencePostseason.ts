import type { OfficialGameResult } from './OfficialGameCompletion';
import { captureOfficialStandingsBasis, matchesOfficialStandingsBasis,
  snapshotLeagueGroupAlignment,
  type LeagueGroupAlignment, type OfficialGroupStandingsSnapshot,
  type OfficialStandingsBasis } from './OfficialStandings';
import { resolvePostseasonSeries, type PostseasonSeriesPlan,
  type PostseasonSeriesState } from './PostseasonSeries';

export type ConferencePostseasonPolicy = Readonly<{
  version: string;
  format: 'JAPAN' | 'MEXICO' | 'CUBA';
  championshipHigherSeedGroupId: string;
  qualificationPolicyVersion: string;
  /** Frozen League A/B, North/South, or West/East berth priority. */
  qualificationPriorityGroupIds: readonly string[];
}>;
export type ConferenceStage = 'preliminary' | 'semifinal-1' | 'semifinal-2' | 'group-final';
export type ConferenceSeriesEntry = Readonly<{
  stage: ConferenceStage;
  plan: PostseasonSeriesPlan;
  results: readonly OfficialGameResult[];
}>;
export type ConferenceGroupInput = Readonly<{
  groupId: string;
  standings: OfficialGroupStandingsSnapshot;
  series: readonly ConferenceSeriesEntry[];
}>;
export type ConferencePostseasonState = Readonly<{
  seasonId: string;
  regularSeasonBasis: OfficialStandingsBasis;
  alignmentSnapshot: LeagueGroupAlignment;
  alignmentVersion: string;
  qualificationPolicyVersion: string;
  qualificationPriorityGroupIds: readonly string[];
  policyVersion: string;
  status: 'PENDING' | 'COMPLETE';
  groupChampions: readonly Readonly<{ groupId: string; clubId: string | null }>[];
  groupPennantWinners: readonly Readonly<{ groupId: string; clubId: string }>[];
  series: readonly Readonly<{ groupId: string; stage: ConferenceStage;
    state: PostseasonSeriesState }>[];
  nextGroupSeries: readonly Readonly<{ groupId: string; stage: ConferenceStage;
    higherSeedClubId: string; lowerSeedClubId: string; bestOf: number }>[];
  nextChampionship: Readonly<{ higherSeedClubId: string; lowerSeedClubId: string;
    bestOf: 7 }> | null;
  championship: PostseasonSeriesState | null;
  championClubId: string | null;
  runnerUpClubId: string | null;
}>;

/** Japan, Mexico and Cuba retain their distinct confirmed group paths. */
export const resolveConferencePostseason = (
  policy: ConferencePostseasonPolicy,
  alignment: LeagueGroupAlignment,
  groups: readonly ConferenceGroupInput[],
  championship: Readonly<{ plan: PostseasonSeriesPlan;
    results: readonly OfficialGameResult[] }> | null,
): ConferencePostseasonState => {
  if (!policy.version || !['JAPAN', 'MEXICO', 'CUBA'].includes(policy.format)
    || groups.length !== 2
    || groups.some((group) => !group.groupId)
    || groups[0].groupId === groups[1].groupId
    || !groups.some((group) => group.groupId === policy.championshipHigherSeedGroupId)) {
    throw new Error('invalid versioned conference postseason policy or groups');
  }
  const expectedLeagueId = policy.format === 'JAPAN' ? 'league-001'
    : policy.format === 'MEXICO' ? 'league-009' : 'league-013';
  if (!alignment.version || !alignment.seasonId
    || alignment.leagueId !== expectedLeagueId) {
    throw new Error('conference alignment league or version mismatch');
  }
  const expectedClubs = policy.format === 'JAPAN' ? 6 : policy.format === 'MEXICO' ? 10 : 8;
  const seasonId = alignment.seasonId;
  const regularSeasonBasis = captureOfficialStandingsBasis(groups[0].standings, false);
  const allClubs = new Set<string>();
  if (alignment.groups.length !== 2
    || new Set(alignment.groups.map((group) => group.groupId)).size !== 2) {
    throw new Error('conference alignment must define two unique groups');
  }
  if (!policy.qualificationPolicyVersion
    || policy.qualificationPriorityGroupIds.length !== 2
    || new Set(policy.qualificationPriorityGroupIds).size !== 2
    || policy.qualificationPriorityGroupIds.some((groupId) =>
      !alignment.groups.some((group) => group.groupId === groupId))) {
    throw new Error('conference qualification policy must prioritize both aligned groups');
  }
  for (const group of groups) {
    if (!matchesOfficialStandingsBasis(group.standings, regularSeasonBasis)) {
      throw new Error('conference group standings have different official season basis');
    }
    const ranking = group.standings.orderedClubIds;
    const aligned = alignment.groups.find((item) => item.groupId === group.groupId);
    if (!aligned || group.standings.groupId !== group.groupId
      || group.standings.alignmentVersion !== alignment.version
      || group.standings.leagueId !== alignment.leagueId
      || group.standings.memberClubIds.length !== aligned.clubIds.length
      || group.standings.memberClubIds.some((id) => !aligned.clubIds.includes(id))) {
      throw new Error('conference standings do not match frozen group alignment');
    }
    if (!seasonId || group.standings.seasonId !== seasonId
      || ranking === null || group.standings.unresolvedTieGroups.length > 0
      || ranking.length !== expectedClubs || group.standings.rows.length !== expectedClubs) {
      throw new Error('conference group club count or resolved standings are invalid');
    }
    const rowClubs = new Set(group.standings.rows.map((row) => row.clubId));
    if (rowClubs.size !== expectedClubs || new Set(ranking).size !== expectedClubs
      || ranking.some((clubId) => !aligned.clubIds.includes(clubId))
      || ranking.some((clubId) =>
      !clubId || !rowClubs.has(clubId) || allClubs.has(clubId))) {
      throw new Error('conference group memberships must be unique and complete');
    }
    ranking.forEach((clubId) => allClubs.add(clubId));
  }
  const usedSeriesIds = new Set<string>();
  const usedGameIds = new Set<string>();
  const usedApplicationIds = new Set(groups.flatMap((group) => [
    ...group.standings.resultApplicationIds,
    ...group.standings.tiebreakResolutions.map((item) => item.applicationId),
  ]));
  const validateUnique = (entry: { plan: PostseasonSeriesPlan;
    results: readonly OfficialGameResult[] }): void => {
    if (entry.plan.seasonId !== seasonId || usedSeriesIds.has(entry.plan.seriesId)) {
      throw new Error('conference series season or identity mismatch');
    }
    usedSeriesIds.add(entry.plan.seriesId);
    for (const game of entry.plan.scheduledGames) {
      if (usedGameIds.has(game.gameId)) throw new Error('conference game is scheduled twice');
      usedGameIds.add(game.gameId);
    }
    for (const result of entry.results) {
      if (usedApplicationIds.has(result.applicationId)) {
        throw new Error('official application is reused across conference series');
      }
      usedApplicationIds.add(result.applicationId);
    }
  };
  const series: { groupId: string; stage: ConferenceStage; state: PostseasonSeriesState }[] = [];
  const nextGroupSeries: { groupId: string; stage: ConferenceStage;
    higherSeedClubId: string; lowerSeedClubId: string; bestOf: number }[] = [];
  const groupChampions: { groupId: string; clubId: string | null }[] = [];
  const groupPennantWinners: { groupId: string; clubId: string }[] = [];
  for (const group of groups) {
    const ranking = group.standings.orderedClubIds!;
    const entries = new Map<ConferenceStage, ConferenceSeriesEntry>();
    for (const entry of group.series) {
      if (entries.has(entry.stage)) throw new Error('duplicate conference stage');
      entries.set(entry.stage, entry);
    }
    const allowed = new Set<ConferenceStage>();
    const resolve = (stage: ConferenceStage, high: string | null,
      low: string | null, bestOf: number): PostseasonSeriesState | null => {
      allowed.add(stage);
      const entry = entries.get(stage);
      if (high === null || low === null) {
        if (entry) throw new Error('conference series cannot start before upstream winner');
        return null;
      }
      if (!entry) {
        nextGroupSeries.push(Object.freeze({ groupId: group.groupId,
          stage, higherSeedClubId: high, lowerSeedClubId: low, bestOf }));
        return null;
      }
      if (entry.plan.bestOf !== bestOf || entry.plan.higherSeedClubId !== high
        || entry.plan.lowerSeedClubId !== low) {
        throw new Error('conference series format or seeding mismatch');
      }
      validateUnique(entry);
      const state = resolvePostseasonSeries(entry.plan, entry.results);
      series.push(Object.freeze({ groupId: group.groupId, stage, state }));
      return state;
    };
    let groupFinal: PostseasonSeriesState | null;
    if (policy.format === 'JAPAN') {
      const preliminary = resolve('preliminary', ranking[1], ranking[2], 3);
      groupFinal = resolve('group-final', ranking[0],
        preliminary?.winnerClubId ?? null, 5);
    } else {
      const first = resolve('semifinal-1', ranking[0], ranking[3], 5);
      const second = resolve('semifinal-2', ranking[1], ranking[2], 5);
      const firstWinner = first?.winnerClubId;
      const secondWinner = second?.winnerClubId;
      const high = firstWinner && secondWinner
        ? ranking.indexOf(firstWinner) < ranking.indexOf(secondWinner)
          ? firstWinner : secondWinner : null;
      const low = firstWinner && secondWinner
        ? high === firstWinner ? secondWinner : firstWinner : null;
      groupFinal = resolve('group-final', high, low,
        policy.format === 'MEXICO' ? 7 : 5);
    }
    if ([...entries.keys()].some((stage) => !allowed.has(stage))) {
      throw new Error('conference stage does not belong to the selected format');
    }
    groupPennantWinners.push(Object.freeze({ groupId: group.groupId, clubId: ranking[0] }));
    groupChampions.push(Object.freeze({ groupId: group.groupId,
      clubId: groupFinal?.winnerClubId ?? null }));
  }
  const highGroup = groupChampions.find((group) =>
    group.groupId === policy.championshipHigherSeedGroupId)!;
  const lowGroup = groupChampions.find((group) =>
    group.groupId !== policy.championshipHigherSeedGroupId)!;
  let nextChampionship: ConferencePostseasonState['nextChampionship'] = null;
  let championshipState: PostseasonSeriesState | null = null;
  if (highGroup.clubId && lowGroup.clubId) {
    if (championship === null) {
      nextChampionship = Object.freeze({ higherSeedClubId: highGroup.clubId,
        lowerSeedClubId: lowGroup.clubId, bestOf: 7 });
    } else {
      if (championship.plan.bestOf !== 7
        || championship.plan.higherSeedClubId !== highGroup.clubId
        || championship.plan.lowerSeedClubId !== lowGroup.clubId) {
        throw new Error('conference championship format or hosting priority mismatch');
      }
      validateUnique(championship);
      championshipState = resolvePostseasonSeries(championship.plan, championship.results);
    }
  } else if (championship !== null) {
    throw new Error('conference championship cannot start before upstream winners');
  }
  return Object.freeze({ seasonId, regularSeasonBasis,
    alignmentSnapshot: snapshotLeagueGroupAlignment(alignment),
    alignmentVersion: alignment.version,
    qualificationPolicyVersion: policy.qualificationPolicyVersion,
    qualificationPriorityGroupIds: Object.freeze([...policy.qualificationPriorityGroupIds]),
    policyVersion: policy.version,
    status: championshipState?.status === 'COMPLETE' ? 'COMPLETE' : 'PENDING',
    groupChampions: Object.freeze(groupChampions),
    groupPennantWinners: Object.freeze(groupPennantWinners),
    series: Object.freeze(series), nextGroupSeries: Object.freeze(nextGroupSeries),
    nextChampionship, championship: championshipState,
    championClubId: championshipState?.winnerClubId ?? null,
    runnerUpClubId: championshipState?.runnerUpClubId ?? null });
};
