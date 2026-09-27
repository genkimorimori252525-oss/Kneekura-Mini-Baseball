import { finalizeDomesticCompetitionSeason,
  type DomesticCompetitionSeasonInput,
  type DomesticCompetitionSeasonSnapshot } from
  '../../core/world/competition/DomesticCompetitionSeason';
import { LEAGUE_PROFILES_V1 } from
  '../../core/world/competition/LeagueProfiles';
import { resolveNorthAmericaPostseason,
  type NorthAmericaPostseasonPolicy,
  type NorthAmericaPostseasonState,
  type NorthAmericaSeriesEntry } from
  '../../core/world/competition/NorthAmericaPostseason';
import { projectOfficialGroupStandings,
  type LeagueGroupAlignment } from
  '../../core/world/competition/OfficialStandings';
import type { PostseasonSeriesPlan } from
  '../../core/world/competition/PostseasonSeries';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { readDurablePostseasonResults } from
  './PostseasonResultsFromMatches';

type CompletionStores = Parameters<typeof readCompletedDomesticSeason>[0];
export type NorthAmericaDomesticCompetitionRequest = Readonly<{
  careerId: string;
  seasonId: string;
  conferenceAlignment: LeagueGroupAlignment;
  divisionAlignment: LeagueGroupAlignment;
  policy: NorthAmericaPostseasonPolicy;
  conferencePlans: readonly Readonly<{
    conferenceId: string;
    series: readonly Pick<NorthAmericaSeriesEntry,
      'stage' | 'plan'>[];
  }>[];
  championshipPlan: PostseasonSeriesPlan | null;
  qualificationPolicyVersion: string;
}> & Pick<DomesticCompetitionSeasonInput,
  'competitionEditionId' | 'berthCount' | 'alreadyQualifiedClubIds'
  | 'eligibilityByClubId'>;
export type NorthAmericaDomesticCompetitionProjection = Readonly<{
  postseason: NorthAmericaPostseasonState;
  snapshot: DomesticCompetitionSeasonSnapshot | null;
}>;

/** Build conference/division tables from World, then advance verified Match series. */
export const projectNorthAmericaDomesticCompetitionFromWorld = (
  stores: CompletionStores,
  input: NorthAmericaDomesticCompetitionRequest,
): NorthAmericaDomesticCompetitionProjection | null => {
  const completed = readCompletedDomesticSeason(stores,
    input.careerId, input.seasonId);
  if (!completed) return null;
  const { archive, world } = completed;
  const profile = LEAGUE_PROFILES_V1.find((item) =>
    item.leagueId === world.schedule.leagueId);
  if (!profile || profile.leagueId !== 'league-008'
    || profile.championshipFormat !== 'CONFERENCE_SERIES') {
    throw new Error('league requires its separate championship path');
  }
  if (archive.baseSchedule.calendarProfileVersion
      !== profile.calendarProfileVersion
    || archive.baseSchedule.regularSeasonGamesPerClub
      !== profile.regularSeasonGamesPerClub
    || world.schedule.memberClubIds.length !== profile.clubCount
    || input.conferencePlans.length !== 2
    || new Set(input.conferencePlans.map((item) =>
      item.conferenceId)).size !== 2
    || input.conferencePlans.some((item) =>
      !input.conferenceAlignment.groups.some((group) =>
        group.groupId === item.conferenceId))) {
    throw new Error('North America profile or conference plans mismatch');
  }
  const conferences = input.conferencePlans.map((entry) => {
    const aligned = input.conferenceAlignment.groups.find((item) =>
      item.groupId === entry.conferenceId)!;
    const divisions = input.divisionAlignment.groups.filter((division) =>
      division.clubIds.every((clubId) =>
        aligned.clubIds.includes(clubId)));
    return {
      conferenceId: entry.conferenceId,
      standings: projectOfficialGroupStandings(world.schedule,
        world.results, world.standingsPolicy,
        input.conferenceAlignment, entry.conferenceId),
      divisions: divisions.map((division) => ({
        divisionId: division.groupId,
        standings: projectOfficialGroupStandings(world.schedule,
          world.results, world.standingsPolicy,
          input.divisionAlignment, division.groupId),
      })),
      series: entry.series.map((series) => ({
        stage: series.stage, plan: series.plan,
        results: readDurablePostseasonResults(stores.match,
          series.plan),
      })),
    };
  });
  const championship = input.championshipPlan === null ? null
    : { plan: input.championshipPlan,
      results: readDurablePostseasonResults(stores.match,
        input.championshipPlan) };
  const postseason = resolveNorthAmericaPostseason(input.policy,
    input.conferenceAlignment, input.divisionAlignment,
    conferences, championship);
  const snapshot = postseason.status === 'COMPLETE'
    ? finalizeDomesticCompetitionSeason({
      profile, standings: world.standings.snapshot,
      outcome: { kind: 'north-america', state: postseason },
      qualificationPolicyVersion: input.qualificationPolicyVersion,
      competitionEditionId: input.competitionEditionId,
      berthCount: input.berthCount,
      alreadyQualifiedClubIds: input.alreadyQualifiedClubIds,
      eligibilityByClubId: input.eligibilityByClubId,
    }) : null;
  return Object.freeze({ postseason, snapshot });
};
