import { expect, it } from 'vitest';
import { battedWorldThrowFixture as fixture } from './BattedWorldThrowFixtures.test-support';
import { openSqliteBattedWorldExecutionStore } from './SqliteBattedWorldExecutionStore';

it.each([
  ['model-source', "UPDATE world_player_fielding_models SET source_hash='changed';"],
  ['model-snapshot', "UPDATE world_player_fielding_models SET snapshot_hash='changed';"],
  ['model-person', "UPDATE world_player_fielding_models SET person_link_source_id='changed';"],
  ['model-archive', 'DELETE FROM world_player_fielding_models;'],
  ['Person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
])('rolls back late %s corruption after the actual throw execution insert', (_kind, sql) => {
  const { f, source, executions, model, fielding, motions, motion } = fixture();
  try {
    f.db.exec(`CREATE TRIGGER mutate_throw AFTER INSERT ON batted_world_execution_heads BEGIN ${sql} END`);
    expect(() => executions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_execution_heads').get()).toEqual({ n: 0 });
    expect(fielding.read(model.source.sourceId)).toEqual(model); expect(motions.read(motion.source.sourceId)).toEqual(motion);
    f.db.exec('DROP TRIGGER mutate_throw'); expect(executions.accept(source.sourceId).execution.kind).toBe('throw');
  } finally { f.close(); }
});
it('revalidates own model after a cached motion peer changes it before the transaction', () => {
  const { f, source, motion, authority } = fixture();
  try {
    const store = f.track(openSqliteBattedWorldExecutionStore(f.path, { read: () => {
      f.db.exec("UPDATE world_player_fielding_models SET snapshot_hash='changed'"); return motion;
    } }, authority));
    expect(() => store.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('revalidates own model after an identical retry authority callback', () => {
  const { f, source, motions, executions } = fixture();
  try {
    executions.accept(source.sourceId);
    const store = f.track(openSqliteBattedWorldExecutionStore(f.path, motions, { readAcceptedExecution: () => {
      f.db.exec("UPDATE world_player_fielding_models SET source_hash='changed'"); return source;
    } }));
    expect(() => store.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
