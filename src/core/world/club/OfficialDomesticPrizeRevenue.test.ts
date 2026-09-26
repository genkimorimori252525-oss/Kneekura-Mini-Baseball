import { expect, it } from 'vitest';
import { createClubFromSeed } from './ClubSeed';
import { bootstrap } from './ClubFixtures.test-support';
import { resolveDomesticPostseason } from '../competition/DomesticPostseason';
import { finalizeDomesticCompetitionSeason } from '../competition/DomesticCompetitionSeason';
import { LEAGUE_PROFILES_V1 } from '../competition/LeagueProfiles';
import type { OfficialStandingsSnapshot } from '../competition/OfficialStandings';
import { applyOfficialDomesticPrizeRevenue } from './OfficialDomesticPrizeRevenue';

const profile = LEAGUE_PROFILES_V1.find((item) =>
  item.leagueId === 'league-005')!;
const clubs = ['club-a', ...Array.from({ length: profile.clubCount - 1 },
  (_, index) => `club-${index + 2}`)];
const standings: OfficialStandingsSnapshot = {
  seasonId: 'season-2026', leagueId: profile.leagueId,
  tiebreakPolicyVersion: 'standings-v1', scheduleRevisionEventIds: [],
  resultApplicationIds: Array.from({ length: 660 },
    (_, index) => `game-${index}`),
  tiebreakResolutions: [], orderedClubIds: clubs,
  unresolvedTieGroups: [], rows: clubs.map((clubId) => ({
    clubId, games: 110, wins: 55, losses: 55, ties: 0,
    runsFor: 300, runsAgainst: 300, cappedRunDifferential: 0,
  })),
};
const seasonInput = () => ({ profile, standings,
  outcome: { kind: 'direct' as const,
    state: resolveDomesticPostseason('TABLE_TITLE', standings, []) },
  qualificationPolicyVersion: 'qual-v1',
  competitionEditionId: 'continental-2027', berthCount: 2,
  alreadyQualifiedClubIds: [] as string[],
  eligibilityByClubId: Object.fromEntries(clubs.map((clubId) =>
    [clubId, { eligible: true }])),
});
const club = () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed, initial: {
    ...seed.initial, season: { ...seed.initial.season,
      competitionEditionIds: ['season-2026'],
      financialProfile: { ...seed.initial.season.financialProfile,
        leagueId: profile.leagueId },
    },
  } });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  return created.value;
};
const policy = { policyId: 'prize-policy-1', version: 'v1',
  careerId: 'career-a',
  leagueId: profile.leagueId, seasonId: 'season-2026',
  availableAtDay: 10, currency: 'SIM', awards: {
    DOMESTIC_CHAMPION: 300, RUNNER_UP: 100,
    REGULAR_SEASON_TITLE: 50,
  } };

it('records a calibrated prize from a recomputed official season snapshot', () => {
  const input = seasonInput();
  const snapshot = finalizeDomesticCompetitionSeason(input);
  const applied = applyOfficialDomesticPrizeRevenue(club(), input,
    snapshot, policy, 'DOMESTIC_CHAMPION', 'season-finalized-1', 20);
  expect(applied.state.live.finance.revenue.prizeMoney).toBe(300);
  expect(applied.event.command).toMatchObject({
    causeEventIds: ['season-finalized-1'],
    operations: [{ kind: 'RECORD_REVENUE', category: 'prizeMoney',
      amount: 300, currency: 'SIM' }],
  });
  expect(applied.basis).toMatchObject({ award: 'DOMESTIC_CHAMPION',
    recipientClubId: 'club-a', policyVersion: 'v1', amount: 300 });
  expect(() => applyOfficialDomesticPrizeRevenue(applied.state,
    input, snapshot, policy, 'DOMESTIC_CHAMPION',
    'season-finalized-1', 21)).toThrow('DUPLICATE_ID');
});

it('rejects a forged winner, wrong league, and future or mismatched policy', () => {
  const input = seasonInput();
  const snapshot = finalizeDomesticCompetitionSeason(input);
  expect(() => applyOfficialDomesticPrizeRevenue(club(), input,
    { ...snapshot, domesticChampionSnapshot: {
      ...snapshot.domesticChampionSnapshot, championClubId: clubs[1],
    } }, policy, 'DOMESTIC_CHAMPION', 'season-finalized-1', 20))
    .toThrow('snapshot');
  expect(() => applyOfficialDomesticPrizeRevenue(club(), input,
    snapshot, { ...policy, leagueId: 'other' },
    'DOMESTIC_CHAMPION', 'season-finalized-1', 20)).toThrow('policy');
  expect(() => applyOfficialDomesticPrizeRevenue(club(), input,
    snapshot, { ...policy, careerId: 'another-career' },
    'DOMESTIC_CHAMPION', 'season-finalized-1', 20)).toThrow('policy');
  expect(() => applyOfficialDomesticPrizeRevenue(club(), input,
    snapshot, { ...policy, availableAtDay: 21 },
    'DOMESTIC_CHAMPION', 'season-finalized-1', 20)).toThrow('policy');
  expect(() => applyOfficialDomesticPrizeRevenue(club(), input,
    snapshot, { ...policy, awards: { ...policy.awards,
      DOMESTIC_CHAMPION: -1 } },
    'DOMESTIC_CHAMPION', 'season-finalized-1', 20)).toThrow('policy');
});

it('keeps distinct award receipts and skips an absent runner-up', () => {
  const input = seasonInput();
  const snapshot = finalizeDomesticCompetitionSeason(input);
  const title = applyOfficialDomesticPrizeRevenue(club(), input,
    snapshot, policy, 'REGULAR_SEASON_TITLE', 'season-finalized-1', 20);
  const champion = applyOfficialDomesticPrizeRevenue(title.state, input,
    snapshot, policy, 'DOMESTIC_CHAMPION', 'season-finalized-1', 20);
  expect(champion.state.live.finance.revenue.prizeMoney).toBe(350);
  expect(champion.state.live.finance.receipts.map((receipt) =>
    receipt.receiptId)).toHaveLength(2);
  expect(() => applyOfficialDomesticPrizeRevenue(club(), input,
    snapshot, policy, 'RUNNER_UP', 'season-finalized-1', 20))
    .toThrow('recipient');
});
