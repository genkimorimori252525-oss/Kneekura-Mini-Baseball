import type { LeagueProfileV1 } from './LeagueProfiles';
import type { QualificationCandidate, QualificationSourceType } from './ContinentalQualification';

export type DomesticQualificationFacts = Readonly<{
  profile: LeagueProfileV1;
  regularSeasonStandings: readonly string[];
  domesticChampionId: string;
  championshipRunnerUpId?: string;
  conferenceWinnerIds?: readonly string[];
  championshipRoundOrder?: readonly string[];
}>;

/** Preserves duplicate routes for later eligibility/cascade provenance. */
export const deriveDomesticQualificationOrder = (
  facts: DomesticQualificationFacts,
): readonly QualificationCandidate[] => {
  const {
    profile, regularSeasonStandings: standings,
    domesticChampionId: champion, championshipRunnerUpId: runnerUp,
  } = facts;
  const members = new Set(standings);
  if (
    standings.length !== profile.clubCount || members.size !== standings.length
    || standings.some((id) => typeof id !== 'string' || id.length === 0)
    || !members.has(champion)
    || (runnerUp !== undefined && (!members.has(runnerUp) || runnerUp === champion))
  ) throw new Error('domestic qualification facts conflict with league membership');
  const result: QualificationCandidate[] = [];
  const add = (clubId: string, sourceType: QualificationSourceType): void => {
    result.push(Object.freeze({ clubId, sourceType }));
  };
  const addStandings = (): void => standings.forEach((clubId) =>
    add(clubId, 'LEAGUE_COEFFICIENT_BERTH'));
  if (profile.championshipFormat === 'TABLE_TITLE') {
    if (champion !== standings[0] || runnerUp !== undefined) {
      throw new Error('table title champion must equal regular-season winner');
    }
    add(champion, 'DOMESTIC_CHAMPION');
    standings.slice(1).forEach((clubId) => add(clubId, 'LEAGUE_COEFFICIENT_BERTH'));
  } else if (profile.championshipFormat === 'CONFERENCE_SERIES') {
    if (!runnerUp) throw new Error('conference championship runner-up is required');
    add(champion, 'DOMESTIC_CHAMPION');
    const needsWinners = ['league-001', 'league-009', 'league-013'].includes(profile.leagueId);
    const winners = facts.conferenceWinnerIds ?? [];
    if (needsWinners && (winners.length !== 2
      || new Set(winners).size !== 2
      || winners.some((id) => !members.has(id)))) {
      throw new Error('conference winners are required for this league');
    }
    if (profile.leagueId === 'league-001') {
      winners.forEach((clubId) => add(clubId, 'OTHER_PROFILE_DEFINED'));
      add(runnerUp, 'RUNNER_UP');
    } else {
      add(runnerUp, 'RUNNER_UP');
      winners.forEach((clubId) => add(clubId, 'OTHER_PROFILE_DEFINED'));
    }
    addStandings();
  } else if (profile.championshipFormat === 'WINTER_ROUND_ROBIN') {
    const round = facts.championshipRoundOrder;
    if (!runnerUp || !round || round.length !== 4
      || new Set(round).size !== 4 || round.some((id) => !members.has(id))) {
      throw new Error('winter championship round order is required');
    }
    add(champion, 'DOMESTIC_CHAMPION');
    add(runnerUp, 'RUNNER_UP');
    add(round[2], 'OTHER_PROFILE_DEFINED');
    add(round[3], 'OTHER_PROFILE_DEFINED');
    addStandings();
  } else if (profile.championshipFormat === 'TOP2_FINAL') {
    if (!runnerUp) throw new Error('top-two final runner-up is required');
    add(champion, 'DOMESTIC_CHAMPION');
    add(standings[0], 'REGULAR_SEASON_CHAMPION');
    addStandings();
  } else {
    if (!runnerUp) throw new Error('postseason runner-up is required');
    add(champion, 'DOMESTIC_CHAMPION');
    add(standings[0], 'REGULAR_SEASON_CHAMPION');
    add(runnerUp, 'RUNNER_UP');
    addStandings();
  }
  return Object.freeze(result);
};
