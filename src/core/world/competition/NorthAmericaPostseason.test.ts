import { expect, it } from 'vitest';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { LeagueGroupAlignment, OfficialGroupStandingsSnapshot } from './OfficialStandings';
import type { PostseasonSeriesPlan } from './PostseasonSeries';
import { resolveNorthAmericaPostseason } from './NorthAmericaPostseason';

const clubs = (prefix: string) => Array.from({ length: 15 }, (_, index) => `${prefix}${index + 1}`);
const standing = (groupId: string, members: readonly string[],
  ordered = members): OfficialGroupStandingsSnapshot => ({
  seasonId: 'season-1', leagueId: 'league-008', groupId,
  alignmentVersion: groupId.length === 1 ? 'conferences-v1' : 'divisions-v1',
  memberClubIds: members, tiebreakPolicyVersion: 'table-v1',
  scheduleRevisionEventIds: [], resultApplicationIds: ['regular-application'],
  tiebreakResolutions: [], orderedClubIds: ordered, unresolvedTieGroups: [],
  rows: ordered.map((clubId) => ({ clubId, games: 162,
    wins: 101 - Number(clubId.slice(1)), losses: 61 + Number(clubId.slice(1)), ties: 0,
    runsFor: 500, runsAgainst: 400, cappedRunDifferential: 100 })),
});
const leagueClubs = [...clubs('a'), ...clubs('b')];
const conferenceAlignment: LeagueGroupAlignment = {
  version: 'conferences-v1', seasonId: 'season-1', leagueId: 'league-008',
  groups: [{ groupId: 'a', clubIds: leagueClubs.slice(0, 15) },
    { groupId: 'b', clubIds: leagueClubs.slice(15) }],
};
const divisionAlignment: LeagueGroupAlignment = {
  version: 'divisions-v1', seasonId: 'season-1', leagueId: 'league-008',
  groups: ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((groupId, index) => ({
    groupId, clubIds: leagueClubs.slice(index * 5, index * 5 + 5),
  })),
};
const conferences = ['a', 'b'].map((conferenceId, index) => {
  const members = leagueClubs.slice(index * 15, index * 15 + 15);
  return { conferenceId, standings: standing(conferenceId, members),
    divisions: [1, 2, 3].map((division) => {
      const divisionId = `${conferenceId}${division}`;
      const divisionMembers = members.slice((division - 1) * 5, division * 5);
      return { divisionId, standings: standing(divisionId, divisionMembers) };
    }), series: [] };
});
const policy = { version: 'na-v1', championshipHigherSeedConferenceId: 'a',
  bracket: { seedSources: ['DIVISION_WINNER_1', 'DIVISION_WINNER_2',
    'DIVISION_WINNER_3', 'WILD_CARD_1', 'WILD_CARD_2', 'WILD_CARD_3'],
    wildCardPairings: [[3, 6], [4, 5]], divisionByes: [1, 2],
    divisionPairings: [[1, 1], [2, 0]] } } as const;
const plan = (seriesId: string, high: string, low: string,
  bestOf: number): PostseasonSeriesPlan => ({
  seriesId, seasonId: 'season-1', bestOf,
  higherSeedClubId: high, lowerSeedClubId: low,
  scheduledGames: Array.from({ length: bestOf }, (_, index) => ({
    gameId: `${seriesId}-${index}`, homeClubId: index < (bestOf + 1) / 2 ? high : low,
    awayClubId: index < (bestOf + 1) / 2 ? low : high,
  })),
});
const wins = (series: PostseasonSeriesPlan, winner: string): OfficialGameResult[] =>
  series.scheduledGames.slice(0, (series.bestOf + 1) / 2).map((game, index) => {
    const homeRuns = game.homeClubId === winner ? 2 : 1;
    const awayRuns = game.awayClubId === winner ? 2 : 1;
    return { gameId: game.gameId, seasonId: 'season-1', homeClubId: game.homeClubId,
      awayClubId: game.awayClubId, homeRuns, awayRuns, winnerClubId: winner,
      closureId: `close-${game.gameId}`, applicationId: `apply-${game.gameId}`,
      completionReason: 'BOTTOM_COMPLETE', ruleProfileId: 'rules' as OfficialGameResult['ruleProfileId'],
      gamePolicyVersion: 'game-v1', durableRevision: index + 1,
      lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
        totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
          away: { runs: awayRuns, hits: 0, errors: 0 } } } };
  });

