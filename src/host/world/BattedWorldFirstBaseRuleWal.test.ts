import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { battedWorldRunnerContactFixture as fixture } from './BattedWorldRunnerContactFixtures.test-support';
import { openSqliteBattedWorldExecutionStore, type AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

const directories: string[] = [];
const path = () => { const directory = mkdtempSync(join(tmpdir(), 'batted-first-base-rule-wal-')); directories.push(directory); return join(directory, 'state.sqlite'); };
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`) || !basename(target).startsWith('batted-first-base-rule-wal-')) throw new Error('first-base rule WAL cleanup escaped its own temporary directory');
    rmSync(target, { recursive: true, force: true });
  }
});
const observation = (g: ReturnType<typeof fixture>, previousExecutionSourceId: string | null): AcceptedBattedWorldExecution => ({
  ...g.source, sourceId: 'whole-first-base-rule', previousExecutionSourceId, action: { kind: 'first_base_rule',
    geometrySourceId: g.geometrySource.sourceId } });
it.each([
  ['earlier_source', "UPDATE batted_world_executions SET source_hash='changed' WHERE source_id='runner-touch-execution';"],
  ['earlier_snapshot', "UPDATE batted_world_executions SET snapshot_hash='changed' WHERE source_id='runner-touch-execution';"],
  ['earlier_mirror', "UPDATE batted_world_executions SET game_id='changed' WHERE source_id='runner-touch-execution';"],
  ['head', 'UPDATE batted_world_execution_heads SET revision=revision+1;'],
  ['motion_prefix', "UPDATE batted_world_motions SET snapshot_hash='changed';"],
  ['geometry', "UPDATE batted_world_base_geometries SET source_hash='changed';"],
  ['person', "UPDATE world_player_person_links SET person_id='changed';"],
])('rolls back late %s corruption including the whole earlier prefix and head', (_kind, sql) => {
  const g = fixture(path()); try {
    const earlier = g.executions.accept(g.source.sourceId), source = observation(g, earlier.source.sourceId);
    g.sources.set(source.sourceId, source);
    g.f.db.exec(`CREATE TRIGGER mutate_first_rule AFTER UPDATE ON batted_world_execution_heads BEGIN ${sql} END`);
    expect(() => g.executions.accept(source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 1 });
    expect(g.executions.read(earlier.source.sourceId)).toEqual(earlier);
    expect(g.geometries.read(g.geometry.source.sourceId)).toEqual(g.geometry);
    g.f.db.exec('DROP TRIGGER mutate_first_rule');
    const value = g.executions.accept(source.sourceId);
    if (value.execution.kind !== 'first_base_rule') throw new Error('history fixture');
    expect(value.execution.ballEvidence.kind).toBe('unresolved');
  } finally { g.f.close(); }
});
it('revalidates the whole original prefix after a cached motion peer changes an earlier execution', () => {
  const g = fixture(path()); try {
    const earlier = g.executions.accept(g.source.sourceId), source = observation(g, earlier.source.sourceId); g.sources.set(source.sourceId, source);
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, { read: () => {
      g.f.db.exec("UPDATE batted_world_executions SET source_hash='changed'"); return g.motion;
    } }, g.authority));
    expect(() => store.accept(source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 1 });
  } finally { g.f.close(); }
});
it('revalidates an identical first-base interpretation retry after its callback mutates an earlier physical Source', () => {
  const g = fixture(path()); try {
    const earlier = g.executions.accept(g.source.sourceId), source = observation(g, earlier.source.sourceId); g.sources.set(source.sourceId, source);
    g.executions.accept(source.sourceId);
    const store = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, g.motions, { readAcceptedExecution: () => {
      g.f.db.exec("UPDATE batted_world_motions SET source_hash='changed'"); return source;
    } }));
    expect(() => store.accept(source.sourceId)).toThrow();
  } finally { g.f.close(); }
});
it('preserves historical full-prefix first-base interpretation after legitimate recovery and fences only a new append', () => {
  const g = fixture(path()); try {
    const source = observation(g, null); g.sources.set(source.sourceId, source); const value = g.executions.accept(source.sourceId);
    const rest = { sourceEventId: 'base-rule-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a',
      playerId: g.motion.response.touch.worldContact.flight.physicalPitch.frame.workload.playerId, atDay: 11, kind: 'RECOVERY' as const,
      durationHours: 8, quality: 1, medicalAvailability: 1 };
    g.f.activities.set(rest.sourceEventId, rest); g.f.workload.apply(rest.sourceEventId, 0);
    expect(g.executions.read(source.sourceId)).toEqual(value); expect(g.executions.accept(source.sourceId)).toEqual(value);
    const next = { ...source, sourceId: 'stale-first-base-rule', previousExecutionSourceId: source.sourceId }; g.sources.set(next.sourceId, next);
    expect(() => g.executions.accept(next.sourceId)).toThrow(/workload/);
  } finally { g.f.close(); }
});

