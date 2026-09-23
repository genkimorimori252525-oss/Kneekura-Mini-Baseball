import { expect, it } from 'vitest';
import { resolveDomesticPostseason } from './DomesticPostseason';
import { LEAGUE_PROFILES_V1 } from './LeagueProfiles';
import type { OfficialStandingsSnapshot } from './OfficialStandings';
import { captureOfficialStandingsBasis } from './OfficialStandings';
import { finalizeDomesticCompetitionSeason } from './DomesticCompetitionSeason';

const league = LEAGUE_PROFILES_V1.find((item) => item.leagueId === 'league-005')!;
const clubs = Array.from({ length: league.clubCount }, (_, index) => `club-${index + 1}`);
const standings: OfficialStandingsSnapshot = {
  seasonId: 'season-2026', leagueId: league.leagueId,
  tiebreakPolicyVersion: 'standings-v1', scheduleRevisionEventIds: ['rainout-1'],
  resultApplicationIds: Array.from({ length: 660 }, (_, index) => `game-${index}`),
  tiebreakResolutions: [],
  orderedClubIds: clubs, unresolvedTieGroups: [],
  rows: clubs.map((clubId) => ({ clubId, games: 110, wins: 55, losses: 55,
    ties: 0, runsFor: 300, runsAgainst: 300, cappedRunDifferential: 0 })),
};
const eligibility = Object.fromEntries(clubs.map((clubId) =>
  [clubId, { eligible: true }]));
const input = () => ({
  profile: league, standings,
  outcome: { kind: 'direct' as const,
    state: resolveDomesticPostseason('TABLE_TITLE', standings, []) },
  qualificationPolicyVersion: 'qual-v1',
  competitionEditionId: 'apbcl-2027', berthCount: 2,
  alreadyQualifiedClubIds: [] as string[], eligibilityByClubId: eligibility,
});

it('freezes a completed official title, policy, and deterministic berth provenance', () => {
  const request = input();
  const snapshot = finalizeDomesticCompetitionSeason(request);
  expect(snapshot).toMatchObject({
    seasonId: 'season-2026', leagueId: league.leagueId,
    competitionProfileVersion: 'league-competition-v1',
    standingsTiebreakPolicyVersion: 'standings-v1',
    postseasonFormatVersion: 'league-competition-v1',
    qualificationPolicyVersion: 'qual-v1',
    regularSeasonTitleSnapshot: { winnerClubId: clubs[0] },
    domesticChampionSnapshot: { championClubId: clubs[0] },
    continentalQualification: {
      competitionEditionId: 'apbcl-2027', qualificationSeasonId: 'season-2026',
      entrantClubIds: [clubs[0], clubs[1]],
    },
  });
  expect(snapshot.continentalQualification.provenance[0]).toMatchObject({
    sourceType: 'DOMESTIC_CHAMPION', originalCandidateClubId: clubs[0],
    finalRecipientClubId: clubs[0],
  });
  expect(snapshot.continentalQualification.provenance[1]).toMatchObject({
    sourceType: 'LEAGUE_COEFFICIENT_BERTH', originalCandidateClubId: clubs[1],
    finalRecipientClubId: clubs[1],
  });
  expect(snapshot.regularSeasonTitleSnapshot.standings).not.toBe(standings);
  expect(Object.isFrozen(snapshot.regularSeasonTitleSnapshot.standings.rows[0])).toBe(true);
  expect(Object.isFrozen(snapshot.continentalQualification.provenance[0].attempts)).toBe(true);
});

it('pins cascade and rejects mismatched or unfinished official season evidence', () => {
  const snapshot = finalizeDomesticCompetitionSeason({ ...input(),
    alreadyQualifiedClubIds: [clubs[0]],
    eligibilityByClubId: { ...eligibility, [clubs[1]]: {
      eligible: false, reason: 'registration' } },
  });
  expect(snapshot.continentalQualification.entrantClubIds).toEqual([clubs[2], clubs[3]]);
  expect(snapshot.continentalQualification.provenance[0].attempts.map((item) =>
    item.result)).toEqual(['ALREADY_QUALIFIED', 'INELIGIBLE', 'SELECTED']);
  expect(() => finalizeDomesticCompetitionSeason({ ...input(),
    qualificationPolicyVersion: '' })).toThrow('policy');
  expect(() => finalizeDomesticCompetitionSeason({ ...input(),
    standings: { ...standings, resultApplicationIds: ['changed-result'] } }))
    .toThrow('complete');
});

