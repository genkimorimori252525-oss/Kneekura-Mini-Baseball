import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { openSqliteRegionalNationalRankingSnapshotStore } from './SqliteRegionalNationalRankingSnapshotStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { regionalNationalInput } from './RegionalNationalFixtures.test-support';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, registerWorldNationalRankingPolicy,
  type WorldNationalRankingHistory } from '../../core/world/competition/WorldNationalRankingHistory';

it('pins regional policy and Nation evidence while excluding unrelated World results and future regional source reads', () => {
  const path = `file:regional-ranking-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const nations = openSqliteNationCompetitionRegionStore(path);
  for (const nationId of ['A', 'B', 'C']) nations.record({ careerId: 'career-a', nationId,
    region: 'EUROPE', effectiveFromDay: 0, sourceEventId: nationId });
  // Official history callback is a fixture; the four-region Match integration exercises the actual Native owner.
  let history: WorldNationalRankingHistory = { editions: [{ editionId: 'eu-1', tier: 'REGIONAL',
    completedAtDay: 10, snapshotId: 'accepted-eu-1', games: [{ applicationId: 'eu-final', stage: 'FINAL',
      homeNationId: 'A', awayNationId: 'B', winnerNationId: 'A' }] }] };
  const policy = { version: 'regional-v1', winPoints: 2, tiePoints: 1,
    tierWeights: { REGIONAL: 1, WBC: 0, PREMIER_12: 0 },
    stageWeights: { GROUP: 1, ROUND_OF_16: 1, QUARTERFINAL: 2, SEMIFINAL: 3, BRONZE: 1, FINAL: 4 },
    recencyBands: [{ maxAgeDays: 100, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
  const registry = registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, policy);
  let edition = { ...regionalNationalInput('EUROPE', 2, { startsOnDay: 1, endsOnDay: 10 }).edition, editionId: 'eu-1' };
  const sources = { nations, history: { readHistory: () => history,
    readRegionalEdition: (_careerId: string, editionId: string) => editionId === edition.editionId ? edition : null } };
  let store = openSqliteRegionalNationalRankingSnapshotStore(path, sources);
  try {
    const request = { careerId: 'career-a', region: 'EUROPE' as const, asOfDay: 30, nationIds: ['A', 'B', 'C'], policy, registry };
    const saved = store.initialize(request);
    expect(saved.ranking.orderedNationIds).toEqual(['A', 'B', 'C']);
    history = { editions: [...history.editions,
      { editionId: 'world-1', tier: 'WBC', completedAtDay: 30, snapshotId: 'accepted-world-1', games: [
        { applicationId: 'world-final', stage: 'FINAL', homeNationId: 'A', awayNationId: 'B', winnerNationId: 'B' }] },
      { editionId: 'eu-future', tier: 'REGIONAL', completedAtDay: 50, snapshotId: 'future-proof', games: [
        { applicationId: 'future-final', stage: 'FINAL', homeNationId: 'FUTURE_ONLY', awayNationId: 'B', winnerNationId: 'B' }] }] };
    nations.record({ careerId: 'career-a', nationId: 'B', region: 'AMERICAS', effectiveFromDay: 31, sourceEventId: 'B-moved' });
    store.close(); store = openSqliteRegionalNationalRankingSnapshotStore(path, sources);
    expect(store.readSnapshot('career-a', 'EUROPE', 30)).toEqual(saved);
    expect(store.initialize({ ...request, asOfDay: 31, nationIds: ['A', 'C'] }).ranking.orderedNationIds).toEqual(['A', 'C']);
    const changedPolicy = { ...policy, winPoints: 3 };
    expect(() => store.initialize({ ...request, asOfDay: 32, nationIds: ['A', 'C'], policy: changedPolicy,
      registry: registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, changedPolicy) })).toThrow('policy is frozen differently');
    expect(store.readSnapshot('career-a', 'EUROPE', 32)).toBeNull();
    const originalHistory = history;
    history = { editions: history.editions.map((edition, i) => i === 0
      ? { ...edition, games: [{ ...edition.games[0], winnerNationId: 'B' }] } : edition) };
    expect(() => store.readSnapshot('career-a', 'EUROPE', 30)).toThrow('corrupt');
    history = originalHistory;
    const originalEdition = edition;
    edition = { ...edition, calendarWindow: { ...edition.calendarWindow, startsOnDay: 2 } };
    expect(() => store.readSnapshot('career-a', 'EUROPE', 30)).toThrow('corrupt');
    edition = originalEdition;
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    try { db.prepare("UPDATE world_regional_national_ranking_snapshots SET snapshot_json='{}' WHERE as_of_day=30").run(); }
    finally { db.close(); }
    expect(() => store.readRanking('career-a', 'EUROPE', 30)).toThrow('corrupt');
  } finally { store.close(); nations.close(); }
});
