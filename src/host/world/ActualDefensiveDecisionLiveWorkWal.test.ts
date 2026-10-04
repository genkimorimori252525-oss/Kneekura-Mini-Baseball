import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import { openSqliteActualDefensiveDecisionLiveWork } from './SqliteActualDefensiveDecisionLiveWork';

it('pins one read transaction across a WAL dependency change and sees corruption on the next read', () => {
  const directory = mkdtempSync(join(tmpdir(), 'decision-live-work-wal-'));
  const x = fixture(join(directory, 'world.sqlite'));
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    x.plans.accept(x.planSource.sourceId); x.decisions.accept(x.decisionSource.sourceId);
    const reader = x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path)), original = reader.read(x.decisionSource.sourceId);
    const prepare = DatabaseSync.prototype.prepare; let firstPrepared = false, changed = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      // The first decision query has executed before the next query is prepared.
      if (firstPrepared && !changed) {
        changed = true;
        x.f.db.exec("UPDATE actual_field_observations SET snapshot_hash='peer-committed-corruption'");
      }
      const statement = prepare.call(this, sql);
      if (sql.startsWith('SELECT * FROM actual_defensive_decisions WHERE source_id=?')) firstPrepared = true;
      return statement;
    });
    try {
      expect(reader.read(x.decisionSource.sourceId)).toEqual(original);
      expect(changed).toBe(true);
    } finally { hook.mockRestore(); }
    expect(() => reader.read(x.decisionSource.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT snapshot_hash FROM actual_field_observations').get()).toEqual({ snapshot_hash: 'peer-committed-corruption' });
  } finally { x.f.close(); rmSync(directory, { recursive: true, force: true }); }
});

it('opens no write capability and creates no missing archive', () => {
  const directory = mkdtempSync(join(tmpdir(), 'decision-live-work-readonly-'));
  const x = fixture(join(directory, 'world.sqlite')), { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  try {
    const exec = DatabaseSync.prototype.exec; let blockedWrite = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      const result = exec.call(this, sql);
      if (sql === 'BEGIN') {
        expect(() => exec.call(this, 'CREATE TABLE forbidden_live_work_write (id TEXT)')).toThrow();
        blockedWrite = true;
      }
      return result;
    });
    try {
      const reader = x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path));
      expect(reader.read('missing')).toBeNull(); expect(blockedWrite).toBe(true);
    } finally { hook.mockRestore(); }
    expect(x.f.db.prepare("SELECT name FROM sqlite_master WHERE name='forbidden_live_work_write'").all()).toEqual([]);
    const missingPath = join(directory, 'missing.sqlite');
    expect(() => openSqliteActualDefensiveDecisionLiveWork(missingPath)).toThrow();
    expect(existsSync(missingPath)).toBe(false);
  } finally { x.f.close(); rmSync(directory, { recursive: true, force: true }); }
});
