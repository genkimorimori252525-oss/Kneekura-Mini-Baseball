import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import { EMPTY_WBC_BERTH_POLICY_REGISTRY,
  registerWbcBerthPolicy, type WbcBerthInput } from
  '../../core/world/competition/WbcBerths';
import { openSqliteWbcDirectBerthStore } from
  './SqliteWbcDirectBerthStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const policy = { version: 'wbc-berths-v1',
  performanceMethod: 'DIVISOR_WITH_TWO_EXTRA_CAP' as const };
const input: WbcBerthInput = {
  editionId: 'wbc-2032', cycleId: 'cycle-2031',
  previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
  previousRegionalEditionIds: {
    ASIA_PACIFIC: 'regional-ap-2031',
    AMERICAS: 'regional-am-2031',
    EUROPE: 'regional-eu-2031', AFRICA: 'regional-af-2031',
  },
  qualifierEditionId: 'qualifier-2032',
  cutoffSnapshotId: 'cutoff-2032',
  coefficientPolicyVersion: 'wbc-regional-results-v1',
  policy,
  policyRegistry: registerWbcBerthPolicy(
    EMPTY_WBC_BERTH_POLICY_REGISTRY, policy),
};

it('freezes twenty WBC direct slots from regional titles and coefficients', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-wbc-direct-'));
  const path = join(directory, 'world.sqlite');
  let changed = false;
  const sources = {
    editionCutoff: () => ({ snapshotId: 'cutoff-2032', day: 100 }),
    coefficients: { authority: () => ({
      regionalCoefficient: (region: ClubWorldRegion) => ({ region,
        snapshotId: `coefficient-${region}`,
        policyVersion: 'wbc-regional-results-v1',
        previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
        completedAtDay: changed ? 101 : 60,
        score: { ASIA_PACIFIC: 100, AMERICAS: 80,
          EUROPE: 40, AFRICA: 20 }[region],
        evidenceResultIds: [`wbc-${region}-2024`,
          `wbc-${region}-2028`] }),
    }) },
    regional: { regionalAuthority: () => ({
      regionalChampionship: (region: ClubWorldRegion) => ({ region,
        editionId: input.previousRegionalEditionIds[region],
        snapshotId: `placement-${region}`,
        completedAtDay: 70,
        orderedNationIds: Array.from({ length: 8 }, (_, index) =>
          `${region}-${index}`),
      }),
    }) },
    nations: { authority: () => ({
      nationCompetitionRegion: (nationId: string) =>
        regions.find((region) => nationId.startsWith(`${region}-`))
        ?? null,
    }) },
  };
  try {
    const store = openSqliteWbcDirectBerthStore(path, sources);
    const direct = store.initialize({ careerId: 'career-1', input });
    expect(direct.entrantNationIds).toHaveLength(20);
    expect(direct.placements).toHaveLength(4);
    expect(store.initialize({ careerId: 'career-1', input }))
      .toEqual(direct);
    store.close();
    const reopened = openSqliteWbcDirectBerthStore(path, sources);
    expect(reopened.readDirect('career-1', input.editionId))
      .toEqual(direct);
    changed = true;
    expect(() => reopened.readDirect('career-1', input.editionId))
      .toThrow('corrupt WBC direct berths');
    changed = false;
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_wbc_direct_berths
      SET direct_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteWbcDirectBerthStore(path, sources);
    expect(() => tampered.readDirect('career-1', input.editionId))
      .toThrow('corrupt WBC direct berths');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-wbc-direct-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
