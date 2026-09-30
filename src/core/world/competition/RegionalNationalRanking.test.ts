import { expect, it } from 'vitest';
import { buildRegionalNationalRanking } from './RegionalNationalRanking';
import { registerWorldNationalRankingPolicy, EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY,
  type WorldNationalRankingHistory } from './WorldNationalRankingHistory';

const policy = { version: 'regional-v1', winPoints: 2, tiePoints: 1,
  tierWeights: { REGIONAL: 1, WBC: 0, PREMIER_12: 0 },
  stageWeights: { GROUP: 1, ROUND_OF_16: 1, QUARTERFINAL: 2, SEMIFINAL: 3, BRONZE: 1, FINAL: 4 },
  recencyBands: [{ maxAgeDays: 10, multiplier: 2 }, { maxAgeDays: 100, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
const registry = registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, policy);
const history: WorldNationalRankingHistory = { editions: [
  { editionId: 'eu-old', tier: 'REGIONAL', completedAtDay: 10, snapshotId: 'eu-old-proof', games: [
    { applicationId: 'old-final', stage: 'FINAL', homeNationId: 'A', awayNationId: 'B', winnerNationId: 'A' }] },
  { editionId: 'eu-new', tier: 'REGIONAL', completedAtDay: 29, snapshotId: 'eu-new-proof', games: [
    { applicationId: 'new-final', stage: 'FINAL', homeNationId: 'A', awayNationId: 'B', winnerNationId: 'B' }] },
  { editionId: 'wbc', tier: 'WBC', completedAtDay: 29, snapshotId: 'wbc-proof', games: [
    { applicationId: 'world-final', stage: 'FINAL', homeNationId: 'A', awayNationId: 'B', winnerNationId: 'A' }] },
  { editionId: 'africa', tier: 'REGIONAL', completedAtDay: 29, snapshotId: 'af-proof', games: [
    { applicationId: 'af-final', stage: 'FINAL', homeNationId: 'X', awayNationId: 'Y', winnerNationId: 'X' }] },
  { editionId: 'future', tier: 'REGIONAL', completedAtDay: 31, snapshotId: 'future-proof', games: [
    { applicationId: 'future-final', stage: 'FINAL', homeNationId: 'MISSING', awayNationId: 'B', winnerNationId: 'B' }] },
] };
const region = (nationId: string) => ['A', 'B', 'C'].includes(nationId) ? 'EUROPE' as const
  : ['X', 'Y'].includes(nationId) ? 'AFRICA' as const : null;
const sourceEdition = (editionId: string) => {
  if (editionId === 'future') throw new Error('future regional Edition source must not be read');
  const edition = history.editions.find((entry) => entry.editionId === editionId)!;
  return { editionId, region: editionId === 'africa' ? 'AFRICA' as const : 'EUROPE' as const,
    calendarWindow: { startsOnDay: edition.completedAtDay, endsOnDay: edition.completedAtDay } };
};

it('seeds only previous results in the requested region, with explicit recency and no World ranking substitution', () => {
  const ranking = buildRegionalNationalRanking(history, 'EUROPE', 30, ['C', 'A', 'B'], policy, registry, region, sourceEdition);
  expect(ranking).toMatchObject({ kind: 'REGIONAL_NATIONAL', region: 'EUROPE', asOfDay: 30,
    orderedNationIds: ['B', 'A', 'C'], evidenceResultIds: ['old-final', 'new-final'] });
  expect(Object.isFrozen(ranking.orderedNationIds)).toBe(true);
  expect(buildRegionalNationalRanking(history, 'EUROPE', 28, ['C', 'A', 'B'], policy, registry, region, sourceEdition).orderedNationIds)
    .toEqual(['A', 'B', 'C']);
  expect(() => buildRegionalNationalRanking({ editions: [history.editions[2]] }, 'EUROPE', 30,
    ['A', 'B'], policy, registry, region, sourceEdition)).toThrow('official regional results');
});

it('retains historical opponent evidence without ranking a Nation that changed region later', () => {
  const old = { editions: [history.editions[0]] };
  const moved = (nationId: string, day: number) => nationId === 'A' && day >= 20 ? 'AMERICAS' as const : region(nationId);
  const ranking = buildRegionalNationalRanking(old, 'EUROPE', 30, ['B', 'C'], policy, registry, moved, sourceEdition);
  expect(ranking.orderedNationIds).toEqual(['B', 'C']);
  expect(ranking.evidenceResultIds).toEqual(['old-final']);
  expect(() => buildRegionalNationalRanking(old, 'EUROPE', 30, ['A', 'B'], policy, registry, moved, sourceEdition)).toThrow('current Nation region');
  expect(() => buildRegionalNationalRanking(old, 'EUROPE', 30, ['B', 'C'], policy, registry,
    (nationId, day) => nationId === 'A' && day === 10 ? 'AMERICAS' : moved(nationId, day), sourceEdition)).toThrow('one historical region');
});

it('rejects unregistered policy, World-weighted policy and absent legal historical region proof', () => {
  expect(() => buildRegionalNationalRanking(history, 'EUROPE', 30, ['A', 'B'], policy,
    EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, region, sourceEdition)).toThrow('registered');
  const worldPolicy = { ...policy, version: 'world-v1', tierWeights: { REGIONAL: 1, WBC: 3, PREMIER_12: 1 } };
  const worldRegistry = registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, worldPolicy);
  expect(() => buildRegionalNationalRanking(history, 'EUROPE', 30, ['A', 'B'], worldPolicy, worldRegistry, region, sourceEdition)).toThrow('regional-only');
  expect(() => buildRegionalNationalRanking(history, 'EUROPE', 30, ['A', 'B'], policy, registry,
    (nationId, day) => day === 10 ? null : region(nationId), sourceEdition)).toThrow('historical');
});

it('uses accepted Edition start-day membership when a Nation moves region during the tournament', () => {
  const duringTournament: WorldNationalRankingHistory = { editions: [{ editionId: 'eu-during', tier: 'REGIONAL',
    completedAtDay: 30, snapshotId: 'eu-during-proof', games: [{ applicationId: 'during-final', stage: 'FINAL',
      homeNationId: 'A', awayNationId: 'B', winnerNationId: 'A' }] }] };
  const moved = (nationId: string, day: number) => nationId === 'A' && day >= 20 ? 'AMERICAS' as const : region(nationId);
  const ranking = buildRegionalNationalRanking(duringTournament, 'EUROPE', 40, ['B', 'C'], policy, registry, moved,
    () => ({ editionId: 'eu-during', region: 'EUROPE', calendarWindow: { startsOnDay: 10, endsOnDay: 30 } }));
  expect(ranking.orderedNationIds).toEqual(['B', 'C']);
  expect(ranking.evidenceResultIds).toEqual(['during-final']);
});
