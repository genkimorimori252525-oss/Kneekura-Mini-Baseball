import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import * as observations from './SqliteActualFieldObservationStore';
import { ownedRunnerFieldNativeFixture } from './OwnedRunnerFieldNativeFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { requireRunnerObservationHistoryStore, type RunnerObservationHistorySource } from './OwnedRunnerFieldObservationHistoryContracts.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';

/** One genuine legal chain, reused for history, rollback, complete close and retry. */
it('owns runner sensory history with real insertion rollback and callback-free full-file reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-history-native-')), path = join(directory, 'state.sqlite');
  let fixture: ReturnType<typeof ownedRunnerFieldNativeFixture> | undefined, closed = false;
  const reopenedHandles: { close(): void }[] = [];
  try {
    const x = fixture = ownedRunnerFieldNativeFixture({ retainedSpeedBoundary: true, databasePath: path }), { f } = x;
    expect(x.originalMatch.ruleProfileId).toBe('npb-2026');
    expect(f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    x.touches.accept(x.touchSource.sourceId); x.responses.accept(x.responseSource.sourceId);
    x.bases.accept(x.baseSource.sourceId); x.fields.acceptGeometry(x.geometrySource.sourceId);
    const initial = x.fields.accept(x.source.sourceId);
    const pieces = { ...x.source, kind: 'owned_runner_field_pieces_v1' as const, sourceId: 'history-native-field',
      previousFieldSourceId: initial.source.sourceId, throughTick: x.throughTick };
    x.sources.set(pieces.sourceId, pieces); const field = x.fields.accept(pieces.sourceId);
    const model = installSyntheticObservation({ f, baseField: field }, x.runner.playerId, null);
    const source: RunnerObservationHistorySource = { kind: 'owned_runner_field_observation_history_v1', sourceId: 'history-native-1',
      sourceVersion: 'synthetic-v1', physicalPitchSourceId: x.action.sourceId, playerId: x.runner.playerId,
      baseFieldSourceId: field.source.sourceId, executionSourceId: null, prePitchRunnerSourceId: x.runner.sourceId,
      observationModelSourceId: model.observationModel.source.sourceId, previousObservationSourceId: null, view: model.observationSource.view };
    const sources = new Map([[source.sourceId, source]]), open = requireRunnerObservationHistoryStore(observations);
    const store = f.track(open(path, { readAcceptedObservation: id => sources.get(id) ?? null }));
    const physicalBefore = { fields: f.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all(),
      people: f.db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all(),
      models: f.db.prepare('SELECT * FROM world_player_observation_models ORDER BY source_id').all(),
      matches: f.db.prepare('SELECT * FROM matches ORDER BY match_id').all() };
    const first = store.accept(source.sourceId), next = { ...source, sourceId: 'history-native-2', previousObservationSourceId: source.sourceId };
    expect(first.receipt.results).toHaveLength(11); expect(first.motionRevision).toBe(x.runner.motionRevision);
    sources.set(next.sourceId, next);
    const heads = f.db.prepare('SELECT * FROM actual_field_observation_heads').all();
    const binding = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId);
    f.db.exec(`CREATE TRIGGER tamper_runner_observation AFTER INSERT ON actual_field_observations
      WHEN NEW.source_id='history-native-2' BEGIN UPDATE official_participant_bindings SET binding_json='{}'
      WHERE game_id='game-1' AND player_id='${x.runner.playerId}'; END;`);
    const witness = witnessSqliteWrite('INSERT INTO actual_field_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', writer =>
      writer.prepare('SELECT source_id FROM actual_field_observations WHERE source_id=?').get(next.sourceId)?.source_id === next.sourceId
      && writer.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId)?.binding_json === '{}');
    try { expect(() => store.accept(next.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true); }
    finally { witness.close(); }
    expect(f.db.prepare('SELECT source_id FROM actual_field_observations ORDER BY revision').all()).toEqual([{ source_id: first.source.sourceId }]);
    expect(f.db.prepare('SELECT * FROM actual_field_observation_heads').all()).toEqual(heads);
    expect(f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId)).toEqual(binding);
    f.db.exec('DROP TRIGGER tamper_runner_observation');
    const second = store.accept(next.sourceId); expect(second.history).toEqual([source, next]);
    expect(second.receipt.samples).toEqual(first.receipt.samples); expect(second.knowledge).toEqual(first.knowledge);
    expect(store.accept(source.sourceId)).toEqual(first); expect(store.accept(next.sourceId)).toEqual(second);
    closed = true; f.close(); expect(() => f.db.prepare('SELECT 1')).toThrow();
    const reader = open(path); reopenedHandles.push(reader);
    expect(reader.read(source.sourceId)).toEqual(first); expect(reader.read(next.sourceId)).toEqual(second);
    expect(reader.accept(source.sourceId)).toEqual(first); expect(reader.accept(next.sourceId)).toEqual(second);
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(path); reopenedHandles.push(db);
    expect({ fields: db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all(),
      people: db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all(),
      models: db.prepare('SELECT * FROM world_player_observation_models ORDER BY source_id').all(),
      matches: db.prepare('SELECT * FROM matches ORDER BY match_id').all() }).toEqual(physicalBefore);
    const savedRows = db.prepare('SELECT * FROM actual_field_observations ORDER BY revision').all();
    const savedHeads = db.prepare('SELECT * FROM actual_field_observation_heads').all();
    // Narrow admission-fence fixture only. The real contract blocks any matching
    // claim; this is not a completed eleven-player PlayEnd or closure receipt.
    // Keep the genuine physical history above valid for historical reads/retry.
    db.exec(`CREATE TABLE actual_live_play_fences(game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL UNIQUE,
      closure_source_id TEXT NOT NULL UNIQUE,PRIMARY KEY(game_id,play_id));`);
    db.prepare('INSERT INTO actual_live_play_fences VALUES (?,?,?,?)').run('game-1', x.actor.match.playId, x.action.sourceId, 'synthetic-admission-fence');
    expect(readOriginalPhysicalPitchPrefixFromSqlite(db, x.action.sourceId).at(-1)).toEqual(x.physical);
    expect(reader.read(source.sourceId)).toEqual(first); expect(reader.read(next.sourceId)).toEqual(second);
    const fresh = { ...next, sourceId: 'history-native-after-seal', previousObservationSourceId: next.sourceId };
    const writer = open(path, { readAcceptedObservation: id => id === fresh.sourceId ? fresh : null }); reopenedHandles.push(writer);
    expect(() => writer.accept(fresh.sourceId)).toThrow(/sealed|closure/);
    expect(writer.accept(source.sourceId)).toEqual(first); expect(writer.read(next.sourceId)).toEqual(second);
    expect(db.prepare('SELECT * FROM actual_field_observations ORDER BY revision').all()).toEqual(savedRows);
    expect(db.prepare('SELECT * FROM actual_field_observation_heads').all()).toEqual(savedHeads);
  } finally {
    try { while (reopenedHandles.length) reopenedHandles.pop()!.close(); }
    finally { try { if (fixture && !closed) { closed = true; fixture.f.close(); } }
      finally { rmSync(directory, { recursive: true, force: true }); } }
  }
}, 180_000);
