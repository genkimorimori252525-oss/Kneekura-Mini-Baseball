import type { QualificationCandidate } from './ContinentalQualification';
import { deriveDomesticQualificationOrder } from './DomesticQualificationOrder';
import type { DomesticPostseasonState } from './DomesticPostseason';
import type { ConferencePostseasonState } from './ConferencePostseason';
import type { LeagueProfileV1 } from './LeagueProfiles';
import type { NorthAmericaPostseasonState } from './NorthAmericaPostseason';
import { matchesOfficialStandingsBasis,
  type OfficialStandingsSnapshot } from './OfficialStandings';
import type { WinterChampionshipState } from './WinterChampionship';

export type OfficialDomesticOutcome =
  | Readonly<{ kind: 'direct'; state: DomesticPostseasonState }>
  | Readonly<{ kind: 'group-conference'; state: ConferencePostseasonState }>
  | Readonly<{ kind: 'north-america'; state: NorthAmericaPostseasonState }>
  | Readonly<{ kind: 'winter'; state: WinterChampionshipState }>;

const matchesFinalists = (groupChampions: readonly Readonly<{
  clubId: string | null;
}>[], champion: string, runnerUp: string | null): boolean =>
  runnerUp !== null && groupChampions.length === 2
    && new Set(groupChampions.map((item) => item.clubId)).size === 2
    && groupChampions.some((item) => item.clubId === champion)
    && groupChampions.some((item) => item.clubId === runnerUp);

