import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import * as calibrationOwner from './BattedWorldFieldCalibrationEvidenceFromSqlite';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame, openSqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

it('shares physical ancestry only inside each bound-field prepare and verification phase', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bound-field-read-phase-'));
  const x = battedWorldFieldFixture(join(directory, 'state.sqlite'));
  const bindingSource = { sourceId: 'field-binding', sourceVersion: 'fixture-v1', version: 'batted_episode_field_binding_v1' as const,
    responseSourceId: x.response.source.sourceId, fieldCalibrationSourceId: x.geometrySource.sourceId };
  const bindings = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: () => bindingSource }));
  bindings.accept(bindingSource.sourceId);
  const source = { ...x.source, episodeFieldBinding: { sourceId: bindingSource.sourceId, version: bindingSource.version } };
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let connection: import('node:sqlite').DatabaseSync | undefined, peerReads = 0;
  const frames: (object | null)[] = [], replayFrames: (object | null)[] = [];
  const originalCalibration = calibrationOwner.battedWorldFieldCalibrationEvidenceFromSqlite;
  const originalActor = actorOwner.readPhysicalPlateAppearanceActorFromSqlite;
  // Both witnesses delegate the real owners unchanged. The first factory is
  // the field writer's own calibration reader, which identifies its connection.
  const geometryWitness = vi.spyOn(calibrationOwner, 'battedWorldFieldCalibrationEvidenceFromSqlite').mockImplementation(db => {
    if (!(db instanceof DatabaseSync)) throw new Error('bound-field witness requires Native ownership');
    connection ??= db;
    const own = originalCalibration(db);
    return { ...own, readGeometry(id) {
      if (db === connection) frames.push(activeBattedWorldFieldReadFrame(db));
      return own.readGeometry(id);
    } };
  });
  const replayWitness = vi.spyOn(actorOwner, 'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((db, id) => {
    if (db === connection) replayFrames.push(activeBattedWorldFieldReadFrame(db));
    return originalActor(db, id);
  });
  const store = x.f.track(openSqliteBattedWorldFieldStore(x.f.path, { read(id) {
    peerReads++;
    expect(connection!.isTransaction).toBe(false);
    expect(activeBattedWorldFieldReadFrame(connection!)).toBeNull();
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    return x.responses.read(id);
  } }, x.bases, { readAcceptedGeometry: () => null, readAcceptedAction: () => source }));
  try {
    const pitchRows = x.f.db.prepare('SELECT rowid,* FROM physical_pitch_progress_actions').all();
    x.f.db.exec(`CREATE TRIGGER corrupt_field_pitch AFTER INSERT ON batted_world_field_actions BEGIN
      UPDATE physical_pitch_progress_actions SET source_hash='field-trigger-corruption'; END`);
    const written = witnessSqliteWrite('INSERT INTO batted_world_field_actions VALUES (?,?,?,?,?,?,?,?,?,?,?)', db =>
      db.prepare('SELECT source_hash FROM physical_pitch_progress_actions').get()!.source_hash === 'field-trigger-corruption');
    try {
      expect(() => store.accept(source.sourceId)).toThrow();
      expect(written.wasReached()).toBe(true);
    } finally { written.close(); }
    expect(x.f.db.prepare('SELECT rowid,* FROM physical_pitch_progress_actions').all()).toEqual(pitchRows);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_actions').all()).toEqual([]);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_heads').all()).toEqual([]);
    x.f.db.exec('DROP TRIGGER corrupt_field_pitch'); frames.length = 0; replayFrames.length = 0;

    const value = store.accept(source.sourceId);
    expect(frames).toHaveLength(3);
    expect(frames.every(frame => frame !== null)).toBe(true);
    expect(new Set(frames).size).toBe(3);
    expect(replayFrames.length).toBeGreaterThan(0);
    expect(replayFrames.every(frame => frames.includes(frame))).toBe(true);
    const rows = x.f.db.prepare('SELECT rowid,* FROM batted_world_field_actions').all();
    expect(store.accept(source.sourceId)).toEqual(value);
    expect(store.read(source.sourceId)).toEqual(value);
    expect(x.f.db.prepare('SELECT rowid,* FROM batted_world_field_actions').all()).toEqual(rows);
    expect(peerReads).toBe(2);
    expect(connection!.isTransaction).toBe(false);
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { replayWitness.mockRestore(); geometryWitness.mockRestore(); x.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 45_000);
