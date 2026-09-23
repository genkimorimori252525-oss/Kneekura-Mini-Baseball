import { allocateContinentalBerths, type ContinentalQualificationProvenance,
  type EligibilityResult, type QualificationCandidate } from './ContinentalQualification';
import type { LeagueProfileV1 } from './LeagueProfiles';
import { deriveOfficialDomesticQualificationOrder,
  type OfficialDomesticOutcome } from './OfficialDomesticQualification';
import type { LeagueGroupAlignment, OfficialStandingsSnapshot } from './OfficialStandings';

export type DomesticSeasonAlignment =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'group'; alignment: LeagueGroupAlignment }>
  | Readonly<{ kind: 'north-america'; conferenceAlignment: LeagueGroupAlignment;
    divisionAlignment: LeagueGroupAlignment }>;

export type DomesticCompetitionSeasonInput = Readonly<{
  profile: LeagueProfileV1;
  standings: OfficialStandingsSnapshot;
  outcome: OfficialDomesticOutcome;
  qualificationPolicyVersion: string;
  competitionEditionId: string;
  berthCount: number;
  alreadyQualifiedClubIds: readonly string[];
  eligibilityByClubId: Readonly<Record<string, EligibilityResult>>;
}>;

export type DomesticCompetitionSeasonSnapshot = Readonly<{
  seasonId: string;
  leagueId: string;
  competitionProfileVersion: string;
  calendarProfileVersion: string;
  clubMembershipSnapshot: readonly string[];
  alignmentSnapshot: DomesticSeasonAlignment;
  postseasonFormatVersion: string;
  standingsTiebreakPolicyVersion: string;
  qualificationPolicyVersion: string;
  regularSeasonTitleSnapshot: Readonly<{
    winnerClubId: string;
    standings: OfficialStandingsSnapshot;
  }>;
  domesticChampionSnapshot: Readonly<{
    championClubId: string;
    runnerUpClubId: string | null;
    outcome: OfficialDomesticOutcome;
  }>;
  continentalQualification: Readonly<{
    competitionEditionId: string;
    qualificationSeasonId: string;
    berthCount: number;
    alreadyQualifiedClubIds: readonly string[];
    orderedCandidates: readonly QualificationCandidate[];
    eligibilityByClubId: Readonly<Record<string, EligibilityResult>>;
    entrantClubIds: readonly string[];
    provenance: readonly ContinentalQualificationProvenance[];
  }>;
}>;

const sameSet = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && new Set(left).size === left.length
  && new Set(right).size === right.length
  && left.every((id) => right.includes(id));

const validAlignment = (alignment: LeagueGroupAlignment,
  seasonId: string, leagueId: string, memberClubIds: readonly string[],
  groupCount: number, groupSize: number): boolean =>
  !!alignment.version && alignment.seasonId === seasonId
  && alignment.leagueId === leagueId && alignment.groups.length === groupCount
  && new Set(alignment.groups.map((group) => group.groupId)).size === groupCount
  && alignment.groups.every((group) => !!group.groupId
    && group.clubIds.length === groupSize
    && new Set(group.clubIds).size === groupSize)
  && sameSet(alignment.groups.flatMap((group) => group.clubIds), memberClubIds);

