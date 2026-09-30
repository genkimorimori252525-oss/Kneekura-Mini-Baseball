import { expect, it } from 'vitest';
import { planPremierTwelveGroups, type PremierTwelveEdition } from './PremierTwelve';
import { planPremierTwelveSchedule } from './PremierTwelveSchedule';

const nationIds = Array.from({ length: 12 }, (_, index) => `nation-${index}`);
const edition: PremierTwelveEdition = {
  competitionId: 'premier', editionId: 'edition', canonicalRole: 'PREMIER_12',
  formatVersion: 'format', ruleProfileVersion: 'rules', gamePolicyVersion: 'games',
  rankingPolicyVersion: 'ranking-policy', qualificationCutoffSnapshotId: 'cutoff',
  rankingSnapshotId: 'ranking', drawSnapshotId: 'draw', hostingPolicyVersion: 'hosting',
  tiebreakPolicy: { version: 'ties', tieCreditNumerator: 0,
    tieCreditDenominator: 1, runDifferentialCapPerGame: 5 },
  finalFourPairingPolicy: { version: 'pairing', semifinalPairs: [[0, 3], [1, 2]] },
  hostNationIds: ['nation-0'],
  groupHosts: [0, 1].map((groupIndex) => ({ groupIndex, nationId: 'nation-0',
    cityId: `city-${groupIndex}`, venueId: `venue-${groupIndex}` })),
  finalFourHost: { nationId: 'nation-0', cityId: 'final-city', venueId: 'final-venue' },
  groups: [0, 1].map((groupIndex) => ({ groupIndex,
    nationIds: nationIds.slice(groupIndex * 6, groupIndex * 6 + 6) })),
  calendarWindow: { startsOnDay: 110, endsOnDay: 125 },
};
const plan = planPremierTwelveGroups(edition, {
  editionCutoff: () => ({ snapshotId: 'cutoff', day: 100 }),
  worldNationalRanking: () => ({ snapshotId: 'ranking', policyVersion: 'ranking-policy',
    asOfDay: 100, orderedNationIds: nationIds, evidenceResultIds: ['result'] }),
});
const policy = { version: 'schedule-test-v1', gamesPerVenuePerDay: 3,
  minimumOffDaysBetweenRounds: 1 };

it('schedules all 34 fixtures with no repeated daily nation and protected round rest', () => {
  const schedule = planPremierTwelveSchedule(edition, plan, policy);
  expect(planPremierTwelveSchedule(edition, plan, policy)).toEqual(schedule);
  expect(schedule.games).toHaveLength(34);
  expect(new Set(schedule.games.map((game) => game.gameId)).size).toBe(34);
  const groupGames = plan.groups.flatMap((group) => group.games);
  expect(schedule.games.filter((game) => game.stage === 'GROUP')
    .map((game) => game.gameId).sort()).toEqual(groupGames.map((game) => game.gameId).sort());
  for (const nationId of nationIds) {
    const days = schedule.games.filter((slot) => groupGames.some((game) =>
      game.gameId === slot.gameId && [game.homeNationId, game.awayNationId].includes(nationId)))
      .map((slot) => slot.gameDay).sort((left, right) => left - right);
    expect(days).toEqual([110, 112, 114, 116, 118]);
  }
  expect(schedule.games.filter((game) => game.stage === 'SEMIFINAL')
    .map((game) => game.gameDay)).toEqual([120, 120]);
  expect(schedule.games.filter((game) => ['BRONZE', 'FINAL'].includes(game.stage))
    .map((game) => game.gameDay)).toEqual([122, 122]);
  for (const slot of schedule.games) {
    expect(slot.venueGameOrdinal).toBeLessThan(policy.gamesPerVenuePerDay);
    expect(slot.gameDay).toBeGreaterThanOrEqual(110);
    expect(slot.gameDay).toBeLessThanOrEqual(125);
  }
  const limited = planPremierTwelveSchedule({ ...edition,
    calendarWindow: { startsOnDay: 110, endsOnDay: 145 } }, plan,
  { ...policy, gamesPerVenuePerDay: 1 });
  expect(new Set(limited.games.map((game) => [game.gameDay, game.venueId].join(':'))).size)
    .toBe(34);
});

it('rejects insufficient windows, invalid policies and changed group provenance', () => {
  expect(() => planPremierTwelveSchedule({ ...edition,
    calendarWindow: { startsOnDay: 110, endsOnDay: 121 } }, plan, policy))
    .toThrow('window cannot contain');
  for (const bad of [{ ...policy, gamesPerVenuePerDay: 0 },
    { ...policy, minimumOffDaysBetweenRounds: -1 }, { ...policy, version: '' }]) {
    expect(() => planPremierTwelveSchedule(edition, plan, bad)).toThrow('policy');
  }
  expect(() => planPremierTwelveSchedule(edition, { ...plan, drawSnapshotId: 'changed' }, policy))
    .toThrow('group plan');
  expect(() => planPremierTwelveSchedule(edition, { ...plan,
    groups: [{ ...plan.groups[0], games: plan.groups[0].games.slice(1) }, plan.groups[1]] }, policy))
    .toThrow('group plan');
});
