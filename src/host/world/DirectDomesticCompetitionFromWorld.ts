import { finalizeDomesticCompetitionSeason,
  type DomesticCompetitionSeasonInput,
  type DomesticCompetitionSeasonSnapshot } from
  '../../core/world/competition/DomesticCompetitionSeason';
import { resolveDomesticPostseason,
  type DomesticPostseasonEntry,
  type DomesticPostseasonState } from
  '../../core/world/competition/DomesticPostseason';
import { LEAGUE_PROFILES_V1 } from
  '../../core/world/competition/LeagueProfiles';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { readDurablePostseasonResults } from
  './PostseasonResultsFromMatches';

type CompletionStores = Parameters<typeof readCompletedDomesticSeason>[0];
export type DirectDomesticCompetitionRequest = Readonly<{
  careerId: string;
  seasonId: string;
  postseasonPlans: readonly Pick<DomesticPostseasonEntry,
    'stage' | 'plan'>[];
}> & Pick<DomesticCompetitionSeasonInput,
  'qualificationPolicyVersion' | 'competitionEditionId' | 'berthCount'
  | 'alreadyQualifiedClubIds' | 'eligibilityByClubId'>;
export type DirectDomesticCompetitionProjection = Readonly<{
  postseason: DomesticPostseasonState;
  snapshot: DomesticCompetitionSeasonSnapshot | null;
}>;

/** Derive the played prefix from Match; callers cannot supply claimed results. */
export const readDurablePostseasonEntries = (
  matchStore: CompletionStores['match'],
  plans: DirectDomesticCompetitionRequest['postseasonPlans'],
): readonly DomesticPostseasonEntry[] => Object.freeze(plans.map((entry) =>
  Object.freeze({ stage: entry.stage, plan: entry.plan,
    results: readDurablePostseasonResults(matchStore, entry.plan) })));

/** Advance only from completed regular-season Match finals and accepted series finals. */
export const projectDirectDomesticCompetitionFromWorld = (
  stores: CompletionStores,
  input: DirectDomesticCompetitionRequest,
): DirectDomesticCompetitionProjection | null => {
  const completed = readCompletedDomesticSeason(stores,
    input.careerId, input.seasonId);
  if (!completed) return null;
  const { archive, world } = completed;
  const profile = LEAGUE_PROFILES_V1.find((item) =>
    item.leagueId === world.schedule.leagueId);
  if (!profile || profile.championshipFormat === 'CONFERENCE_SERIES'
    || profile.championshipFormat === 'WINTER_ROUND_ROBIN') {
    throw new Error('league requires its separate championship path');
  }
  if (archive.baseSchedule.calendarProfileVersion
      !== profile.calendarProfileVersion
    || archive.baseSchedule.regularSeasonGamesPerClub
      !== profile.regularSeasonGamesPerClub
    || world.schedule.memberClubIds.length !== profile.clubCount) {
    throw new Error('completed season does not match frozen league profile');
  }
  const entries = readDurablePostseasonEntries(stores.match,
    input.postseasonPlans);
  const postseason = resolveDomesticPostseason(
    profile.championshipFormat, world.standings.snapshot,
    entries);
  const snapshot = postseason.status === 'COMPLETE'
    ? finalizeDomesticCompetitionSeason({
      profile, standings: world.standings.snapshot,
      outcome: { kind: 'direct', state: postseason },
      qualificationPolicyVersion: input.qualificationPolicyVersion,
      competitionEditionId: input.competitionEditionId,
      berthCount: input.berthCount,
      alreadyQualifiedClubIds: input.alreadyQualifiedClubIds,
      eligibilityByClubId: input.eligibilityByClubId,
    }) : null;
  return Object.freeze({ postseason, snapshot });
};
