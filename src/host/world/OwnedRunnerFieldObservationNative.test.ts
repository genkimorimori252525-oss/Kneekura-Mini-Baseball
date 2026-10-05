import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ownedRunnerFieldNativeFixture } from './OwnedRunnerFieldNativeFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { ownedRunnerFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import type { OwnedRunnerFieldObservationSource } from './OwnedRunnerFieldObservation';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** One genuine registered-profile chain. Sensory output remains an unpersisted projection. */
it('rederives the original runner sensory projection from a fully closed real file without creating observation or consumption rows', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-sensory-native-')), path = join(directory, 'state.sqlite');
  let fixture: ReturnType<typeof ownedRunnerFieldNativeFixture> | undefined, closed = false;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let reopened: InstanceType<typeof DatabaseSync> | undefined;
  try {
    const x = fixture = ownedRunnerFieldNativeFixture({ retainedSpeedBoundary: true, databasePath: path }), { f } = x;
    expect(x.originalMatch.ruleProfileId).toBe('npb-2026');
    expect(f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    x.touches.accept(x.touchSource.sourceId); x.responses.accept(x.responseSource.sourceId);
    x.bases.accept(x.baseSource.sourceId); x.fields.acceptGeometry(x.geometrySource.sourceId);
    const first = x.fields.accept(x.source.sourceId);
    const pieceSource = { ...x.source, kind: 'owned_runner_field_pieces_v1' as const, sourceId: 'runner-sensory-native-piece',
      previousFieldSourceId: first.source.sourceId, throughTick: x.throughTick };
    x.sources.set(pieceSource.sourceId, pieceSource); const field = x.fields.accept(pieceSource.sourceId);
    const installed = installSyntheticObservation({ f, baseField: field }, x.runner.playerId, null);
    const source: OwnedRunnerFieldObservationSource = { kind: 'owned_runner_field_observation_v1', sourceId: 'runner-sensory-native', sourceVersion: 'synthetic-v1',
      physicalPitchSourceId: x.action.sourceId, playerId: x.runner.playerId, fieldSourceId: field.source.sourceId,
      prePitchRunnerSourceId: x.runner.sourceId, observationModelSourceId: installed.observationModel.source.sourceId, view: installed.observationSource.view };
    const rows = (db: InstanceType<typeof DatabaseSync>) => ({ schema: db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all(),
      fields: db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all(), heads: db.prepare('SELECT * FROM batted_world_field_heads').all(),
      observations: db.prepare('SELECT * FROM actual_field_observations').all(), observationHeads: db.prepare('SELECT * FROM actual_field_observation_heads').all(),
      people: db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all(),
      models: db.prepare('SELECT * FROM world_player_observation_models ORDER BY source_id').all(),
      matches: db.prepare('SELECT * FROM matches ORDER BY match_id').all() });
    const before = rows(f.db), derive = ownedRunnerFieldObservationEvidenceFromSqlite(f.db).derive, value = derive(source);
    expect(value.receipt.perceived.observerId).toBe(x.runner.playerId);
    expect(value.receipt.results).toHaveLength(11);
    expect(value.receipt.at.elapsedSeconds).toBe(field.field.motion.world.moment.elapsedSeconds);
    expect(value.originalPublicContext).toEqual({ kind: 'original_official_occupancy_v1', startingBase: 1, normalNextBase: 2,
      actorSourceId: x.actor.source.sourceId, officialRevision: x.actor.officialRevision, matchHash: hash(x.actor.match), availableAtTick: x.actor.world.tick });
    expect(value.knowledge).toEqual({ status: 'pending', knownContext: null, force: 'unavailable', tagUp: 'unavailable',
      cueGeneration: 'unavailable', consumedSignals: [], perceivedCues: [] });
    expect(value.receipt.perceived.knownContext).toBeNull(); expect(value.receipt.perceived.communications).toEqual([]);
    expect(value.motionRevision).toBe(x.runner.motionRevision); expect(value.dependencyHashes.field).toBe(hash(field));
    expect(derive(source)).toEqual(value); expect(rows(f.db)).toEqual(before);
    closed = true; f.close();
    expect(() => f.db.prepare('SELECT 1')).toThrow();
    reopened = new DatabaseSync(path, { readOnly: true });
    expect(reopened.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(ownedRunnerFieldObservationEvidenceFromSqlite(reopened).derive(source)).toEqual(value);
    expect(rows(reopened)).toEqual(before);
    for (const name of ['decisionInput', 'decision', 'motionIntent', 'activeCommand', 'playEnd', 'ruleResult']) expect(value).not.toHaveProperty(name);
  } finally {
    try { reopened?.close(); } finally { try { if (fixture && !closed) { closed = true; fixture.f.close(); } }
      finally { rmSync(directory, { recursive: true, force: true }); } }
  }
}, 180_000);
