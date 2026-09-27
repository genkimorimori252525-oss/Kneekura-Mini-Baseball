import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY,
  registerWorldNationalRankingPolicy,
  type WorldNationalRankingHistory } from
  '../../core/world/competition/WorldNationalRankingHistory';
import { openSqliteWorldNationalRankingSnapshotStore } from
  './SqliteWorldNationalRankingSnapshotStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');

const policy = { version: 'national-v1', winPoints: 2,
  tiePoints: 1, tierWeights: { REGIONAL: 1, WBC: 3,
    PREMIER_12: 2 },
  stageWeights: { GROUP: 1, ROUND_OF_16: 2,
    QUARTERFINAL: 3, SEMIFINAL: 4, BRONZE: 2,
    FINAL: 5 },
  recencyBands: [{ maxAgeDays: 100, multiplier: 1 }],
  tieBreak: 'NATION_ID' as const };
const registry = registerWorldNationalRankingPolicy(
  EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, policy);
const nationIds = Array.from({ length: 24 }, (_, index) =>
  `nation-${index + 1}`);
const history: WorldNationalRankingHistory = { editions: [{
  editionId: 'regional-1', tier: 'REGIONAL',
  completedAtDay: 30, snapshotId: 'regional-snapshot-1',
  games: [{ applicationId: 'official-1', stage: 'FINAL',
    homeNationId: nationIds[0], awayNationId: nationIds[1],
    winnerNationId: nationIds[0] }],
}] };

it('freezes a cutoff ranking and replays its official history', () => {
  const directory = mkdtempSync(join(tmpdir(), 'national-ranking-'));
  const path = join(directory, 'world.sqlite');
  let currentHistory = history;
  const sources = { history: { readHistory: () => currentHistory } };
  try {
    const store = openSqliteWorldNationalRankingSnapshotStore(path,
      sources);
    const request = { careerId: 'career-1', asOfDay: 30,
      nationIds, policy, registry };
    const ranking = store.initialize(request);
    expect(ranking.orderedNationIds[0]).toBe(nationIds[0]);
    expect(store.initialize(request)).toEqual(ranking);
    expect(store.authority('career-1').worldNationalRanking(30))
      .toEqual(ranking);
    expect(store.authority('career-1').worldNationalRanking(29))
      .toBeNull();
    expect(() => store.initialize({ ...request,
      nationIds: [...nationIds].reverse() }))
      .toThrow('frozen differently');
    store.close();
    const reopened = openSqliteWorldNationalRankingSnapshotStore(path,
      sources);
    expect(reopened.readRanking('career-1', 30)).toEqual(ranking);
    currentHistory = { editions: [{ ...history.editions[0],
      games: [{ ...history.editions[0].games[0],
        winnerNationId: nationIds[1] }] }] };
    expect(() => reopened.readRanking('career-1', 30))
      .toThrow('corrupt world national ranking snapshot');
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('rejects a changed stored ranking', () => {
  const directory = mkdtempSync(join(tmpdir(), 'national-ranking-'));
  const path = join(directory, 'world.sqlite');
  const sources = { history: { readHistory: () => history } };
  try {
    const store = openSqliteWorldNationalRankingSnapshotStore(path,
      sources);
    store.initialize({ careerId: 'career-1', asOfDay: 30,
      nationIds, policy, registry });
    store.close();
    const db = new DatabaseSync(path);
    db.prepare(`UPDATE world_national_ranking_snapshots
      SET ranking_json='{}' WHERE career_id='career-1'`).run();
    db.close();
    const reopened = openSqliteWorldNationalRankingSnapshotStore(path,
      sources);
    expect(() => reopened.readRanking('career-1', 30))
      .toThrow('corrupt world national ranking snapshot');
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
