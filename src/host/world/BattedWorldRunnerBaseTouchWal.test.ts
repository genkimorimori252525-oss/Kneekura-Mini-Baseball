import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { battedWorldRunnerContactFixture as fixture } from './BattedWorldRunnerContactFixtures.test-support';
import { openSqliteBattedWorldExecutionStore } from './SqliteBattedWorldExecutionStore';

const directories: string[] = [];
const path = () => { const directory = mkdtempSync(join(tmpdir(), 'batted-runner-touch-wal-')); directories.push(directory); return join(directory, 'state.sqlite'); };
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`) || !basename(target).startsWith('batted-runner-touch-wal-')) throw new Error('runner WAL cleanup escaped its own temporary directory');
    rmSync(target, { recursive: true, force: true });
  }
});
it.each([
  ['geometry_source', "UPDATE batted_world_base_geometries SET source_hash='changed';"],
  ['geometry_snapshot', "UPDATE batted_world_base_geometries SET snapshot_hash='changed';"],
  ['geometry_mirror', "UPDATE batted_world_base_geometries SET flight_source_id='changed';"],
  ['fixture', "UPDATE official_fixtures SET venue_id='changed';"],
  ['player_person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['player_binding', "UPDATE official_participant_bindings SET binding_json=json_set(binding_json,'$.personId','changed');"],
  ['initial_world', "UPDATE official_initial_world_sources SET snapshot_hash='changed';"],
  ['motion', "UPDATE batted_world_motions SET source_hash='changed';"],
  ['physical_pitch', "UPDATE physical_pitch_progress_actions SET snapshot_hash='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['execution_source', "UPDATE batted_world_executions SET source_hash='changed';"],
  ['execution_mirror', "UPDATE batted_world_executions SET physical_pitch_source_id='changed';"],
  ['execution_head', 'UPDATE batted_world_execution_heads SET revision=revision+1;'],
  ['geometry_archive', 'DELETE FROM batted_world_base_geometries;'],
])('rolls back late %s mutation after the actual runner observation head insert', (_kind, sql) => {
  const g = fixture(path()); try {
    g.f.db.exec(`CREATE TRIGGER mutate_runner_touch AFTER INSERT ON batted_world_execution_heads BEGIN ${sql} END`);
    expect(() => g.executions.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_execution_heads').get()).toEqual({ n: 0 });
    expect(g.geometries.read(g.geometry.source.sourceId)).toEqual(g.geometry);
    expect(g.motions.read(g.motion.source.sourceId)).toEqual(g.motion);
    g.f.db.exec('DROP TRIGGER mutate_runner_touch');
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'runner_base_touch') throw new Error('actual runner touch fixture');
    expect(value.execution.contact?.playerId).toBe(g.batter.binding.playerId);
  } finally { g.f.close(); }
});
it.each([
  ['geometry', "UPDATE batted_world_base_geometries SET source_hash='changed';"],
  ['player', "UPDATE world_player_person_links SET person_id='changed';"],
])('revalidates own %s after a cached motion peer mutates it before the transaction', (_kind, sql) => {
  const g = fixture(path()); try {
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, { read: () => {
      g.f.db.exec(sql); return g.motion;
    } }, g.authority));
    expect(() => store.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { g.f.close(); }
});
it.each([
  ['geometry', "UPDATE batted_world_base_geometries SET snapshot_hash='changed';"],
  ['prefix', 'UPDATE batted_world_execution_heads SET revision=revision+1;'],
])('revalidates own %s after an identical runner retry Source callback', (_kind, sql) => {
  const g = fixture(path()); try {
    g.executions.accept(g.source.sourceId);
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, g.motions, { readAcceptedExecution: () => {
      g.f.db.exec(sql); return g.source;
    } }));
    expect(() => store.accept(g.source.sourceId)).toThrow();
  } finally { g.f.close(); }
});
it('preserves historical runner contact after original pitch workload recovery and rejects a stale fresh append', () => {
  const g = fixture(path()); try {
    const value = g.executions.accept(g.source.sourceId), rest = { sourceEventId: 'runner-touch-rest', sourceVersion: 'fixture-v1',
      evidenceId: 'actual-rest', careerId: 'career-a', playerId: g.motion.response.touch.worldContact.flight.physicalPitch.frame.workload.playerId,
      atDay: 11, kind: 'RECOVERY' as const,
      durationHours: 8, quality: 1, medicalAvailability: 1 };
    g.f.activities.set(rest.sourceEventId, rest); g.f.workload.apply(rest.sourceEventId, 0);
    expect(g.executions.read(g.source.sourceId)).toEqual(value); expect(g.executions.accept(g.source.sourceId)).toEqual(value);
    const next = { ...g.source, sourceId: 'stale-runner-touch', previousExecutionSourceId: g.source.sourceId };
    g.sources.set(next.sourceId, next); expect(() => g.executions.accept(next.sourceId)).toThrow(/workload/);
  } finally { g.f.close(); }
});
it('rejects altered runner Source on retry and rederives its own geometry on historical read', () => {
  const g = fixture(path()); try {
    const value = g.executions.accept(g.source.sourceId);
    if (g.source.action.kind !== 'runner_base_touch') throw new Error('actual runner Source fixture');
    g.sources.set(g.source.sourceId, { ...g.source, action: { ...g.source.action, base: 'first' } });
    expect(() => g.executions.accept(g.source.sourceId)).toThrow(/frozen differently/);
    expect(g.executions.read(g.source.sourceId)).toEqual(value);
    g.f.db.exec("UPDATE batted_world_base_geometries SET source_hash='changed'");
    expect(() => g.executions.read(g.source.sourceId)).toThrow();
  } finally { g.f.close(); }
});
