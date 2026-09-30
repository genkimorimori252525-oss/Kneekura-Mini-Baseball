import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import type { WorldNationalRankingHistory } from '../../core/world/competition/WorldNationalRankingHistory';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore, type NationalCompetitionSelection } from
  './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { openSqliteNationalHostCandidateStore } from './SqliteNationalHostCandidateStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';

const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');

it('rejects self-referential hosting history before following the Edition owner and validates saved sources', () => {
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { closables.push(store); return store; };
  try {
    const cycle = track(openSqliteWorldCompetitionCycleStore(':memory:'));
    cycle.initialize('career-1', worldCycleInput(0));
    const selections = track(openSqliteNationalCompetitionSelectionStore(':memory:', { cycle }));
    const selection = selections.initialize({ careerId: 'career-1', editionId: 'wbc-2032', kind: 'WBC',
      cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 400 });
    const nations = track(openSqliteNationCompetitionRegionStore(':memory:'));
    nations.record({ careerId: 'career-1', nationId: 'US', region: 'AMERICAS', effectiveFromDay: 0, sourceEventId: 'us-region' });
    const infrastructure = track(openSqliteWorldHostInfrastructureStore(':memory:', { nations }));
    const metrics = { stadiumCapacity: 10000, stadiumQuality: 50, transportQuality: 50,
      accommodationCapacity: 10000, broadcastReadiness: 50, operationsQuality: 50 };
    for (let index = 0; index < 6; index++) infrastructure.record({ careerId: 'career-1', nationId: 'US',
      venueId: `venue-${index}`, cityId: `city-${index}`, region: 'AMERICAS', effectiveFromDay: 0,
      sourceEventId: `venue-${index}-opened`, sourceClubId: null, licensed: true, safe: true, metrics });
    let history: WorldNationalRankingHistory = { editions: [] };
    let invalidPredecessor: NationalCompetitionSelection | null = null;
    let editionReads = 0;
    const path = `file:host-candidates-${crypto.randomUUID()}?mode=memory&cache=shared`;
    const store = track(openSqliteNationalHostCandidateStore(path, { selections: {
      readSelection: (careerId: string, editionId: string) => editionId === 'invalid-predecessor'
        ? invalidPredecessor : selections.readSelection(careerId, editionId) }, infrastructure,
      history: { readHistory: () => history }, editions: { readSnapshot: () => {
        editionReads++; throw new Error('Edition owner must not be followed');
      } } }));
    const policy = { version: 'test-hosts-v1', kind: 'WBC' as const, knockoutHubCount: 2,
      minimums: { GROUP: metrics, KNOCKOUT: metrics, FINAL_FOUR: metrics },
      suitabilityWeights: { ...metrics, stadiumCapacity: 0, accommodationCapacity: 0 },
      rotation: { lookbackDays: 1000, cityPenalty: 1, nationPenalty: 1, regionPenalty: 1 } };
    const saved = store.initialize({ careerId: 'career-1', editionId: selection.editionId, policy });
    expect(() => store.readCandidates('career-1', selection.editionId, 401)).toThrow('cutoff differs');
    history = { editions: [{ editionId: selection.editionId, tier: 'WBC', completedAtDay: 100,
      snapshotId: 'invalid-self-completion', games: [] }] };
    expect(() => store.readCandidates('career-1', selection.editionId, 400)).toThrow('corrupt');
    expect(editionReads).toBe(0);
    for (const cutoffDay of [400, 401, 200]) {
      invalidPredecessor = { ...selection, editionId: 'invalid-predecessor',
        qualificationCutoff: { ...selection.qualificationCutoff, day: cutoffDay },
        calendarWindow: { startsOnDay: 210, endsOnDay: 290 } };
      history = { editions: [{ editionId: 'invalid-predecessor', tier: 'WBC',
        completedAtDay: 300, snapshotId: 'invalid-predecessor-completion', games: [] }] };
      expect(() => store.readCandidates('career-1', selection.editionId, 400)).toThrow('corrupt');
      expect(editionReads).toBe(0);
    }
    history = { editions: [] };
    expect(store.readCandidates('career-1', selection.editionId, 400)).toEqual(saved);
    const db = new DatabaseSync(path);
    try {
      db.prepare("UPDATE world_national_host_candidates SET snapshot_json='{}'").run();
      expect(() => store.readCandidates('career-1', selection.editionId, 400)).toThrow('corrupt');
    } finally { db.close(); }
  } finally { closables.reverse().forEach((store) => store.close()); }
});