/** Derive candidate routes only after the corresponding official title is final. */
export const deriveOfficialDomesticQualificationOrder = (
  profile: LeagueProfileV1,
  standings: OfficialStandingsSnapshot,
  outcome: OfficialDomesticOutcome,
): readonly QualificationCandidate[] => {
  const order = standings.orderedClubIds;
  if (profile.leagueId !== standings.leagueId || profile.clubCount !== standings.rows.length) {
    throw new Error('official qualification league profile and standings mismatch');
  }
  if (!standings.seasonId || order === null || standings.unresolvedTieGroups.length > 0
    || order.length !== profile.clubCount || new Set(order).size !== order.length
    || new Set(standings.rows.map((row) => row.clubId)).size !== order.length
    || standings.rows.some((row) => !order.includes(row.clubId))) {
    throw new Error('official qualification requires resolved full-league standings');
  }
  const expectedGames = profile.clubCount * profile.regularSeasonGamesPerClub / 2;
  if (!Number.isSafeInteger(expectedGames)
    || standings.resultApplicationIds.length !== expectedGames
    || new Set(standings.resultApplicationIds).size !== expectedGames
    || standings.resultApplicationIds.some((id) => !id)
    || standings.rows.some((row) =>
      row.games !== profile.regularSeasonGamesPerClub
      || row.wins + row.losses + row.ties !== row.games)) {
    throw new Error('official qualification requires a complete official regular season');
  }
  const state = outcome.state;
  if (state.seasonId !== standings.seasonId || state.status !== 'COMPLETE'
    || !state.championClubId
    || !matchesOfficialStandingsBasis(standings, state.regularSeasonBasis)) {
    throw new Error('official qualification requires a complete same-season championship');
  }
  if (outcome.kind === 'direct') {
    const direct = outcome.state;
    if (profile.championshipFormat !== direct.format
      || direct.regularSeasonChampionClubId !== order[0]
      || direct.regularSeasonOrder.length !== order.length
      || direct.regularSeasonOrder.some((clubId, index) => clubId !== order[index])) {
      throw new Error('official qualification direct format or title mismatch');
    }
    return deriveDomesticQualificationOrder({ profile, regularSeasonStandings: order,
      domesticChampionId: state.championClubId,
      championshipRunnerUpId: state.runnerUpClubId ?? undefined });
  }
  if (outcome.kind === 'group-conference') {
    const conference = outcome.state;
    const priority = conference.qualificationPriorityGroupIds;
    if (profile.championshipFormat !== 'CONFERENCE_SERIES'
      || !['league-001', 'league-009', 'league-013'].includes(profile.leagueId)
      || !conference.alignmentVersion || !conference.qualificationPolicyVersion
      || priority.length !== 2
      || new Set(priority).size !== 2
      || conference.championship?.status !== 'COMPLETE'
      || conference.championship.winnerClubId !== state.championClubId
      || conference.championship.runnerUpClubId !== state.runnerUpClubId
      || !matchesFinalists(conference.groupChampions,
        state.championClubId, state.runnerUpClubId)
      || new Set(conference.groupChampions.map((item) => item.groupId)).size !== 2
      || conference.groupPennantWinners.length !== 2
      || new Set(conference.groupPennantWinners.map((item) => item.groupId)).size !== 2
      || priority.some((groupId) =>
        !conference.groupPennantWinners.some((item) => item.groupId === groupId))) {
      throw new Error('official qualification conference title mismatch');
    }
    return deriveDomesticQualificationOrder({ profile, regularSeasonStandings: order,
      domesticChampionId: state.championClubId,
      championshipRunnerUpId: state.runnerUpClubId ?? undefined,
      conferenceWinnerIds: priority.map((groupId) =>
        conference.groupPennantWinners.find((item) => item.groupId === groupId)!.clubId) });
  }
  if (outcome.kind === 'north-america') {
    const northAmerica = outcome.state;
    if (profile.leagueId !== 'league-008'
      || profile.championshipFormat !== 'CONFERENCE_SERIES'
      || northAmerica.championship?.status !== 'COMPLETE'
      || northAmerica.championship.winnerClubId !== state.championClubId
      || northAmerica.championship.runnerUpClubId !== state.runnerUpClubId
      || !matchesFinalists(northAmerica.conferenceChampions,
        state.championClubId, state.runnerUpClubId)
      || new Set(northAmerica.conferenceChampions.map((item) =>
        item.conferenceId)).size !== 2) {
      throw new Error('official qualification North America title mismatch');
    }
    return deriveDomesticQualificationOrder({ profile, regularSeasonStandings: order,
      domesticChampionId: state.championClubId,
      championshipRunnerUpId: state.runnerUpClubId ?? undefined });
  }
  const winter = outcome.state;
  const roundOrder = winter.championshipRoundStandings.orderedClubIds;
  if (profile.leagueId !== 'league-010'
    || profile.championshipFormat !== 'WINTER_ROUND_ROBIN'
    || winter.regularSeasonWinnerClubId !== order[0]
    || winter.regularSeasonOrder.length !== order.length
    || winter.regularSeasonOrder.some((clubId, index) => clubId !== order[index])
    || winter.final?.status !== 'COMPLETE'
    || winter.final.winnerClubId !== state.championClubId
    || winter.final.runnerUpClubId !== state.runnerUpClubId
    || winter.championshipRoundStandings.seasonId !== standings.seasonId
    || winter.championshipRoundStandings.leagueId
      !== `${profile.leagueId}:championship-round`
    || roundOrder === null || roundOrder.length !== 4
    || new Set(roundOrder).size !== 4
    || roundOrder.some((clubId) => !order.slice(0, 4).includes(clubId))
    || !roundOrder.slice(0, 2).includes(state.championClubId)
    || !roundOrder.slice(0, 2).includes(state.runnerUpClubId ?? '')
    || winter.championshipRoundStandings.unresolvedTieGroups.length > 0
    || winter.championshipRoundWinnerClubId
      !== roundOrder[0]) {
    throw new Error('official qualification winter title or round mismatch');
  }
  return deriveDomesticQualificationOrder({ profile, regularSeasonStandings: order,
    domesticChampionId: state.championClubId,
    championshipRunnerUpId: state.runnerUpClubId ?? undefined,
    championshipRoundOrder: roundOrder });
};
