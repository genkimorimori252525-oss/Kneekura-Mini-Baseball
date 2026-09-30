import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as candidateModule from './SqliteRegionalNationalHostCandidateStore';
import { selectRegionalNationalHosts } from '../../core/world/competition/RegionalNationalHosting';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWorldHostInfrastructureStore } from './SqliteWorldHostInfrastructureStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { regionalNationalInput } from './RegionalNationalFixtures.test-support';
import type { WorldNationalRankingHistory } from '../../core/world/competition/WorldNationalRankingHistory';

it('replays dated public facilities, cutoff membership and earlier regional rotation without a current-Edition cycle', () => {
  expect(candidateModule).toHaveProperty('openSqliteRegionalNationalHostCandidateStore');
  const path = `file:regional-host-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const cycle = openSqliteWorldCompetitionCycleStore(path);
  cycle.initialize('career-a', worldCycleInput(0)); cycle.initialize('career-a', worldCycleInput(1));
  const selections = openSqliteNationalCompetitionSelectionStore(path, { cycle });
  const previous = selections.initialize({ careerId: 'career-a', editionId: 'eu-2031', kind: 'REGIONAL_NATIONAL',
    region: 'EUROPE', cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 100 });
  const selection = selections.initialize({ careerId: 'career-a', editionId: 'eu-2035', kind: 'REGIONAL_NATIONAL',
    region: 'EUROPE', cycleOrdinal: 1, careerDayOne: '2031-01-01', cutoffDay: 1500 });
  const nations = openSqliteNationCompetitionRegionStore(path);
  for (const nationId of ['A', 'B', 'MOVED']) nations.record({ careerId: 'career-a', nationId, region: 'EUROPE',
    effectiveFromDay: 0, sourceEventId: `${nationId}-region` });
  const infrastructure = openSqliteWorldHostInfrastructureStore(path, { nations });
  const metrics = { stadiumCapacity: 100, stadiumQuality: 10, transportQuality: 10,
    accommodationCapacity: 100, broadcastReadiness: 10, operationsQuality: 10 };
  for (const [nationId, score] of [['A', 100], ['B', 70], ['MOVED', 1000]] as const) for (let i = 0; i < 2; i++) {
    infrastructure.record({ careerId: 'career-a', venueId: `${nationId}-${i}`, nationId, cityId: `city-${nationId}-${i}`,
      region: 'EUROPE', effectiveFromDay: 10, sourceEventId: `opened-${nationId}-${i}`, sourceClubId: null,
      licensed: true, safe: true, metrics: { ...metrics, stadiumQuality: score - i, broadcastReadiness: i === 0 ? 30 : 10 } });
  }
  infrastructure.record({ careerId: 'career-a', venueId: 'A-final', nationId: 'A', cityId: 'city-A-final',
    region: 'EUROPE', effectiveFromDay: 10, sourceEventId: 'opened-A-final', sourceClubId: null,
    licensed: true, safe: true, metrics: { ...metrics, stadiumQuality: 20, broadcastReadiness: 30 } });
  nations.record({ careerId: 'career-a', nationId: 'MOVED', region: 'AMERICAS', effectiveFromDay: 1400, sourceEventId: 'MOVED-left' });
  let priorEdition = { ...regionalNationalInput('EUROPE', 2, previous.calendarWindow).edition,
    editionId: previous.editionId, hostNationIds: ['A'], groups: regionalNationalInput('EUROPE', 2, previous.calendarWindow).edition.groups
      .map((group, i) => ({ ...group, hostNationId: 'A', hostCityId: `city-A-${i}`, hostVenueId: `A-${i}` })) };
  let history: WorldNationalRankingHistory = { editions: [{ editionId: previous.editionId, tier: 'REGIONAL',
    completedAtDay: previous.calendarWindow.endsOnDay, snapshotId: 'prior-official-regional-proof', games: [
      { applicationId: 'prior-final', stage: 'FINAL', homeNationId: 'A', awayNationId: 'B', winnerNationId: 'A' }] }] };
  const priorKnockout = { ...regionalNationalInput('EUROPE', 2, previous.calendarWindow).knockoutEdition,
    editionId: previous.editionId, openingVenueIds: ['A-0', 'A-1'], semifinalVenueIds: ['A-0', 'A-1'], finalVenueId: 'A-final' };
  // Previous official Match/Edition callbacks are fixtures here; public facilities/calendar/Nation owners are Native.
  const sources = { selections, nations, infrastructure, history: { readHistory: () => history,
    readRegionalEdition: (_careerId: string, editionId: string) => {
      if (editionId !== previous.editionId) throw new Error('current/later metadata must not be followed');
      return priorEdition;
    },
    readRegionalHostingEdition: (_careerId: string, editionId: string) => {
      if (editionId !== previous.editionId) throw new Error('current/later metadata must not be followed');
      return { edition: priorEdition, knockoutEdition: priorKnockout };
    } } };
  const policy = { version: 'regional-host-fixture-v1', hostNationCount: 1 as const, groupHostVenueCount: 2, knockoutHubCount: 1,
    minimums: { GROUP: metrics, KNOCKOUT: { ...metrics, broadcastReadiness: 20 }, FINAL_FOUR: { ...metrics, broadcastReadiness: 30 } },
    suitabilityWeights: { ...metrics, stadiumCapacity: 0, stadiumQuality: 1, transportQuality: 0, accommodationCapacity: 0,
      broadcastReadiness: 0, operationsQuality: 0 }, rotation: { lookbackDays: 2000, cityPenalty: 0, nationPenalty: 100, regionPenalty: 0 } };
  const request = { careerId: 'career-a', editionId: selection.editionId, policy };
  let candidates = candidateModule.openSqliteRegionalNationalHostCandidateStore(path, sources);
  try {
    const accepted = candidates.initialize(request);
    expect(accepted.groupCandidates.filter((item) => item.nationId === 'MOVED').every((item) => !item.eligible)).toBe(true);
    expect(accepted.source.venues.find((item) => item.nationId === 'MOVED')?.region).toBe('AMERICAS');
    expect(accepted.source.nationRegions.find((item) => item.nationId === 'MOVED')?.region).toBe('AMERICAS');
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const rawDb = new DatabaseSync(path);
    try {
      const event = rawDb.prepare('SELECT event_json FROM world_host_venue_events WHERE venue_id=?').get('MOVED-0') as { event_json: string };
      expect(JSON.parse(event.event_json).region).toBe('EUROPE');
    } finally { rawDb.close(); }
    expect(selectRegionalNationalHosts(accepted).hostNationIds).toEqual(['B']);
    expect(accepted.source.hostingHistory[0].hosts.map((item) => item.venueId)).toEqual(['A-0', 'A-1', 'A-final']);
    expect(candidates.initialize(request)).toEqual(accepted);
    expect(() => candidates.initialize({ ...request, policy: { ...policy, hostNationCount: 2 } })).toThrow('frozen differently');
    nations.record({ careerId: 'career-a', nationId: 'B', region: 'AMERICAS', effectiveFromDay: 1501, sourceEventId: 'B-later-moved' });
    const originalHistory = history;
    history = { editions: [...history.editions, { ...history.editions[0], editionId: 'future-only', completedAtDay: 1501 }] };
    candidates.close(); candidates = candidateModule.openSqliteRegionalNationalHostCandidateStore(path, sources);
    expect(candidates.readCandidates('career-a', selection.editionId, 1500)).toEqual(accepted);
    expect(() => candidates.readCandidates('career-a', selection.editionId, 1501)).toThrow('cutoff differs');
    history = { editions: [...originalHistory.editions, { ...originalHistory.editions[0], editionId: selection.editionId, completedAtDay: 1500 }] };
    try {
      candidates.readCandidates('career-a', selection.editionId, 1500);
      expect.fail('current Edition must be rejected before following its metadata Source');
    } catch (error) {
      expect((error as Error).message).toContain('corrupt');
      expect(((error as Error).cause as Error).message).toContain('accepted completed predecessor at cutoff');
    }
    history = originalHistory;
    const originalEdition = priorEdition;
    priorEdition = { ...priorEdition, drawSnapshotId: 'same-hosts-forked-edition-proof' };
    expect(() => candidates.readCandidates('career-a', selection.editionId, 1500)).toThrow('corrupt');
    priorEdition = originalEdition;
    expect(candidates.readCandidates('career-a', selection.editionId, 1500)).toEqual(accepted);
    const db = new DatabaseSync(path);
    try { db.prepare("UPDATE world_regional_national_host_candidates SET snapshot_json='{}'").run(); }
    finally { db.close(); }
    expect(() => candidates.readCandidates('career-a', selection.editionId, 1500)).toThrow('corrupt');
  } finally { candidates.close(); infrastructure.close(); nations.close(); selections.close(); cycle.close(); }
});
