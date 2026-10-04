import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { actualFirstBaseUmpireFixture } from './ActualFirstBaseUmpireFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteActualFirstBaseUmpireStore, type SqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const diskFixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'first-base-umpire-wal-')), 'actual.sqlite');
  const x = actualFirstBaseUmpireFixture(setup => ({ ...setup, calibration: null }), 0.04, 0.08, 0.1, path);
  expect(x.f.path).toBe(path); expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
  expect(x.f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(path);
  return x;
};
type Fixture = ReturnType<typeof diskFixture>;
const closed = new WeakSet<Fixture>();
const closeAll = (x: Fixture) => { if (!closed.has(x)) { closed.add(x); x.f.close(); } };
const reopenAfterAllClosed = (x: Fixture, verify: (owner: SqliteActualFirstBaseUmpireStore) => void) => {
  closeAll(x);
  const owner = openSqliteActualFirstBaseUmpireStore(x.f.path), db = new DatabaseSync(x.f.path);
  try {
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(x.f.path);
    verify(owner);
  } finally { owner.close(); db.close(); }
};
const advance = (x: Fixture, prior: DurableBattedWorldFieldExecution, name: string) => {
  if (x.move.action.kind !== 'motion') throw new Error('actual fixture motion');
  const at = prior.execution.field.motion.world.moment.ball.tick;
  const source = { ...x.move, sourceId: name, previousExecutionSourceId: prior.source.sourceId,
    action: { ...x.move.action, availableAtTick: at, throughTick: at + 1 } };
  x.sources.set(source.sourceId, source); return x.executions.accept(source.sourceId);
};
const pendingAdvance = (x: Fixture) => {
  x.umpires.acceptSetup(x.setup.sourceId); x.umpires.observe(x.observation.sourceId);
  const first = x.umpires.advanceCall(x.call.sourceId);
  expect(first.schedule.kind).toBe('pending');
  const cut = advance(x, x.race, 'wal-actual-next-cut');
  const second = { ...x.call, sourceId: 'wal-call-two', currentExecutionSourceId: cut.source.sourceId };
  x.calls.set(second.sourceId, second);
  const changedSource = { ...first.source, sourceVersion: 'coherent-rewrite' };
  const changed = { ...first, source: changedSource };
  const rewrite = `UPDATE actual_first_base_umpire_calls SET source_version=${quote(changedSource.sourceVersion)},
    source_json=${quote(json(changedSource))},source_hash=${quote(hash(changedSource))},
    snapshot_json=${quote(json(changed))},snapshot_hash=${quote(hash(changed))} WHERE source_id=${quote(first.source.sourceId)}`;
  return { first, second, rewrite };
};
const calls = (x: Fixture) => x.f.db.prepare('SELECT * FROM actual_first_base_umpire_calls ORDER BY source_id').all();

it.each(['delete', 'rewrite'] as const)('rolls back an actual disk/WAL INSERT trigger that %ss an earlier pending call', mutation => {
  const x = diskFixture();
  try {
    const p = pendingAdvance(x), before = calls(x);
    const physical = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const sql = mutation === 'delete' ? `DELETE FROM actual_first_base_umpire_calls WHERE source_id=${quote(p.first.source.sourceId)}` : p.rewrite;
    x.f.db.exec(`CREATE TRIGGER mutate_prior_call AFTER INSERT ON actual_first_base_umpire_calls
      WHEN NEW.source_id=${quote(p.second.sourceId)} BEGIN ${sql}; END;`);
    expect(() => x.umpires.advanceCall(p.second.sourceId)).toThrow(/prior call rowset changed/);
    expect(calls(x)).toEqual(before);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(physical);
    x.f.db.exec('DROP TRIGGER mutate_prior_call');
    const accepted = x.umpires.advanceCall(p.second.sourceId);
    expect(accepted.source).toEqual(p.second); expect(x.umpires.readCall(p.first.source.sourceId)).toEqual(p.first);
    expect(x.umpires.readCall(p.second.sourceId)).toEqual(accepted);
    reopenAfterAllClosed(x, owner => {
      expect(owner.readCall(p.first.source.sourceId)).toEqual(p.first);
      expect(owner.readCall(p.second.sourceId)).toEqual(accepted);
    });
  } finally { closeAll(x); }
});

it('pins earlier rows after BEGIN and rolls back writer-local coherent changes before insertion', () => {
  const x = diskFixture(); let restore: (() => void) | undefined;
  try {
    const p = pendingAdvance(x), before = calls(x), originalExec = DatabaseSync.prototype.exec; let changed = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      originalExec.call(this, sql);
      if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; originalExec.call(this, p.rewrite); }
    }); restore = () => hook.mockRestore();
    expect(() => x.umpires.advanceCall(p.second.sourceId)).toThrow(/prior call rowset changed/); expect(changed).toBe(true);
    expect(calls(x)).toEqual(before);
    restore(); restore = undefined;
    reopenAfterAllClosed(x, owner => {
      expect(owner.readCall(p.first.source.sourceId)).toEqual(p.first);
      expect(owner.readCall(p.second.sourceId)).toBeNull();
    });
  } finally { restore?.(); closeAll(x); }
});

