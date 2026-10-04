import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture } from './OwnedBattedWorldMotionFixtures.test-support';
import { openSqliteActualLivePlayStore } from './SqliteActualLivePlayStore';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';

it('rejects foreign sources and hidden ownership aliases and rolls back same-connection post-insert corruption', () => {
  const x = ownedBattedWorldMotionFixture();
  try {
    let source: AcceptedActualLivePlayScope = { sourceId: 'scope', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1',
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
      cut: { kind: 'field_execution', baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: x.first.source.sourceId } };
    const store = x.f.track(openSqliteActualLivePlayStore(x.f.path, { readAcceptedScope: () => source }));
    const original = source; source = { ...source, physicalPitchSourceId: 'foreign' };
    expect(() => store.accept(source.sourceId)).toThrow(); source = original;
    x.f.db.exec(`CREATE TRIGGER corrupt_scope AFTER INSERT ON actual_live_play_scopes BEGIN
      UPDATE batted_world_field_execution_heads SET revision=revision+1; END;`);
    const heads = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    expect(() => store.accept(source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_scopes').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
    x.f.db.exec('DROP TRIGGER corrupt_scope'); const saved = store.accept(source.sourceId);
    const row = x.f.db.prepare('SELECT * FROM actual_live_play_scopes WHERE source_id=?').get(source.sourceId)!;
    x.f.db.prepare('UPDATE actual_live_play_scopes SET source_json=? WHERE source_id=?').run(String(row.source_json).replace('"sourceId":"scope"','"sourceId":"hidden","sourceId":"scope"'), source.sourceId);
    expect(() => store.read('hidden')).toThrow(/ownership|metadata|identity/);
    x.f.db.prepare('UPDATE actual_live_play_scopes SET source_json=? WHERE source_id=?').run(row.source_json!, source.sourceId);
    expect(store.read(source.sourceId)).toEqual(saved);
    const obs = installSyntheticObservation(x, 'p2', x.first.source.sourceId); obs.observations.accept(obs.observationSource.sourceId);
    x.f.db.prepare(`UPDATE actual_field_observations SET physical_pitch_source_id='foreign', player_id='foreign'`).run();
    expect(() => store.evaluate(source.sourceId)).toThrow(/metadata|ownership|scope/);
  } finally { x.f.close(); }
});
