import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { battedWorldFirstBaseRaceFixture as fixture } from './BattedWorldFirstBaseRaceFixtures.test-support';
import { openSqliteBattedWorldExecutionStore } from './SqliteBattedWorldExecutionStore';

const directories: string[] = [];
const path = () => { const directory = mkdtempSync(join(tmpdir(), 'batted-first-base-race-wal-')); directories.push(directory); return join(directory, 'state.sqlite'); };
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`) || !basename(target).startsWith('batted-first-base-race-wal-')) throw new Error('first-base race WAL cleanup escaped its own temporary directory');
    rmSync(target, { recursive: true, force: true });
  }
});
it.each([
  ['earlier_source', "UPDATE batted_world_executions SET source_hash='changed' WHERE source_id='actual-race-ground-pickup';"],
  ['earlier_snapshot', "UPDATE batted_world_executions SET snapshot_hash='changed' WHERE source_id='actual-race-feet';"],
  ['earlier_mirror', "UPDATE batted_world_executions SET game_id='changed' WHERE source_id='actual-race-feet';"],
  ['head', 'UPDATE batted_world_execution_heads SET revision=revision+1;'],
  ['motion_prefix', "UPDATE batted_world_motions SET snapshot_hash='changed';"],
  ['geometry', "UPDATE batted_world_base_geometries SET source_hash='changed';"],
  ['person', "UPDATE world_player_person_links SET person_id='changed';"],
])('rolls back late %s corruption rather than accepting a transported OUT', (_kind, sql) => {
  const g = fixture(path()); try {
    g.f.db.exec(`CREATE TRIGGER mutate_first_race AFTER UPDATE ON batted_world_execution_heads BEGIN ${sql} END`);
    expect(() => g.executions.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 2 });
    expect(g.executions.read(g.moved.source.sourceId)).toEqual(g.moved);
    expect(g.geometries.read(g.geometry.source.sourceId)).toEqual(g.geometry);
    g.f.db.exec('DROP TRIGGER mutate_first_race');
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('actual first-base race fixture');
    expect(value.execution.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out', runnerTouchTick: null } });
  } finally { g.f.close(); }
});
it('revalidates the owned prefix after a cached motion peer changes an earlier execution', () => {
  const g = fixture(path()); try {
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, { read: () => {
      g.f.db.exec("UPDATE batted_world_executions SET source_hash='changed'"); return g.motion;
    } }, g.authority));
    expect(() => store.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 2 });
  } finally { g.f.close(); }
});
it('revalidates an identical race retry after its authority mutates an original Person link', () => {
  const g = fixture(path()); try {
    g.executions.accept(g.source.sourceId);
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, g.motions, { readAcceptedExecution: () => {
      g.f.db.exec("UPDATE world_player_person_links SET person_id='changed'"); return g.source;
    } }));
    expect(() => store.accept(g.source.sourceId)).toThrow();
  } finally { g.f.close(); }
});
it('retains historical early OUT after legitimate recovery while fencing a new stale append', () => {
  const g = fixture(path()); try {
    const value = g.executions.accept(g.source.sourceId);
    const rest = { sourceEventId: 'base-race-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a',
      playerId: g.motion.response.touch.worldContact.flight.physicalPitch.frame.workload.playerId, atDay: 11, kind: 'RECOVERY' as const,
      durationHours: 8, quality: 1, medicalAvailability: 1 };
    g.f.activities.set(rest.sourceEventId, rest); g.f.workload.apply(rest.sourceEventId, 0);
    expect(g.executions.read(g.source.sourceId)).toEqual(value); expect(g.executions.accept(g.source.sourceId)).toEqual(value);
    const next = { ...g.source, sourceId: 'stale-first-base-race', previousExecutionSourceId: g.source.sourceId }; g.sources.set(next.sourceId, next);
    expect(() => g.executions.accept(next.sourceId)).toThrow(/workload/);
    const reopened = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, g.motions));
    expect(reopened.read(g.source.sourceId)).toEqual(value);
  } finally { g.f.close(); }
});
