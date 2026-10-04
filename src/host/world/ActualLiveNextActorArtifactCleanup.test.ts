import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync as Database } from 'node:sqlite';

const state = vi.hoisted(() => ({
  failAt: '',
  open: null as null | ((name: string, path: string) => { db: Database; close(): void }),
}));
const ready = vi.hoisted(() => ({ kind: 'ready', reference: { sourceId: 'closure' }, closure: { proposal: {
  gameId: 'game', playId: 1, actors: [{ binding: { careerId: 'career', competitionEditionId: 'season', gameDay: 1, fixtureEventId: 'fixture' } }],
  seasonFixture: { game: { homeClubId: 'home', awayClubId: 'away' } }, application: { applicationId: 'application' },
  scoring: { kind: 'unsupported' }, expectedOfficial: { nextWorld: { tick: 4, runners: [] } },
} } }));
vi.mock('../SqliteOfficialStateStore', () => ({ SqliteOfficialStateStore: function(path: string) { return state.open!('official', path); } }));
vi.mock('./SqliteOfficialParticipationStore', () => ({ SqliteOfficialParticipationStore: function(path: string) { return state.open!('participation', path); } }));
vi.mock('./SqlitePlayerPersonLinkStore', () => ({ openSqlitePlayerPersonLinkStore: (path: string) => state.open!('links', path) }));
vi.mock('./SqliteOfficialInitialWorldStore', () => ({ openSqliteOfficialInitialWorldStore: (path: string) => state.open!('initial-world', path) }));
vi.mock('./ActualLivePlayReadinessFromSqlite', () => ({ actualLivePlayReadinessFromSqlite: () => ({ read: () => ready }) }));
vi.mock('./PhysicalPlateAppearanceActorEvidenceFromSqlite', () => ({ actorJson: JSON.stringify }));
vi.mock('./SqlitePhysicalPlateAppearanceActorStore', () => ({ openSqlitePhysicalPlateAppearanceActorStore: (path: string) => {
  const resource = state.open!('actors', path);
  return { ...resource, accept: (sourceId: string) => {
    if (sourceId === 'fixture-wrong-activation') throw new Error('missing activation');
    resource.db.prepare('INSERT OR IGNORE INTO physical_plate_appearance_actors VALUES (?)').run(sourceId);
    return { source: { sourceId }, match: { playId: 2 }, origin: { scoringHash: null, actualLiveReadiness: ready.reference }, world: ready.closure.proposal.expectedOfficial.nextWorld };
  } };
} }));
vi.mock('./PhysicalPitchEvidenceFromSqlite', () => ({ readPhysicalPitchProgressFromSqlite: () => [{ frame: { workload: { careerId: 'career', playerId: 'pitcher' } }, source: { effortPolicy: {}, request: { delivery: {} } } }] }));
vi.mock('./SqlitePlayerWorkloadRecoveryStore', () => ({ openSqlitePlayerWorkloadRecoveryStore: (path: string) => ({ ...state.open!('workload', path), readHead: () => {
  if (state.failAt === 'head') throw new Error('injected head read failure');
  return { revision: 1 };
} }) }));
vi.mock('./SqlitePlayerPitchTimingStore', () => ({ openSqlitePlayerPitchTimingStore: (path: string) => state.open!('timing', path) }));
vi.mock('./SqlitePlayerReleaseGeometryStore', () => ({ openSqlitePlayerReleaseGeometryStore: (path: string) => state.open!('release', path) }));
vi.mock('./SqlitePitchFatiguePolicyStore', () => ({ openSqlitePitchFatiguePolicyStore: (path: string) => state.open!('policy', path) }));
vi.mock('./SqlitePhysicalPitchProgressStore', () => ({ openSqlitePhysicalPitchProgressStore: (path: string) => ({ ...state.open!('pitch', path), accept: () => { throw new Error('injected accept failure'); } }) }));

import { verifyActualLiveNextActorArtifact } from './ActualLiveNextActorArtifact.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let directory: string | null = null;
let resources: { name: string; db: Database; close: ReturnType<typeof vi.fn> }[] = [];
afterEach(() => {
  // Test teardown also closes leaked handles so a RED run cannot leave them live.
  for (const r of resources) { try { r.db.close(); } catch { /* already closed */ } }
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = null; resources = [];
});

describe('actual next-actor artifact cleanup (tiny disk; ownership is mocked only to reach injected failures)', () => {
  it.each(['timing', 'policy', 'head', 'pitch', 'accept'])('closes every already-opened owner exactly once after %s fails', async failAt => {
    directory = mkdtempSync(join(tmpdir(), 'actual-artifact-cleanup-'));
    const sourcePath = join(directory, 'source.sqlite'), destinationPath = join(directory, 'destination.sqlite');
    const source = new DatabaseSync(sourcePath);
    source.exec('PRAGMA journal_mode=WAL; CREATE TABLE physical_plate_appearance_actors(source_id TEXT PRIMARY KEY);'); source.close();
    state.failAt = failAt;
    state.open = (name, path) => {
      if (name === failAt) throw new Error(`injected ${name} constructor failure`);
      const db = new DatabaseSync(path), close = vi.fn(() => db.close());
      resources.push({ name, db, close }); return { db, close };
    };
    await expect(verifyActualLiveNextActorArtifact({ sourcePath, destinationPath, closureSourceId: 'closure', nextBatterPlayerId: 'away-2',
      faultChecks: false, executeNextPitch: true, nextTake: { action: { kind: 'take' }, plateZ: 0,
        strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } })).rejects.toThrow(/injected/);
    expect(resources.some(r => r.name === 'workload')).toBe(true);
    for (const r of resources) {
      expect(r.close, r.name).toHaveBeenCalledTimes(1);
      expect(() => r.db.prepare('SELECT 1'), r.name).toThrow();
    }
    const openFiles = readdirSync('/proc/self/fd').flatMap(fd => { try { return [readlinkSync(`/proc/self/fd/${fd}`)]; } catch { return []; } });
    expect(openFiles.filter(path => path.startsWith(directory!))).toEqual([]);
  });
});