it('selects three division winners and three wild cards in each conference', () => {
  const state = resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, conferences, null);
  expect(state.conferenceSeeds[0]).toEqual({ conferenceId: 'a',
    divisionWinnerClubIds: ['a1', 'a6', 'a11'],
    wildCardClubIds: ['a2', 'a3', 'a4'],
    seededClubIds: ['a1', 'a6', 'a11', 'a2', 'a3', 'a4'] });
  expect(state.nextConferenceSeries.filter((item) => item.conferenceId === 'a'))
    .toEqual([{ conferenceId: 'a', stage: 'wild-card-1',
      higherSeedClubId: 'a11', lowerSeedClubId: 'a4', bestOf: 3 },
    { conferenceId: 'a', stage: 'wild-card-2',
      higherSeedClubId: 'a2', lowerSeedClubId: 'a3', bestOf: 3 }]);
});

it('advances only after official wins and rejects reused regular-season applications', () => {
  const wildCard = plan('a-wc', 'a11', 'a4', 3);
  const withWildCard = [{ ...conferences[0], series: [{ stage: 'wild-card-1' as const,
    plan: wildCard, results: wins(wildCard, 'a4') }] }, conferences[1]];
  const state = resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, withWildCard, null);
  expect(state.nextConferenceSeries).toContainEqual({ conferenceId: 'a',
    stage: 'division-2', higherSeedClubId: 'a6', lowerSeedClubId: 'a4', bestOf: 5 });
  const duplicate = { ...wins(wildCard, 'a4')[0], applicationId: 'regular-application' };
  expect(() => resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, [{ ...conferences[0], series: [{ stage: 'wild-card-1',
      plan: wildCard, results: [duplicate] }] }, conferences[1]], null))
    .toThrow('application');
});

it('rejects stale division membership and invalid versioned brackets', () => {
  expect(() => resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, [{ ...conferences[0], divisions: [{
      ...conferences[0].divisions[0], standings: {
        ...conferences[0].divisions[0].standings, alignmentVersion: 'stale',
      },
    }, ...conferences[0].divisions.slice(1)] }, conferences[1]], null)).toThrow('alignment');
  expect(() => resolveNorthAmericaPostseason({ ...policy, bracket: {
    ...policy.bracket, wildCardPairings: [[3, 6], [3, 5]] as const,
  } }, conferenceAlignment, divisionAlignment, conferences, null)).toThrow('bracket');
});

it('uses an edition-specific seed allocation and bye placement', () => {
  const edition = { ...policy, bracket: { ...policy.bracket,
    seedSources: ['DIVISION_WINNER_1', 'WILD_CARD_1', 'DIVISION_WINNER_2',
      'WILD_CARD_2', 'DIVISION_WINNER_3', 'WILD_CARD_3'],
    divisionByes: [1, 2], wildCardPairings: [[3, 6], [4, 5]],
    divisionPairings: [[1, 1], [2, 0]],
  } } as const;
  const state = resolveNorthAmericaPostseason(edition, conferenceAlignment,
    divisionAlignment, conferences, null);
  expect(state.conferenceSeeds[0].seededClubIds)
    .toEqual(['a1', 'a2', 'a6', 'a3', 'a11', 'a4']);
  expect(state.nextConferenceSeries[0]).toMatchObject({
    higherSeedClubId: 'a6', lowerSeedClubId: 'a4', bestOf: 3,
  });
});

it('rejects a policy that gives every wild card priority over division titles', () => {
  const edition = { ...policy, bracket: { ...policy.bracket,
    seedSources: ['WILD_CARD_1', 'WILD_CARD_2', 'WILD_CARD_3',
      'DIVISION_WINNER_1', 'DIVISION_WINNER_2', 'DIVISION_WINNER_3'],
  } } as const;
  expect(() => resolveNorthAmericaPostseason(edition, conferenceAlignment,
    divisionAlignment, conferences, null)).toThrow('bracket');
});

it('accepts the same official application set in a different result order', () => {
  const reordered = conferences.map((conference, conferenceIndex) => ({
    ...conference,
    standings: { ...conference.standings,
      resultApplicationIds: ['regular-application', 'regular-two'] },
    divisions: conference.divisions.map((division, divisionIndex) => ({
      ...division, standings: { ...division.standings,
        resultApplicationIds: conferenceIndex === 0 && divisionIndex === 0
          ? ['regular-two', 'regular-application']
          : ['regular-application', 'regular-two'] },
    })),
  }));
  expect(resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, reordered, null).status).toBe('PENDING');
});

