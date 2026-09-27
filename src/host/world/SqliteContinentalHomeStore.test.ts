import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import type { CompetitionEditionSnapshot } from
  '../../core/world/competition/CompetitionEdition';
import type { DurableCompetitionDraw } from
  './SqliteCompetitionDrawStore';
import { openSqliteContinentalHomeStore } from
  './SqliteContinentalHomeStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const clubs = Array.from({ length: 16 }, (_, index) =>
  `club-${index + 1}`);
const sources = {
  editions: { readEdition: (_careerId: string, editionId: string) =>
    ({ competitionId: 'continental-a', editionId,
      canonicalRole: 'CONTINENTAL_CL',
      drawSnapshotId: `draw-${editionId}` }) as
      CompetitionEditionSnapshot },
  draws: { readDraw: (_careerId: string, editionId: string) =>
    ({ drawSnapshotId: `draw-${editionId}`,
      draw: { editionId, drawPolicyVersion: 'draw-v1',
        drawSeed: `seed-${editionId}`,
        groups: Array.from({ length: 4 }, (_, index) =>
          clubs.slice(index * 4, index * 4 + 4).map((teamId) =>
            ({ teamId, pot: 1, leagueId: 'league-a',
              regionId: 'region-a' }))),
        relaxationOrder: ['REMATCH_AVOIDANCE',
          'REGIONAL_DIVERSITY', 'SAME_LEAGUE_AVOIDANCE'] as const,
        appliedConstraints: [], relaxedConstraints: [],
        softViolationCounts: { sameLeague: 0, sameRegion: 0,
          rematch: 0 } } }) as
      DurableCompetitionDraw },
};
const policy = { version: 'home-v1',
  recentEditionWeights: [1, 0.5] };

it('replays cumulative home credits and its exact group game plan', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-home-'));
  const path = join(directory, 'world.sqlite');
  try {
    const first = openSqliteContinentalHomeStore(path, sources);
    const opening = first.initialize({ careerId: 'career-1',
      editionId: 'edition-1', editionOrdinal: 0, policy });
    expect(opening.groupGamePlan.groups.flatMap((group) =>
      group.games)).toHaveLength(72);
    expect(first.initialize({ careerId: 'career-1',
      editionId: 'edition-1', editionOrdinal: 0, policy }))
      .toEqual(opening);
    const second = first.initialize({ careerId: 'career-1',
      editionId: 'edition-2', editionOrdinal: 1, policy });
    expect(second.assignment.ledger.revision).toBe(2);
    expect(first.readLedger('career-1', 'continental-a')
      .history).toHaveLength(32);
    first.close();
    const reopened = openSqliteContinentalHomeStore(path, sources);
    expect(reopened.readAssignment('career-1', 'edition-1'))
      .toEqual(opening);
    expect(reopened.readAssignment('career-1', 'edition-2'))
      .toEqual(second);
    expect(() => reopened.initialize({ careerId: 'career-1',
      editionId: 'edition-2', editionOrdinal: 1,
      policy: { ...policy, version: 'home-v2' } }))
      .toThrow('already frozen differently');
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_continental_home_assignments
      SET snapshot_json='{}' WHERE career_id='career-1'
      AND edition_id='edition-1'`).run();
    database.close();
    const corrupted = openSqliteContinentalHomeStore(path, sources);
    expect(() => corrupted.readAssignment('career-1', 'edition-2'))
      .toThrow('corrupt continental home history');
    corrupted.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-home-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
