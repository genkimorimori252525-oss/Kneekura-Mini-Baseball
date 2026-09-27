import { finalizeDomesticCompetitionSeason,
  type DomesticCompetitionSeasonInput,
  type DomesticCompetitionSeasonSnapshot } from
  '../../core/world/competition/DomesticCompetitionSeason';
import { LEAGUE_PROFILES_V1 } from
  '../../core/world/competition/LeagueProfiles';
import type { OfficialTiebreakGamePlan,
  StandingsTiebreakPolicy } from
  '../../core/world/competition/OfficialStandings';
import type { PostseasonSeriesPlan } from
  '../../core/world/competition/PostseasonSeries';
import { resolveWinterChampionship,
  type WinterChampionshipState,
  type WinterRoundGame } from
  '../../core/world/competition/WinterChampionship';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { readDurableOfficialGameResult,
  readDurablePostseasonResults } from
  './PostseasonResultsFromMatches';

type CompletionStores = Parameters<typeof readCompletedDomesticSeason>[0];
export type WinterDomesticCompetitionRequest = Readonly<{
  careerId: string;
  seasonId: string;
  version: string;
  roundGames: readonly WinterRoundGame[];
  roundTiebreakPolicy: StandingsTiebreakPolicy;
  tiebreakPlans: readonly OfficialTiebreakGamePlan[];
  finalPlan: PostseasonSeriesPlan | null;
  qualificationPolicyVersion: string;
}> & Pick<DomesticCompetitionSeasonInput,
  'competitionEditionId' | 'berthCount' | 'alreadyQualifiedClubIds'
  | 'eligibilityByClubId'>;
export type WinterDomesticCompetitionProjection = Readonly<{
  postseason: WinterChampionshipState;
  snapshot: DomesticCompetitionSeasonSnapshot | null;
}>;

/** The round advances only after its twelve Match finals are durable. */
export const projectWinterDomesticCompetitionFromWorld = (
  stores: CompletionStores,
  input: WinterDomesticCompetitionRequest,
): WinterDomesticCompetitionProjection | null => {
  const completed = readCompletedDomesticSeason(stores,
    input.careerId, input.seasonId);
  if (!completed) return null;
  const { archive, world } = completed;
  const profile = LEAGUE_PROFILES_V1.find((item) =>
    item.leagueId === world.schedule.leagueId);
  if (!profile || profile.leagueId !== 'league-010'
    || profile.championshipFormat !== 'WINTER_ROUND_ROBIN') {
    throw new Error('league requires its separate championship path');
  }
  if (archive.baseSchedule.calendarProfileVersion
      !== profile.calendarProfileVersion
    || archive.baseSchedule.regularSeasonGamesPerClub
      !== profile.regularSeasonGamesPerClub
    || world.schedule.memberClubIds.length !== profile.clubCount) {
    throw new Error('winter season does not match frozen league profile');
  }
  const roundResults = input.roundGames.map((game) =>
    readDurableOfficialGameResult(stores.match, game.gameId));
  if (roundResults.some((result) => result === null)) return null;
  const tiebreakGames = input.tiebreakPlans.map((plan) => ({
    plan, result: readDurableOfficialGameResult(stores.match,
      plan.gameId),
  }));
  if (tiebreakGames.some((entry) => entry.result === null)) return null;
  const final = input.finalPlan === null ? null
    : { plan: input.finalPlan,
      results: readDurablePostseasonResults(stores.match,
        input.finalPlan) };
  const postseason = resolveWinterChampionship({
    version: input.version,
    regularSeasonStandings: world.standings.snapshot,
    games: input.roundGames,
    results: roundResults.filter((result) => result !== null),
    tiebreakPolicy: input.roundTiebreakPolicy,
    tiebreakGames: tiebreakGames.map((entry) => ({
      plan: entry.plan, result: entry.result!,
    })),
  }, final);
  const snapshot = postseason.status === 'COMPLETE'
    ? finalizeDomesticCompetitionSeason({
      profile, standings: world.standings.snapshot,
      outcome: { kind: 'winter', state: postseason },
      qualificationPolicyVersion: input.qualificationPolicyVersion,
      competitionEditionId: input.competitionEditionId,
      berthCount: input.berthCount,
      alreadyQualifiedClubIds: input.alreadyQualifiedClubIds,
      eligibilityByClubId: input.eligibilityByClubId,
    }) : null;
  return Object.freeze({ postseason, snapshot });
};