it('rejects conflicting tiebreak provenance for one application ID', () => {
  const resolution = { policyVersion: 'tie-v1', gameId: 'tie-game',
    applicationId: 'tie-application', winnerClubId: 'a1', loserClubId: 'a2' };
  const conflicted = [{ ...conferences[0],
    standings: { ...conferences[0].standings, tiebreakResolutions: [resolution] },
    divisions: [{ ...conferences[0].divisions[0], standings: {
      ...conferences[0].divisions[0].standings,
      tiebreakResolutions: [{ ...resolution, gameId: 'different-game' }],
    } }, ...conferences[0].divisions.slice(1)],
  }, conferences[1]];
  expect(() => resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, conflicted, null)).toThrow('tiebreak');
});

it('retains home priority for the better seed when a lower seed has a bye', () => {
  const edition = { ...policy, bracket: { ...policy.bracket,
    divisionByes: [5, 6], wildCardPairings: [[1, 4], [2, 3]],
    divisionPairings: [[5, 0], [6, 1]],
  } } as const;
  const wildCard = plan('lower-bye-wc', 'a1', 'a2', 3);
  const entered = [{ ...conferences[0], series: [{ stage: 'wild-card-1' as const,
    plan: wildCard, results: wins(wildCard, 'a1') }] }, conferences[1]];
  const state = resolveNorthAmericaPostseason(edition, conferenceAlignment,
    divisionAlignment, entered, null);
  expect(state.nextConferenceSeries).toContainEqual({ conferenceId: 'a',
    stage: 'division-1', higherSeedClubId: 'a1', lowerSeedClubId: 'a3', bestOf: 5 });
});

it('does not reuse a division tiebreak application in a postseason series', () => {
  const wildCard = plan('tie-replay', 'a11', 'a4', 3);
  const first = { ...wins(wildCard, 'a4')[0], applicationId: 'tie-application' };
  const withTiebreak = [{ ...conferences[0], divisions: [{
    ...conferences[0].divisions[0], standings: {
      ...conferences[0].divisions[0].standings,
      tiebreakResolutions: [{ policyVersion: 'tie-v1', gameId: 'tie-game',
        applicationId: 'tie-application', winnerClubId: 'a1', loserClubId: 'a2' }],
    },
  }, ...conferences[0].divisions.slice(1)], series: [{ stage: 'wild-card-1' as const,
    plan: wildCard, results: [first] }] }, conferences[1]];
  expect(() => resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, withTiebreak, null)).toThrow('application');
});

it('completes both conference paths and the national best-of-seven final', () => {
  const entries = (prefix: string) => {
    const rounds = [
      { stage: 'wild-card-1' as const, high: `${prefix}11`, low: `${prefix}4`,
        bestOf: 3, winner: `${prefix}4` },
      { stage: 'wild-card-2' as const, high: `${prefix}2`, low: `${prefix}3`,
        bestOf: 3, winner: `${prefix}2` },
      { stage: 'division-1' as const, high: `${prefix}1`, low: `${prefix}2`,
        bestOf: 5, winner: `${prefix}1` },
      { stage: 'division-2' as const, high: `${prefix}6`, low: `${prefix}4`,
        bestOf: 5, winner: `${prefix}4` },
      { stage: 'conference-championship' as const, high: `${prefix}1`,
        low: `${prefix}4`, bestOf: 7, winner: `${prefix}4` },
    ];
    return rounds.map((round) => {
      const series = plan(`${prefix}-${round.stage}`, round.high, round.low, round.bestOf);
      return { stage: round.stage, plan: series, results: wins(series, round.winner) };
    });
  };
  const completedConferences = conferences.map((conference) => ({
    ...conference, series: entries(conference.conferenceId),
  }));
  const ready = resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, completedConferences, null);
  expect(ready.nextChampionship).toEqual({ higherSeedClubId: 'a4',
    lowerSeedClubId: 'b4', bestOf: 7 });
  const final = plan('north-america-final', 'a4', 'b4', 7);
  expect(resolveNorthAmericaPostseason(policy, conferenceAlignment,
    divisionAlignment, completedConferences, { plan: final, results: wins(final, 'b4') }))
    .toMatchObject({ status: 'COMPLETE', championClubId: 'b4',
      runnerUpClubId: 'a4' });
});