it('pins the Japan alignment and qualification policy with each pennant owner', () => {
  const japan = LEAGUE_PROFILES_V1.find((item) => item.leagueId === 'league-001')!;
  const fullTable = { ...standings, leagueId: japan.leagueId,
    resultApplicationIds: Array.from({ length: 720 }, (_, index) => `game-${index}`),
    rows: standings.rows.map((row) => ({ ...row, games: 120,
      wins: 60, losses: 60 })) };
  const groupAlignment = { version: 'alignment-v1', seasonId: standings.seasonId,
    leagueId: japan.leagueId, groups: [
      { groupId: 'a', clubIds: clubs.slice(0, 6) },
      { groupId: 'b', clubIds: clubs.slice(6) },
    ] };
  const outcome = { kind: 'group-conference' as const, state: {
    seasonId: standings.seasonId, policyVersion: 'japan-postseason-v1',
    qualificationPolicyVersion: 'japan-qualification-v1',
    alignmentSnapshot: groupAlignment,
    alignmentVersion: 'alignment-v1', qualificationPriorityGroupIds: ['a', 'b'],
    regularSeasonBasis: captureOfficialStandingsBasis(fullTable, false),
    status: 'COMPLETE' as const,
    groupChampions: [{ groupId: 'a', clubId: clubs[1] },
      { groupId: 'b', clubId: clubs[6] }],
    groupPennantWinners: [{ groupId: 'a', clubId: clubs[0] },
      { groupId: 'b', clubId: clubs[6] }],
    series: [], nextGroupSeries: [], nextChampionship: null,
    championship: { seriesId: 'japan-final', status: 'COMPLETE' as const,
      winnerClubId: clubs[1], runnerUpClubId: clubs[6],
      higherSeedWins: 4, lowerSeedWins: 2, resultApplicationIds: [] },
    championClubId: clubs[1], runnerUpClubId: clubs[6],
  } };
  const request = { ...input(), profile: japan, standings: fullTable,
    outcome,
    qualificationPolicyVersion: 'japan-qualification-v1' };
  const snapshot = finalizeDomesticCompetitionSeason(request);
  expect(snapshot.continentalQualification.orderedCandidates.slice(0, 4)
    .map((item) => item.clubId))
    .toEqual([clubs[1], clubs[0], clubs[6], clubs[6]]);
  expect(() => finalizeDomesticCompetitionSeason({ ...request,
    qualificationPolicyVersion: 'other-policy' })).toThrow('policy');
  expect(() => finalizeDomesticCompetitionSeason({ ...request,
    outcome: { ...outcome, state: { ...outcome.state,
      groupPennantWinners: [{ groupId: 'a', clubId: clubs[6] },
        { groupId: 'b', clubId: clubs[0] }] } } }))
    .toThrow('alignment');
});

it('requires North America divisions to remain inside their pinned conferences', () => {
  const northAmerica = LEAGUE_PROFILES_V1.find((item) =>
    item.leagueId === 'league-008')!;
  const members = Array.from({ length: 30 }, (_, index) => `na-${index + 1}`);
  const fullTable: OfficialStandingsSnapshot = { ...standings,
    leagueId: northAmerica.leagueId,
    orderedClubIds: members,
    resultApplicationIds: Array.from({ length: 2430 },
      (_, index) => `na-game-${index}`),
    rows: members.map((clubId) => ({ clubId, games: 162,
      wins: 81, losses: 81, ties: 0, runsFor: 500,
      runsAgainst: 500, cappedRunDifferential: 0 })),
  };
  const conferenceAlignment = { version: 'conf-v1',
    seasonId: standings.seasonId, leagueId: northAmerica.leagueId,
    groups: [{ groupId: 'american', clubIds: members.slice(0, 15) },
      { groupId: 'national', clubIds: members.slice(15) }] };
  const divisionAlignment = { version: 'division-v1',
    seasonId: standings.seasonId, leagueId: northAmerica.leagueId,
    groups: Array.from({ length: 6 }, (_, index) => ({
      groupId: `division-${index + 1}`,
      clubIds: members.slice(index * 5, index * 5 + 5),
    })) };
  const outcome = { kind: 'north-america' as const, state: {
    seasonId: standings.seasonId, policyVersion: 'na-postseason-v1',
    conferenceAlignmentSnapshot: conferenceAlignment,
    divisionAlignmentSnapshot: divisionAlignment,
    conferenceAlignmentVersion: 'conf-v1', divisionAlignmentVersion: 'division-v1',
    regularSeasonBasis: captureOfficialStandingsBasis(fullTable, false),
    status: 'COMPLETE' as const,
    conferenceSeeds: [], conferenceChampions: [
      { conferenceId: 'american', clubId: members[0] },
      { conferenceId: 'national', clubId: members[15] },
    ], series: [], nextConferenceSeries: [], nextChampionship: null,
    championship: { seriesId: 'na-final', status: 'COMPLETE' as const,
      winnerClubId: members[15], runnerUpClubId: members[0],
      higherSeedWins: 2, lowerSeedWins: 4, resultApplicationIds: [] },
    championClubId: members[15], runnerUpClubId: members[0],
  } };
  const request = { ...input(), profile: northAmerica, standings: fullTable,
    outcome,
    eligibilityByClubId: Object.fromEntries(members.map((clubId) =>
      [clubId, { eligible: true }])),
  };
  expect(finalizeDomesticCompetitionSeason(request)
    .continentalQualification.entrantClubIds)
    .toEqual([members[15], members[0]]);
  const swapped = structuredClone(divisionAlignment);
  swapped.groups[0].clubIds[0] = members[15];
  swapped.groups[3].clubIds[0] = members[0];
  expect(() => finalizeDomesticCompetitionSeason({ ...request,
    outcome: { ...outcome, state: { ...outcome.state,
      divisionAlignmentSnapshot: swapped } } }))
    .toThrow('alignment');
});
