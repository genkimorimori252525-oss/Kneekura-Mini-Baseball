import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyActualRoleWorkloadArtifact } from './ActualRoleWorkloadArtifact.test-support';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const handles = (path: string) => readdirSync('/proc/self/fd').flatMap(fd => {
  try { return [readlinkSync(`/proc/self/fd/${fd}`)]; } catch { return []; }
}).filter(target => target.startsWith(path));
it.each(['global-owner', 'actual-owner', 'artifact-helper'])('closes real SQLite handles after %s construction fails on malformed workload schema', async owner => {
  const directory = mkdtempSync(join(tmpdir(), 'role-constructor-cleanup-')), sourcePath = join(directory, 'source.sqlite'), destinationPath = join(directory, 'output.sqlite');
  const f = officialPitchWorkloadFixture(true, true, sourcePath);
  f.db.exec('CREATE TABLE world_player_workload_baselines(badcolumn TEXT)'); f.close();
  try {
    expect(handles(sourcePath)).toEqual([]);
    if (owner === 'artifact-helper') {
      await expect(verifyActualRoleWorkloadArtifact({ sourcePath, destinationPath, closureSourceId: 'missing', faultChecks: false })).rejects.toThrow(/no such column/);
    } else {
      const open = owner === 'global-owner' ? openSqlitePlayerWorkloadRecoveryStore : openSqliteActualRoleWorkloadStore;
      expect(() => open(sourcePath, { readLink: () => null })).toThrow(/no such column/);
    }
    expect(handles(sourcePath)).toEqual([]); expect(handles(destinationPath)).toEqual([]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
for (const schema of ['missing-roster', 'malformed-links'] as const) {
  it.each(['person-owner', 'artifact-helper'])('closes pre-return Person-link handles for %s with ' + schema, async owner => {
    const directory = mkdtempSync(join(tmpdir(), 'role-person-constructor-')), sourcePath = join(directory, 'source.sqlite'), destinationPath = join(directory, 'output.sqlite');
    const db = new DatabaseSync(sourcePath);
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE unrelated(id TEXT)');
    if (schema === 'malformed-links') db.exec('CREATE TABLE world_roster_heads(career_id TEXT,revision INTEGER,roster_json TEXT); CREATE TABLE world_player_person_links(badcolumn TEXT)');
    db.close(); const sourceHash = fileHash(sourcePath);
    try {
      if (owner === 'person-owner') expect(() => openSqlitePlayerPersonLinkStore(sourcePath)).toThrow(/no such table|no such column/);
      else {
        await expect(verifyActualRoleWorkloadArtifact({ sourcePath, destinationPath, closureSourceId: 'missing', faultChecks: false })).rejects.toThrow(/no such table|no such column/);
        expect(fileHash(sourcePath)).toBe(sourceHash);
      }
      expect(handles(sourcePath)).toEqual([]); expect(handles(destinationPath)).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
