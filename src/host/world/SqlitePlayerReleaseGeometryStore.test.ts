import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openSqlitePlayerReleaseGeometryStore } from
  './SqlitePlayerReleaseGeometryStore';

const directories: string[] = [];
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-release-source-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const path = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-release-source-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const body = { heightMeters: 1.8, shoulderHeightMeters: 1.5,
  armReachMeters: 0.8, postureDropMeters: 0.1,
  throwingSide: 'RIGHT' as const };
const profile = { armSlotClass: 'OVERHAND' as const,
  releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9,
  releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2,
  armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 };
const baseline = { sourceId: 'release-baseline-1', sourceVersion: 'v1',
  careerId: 'career-a', playerId: 'player-a',
  personLinkSourceId: 'intake-a', acceptedAtDay: 1, body, profile,
  tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
const change = { sourceId: 'release-change-1', sourceVersion: 'v1',
  careerId: 'career-a', playerId: 'player-a',
  causeEventId: 'accepted-form-rebuild-1', causeKind: 'FORM_REBUILD' as const,
  effectiveDay: 20, body,
  profile: { ...profile, releaseHeightRatio: 0.8,
    releaseHeightTier: 'HIGH_MID' as const } };
const laterChange = { ...change, sourceId: 'release-change-2',
  causeEventId: 'accepted-coaching-2',
  causeKind: 'COACHING_MECHANICAL_CHANGE' as const,
  effectiveDay: 30, profile };
const links = { readAcceptedPlayerPersonLink: (sourceId: string) =>
  sourceId === 'intake-a' ? {
    sourceId, careerId: 'career-a', playerId: 'player-a',
    personId: 'person-a', sourceRecordId: 'intake-record',
    sourceVersion: 'v1', acceptedRevision: 1,
    acceptedAtDay: 1, rosterRevision: 0,
  } : null };

it('pins a per-Player release position and replays explicit Career change after restart', () => {
  const databasePath = path();
  const source = openSqlitePlayerReleaseGeometryStore(databasePath,
    links, { readAcceptedBaseline: (id) => id === baseline.sourceId
      ? baseline : null,
    readAcceptedChange: (id) => id === change.sourceId
      ? change : id === laterChange.sourceId ? laterChange : null });
  expect(source.initialize(baseline.sourceId).revision).toBe(0);
  const mound = { x: 0, y: 0, z: 18 };
  expect(source.positionAtDay('career-a', 'player-a', 10, mound).x)
    .toBeCloseTo(0.08);
  expect(source.positionAtDay('career-a', 'player-a', 10, mound).y)
    .toBeCloseTo(1.52);
  expect(source.positionAtDay('career-a', 'player-a', 11, mound))
    .toEqual(source.positionAtDay('career-a', 'player-a', 10, mound));
  const changed = source.apply(change.sourceId, 0);
  expect(changed.revision).toBe(1);
  expect(source.selectAtDay('career-a', 'player-a', 19).profile)
    .toEqual(profile);
  expect(source.positionAtDay('career-a', 'player-a', 20, mound).y)
    .toBeCloseTo(1.34);
  expect(source.apply(change.sourceId, 0)).toEqual(changed);
  expect(() => source.apply(change.sourceId, 1)).toThrow('retry');
  const later = source.apply(laterChange.sourceId, 1);
  expect(source.apply(change.sourceId, 0)).toEqual(changed);
  expect(later.revision).toBe(2);
  source.close();
  const reopened = openSqlitePlayerReleaseGeometryStore(databasePath, links);
  expect(reopened.readHead('career-a', 'player-a')).toEqual(later);
  expect(reopened.positionAtDay('career-a', 'player-a', 20, mound).y)
    .toBeCloseTo(1.34);
  reopened.close();
});

it('rejects an unaccepted or physically impossible release source', () => {
  const databasePath = path();
  const source = openSqlitePlayerReleaseGeometryStore(databasePath,
    links, { readAcceptedBaseline: (id) => id === baseline.sourceId
      ? { ...baseline, profile: { ...profile,
        releaseHeightRatio: 1.4,
        releaseHeightTier: 'VERY_HIGH' as const } } : null,
    readAcceptedChange: () => null });
  expect(() => source.initialize('missing')).toThrow('accepted');
  expect(() => source.initialize(baseline.sourceId))
    .toThrow('reach envelope');
  expect(source.readHead('career-a', 'player-a')).toBeNull();
  source.close();
});

it('detects altered durable release heads', () => {
  const databasePath = path();
  const source = openSqlitePlayerReleaseGeometryStore(databasePath,
    links, { readAcceptedBaseline: () => baseline,
      readAcceptedChange: () => null });
  source.initialize(baseline.sourceId);
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  try {
    db.prepare(`UPDATE world_player_release_heads SET state_json='{}'
      WHERE career_id=? AND player_id=?`).run('career-a', 'player-a');
    expect(() => source.readHead('career-a', 'player-a'))
      .toThrow('diverged');
  } finally { db.close(); source.close(); }
});
