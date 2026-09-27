import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import { EMPTY_CLUB_WORLD_QUALIFICATION_POLICY_REGISTRY,
  registerClubWorldQualificationPolicy,
  type ClubWorldQualificationSourceInput,
  type OfficialRegionalClubSeason } from
  '../../core/world/competition/ClubWorldQualificationSources';
import { openSqliteClubWorldQualificationSourceStore } from
  './SqliteClubWorldQualificationSourceStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const seasons = ['2024', '2025', '2026', '2027'];
const policy = { version: 'points-v1',
  recencyMultipliers: [1, 2, 3, 4], regionalTopClubCount: 2,
  tieBreak: 'RECENT_THEN_ID' as const,
  eventWeights: { TITLE: 10, FINAL_APPEARANCE: 5,
    SEMIFINAL_ADVANCE: 3, KNOCKOUT_ADVANCE: 2,
    SERIES_WIN: 1, GROUP_WIN: 1 } };
const input: Omit<ClubWorldQualificationSourceInput, 'authority'> = {
  editionId: 'club-world-2028', cycleId: '2024-2027',
  fourYearSeasonIds: seasons, policy,
  policyRegistry: registerClubWorldQualificationPolicy(
    EMPTY_CLUB_WORLD_QUALIFICATION_POLICY_REGISTRY, policy),
  eligibility: { editionId: 'club-world-2028',
    snapshotId: 'eligible-2028', asOfDay: 100,
    regions: regions.map((region) => ({ region,
      eligibleClubIds: [`${region}-a`, `${region}-b`] })) },
};
const makeSeason = (region: ClubWorldRegion,
  seasonId: string): OfficialRegionalClubSeason => ({
  region, seasonId, editionId: `${region}-${seasonId}`,
  officialSnapshotId: `official-${region}-${seasonId}`,
  completedAtDay: Number(seasonId) - 2000,
  clubs: ['a', 'b'].map((suffix) => ({
    clubId: `${region}-${suffix}`,
    resultApplicationIds: [`result-${region}-${seasonId}-${suffix}`],
    achievements: suffix === 'a' ? [{ kind: 'TITLE' as const,
      applicationId: `result-${region}-${seasonId}-${suffix}` }] : [],
  })),
});

it('replays four official seasons into frozen Club World coefficients', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-world-qual-'));
  const path = join(directory, 'world.sqlite');
  let changed = false;
  const sources = {
    editionHost: () => ({ snapshotId: 'host-2028',
      region: 'AMERICAS' as const, qualificationCutoffDay: 100 }),
    regional: { authority: () => ({
      completedRegionalSeason: (region: ClubWorldRegion,
        seasonId: string) => changed && region === 'AFRICA'
          && seasonId === '2027' ? null : makeSeason(region, seasonId),
      latestRegionalChampion: () => null,
    }) },
  };
  try {
    const store = openSqliteClubWorldQualificationSourceStore(path,
      sources);
    const result = store.initialize('career-1', input);
    expect(result.coefficients).toHaveLength(4);
    expect(result.rankings).toHaveLength(4);
    expect(store.initialize('career-1', input)).toEqual(result);
    expect(store.readSources('career-1', input.editionId)).toEqual(result);
    store.close();
    const reopened = openSqliteClubWorldQualificationSourceStore(path,
      sources);
    expect(reopened.readSources('career-1', input.editionId))
      .toEqual(result);
    changed = true;
    expect(() => reopened.readSources('career-1', input.editionId))
      .toThrow('corrupt Club World qualification source');
    changed = false;
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_club_world_qualification_sources
      SET sources_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteClubWorldQualificationSourceStore(path,
      sources);
    expect(() => tampered.readSources('career-1', input.editionId))
      .toThrow('corrupt Club World qualification source');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-world-qual-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