it('rejects committed peer prior-row changes before BEGIN while preserving that committed WAL evidence', () => {
  const x = diskFixture(); let restore: (() => void) | undefined;
  try {
    const p = pendingAdvance(x), originalExec = DatabaseSync.prototype.exec; let changed = false;
    const peer = x.f.track(new DatabaseSync(x.f.path));
    expect(peer.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; peer.exec(p.rewrite); }
      originalExec.call(this, sql);
    }); restore = () => hook.mockRestore();
    expect(() => x.umpires.advanceCall(p.second.sourceId)).toThrow(/prior call rowset changed/); expect(changed).toBe(true);
    const rows = calls(x); expect(rows).toHaveLength(1); expect(rows[0].source_version).toBe('coherent-rewrite');
    expect(x.umpires.readCall(p.first.source.sourceId)?.source.sourceVersion).toBe('coherent-rewrite');
    expect(x.umpires.readCall(p.second.sourceId)).toBeNull();
    restore(); restore = undefined;
    reopenAfterAllClosed(x, owner => {
      expect(owner.readCall(p.first.source.sourceId)?.source.sourceVersion).toBe('coherent-rewrite');
      expect(owner.readCall(p.second.sourceId)).toBeNull();
    });
  } finally { restore?.(); closeAll(x); }
});

it('rejects stale actual observation/call cuts but preserves bounded original reads and successful later-cut admission', () => {
  const x = diskFixture();
  try {
    x.umpires.acceptSetup(x.setup.sourceId);
    const cut = advance(x, x.race, 'wal-stale-observation-cut');
    expect(() => x.umpires.observe(x.observation.sourceId)).toThrow(/prefix changed|current/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_first_base_umpire_observations').get()).toEqual({ n: 0 });
    const raceSource = { ...x.source, sourceId: 'wal-current-rule-cut', previousExecutionSourceId: cut.source.sourceId,
      action: { kind: 'first_base_race' as const, custodyPolicy: 'release_exclusive_v1' as const } };
    x.sources.set(raceSource.sourceId, raceSource); const race = x.executions.accept(raceSource.sourceId);
    x.observations.set(x.observation.sourceId, { ...x.observation, ruleExecutionSourceId: race.source.sourceId });
    const observation = x.umpires.observe(x.observation.sourceId);
    const later = advance(x, race, 'wal-stale-call-cut');
    const stale = { ...x.call, currentExecutionSourceId: race.source.sourceId };
    x.calls.set(stale.sourceId, stale);
    expect(() => x.umpires.advanceCall(stale.sourceId)).toThrow(/prefix changed|current/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_first_base_umpire_calls').get()).toEqual({ n: 0 });
    x.calls.set(stale.sourceId, { ...stale, currentExecutionSourceId: later.source.sourceId });
    const accepted = x.umpires.advanceCall(stale.sourceId);
    expect(x.umpires.readObservation(observation.source.sourceId)).toEqual(observation);
    expect(x.umpires.readCall(accepted.source.sourceId)).toEqual(accepted);
    reopenAfterAllClosed(x, owner => {
      expect(owner.readObservation(observation.source.sourceId)).toEqual(observation);
      expect(owner.readCall(accepted.source.sourceId)).toEqual(accepted);
    });
  } finally { closeAll(x); }
});

it('rejects raw Source mirrors and escaped hidden identity aliases on an actual disk/WAL call owner', () => {
  const x = diskFixture();
  try {
    const p = pendingAdvance(x), before = calls(x);
    x.f.db.prepare('UPDATE actual_first_base_umpire_calls SET source_version=? WHERE source_id=?').run('bad-mirror', p.first.source.sourceId);
    expect(() => x.umpires.readCall(p.first.source.sourceId)).toThrow(/Source|mirror/);
    x.f.db.prepare('UPDATE actual_first_base_umpire_calls SET source_version=? WHERE source_id=?').run(p.first.source.sourceVersion, p.first.source.sourceId);
    const alias = `{ "\\u0073ourceId":${JSON.stringify(p.first.source.sourceId)},"sourceId":"foreign-id", "sourceVersion":"synthetic-v1",
      "observationSourceId":"foreign-observation","currentExecutionSourceId":"foreign-execution" }`;
    const foreignSnapshot = { ...p.first, source: { ...p.first.source, sourceId: 'foreign-index',
      observationSourceId: 'foreign-observation', currentExecutionSourceId: 'foreign-execution' } };
    x.f.db.prepare(`INSERT INTO actual_first_base_umpire_calls SELECT 'foreign-index',source_version,'foreign-game','foreign-pitch',
      'foreign-umpire','foreign-observation','foreign-execution',?,source_hash,?,snapshot_hash
      FROM actual_first_base_umpire_calls WHERE source_id=?`).run(alias, json(foreignSnapshot), p.first.source.sourceId);
    expect(() => x.umpires.readCall(p.first.source.sourceId)).toThrow(/identity ownership/);
    x.f.db.prepare('DELETE FROM actual_first_base_umpire_calls WHERE source_id=?').run('foreign-index');
    expect(calls(x)).toEqual(before); expect(x.umpires.readCall(p.first.source.sourceId)).toEqual(p.first);
    reopenAfterAllClosed(x, owner => expect(owner.readCall(p.first.source.sourceId)).toEqual(p.first));
  } finally { closeAll(x); }
});
