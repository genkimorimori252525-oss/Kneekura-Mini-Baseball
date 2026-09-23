import { expect, it } from 'vitest';
import type { CompetitionDraw } from './CompetitionDraw';
import { assignContinentalGroupHomeSeries,
  createHomeFairnessLedger } from './ContinentalHomeFairness';

const draw = (editionId: string): CompetitionDraw => ({
  editionId, drawPolicyVersion: 'draw-v1', drawSeed: 'draw-seed',
  relaxationOrder: ['REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY',
    'SAME_LEAGUE_AVOIDANCE'],
  groups: ['abcd', 'efgh', 'ijkl', 'mnop'].map((members,
    groupIndex) => [...members].map((teamId, index) => ({
      teamId, pot: index + 1,
      leagueId: `league-${groupIndex * 4 + index}`,
      regionId: `region-${groupIndex * 4 + index}`,
    }))),
  appliedConstraints: [], relaxedConstraints: [],
  softViolationCounts: { sameLeague: 0, sameRegion: 0, rematch: 0 },
});
const policy = { version: 'home-fairness-v1', recentEditionWeights: [1, 0.5] };

it('assigns three-game series with one or two home series per club and records history', () => {
  const initial = createHomeFairnessLedger('continental-a');
  const result = assignContinentalGroupHomeSeries({
    competitionId: 'continental-a', editionId: 'edition-1',
    editionOrdinal: 1, expectedRevision: 0, draw: draw('edition-1'),
    ledger: initial, policy,
  });
  expect(result.groups).toHaveLength(4);
  expect(result.drawSeed).toBe('draw-seed');
  expect(result.groupClubIds[0]).toEqual(['a', 'b', 'c', 'd']);
  expect(Object.isFrozen(result.groupClubIds[0])).toBe(true);
  for (const group of result.groups) {
    expect(group.series).toHaveLength(6);
    expect(group.series.every((series) => series.gamesPerSeries === 3)).toBe(true);
    expect(new Set(group.series.map((series) => series.seriesId)).size).toBe(6);
    expect([...group.homeSeriesCounts].map((entry) => entry.count).sort())
      .toEqual([1, 1, 2, 2]);
  }
  expect(result.ledger.revision).toBe(1);
  expect(result.ledger.history).toHaveLength(16);
  expect(result.ledger.policies).toEqual([policy]);
  expect(Object.isFrozen(result.ledger.policies[0].recentEditionWeights)).toBe(true);
  expect(initial.history).toHaveLength(0);
  expect(Object.isFrozen(result.ledger.history)).toBe(true);
});

it('uses recent participation to reverse prior home imbalance without granting an entitlement', () => {
  const initial = createHomeFairnessLedger('continental-a');
  const first = assignContinentalGroupHomeSeries({
    competitionId: 'continental-a', editionId: 'edition-1',
    editionOrdinal: 1, expectedRevision: 0, draw: draw('edition-1'),
    ledger: initial, policy,
  });
  const secondInput = { competitionId: 'continental-a',
    editionId: 'edition-2', editionOrdinal: 2, expectedRevision: 1,
    draw: draw('edition-2'), ledger: first.ledger, policy };
  const second = assignContinentalGroupHomeSeries(secondInput);
  expect(assignContinentalGroupHomeSeries(secondInput)).toEqual(second);
  for (const firstEntry of first.ledger.history) {
    const secondEntry = second.ledger.history.find((entry) =>
      entry.editionId === 'edition-2' && entry.clubId === firstEntry.clubId)!;
    expect(secondEntry.homeSeriesCount).toBe(3 - firstEntry.homeSeriesCount);
  }
  expect(second.groups.every((group) => group.fairnessCost === 0)).toBe(true);
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    expectedRevision: 0 })).toThrow('revision');
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    policy: { ...policy, recentEditionWeights: [-1] } })).toThrow('policy');
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    policy: { ...policy, recentEditionWeights: [0.5] } }))
    .toThrow('version conflicts');
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    draw: draw('wrong') })).toThrow('edition');
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    ledger: { ...first.ledger, history: first.ledger.history.slice(1) } }))
    .toThrow('history');
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    ledger: { ...first.ledger, history: first.ledger.history.map((entry) =>
      ({ ...entry, homeSeriesCount: 2 as const })) } }))
    .toThrow('history');
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    draw: { ...draw('edition-2'), groups: draw('edition-2').groups.slice(0, 2) } }))
    .toThrow('four groups');
  expect(() => assignContinentalGroupHomeSeries({ ...secondInput,
    competitionId: 'another-competition' })).toThrow('competition');
  const mutable = structuredClone(first.ledger);
  const detached = assignContinentalGroupHomeSeries({ ...secondInput,
    ledger: mutable });
  const originalCount = detached.ledger.history[0].homeSeriesCount;
  (mutable.history[0] as { homeSeriesCount: 1 | 2 }).homeSeriesCount =
    originalCount === 1 ? 2 : 1;
  (mutable.policies[0].recentEditionWeights as number[])[0] = 0;
  expect(detached.ledger.history[0].homeSeriesCount).toBe(originalCount);
  expect(detached.ledger.policies[0].recentEditionWeights[0]).toBe(1);
});
