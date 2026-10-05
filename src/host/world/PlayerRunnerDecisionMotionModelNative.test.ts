import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as models from './SqlitePlayerDecisionModelStore';
import { requireRunnerDecisionMotionModelStore, runnerDecisionMotionModelFixture } from './PlayerRunnerDecisionMotionModelContracts.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

it('persists explicit runner parameters, witnesses insertion rollback and retries from a fully closed real file', () => {
  const x = runnerDecisionMotionModelFixture(), handles: { close(): void }[] = [];
  try {
    const open = requireRunnerDecisionMotionModelStore(models), store = x.track(open(x.path, x.authority));
    expect(x.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(x.path);
    expect(x.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    const before = x.db.prepare('SELECT * FROM world_player_person_links').all();
    x.db.exec(`CREATE TRIGGER tamper_runner_model AFTER INSERT ON world_player_runner_decision_motion_models
      BEGIN UPDATE world_player_person_links SET person_id='changed' WHERE source_id='intake-a'; END;`);
    const witness = witnessSqliteWrite('INSERT INTO world_player_runner_decision_motion_models VALUES (?,?,?,?,?,?,?,?,?,?,?)', writer =>
      writer.prepare('SELECT source_id FROM world_player_runner_decision_motion_models WHERE source_id=?').get(x.source.sourceId)?.source_id === x.source.sourceId
      && writer.prepare("SELECT person_id FROM world_player_person_links WHERE source_id='intake-a'").get()?.person_id === 'changed');
    try { expect(() => store.accept(x.source.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true); }
    finally { witness.close(); }
    expect(x.db.prepare('SELECT * FROM world_player_runner_decision_motion_models').all()).toEqual([]);
    expect(x.db.prepare('SELECT * FROM world_player_person_links').all()).toEqual(before);
    x.db.exec('DROP TRIGGER tamper_runner_model');
    const value = store.accept(x.source.sourceId); expect(value).toEqual({ source: x.source, person: x.person });
    expect(store.selectAtDay(x.source.careerId, x.source.playerId, x.source.acceptedAtDay)).toEqual(value);
    expect(() => store.selectAtDay(x.source.careerId, x.source.playerId, x.source.acceptedAtDay - 1)).toThrow();
    x.closeHandles(); expect(() => x.db.prepare('SELECT 1')).toThrow();
    const reader = open(x.path); handles.push(reader);
    expect(reader.read(x.source.sourceId)).toEqual(value); expect(reader.accept(x.source.sourceId)).toEqual(value);
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(x.path); handles.push(db);
    expect(db.prepare('SELECT * FROM world_player_person_links').all()).toEqual(before);
    expect(db.prepare('SELECT count(*) AS n FROM world_player_fielding_models').get()!.n).toBe(0);
    const changed = open(x.path, { readAcceptedModel: () => ({ ...x.source, decision: { ...x.source.decision, coachTrust: 0 } }) }); handles.push(changed);
    expect(() => changed.accept(x.source.sourceId)).toThrow(/frozen|different/);
    expect(reader.read(x.source.sourceId)).toEqual(value);
  } finally { try { while (handles.length) handles.pop()!.close(); } finally { x.close(); } }
});