const validateAlignment = (input: DomesticCompetitionSeasonInput,
  memberClubIds: readonly string[]): DomesticSeasonAlignment => {
  const { outcome, standings } = input;
  if (outcome.kind === 'group-conference') {
    const alignment = outcome.state.alignmentSnapshot;
    const size = outcome.state.regularSeasonBasis.leagueId === 'league-001' ? 6
      : outcome.state.regularSeasonBasis.leagueId === 'league-009' ? 10 : 8;
    if (!alignment || !validAlignment(alignment, standings.seasonId,
      standings.leagueId, memberClubIds, 2, size)
      || alignment.version !== outcome.state.alignmentVersion
      || !sameSet(alignment.groups.map((group) => group.groupId),
        outcome.state.qualificationPriorityGroupIds)
      || !sameSet(alignment.groups.map((group) => group.groupId),
        outcome.state.groupChampions.map((item) => item.groupId))
      || [...outcome.state.groupChampions, ...outcome.state.groupPennantWinners]
        .some((item) => !alignment.groups.find((group) =>
          group.groupId === item.groupId)?.clubIds.includes(item.clubId ?? ''))
      || input.qualificationPolicyVersion !== outcome.state.qualificationPolicyVersion) {
      throw new Error('group season alignment or qualification policy mismatch');
    }
    return { kind: 'group', alignment };
  } else if (outcome.kind === 'north-america') {
    const { conferenceAlignmentSnapshot: conferenceAlignment,
      divisionAlignmentSnapshot: divisionAlignment } = outcome.state;
    if (!conferenceAlignment || !divisionAlignment
      || !validAlignment(conferenceAlignment, standings.seasonId,
      standings.leagueId, memberClubIds, 2, 15)
      || !validAlignment(divisionAlignment, standings.seasonId,
        standings.leagueId, memberClubIds, 6, 5)
      || conferenceAlignment.version !== outcome.state.conferenceAlignmentVersion
      || divisionAlignment.version !== outcome.state.divisionAlignmentVersion
      || !sameSet(conferenceAlignment.groups.map((group) => group.groupId),
        outcome.state.conferenceChampions.map((item) => item.conferenceId))
      || outcome.state.conferenceChampions.some((item) =>
        !conferenceAlignment.groups.find((group) =>
          group.groupId === item.conferenceId)?.clubIds.includes(item.clubId ?? ''))
      || divisionAlignment.groups.some((division) =>
        !conferenceAlignment.groups.some((conference) =>
          division.clubIds.every((clubId) => conference.clubIds.includes(clubId))))) {
      throw new Error('North America season alignment mismatch');
    }
    return { kind: 'north-america', conferenceAlignment, divisionAlignment };
  }
  return { kind: 'none' };
};

const detachedFrozen = <T>(input: T): T => {
  const copy = structuredClone(input);
  const seen = new WeakSet<object>();
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(copy);
  return copy;
};

/** Finalizes an edition's entrants from official season evidence and pins its historical rules. */
export const finalizeDomesticCompetitionSeason = (
  input: DomesticCompetitionSeasonInput,
): DomesticCompetitionSeasonSnapshot => {
  if (!input.qualificationPolicyVersion) {
    throw new Error('qualification policy version is required');
  }
  const candidates = deriveOfficialDomesticQualificationOrder(
    input.profile, input.standings, input.outcome);
  const members = input.standings.rows.map((row) => row.clubId);
  const alignmentSnapshot = validateAlignment(input, members);
  const allocated = allocateContinentalBerths({
    competitionEditionId: input.competitionEditionId,
    leagueId: input.profile.leagueId,
    qualificationSeasonId: input.standings.seasonId,
    berthCount: input.berthCount,
    alreadyQualifiedClubIds: input.alreadyQualifiedClubIds,
    orderedCandidates: candidates,
    eligibilityByClubId: input.eligibilityByClubId,
  });
  const state = input.outcome.state;
  return detachedFrozen({
    seasonId: input.standings.seasonId,
    leagueId: input.profile.leagueId,
    competitionProfileVersion: input.profile.competitionProfileVersion,
    calendarProfileVersion: input.profile.calendarProfileVersion,
    clubMembershipSnapshot: members,
    alignmentSnapshot,
    postseasonFormatVersion: input.outcome.kind === 'direct'
      ? input.profile.competitionProfileVersion : input.outcome.state.policyVersion,
    standingsTiebreakPolicyVersion: input.standings.tiebreakPolicyVersion,
    qualificationPolicyVersion: input.qualificationPolicyVersion,
    regularSeasonTitleSnapshot: {
      winnerClubId: input.standings.orderedClubIds![0], standings: input.standings,
    },
    domesticChampionSnapshot: {
      championClubId: state.championClubId!, runnerUpClubId: state.runnerUpClubId,
      outcome: input.outcome,
    },
    continentalQualification: {
      competitionEditionId: input.competitionEditionId,
      qualificationSeasonId: input.standings.seasonId,
      berthCount: input.berthCount,
      alreadyQualifiedClubIds: input.alreadyQualifiedClubIds,
      orderedCandidates: candidates,
      eligibilityByClubId: input.eligibilityByClubId,
      entrantClubIds: allocated.entrantClubIds,
      provenance: allocated.provenance,
    },
  });
};
