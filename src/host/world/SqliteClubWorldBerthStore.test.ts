import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { ClubWorldQualificationSources } from
  '../../core/world/competition/ClubWorldQualificationSources';
import { openSqliteClubWorldBerthStore } from
  './SqliteClubWorldBerthStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const seasons = ['2024', '2025', '2026', '2027'];
const performance: ClubWorldQualificationSources = {
  editionId: 'club-world-2028', cycleId: 'cycle-2024-2027',
  policyVersion: 'points-v1', eligibilitySnapshotId: 'eligible-2028',
  coefficients: regions.map((region) => ({ region,
    cycleId: 'cycle-2024-2027',
    coefficientSnapshotId: `coefficient-${region}`,
    coefficientPolicyVersion: 'points-v1',
    score: 100, fourYearSeasonIds: seasons,
    evidenceResultIds: [`result-${region}`] })),
  rankings: regions.map((region) => ({ region,
    cycleId: 'cycle-2024-2027',
    rankingSnapshotId: `ranking-${region}`,
    rankingPolicyVersion: 'points-v1',
    fourYearSeasonIds: seasons,
    orderedCandidates: Array.from({ length: 8 }, (_, index) => ({
      clubId: `${region}-${index}`, eligible: true,
      evidenceResultIds: [`result-${region}-${index}`],
    })),
  })),
};
const request = { careerId: 'career-1',
  editionId: 'club-world-2028', cycleId: 'cycle-2024-2027',
  previousRegionalEditionIds: {
    ASIA_PACIFIC: 'ASIA_PACIFIC-2027',
    AMERICAS: 'AMERICAS-2027',
    EUROPE: 'EUROPE-2027',
    AFRICA: 'AFRICA-2027',
  },
  previousWorldEditionId: 'club-world-2024',
};

it('persists sixteen official Club World berths with title cascade', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-world-berths-'));
  const path = join(directory, 'world.sqlite');
  let changed = false;
  const sources = {
    qualification: { readSources: () => changed ? null : performance },
    regional: { authority: () => ({
      completedRegionalSeason: () => null,
      latestRegionalChampion: (region: ClubWorldRegion) => ({
        editionId: `${region}-2027`, clubId: `${region}-0`,
        officialTitleId: `title-${region}`,
        titleFinalizedDay: 30,
      }),
    }) },
    titles: { authority: () => ({
      defendingWorldChampion: () => ({
        editionId: 'club-world-2024',
        clubId: 'ASIA_PACIFIC-0',
        region: 'ASIA_PACIFIC' as const,
        officialTitleId: 'world-title-2024',
        titleFinalizedDay: 20,
      }),
    }) },
    editionHost: () => ({ snapshotId: 'host-2028',
      region: 'AMERICAS' as const, qualificationCutoffDay: 100 }),
  };
  try {
    const store = openSqliteClubWorldBerthStore(path, sources);
    const allocation = store.initialize(request);
    expect(allocation.entrantClubIds).toHaveLength(16);
    expect(new Set(allocation.entrantClubIds).size).toBe(16);
    expect(allocation.slots.some((slot) =>
      slot.route === 'DUPLICATE_AUTOMATIC_CASCADE')).toBe(true);
    expect(store.initialize(request)).toEqual(allocation);
    store.close();
    const reopened = openSqliteClubWorldBerthStore(path, sources);
    expect(reopened.readAllocation('career-1', request.editionId))
      .toEqual(allocation);
    changed = true;
    expect(() => reopened.readAllocation('career-1', request.editionId))
      .toThrow('corrupt Club World berths');
    changed = false;
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_club_world_berths
      SET allocation_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteClubWorldBerthStore(path, sources);
    expect(() => tampered.readAllocation('career-1', request.editionId))
      .toThrow('corrupt Club World berths');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-world-berths-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
