import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeSelectedWbcGlobalQualifier,
  finalizeWbcGlobalQualifier, planSelectedWbcGlobalQualifier,
  planWbcGlobalQualifier,
  type WbcGlobalQualifierEdition, type WbcQualifierGame }
  from './WbcGlobalQualifierPods';
import type { WbcQualifierSelection }
  from './WbcGlobalQualifierSelection';
import { createNationalQualificationHistory,
  latestWbcQualifierPodWinner, recordWbcGlobalQualifier }
  from './NationalQualificationHistory';

const regions = ['ASIA_PACIFIC', 'AMERICAS',
  'EUROPE', 'AFRICA'] as const;
const edition: WbcGlobalQualifierEdition = {
  competitionId: 'wbc-global-qualifier',
  editionId: 'qualifier-2032',
  canonicalRole: 'WBC_GLOBAL_QUALIFIER',
  formatVersion: 'four-pods-v1', ruleProfileVersion: 'wbc-rules-v1',
  gamePolicyVersion: 'knockout-v1',
  hostingPolicyVersion: 'pod-hosts-v1',
  qualificationSnapshotId: 'qualified-16', drawSnapshotId: 'draw-16',
  calendarWindow: { startsOnDay: 40, endsOnDay: 50 },
  pods: Array.from({ length: 4 }, (_, podIndex) => ({ podIndex,
    hostNationId: `host-${podIndex}`,
    hostCityId: `city-${podIndex}`,
    hostVenueId: `venue-${podIndex}`,
    entrants: regions.map((region) => ({
      nationId: `${region}-${podIndex}`, region })) })),
};
const selection: WbcQualifierSelection = {
  qualifierEditionId: edition.editionId,
  directSnapshotId: 'direct-20',
  rankingSnapshotId: 'national-ranking',
  eligibilitySnapshotId: 'eligible-16',
  policyVersion: 'qualifier-selection-v1',
  qualificationSnapshotId: edition.qualificationSnapshotId,
  entrants: edition.pods.flatMap((pod) => pod.entrants.map((entrant) =>
    ({ ...entrant, route: 'REGIONAL_PRIORITY' as const,
      sourceId: 'regional-placement' }))),
};
const result = (game: WbcQualifierGame,
  index: number): OfficialGameResult => ({
  gameId: game.gameId, seasonId: edition.editionId,
  homeClubId: game.homeNationId, awayClubId: game.awayNationId,
  homeRuns: 2, awayRuns: 1, winnerClubId: game.homeNationId,
  completionReason: 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId(edition.ruleProfileVersion),
  gamePolicyVersion: edition.gamePolicyVersion,
  closureId: `closure-${index}`,
  applicationId: `application-${index}`,
  durableRevision: index + 1,
  venueBinding: { gameId: game.gameId, venueId: game.venueId,
    fixtureEventId: `fixture-${index}`, fixtureRevision: 1 },
  lineScore: { innings: [{ inning: 1, homeRuns: 2,
    awayRuns: 1 }], totals: {
    home: { runs: 2, hits: 0, errors: 0 },
    away: { runs: 1, hits: 0, errors: 0 } } },
});

it('qualifies four nations after exactly twelve official pod games', () => {
  const plan = planWbcGlobalQualifier(edition);
  expect(planSelectedWbcGlobalQualifier(edition, selection))
    .toEqual(plan);
  expect(() => planSelectedWbcGlobalQualifier(edition, {
    ...selection, entrants: selection.entrants.map((entrant,
      index) => index === 0 ? { ...entrant, nationId: 'foreign' }
      : entrant),
  })).toThrow('selected entrants');
  expect(plan.pods).toHaveLength(4);
  expect(plan.pods.flatMap((pod) => pod.semifinals)).toHaveLength(8);
  const semifinals = plan.pods.flatMap((pod) => pod.semifinals)
    .map(result);
  const finals = plan.pods.map((pod, index) => result({
    gameId: pod.finalGameId, podIndex: index,
    homeNationId: semifinals[index * 2].winnerClubId!,
    awayNationId: semifinals[index * 2 + 1].winnerClubId!,
    venueId: pod.hostVenueId }, index + 8));
  const outcome = finalizeWbcGlobalQualifier(plan,
    semifinals, finals, edition);
  expect(finalizeSelectedWbcGlobalQualifier(plan,
    semifinals, finals, edition, selection)).toEqual(outcome);
  expect(outcome.winners.map((winner) => winner.nationId))
    .toEqual(['ASIA_PACIFIC-0', 'ASIA_PACIFIC-1',
      'ASIA_PACIFIC-2', 'ASIA_PACIFIC-3']);
  expect(outcome.resultApplicationIds).toHaveLength(12);
  expect(outcome.winners.every((winner) =>
    winner.finalizedDay === 50)).toBe(true);
  const history = createNationalQualificationHistory({
    ASIA_PACIFIC: 'regional-ap', AMERICAS: 'regional-am',
    EUROPE: 'regional-eu', AFRICA: 'regional-af',
  });
  const recorded = recordWbcGlobalQualifier(history,
    edition, selection, semifinals, finals);
  expect(latestWbcQualifierPodWinner(recorded, 0, 49)).toBeNull();
  expect(latestWbcQualifierPodWinner(recorded, 0, 50))
    .toEqual(outcome.winners[0]);
  expect(() => recordWbcGlobalQualifier(recorded,
    edition, selection, semifinals, finals)).toThrow('already recorded');
  expect(() => finalizeWbcGlobalQualifier(plan, semifinals,
    [{ ...finals[0], applicationId: semifinals[0].applicationId },
      ...finals.slice(1)], edition)).toThrow('unique');
  expect(() => finalizeWbcGlobalQualifier(plan, semifinals,
    [{ ...finals[0], venueBinding: { ...finals[0].venueBinding!,
      venueId: 'different' } }, ...finals.slice(1)], edition))
    .toThrow('venue-bound');
  const forged = structuredClone(plan);
  (forged.pods[0].semifinals[0] as { homeNationId: string })
    .homeNationId = 'foreign';
  expect(() => finalizeWbcGlobalQualifier(forged,
    semifinals, finals, edition)).toThrow('plan');
});

it('requires mixed pods and all four regions in the edition draw', () => {
  const wrongPod = structuredClone(edition);
  (wrongPod.pods[0].entrants[1] as { region: string }).region =
    'ASIA_PACIFIC';
  (wrongPod.pods[0].entrants[2] as { region: string }).region =
    'ASIA_PACIFIC';
  (wrongPod.pods[0].entrants[3] as { region: string }).region =
    'ASIA_PACIFIC';
  expect(() => planWbcGlobalQualifier(wrongPod)).toThrow('mixed-region');
  const duplicate = structuredClone(edition);
  (duplicate.pods[1].entrants[0] as { nationId: string }).nationId =
    duplicate.pods[0].entrants[0].nationId;
  expect(() => planWbcGlobalQualifier(duplicate)).toThrow('distinct');
});
