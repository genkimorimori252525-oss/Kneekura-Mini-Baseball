import { isDeepStrictEqual } from 'node:util';
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

type CompletionStores = Parameters<typeof readCompletedDomesticSeason>[0];
export type DirectDomesticCompetitionRequest = Readonly<{
  careerId: string;
  seasonId: string;
  postseasonEntries: readonly DomesticPostseasonEntry[];
}> & Pick<DomesticCompetitionSeasonInput,
  'qualificationPolicyVersion' | 'competitionEditionId' | 'berthCount'
  | 'alreadyQualifiedClubIds' | 'eligibilityByClubId'>;
export type DirectDomesticCompetitionProjection = Readonly<{
  postseason: DomesticPostseasonState;
  snapshot: DomesticCompetitionSeasonSnapshot | null;
}>;

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
  for (const entry of input.postseasonEntries) {
    for (const result of entry.results) {
      const match = stores.match.getMatch(result.gameId);
      const fixture = stores.match.getOfficialFixture(result.gameId);
      if (!match?.finalResult || !fixture || !result.venueBinding
        || !isDeepStrictEqual(match.finalResult, result)
        || !isDeepStrictEqual(fixture, result.venueBinding)) {
        throw new Error('postseason result lacks durable Match final');
      }
    }
  }
  const postseason = resolveDomesticPostseason(
    profile.championshipFormat, world.standings.snapshot,
    input.postseasonEntries);
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
