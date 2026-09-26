import { finalizeAfricaFinalFour, type AfricaFinalFourPlan,
  type AfricaFinalFourSource } from './AfricaFinalFour';
import { finalizeContinentalFinalFour,
  type ContinentalFinalFourPlan, type ContinentalFinalFourSource }
  from './ContinentalFinalFour';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { CompetitionEditionSnapshot } from './CompetitionEdition';
import type { ClubWorldRegion } from './ClubWorldBerths';
import type { ClubWorldAchievementKind,
  OfficialRegionalClubSeason } from './ClubWorldQualificationSources';

export type OfficialRegionalClubSeasonSource =
  | Readonly<{ kind: 'STANDARD'; region: Exclude<ClubWorldRegion, 'AFRICA'>;
    seasonId: string; source: ContinentalFinalFourSource;
    plan: ContinentalFinalFourPlan;
    semifinalResults: readonly OfficialGameResult[];
    finalResult: OfficialGameResult }>
  | Readonly<{ kind: 'AFRICA'; region: 'AFRICA'; seasonId: string;
    source: AfricaFinalFourSource; plan: AfricaFinalFourPlan;
    semifinalResults: readonly OfficialGameResult[];
    finalResult: OfficialGameResult }>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Recomputes a finished continental title before emitting Club World evidence.
 * SeasonId-to-edition mapping remains owned by the competition history store.
 */
export const deriveOfficialRegionalClubSeason = (
  input: OfficialRegionalClubSeasonSource,
): OfficialRegionalClubSeason => {
  if (!id(input?.seasonId)) {
    throw new Error('official regional season ID is required');
  }
  let edition: CompetitionEditionSnapshot;
  let groupGames: readonly Readonly<{ seriesId: string; gameId: string }>[];
  let groupResults: readonly OfficialGameResult[];
  let quarterfinalResults: readonly OfficialGameResult[];
  let championClubId: string;
  if (input.kind === 'STANDARD') {
    const outcome = finalizeContinentalFinalFour(input.plan,
      input.semifinalResults, input.finalResult, input.source);
    edition = input.source.edition;
    groupGames = input.source.quarterfinalSource.groupPlan.groups
      .flatMap((group) => group.games);
    groupResults = input.source.quarterfinalSource.groupOfficialResults;
    quarterfinalResults = input.source.quarterfinalResults;
    championClubId = outcome.championClubId;
  } else {
    const outcome = finalizeAfricaFinalFour(input.plan,
      input.semifinalResults, input.finalResult, input.source);
    edition = input.source.groupSource.edition;
    groupGames = input.source.groupPlan.groups.flatMap((group) =>
      group.games);
    groupResults = input.source.groupOfficialResults;
    quarterfinalResults = [];
    championClubId = outcome.championClubId;
  }
  if ((input.kind === 'STANDARD'
    && edition.canonicalRole !== 'CONTINENTAL_CL')
    || (input.kind === 'AFRICA'
      && edition.canonicalRole !== 'AFBCL')) {
    throw new Error('official regional achievement role mismatch');
  }
  const allResults = [...groupResults, ...quarterfinalResults,
    ...input.semifinalResults, input.finalResult];
  const resultsByGame = new Map(allResults.map((result) =>
    [result.gameId, result]));
  if (!Array.isArray(edition.participantIds)
    || edition.participantIds.length !== (input.kind === 'STANDARD' ? 16 : 8)
    || new Set(edition.participantIds).size !== edition.participantIds.length
    || resultsByGame.size !== allResults.length
    || new Set(allResults.map((result) => result.applicationId)).size
      !== allResults.length) {
    throw new Error('official regional results or participants are incomplete');
  }
  const applications = new Map(edition.participantIds.map((clubId) =>
    [clubId, new Set<string>()]));
  const achievements = new Map(edition.participantIds.map((clubId) =>
    [clubId, [] as { kind: ClubWorldAchievementKind;
      applicationId: string }[]]));
  const addAchievement = (clubId: string, kind: ClubWorldAchievementKind,
    applicationId: string): void => {
    const entry = achievements.get(clubId);
    if (!entry) throw new Error('official achievement club is not an entrant');
    entry.push({ kind, applicationId });
  };
  for (const result of allResults) {
    if (!id(result.applicationId)
      || !applications.has(result.homeClubId)
      || !applications.has(result.awayClubId)) {
      throw new Error('official regional result has foreign club or application');
    }
    applications.get(result.homeClubId)!.add(result.applicationId);
    applications.get(result.awayClubId)!.add(result.applicationId);
  }
  for (const result of groupResults) {
    if (result.winnerClubId !== null) {
      addAchievement(result.winnerClubId, 'GROUP_WIN',
        result.applicationId);
    }
  }
  const series = new Map<string, string[]>();
  for (const game of groupGames) {
    series.set(game.seriesId, [...(series.get(game.seriesId) ?? []),
      game.gameId]);
  }
  for (const gameIds of series.values()) {
    if (gameIds.length !== 3) {
      throw new Error('official regional group series must have three games');
    }
    const results = gameIds.map((gameId) => resultsByGame.get(gameId)!);
    const wins = new Map<string, OfficialGameResult[]>();
    for (const result of results) {
      if (result.winnerClubId !== null) {
        wins.set(result.winnerClubId,
          [...(wins.get(result.winnerClubId) ?? []), result]);
      }
    }
    for (const [clubId, victories] of wins) {
      if (victories.length >= 2) {
        addAchievement(clubId, 'SERIES_WIN',
          victories[1].applicationId);
      }
    }
  }
  for (const result of quarterfinalResults) {
    addAchievement(result.winnerClubId!, 'KNOCKOUT_ADVANCE',
      result.applicationId);
  }
  for (const result of input.semifinalResults) {
    addAchievement(result.winnerClubId!, 'SEMIFINAL_ADVANCE',
      result.applicationId);
  }
  addAchievement(input.finalResult.homeClubId, 'FINAL_APPEARANCE',
    input.finalResult.applicationId);
  addAchievement(input.finalResult.awayClubId, 'FINAL_APPEARANCE',
    input.finalResult.applicationId);
  addAchievement(championClubId, 'TITLE',
    input.finalResult.applicationId);
  return Object.freeze({ region: input.region,
    seasonId: input.seasonId, editionId: edition.editionId,
    officialSnapshotId: JSON.stringify(['official-regional-club-season',
      edition.editionId, ...allResults.map((result) =>
        result.applicationId).sort()]),
    completedAtDay: edition.calendarWindow.endsOnDay,
    clubs: Object.freeze(edition.participantIds.map((clubId) =>
      Object.freeze({ clubId,
        resultApplicationIds: Object.freeze([
          ...applications.get(clubId)!].sort()),
        achievements: Object.freeze(achievements.get(clubId)!.map(
          (event) => Object.freeze(event))) }))) });
};
