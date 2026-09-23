import { expect, it } from 'vitest';
import type { OfficialStandingsSnapshot } from './OfficialStandings';
import { resolveDomesticPostseason } from './DomesticPostseason';
import { LEAGUE_PROFILES_V1 } from './LeagueProfiles';
import { captureOfficialStandingsBasis } from './OfficialStandings';
import { deriveOfficialDomesticQualificationOrder } from './OfficialDomesticQualification';

const profile = (leagueId: string) => LEAGUE_PROFILES_V1.find((item) =>
  item.leagueId === leagueId)!;
const standings = (leagueId: string, clubs: readonly string[]): OfficialStandingsSnapshot => {
  const games = leagueId.endsWith(':championship-round') ? 6
    : profile(leagueId).regularSeasonGamesPerClub;
  return {
    seasonId: 'season-1', leagueId, tiebreakPolicyVersion: 'table-v1',
    scheduleRevisionEventIds: [], orderedClubIds: clubs, unresolvedTieGroups: [],
    resultApplicationIds: Array.from({ length: clubs.length * games / 2 },
      (_, index) => `application-${index}`), tiebreakResolutions: [],
    rows: clubs.map((clubId) => ({ clubId, games, wins: games / 2,
      losses: games / 2, ties: 0, runsFor: 0, runsAgainst: 0,
      cappedRunDifferential: 0 })),
  };
};

it('derives a table-title berth order only from matching completed official standings', () => {
  const league = profile('league-005');
  const table = standings(league.leagueId,
    Array.from({ length: league.clubCount }, (_, index) => `club-${index + 1}`));
  const outcome = resolveDomesticPostseason('TABLE_TITLE', table, []);
  expect(deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'direct', state: outcome }).slice(0, 2))
    .toMatchObject([{ clubId: 'club-1', sourceType: 'DOMESTIC_CHAMPION' },
      { clubId: 'club-2', sourceType: 'LEAGUE_COEFFICIENT_BERTH' }]);
  expect(() => deriveOfficialDomesticQualificationOrder(league,
    { ...table, leagueId: 'wrong-league' }, { kind: 'direct', state: outcome }))
    .toThrow('league');
  expect(() => deriveOfficialDomesticQualificationOrder(league,
    { ...table, unresolvedTieGroups: [['club-1', 'club-2']], orderedClubIds: null },
    { kind: 'direct', state: outcome })).toThrow('resolved');
  expect(() => deriveOfficialDomesticQualificationOrder(league,
    { ...table, rows: table.rows.map((row) => ({ ...row, games: 1 })) },
    { kind: 'direct', state: outcome })).toThrow('complete official regular season');
  expect(() => deriveOfficialDomesticQualificationOrder(league,
    { ...table, scheduleRevisionEventIds: ['later-revision'] },
    { kind: 'direct', state: outcome })).toThrow('complete');
  expect(() => deriveOfficialDomesticQualificationOrder(league,
    { ...table, resultApplicationIds: ['different-official-result'] },
    { kind: 'direct', state: outcome })).toThrow('complete');
  expect(() => deriveOfficialDomesticQualificationOrder(league,
    { ...table, orderedClubIds: [table.orderedClubIds![1],
      table.orderedClubIds![0], ...table.orderedClubIds!.slice(2)] },
    { kind: 'direct', state: outcome })).toThrow('complete');
  expect(() => deriveOfficialDomesticQualificationOrder(league,
    { ...table, tiebreakResolutions: [{ policyVersion: 'tie-v1',
      gameId: 'deciding-game', applicationId: 'deciding-application',
      winnerClubId: 'club-1', loserClubId: 'club-2' }] },
    { kind: 'direct', state: outcome })).toThrow('complete');
});

it('blocks qualification before an official postseason champion exists', () => {
  const league = profile('league-003');
  const table = standings(league.leagueId,
    Array.from({ length: league.clubCount }, (_, index) => `club-${index + 1}`));
  const pending = resolveDomesticPostseason('TOP4_SERIES', table, []);
  expect(() => deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'direct', state: pending })).toThrow('complete');
});

