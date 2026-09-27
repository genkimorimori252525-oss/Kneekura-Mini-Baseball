import { resolveConferencePostseason,
  type ConferencePostseasonPolicy,
  type ConferencePostseasonState,
  type ConferenceSeriesEntry } from
  '../../core/world/competition/ConferencePostseason';
import { finalizeDomesticCompetitionSeason,
  type DomesticCompetitionSeasonInput,
  type DomesticCompetitionSeasonSnapshot } from
  '../../core/world/competition/DomesticCompetitionSeason';
import { LEAGUE_PROFILES_V1 } from
  '../../core/world/competition/LeagueProfiles';
import { projectOfficialGroupStandings,
  type LeagueGroupAlignment } from
  '../../core/world/competition/OfficialStandings';
import type { PostseasonSeriesPlan } from
  '../../core/world/competition/PostseasonSeries';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { readDurablePostseasonResults } from
  './PostseasonResultsFromMatches';

type CompletionStores = Parameters<typeof readCompletedDomesticSeason>[0];
export type ConferenceDomesticCompetitionRequest = Readonly<{
  careerId: string;
  seasonId: string;
  alignment: LeagueGroupAlignment;
  policy: ConferencePostseasonPolicy;
  groupPlans: readonly Readonly<{
    groupId: string;
    series: readonly Pick<ConferenceSeriesEntry, 'stage' | 'plan'>[];
  }>[];
  championshipPlan: PostseasonSeriesPlan | null;
}> & Pick<DomesticCompetitionSeasonInput,
  'competitionEditionId' | 'berthCount' | 'alreadyQualifiedClubIds'
  | 'eligibilityByClubId'>;
export type ConferenceDomesticCompetitionProjection = Readonly<{
  postseason: ConferencePostseasonState;
  snapshot: DomesticCompetitionSeasonSnapshot | null;
}>;

/** Group standings and every played series are read from official World/Match owners. */
export const projectConferenceDomesticCompetitionFromWorld = (
  stores: CompletionStores,
  input: ConferenceDomesticCompetitionRequest,
): ConferenceDomesticCompetitionProjection | null => {
  const completed = readCompletedDomesticSeason(stores,
    input.careerId, input.seasonId);
  if (!completed) return null;
  const { archive, world } = completed;
  const profile = LEAGUE_PROFILES_V1.find((item) =>
    item.leagueId === world.schedule.leagueId);
  if (!profile || profile.championshipFormat !== 'CONFERENCE_SERIES'
    || !['league-001', 'league-009', 'league-013'].includes(profile.leagueId)) {
    throw new Error('league requires its separate championship path');
  }
  if (archive.baseSchedule.calendarProfileVersion
      !== profile.calendarProfileVersion
    || archive.baseSchedule.regularSeasonGamesPerClub
      !== profile.regularSeasonGamesPerClub
    || world.schedule.memberClubIds.length !== profile.clubCount
    || input.groupPlans.length !== 2
    || new Set(input.groupPlans.map((group) => group.groupId)).size !== 2
    || input.groupPlans.some((group) =>
      !input.alignment.groups.some((item) => item.groupId === group.groupId))) {
    throw new Error('conference season profile or group plans mismatch');
  }
  const groups = input.groupPlans.map((group) => ({
    groupId: group.groupId,
    standings: projectOfficialGroupStandings(world.schedule,
      world.results, world.standingsPolicy,
      input.alignment, group.groupId),
    series: group.series.map((entry) => ({
      stage: entry.stage, plan: entry.plan,
      results: readDurablePostseasonResults(stores.match,
        entry.plan),
    })),
  }));
  const championship = input.championshipPlan === null ? null
    : { plan: input.championshipPlan,
      results: readDurablePostseasonResults(stores.match,
        input.championshipPlan) };
  const postseason = resolveConferencePostseason(input.policy,
    input.alignment, groups, championship);
  const snapshot = postseason.status === 'COMPLETE'
    ? finalizeDomesticCompetitionSeason({
      profile, standings: world.standings.snapshot,
      outcome: { kind: 'group-conference', state: postseason },
      qualificationPolicyVersion: input.policy.qualificationPolicyVersion,
      competitionEditionId: input.competitionEditionId,
      berthCount: input.berthCount,
      alreadyQualifiedClubIds: input.alreadyQualifiedClubIds,
      eligibilityByClubId: input.eligibilityByClubId,
    }) : null;
  return Object.freeze({ postseason, snapshot });
};
