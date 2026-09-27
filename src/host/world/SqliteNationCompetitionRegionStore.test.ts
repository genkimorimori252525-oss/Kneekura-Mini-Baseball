import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');

it('uses accepted historical region at cutoff and detects rewritten evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-nation-region-'));
  const path = join(directory, 'world.sqlite');
  const first = { careerId: 'career-1', nationId: 'nation-a',
    region: 'ASIA_PACIFIC' as const, effectiveFromDay: 10,
    sourceEventId: 'region-event-1' };
  const changed = { ...first, region: 'AMERICAS' as const,
    effectiveFromDay: 100, sourceEventId: 'region-event-2' };
  try {
    const store = openSqliteNationCompetitionRegionStore(path);
    expect(store.readRegion('career-1', 'nation-a', 9)).toBeNull();
    expect(store.record(first).revision).toBe(1);
    expect(store.record(first).revision).toBe(1);
    expect(store.record(changed).revision).toBe(2);
    expect(store.authority('career-1')
      .nationCompetitionRegion('nation-a', 99))
      .toBe('ASIA_PACIFIC');
    expect(store.readRegion('career-1', 'nation-a', 100))
      .toBe('AMERICAS');
    expect(store.readRegion('career-2', 'nation-a', 100)).toBeNull();
    expect(() => store.record({ ...first,
      region: 'EUROPE' })).toThrow('already frozen differently');
    expect(() => store.record({ ...changed,
      sourceEventId: 'region-event-3',
      effectiveFromDay: 99 })).toThrow('stale or unchanged');
    store.close();
    const reopened = openSqliteNationCompetitionRegionStore(path);
    expect(reopened.readHistory('career-1', 'nation-a')
      .map((event) => event.sourceEventId))
      .toEqual(['region-event-1', 'region-event-2']);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_nation_competition_regions
      SET request_json='{}' WHERE career_id='career-1'
      AND source_event_id='region-event-1'`).run();
    database.close();
    const tampered = openSqliteNationCompetitionRegionStore(path);
    expect(() => tampered.readRegion('career-1', 'nation-a', 100))
      .toThrow('corrupt nation competition region history');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-nation-region-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