it('uses official conference pennants after the national champion is settled', () => {
  const league = profile('league-001');
  const clubs = Array.from({ length: league.clubCount }, (_, index) => `club-${index + 1}`);
  const table = standings(league.leagueId, clubs);
  const completed = {
    seasonId: 'season-1', policyVersion: 'japan-v1', status: 'COMPLETE' as const,
    regularSeasonBasis: captureOfficialStandingsBasis(table),
    alignmentVersion: 'japan-alignment-v1',
    alignmentSnapshot: { version: 'japan-alignment-v1', seasonId: 'season-1',
      leagueId: league.leagueId, groups: [
        { groupId: 'east', clubIds: clubs.slice(0, 6) },
        { groupId: 'west', clubIds: clubs.slice(6) },
      ] },
    qualificationPolicyVersion: 'japan-qualification-v1',
    qualificationPriorityGroupIds: ['east', 'west'],
    groupChampions: [{ groupId: 'east', clubId: clubs[2] },
      { groupId: 'west', clubId: clubs[7] }],
    groupPennantWinners: [{ groupId: 'east', clubId: clubs[0] },
      { groupId: 'west', clubId: clubs[6] }],
    series: [], nextGroupSeries: [], nextChampionship: null,
    championship: { seriesId: 'national', status: 'COMPLETE' as const,
      winnerClubId: clubs[7], runnerUpClubId: clubs[2],
      higherSeedWins: 4, lowerSeedWins: 2, resultApplicationIds: [] },
    championClubId: clubs[7], runnerUpClubId: clubs[2],
  };
  expect(deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'group-conference', state: completed }).slice(0, 4)
    .map((candidate) => candidate.clubId))
    .toEqual([clubs[7], clubs[0], clubs[6], clubs[2]]);
  expect(deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'group-conference', state: { ...completed,
      groupPennantWinners: [...completed.groupPennantWinners].reverse() } }).slice(0, 4)
    .map((candidate) => candidate.clubId))
    .toEqual([clubs[7], clubs[0], clubs[6], clubs[2]]);
  expect(() => deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'group-conference', state: { ...completed,
      groupChampions: [{ groupId: 'east', clubId: clubs[2] },
        { groupId: 'west', clubId: clubs[8] }] } }))
    .toThrow('conference');
  expect(() => deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'group-conference', state: { ...completed,
      qualificationPriorityGroupIds: ['east', 'east'] } }))
    .toThrow('conference');
});

it('uses the completed Dominican round order and rejects a mismatched round', () => {
  const league = profile('league-010');
  const clubs = ['a', 'b', 'c', 'd', 'e', 'f'];
  const table = standings(league.leagueId, clubs);
  const round = standings(`${league.leagueId}:championship-round`, ['c', 'd', 'a', 'b']);
  const completed = {
    seasonId: 'season-1', policyVersion: 'winter-v1', status: 'COMPLETE' as const,
    regularSeasonBasis: captureOfficialStandingsBasis(table),
    regularSeasonOrder: clubs,
    regularSeasonWinnerClubId: 'a', championshipRoundStandings: round,
    championshipRoundWinnerClubId: 'c', nextFinal: null,
    final: { seriesId: 'winter-final', status: 'COMPLETE' as const,
      winnerClubId: 'd', runnerUpClubId: 'c', higherSeedWins: 3,
      lowerSeedWins: 4, resultApplicationIds: [] },
    championClubId: 'd', runnerUpClubId: 'c',
  };
  expect(deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'winter', state: completed }).slice(0, 4)
    .map((candidate) => candidate.clubId)).toEqual(['d', 'c', 'a', 'b']);
  expect(() => deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'winter', state: { ...completed,
      championshipRoundStandings: standings(`${league.leagueId}:championship-round`,
        ['c', 'd', 'a', 'e']) } }))
    .toThrow('winter');
});

it('uses national champion, runner-up, then overall official records in North America', () => {
  const league = profile('league-008');
  const clubs = Array.from({ length: league.clubCount }, (_, index) => `club-${index + 1}`);
  const table = standings(league.leagueId, clubs);
  const completed = {
    seasonId: 'season-1', policyVersion: 'na-v1', status: 'COMPLETE' as const,
    regularSeasonBasis: captureOfficialStandingsBasis(table),
    conferenceAlignmentVersion: 'conference-alignment-v1',
    divisionAlignmentVersion: 'division-alignment-v1',
    conferenceAlignmentSnapshot: { version: 'conference-alignment-v1',
      seasonId: 'season-1', leagueId: league.leagueId, groups: [
        { groupId: 'a', clubIds: clubs.slice(0, 15) },
        { groupId: 'b', clubIds: clubs.slice(15) },
      ] },
    divisionAlignmentSnapshot: { version: 'division-alignment-v1',
      seasonId: 'season-1', leagueId: league.leagueId,
      groups: Array.from({ length: 6 }, (_, index) => ({
        groupId: `division-${index + 1}`,
        clubIds: clubs.slice(index * 5, index * 5 + 5),
      })) },
    conferenceSeeds: [], conferenceChampions: [
      { conferenceId: 'a', clubId: clubs[1] },
      { conferenceId: 'b', clubId: clubs[10] },
    ], series: [], nextConferenceSeries: [], nextChampionship: null,
    championship: { seriesId: 'national', status: 'COMPLETE' as const,
      winnerClubId: clubs[10], runnerUpClubId: clubs[1],
      higherSeedWins: 4, lowerSeedWins: 3, resultApplicationIds: [] },
    championClubId: clubs[10], runnerUpClubId: clubs[1],
  };
  expect(deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'north-america', state: completed }).slice(0, 3)
    .map((candidate) => candidate.clubId))
    .toEqual([clubs[10], clubs[1], clubs[0]]);
  expect(() => deriveOfficialDomesticQualificationOrder(league, table,
    { kind: 'north-america', state: { ...completed,
      conferenceChampions: [{ conferenceId: 'a', clubId: clubs[1] },
        { conferenceId: 'b', clubId: clubs[11] }] } })).toThrow('North America');
});
