import { expect, it } from 'vitest';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';

it('preserves pre-correction atomic and all four consumer archive bytes through reopen and retry', () => {
  const x = battedWorldFieldThrowFixture();
  try {
    // Recorded by the original d5b7d2c Native accept path before this correction.
    expect(actorHash(x.acquired)).toBe('ea1e8c8f920a4f69638bc3423c165e1437ff5053da96a88c0d4068f76d3a4821');
    const observer = installSyntheticObservation(x, x.capture.acquirerPlayerId, x.acquired.source.sourceId, x.model);
    const perceived = observer.observations.accept(observer.observationSource.sourceId);
    expect(actorHash(perceived)).toBe('ffec9c9f032550ad85177d3c2468eb9078d70438b51ae553fb2c8a0bcbdfea98');
    const expectedHashes = {
      whole_play_history: 'a97414e1031ff65a4f6dfd2878275c632f5fc65b51ade6a473bb8237a5d228b9',
      first_base_race: '0967e8a3d7d40ecf9455a0b25fca9c6127fb66aab60e5153f90b5128229ef33d',
      base_touch_history: '865a80be6f89bd00256bc0fbc577afed79c5e001779086f1d270fd4543353c9b',
    };
    const values = [x.acquired];
    let previous = x.acquired.source.sourceId;
    for (const action of [{ kind: 'whole_play_history' }, { kind: 'first_base_race' },
      { kind: 'base_touch_history', playerId: x.capture.acquirerPlayerId, base: 'first' }] as const) {
      const source = { ...x.acquired.source, sourceId: `archive-${action.kind}`, previousExecutionSourceId: previous, action };
      x.sources.set(source.sourceId, source);
      const value = x.executions.accept(source.sourceId);
      previous = source.sourceId; values.push(value);
      expect(actorHash(value)).toBe(expectedHashes[action.kind]);
    }
    const rows = () => x.f.db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_field_executions ORDER BY revision').all();
    const observationRows = () => x.f.db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM actual_field_observations ORDER BY revision').all();
    const saved = rows(), savedObservations = observationRows();
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    const reopenedObserver = x.f.track(openSqliteActualFieldObservationStore(x.f.path));
    for (const value of values) {
      expect(reopened.read(value.source.sourceId)).toEqual(value);
      expect(reopened.accept(value.source.sourceId)).toEqual(value);
    }
    expect(reopenedObserver.read(perceived.source.sourceId)).toEqual(perceived);
    expect(reopenedObserver.accept(perceived.source.sourceId)).toEqual(perceived);
    expect(rows()).toEqual(saved);
    expect(observationRows()).toEqual(savedObservations);
  } finally { x.f.close(); }
}, 120_000);
