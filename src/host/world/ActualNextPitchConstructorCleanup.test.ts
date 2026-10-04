import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
// Real constructors and SQLite; no domain read should occur before schema preparation.
const noRead = (): never => { throw new Error('unexpected domain read during construction'); };
const links = { readAcceptedPlayerPersonLink: noRead };
const sources = { matches: { getMatch: noRead, getOfficialFixture: noRead }, participation: { readPregameBinding: noRead },
  initialWorlds: { readAcceptedSource: noRead }, runtime: { workload: { selectAtRevision: noRead }, timing: { selectProfileAtDay: noRead },
    release: { selectAtDay: noRead }, policies: { readAcceptedPolicy: noRead }, effortPolicies: { readAcceptedPolicy: noRead } } };
const cases = [
  ['timing', 'world_pitch_timing_baselines', (path: string) => openSqlitePlayerPitchTimingStore(path, links)],
  ['release', 'world_player_release_baselines', (path: string) => openSqlitePlayerReleaseGeometryStore(path, links)],
  ['fatigue', 'world_pitch_fatigue_policies', (path: string) => openSqlitePitchFatiguePolicyStore(path)],
  ['initial-world', 'official_initial_world_sources', (path: string) => openSqliteOfficialInitialWorldStore(path, sources)],
  ['pitch-progress', 'physical_pitch_progress_actions', (path: string) => openSqlitePhysicalPitchProgressStore(path, sources)],
] as const;
it.each(cases)('closes %s SQLite ownership if preparation fails before returning a handle', (_name, table, open) => {
  const directory = mkdtempSync(join(tmpdir(), 'next-pitch-constructor-')), path = join(directory, 'state.sqlite');
  const db = new DatabaseSync(path); db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE ${table}(badcolumn TEXT)`); db.close();
  try {
    expect(() => open(path)).toThrow(/no such column/);
    const handles = readdirSync('/proc/self/fd').flatMap(fd => {
      try { return [readlinkSync(`/proc/self/fd/${fd}`)]; } catch { return []; }
    }).filter(target => target.startsWith(path));
    expect(handles).toEqual([]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
