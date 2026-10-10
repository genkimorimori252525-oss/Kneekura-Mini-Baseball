import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { openSqliteActualLivePlayRuntimeStore } from './SqliteActualLivePlayRuntimeStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

it('reuses original pitch replay only within each runtime read phase and rechecks after writes and callbacks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'actual-runtime-read-phase-'));
  const x = physicalPlateAppearanceActorFixture(join(directory, 'state.sqlite'));
  x.actors.accept(x.source.sourceId);
  const pitch = x.pitch(0, 0);
  const source = { sourceId: 'runtime', sourceVersion: 'fixture-v1', capability: 'causal_original_live_play_runtime_v1' as const,
    physicalPitchSourceId: pitch.source.sourceId };
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const frames: (object | null)[] = [];
  let connection: import('node:sqlite').DatabaseSync | undefined, corruptInCallback = false;
  // Passive witness at the real pitch replay's actor authentication. The actor
  // owner executes unchanged; no scope, replay result or receipt is substituted.
  const original = actorOwner.readPhysicalPlateAppearanceActorFromSqlite;
  const observe = vi.spyOn(actorOwner, 'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((db, id) => {
    if (!(db instanceof DatabaseSync)) throw new Error('runtime witness requires the actual Native connection');
    connection = db; frames.push(activeBattedWorldFieldReadFrame(db));
    return original(db, id);
  });
  const store = x.f.track(openSqliteActualLivePlayRuntimeStore(x.f.path, { readAcceptedRuntime() {
    if (connection) {
      expect(connection.isTransaction).toBe(false);
      expect(activeBattedWorldFieldReadFrame(connection)).toBeNull();
      expect(connection.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    }
    if (corruptInCallback) x.f.db.exec("UPDATE actual_live_play_runtimes SET source_hash='callback-corruption'");
    return source;
  } }));
  try {
    const pitchRows = x.f.db.prepare('SELECT rowid,* FROM physical_pitch_progress_actions').all();
    x.f.db.exec(`CREATE TRIGGER corrupt_runtime_pitch AFTER INSERT ON actual_live_play_runtimes BEGIN
      UPDATE physical_pitch_progress_actions SET source_hash='trigger-corruption'; END`);
    const written = witnessSqliteWrite('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?,?,?,?)', db =>
      db.prepare('SELECT source_hash FROM physical_pitch_progress_actions').get()!.source_hash === 'trigger-corruption');
    try {
      expect(() => store.accept(source.sourceId)).toThrow(/original physical pitch/);
      expect(written.wasReached()).toBe(true);
    } finally { written.close(); }
    expect(x.f.db.prepare('SELECT rowid,* FROM physical_pitch_progress_actions').all()).toEqual(pitchRows);
    expect(x.f.db.prepare('SELECT * FROM actual_live_play_runtimes').all()).toEqual([]);
    x.f.db.exec('DROP TRIGGER corrupt_runtime_pitch'); frames.length = 0;

    const value = store.accept(source.sourceId);
    expect(frames).toHaveLength(3);
    expect(frames.every(frame => frame !== null)).toBe(true);
    expect(new Set(frames).size).toBe(3);
    const rows = x.f.db.prepare('SELECT rowid,* FROM actual_live_play_runtimes').all();
    expect(store.accept(source.sourceId)).toEqual(value);
    expect(frames).toHaveLength(5);
    expect(store.read(source.sourceId)).toEqual(value);
    expect(frames).toHaveLength(6); expect(new Set(frames).size).toBe(6);
    expect(x.f.db.prepare('SELECT rowid,* FROM actual_live_play_runtimes').all()).toEqual(rows);

    corruptInCallback = true;
    expect(() => store.accept(source.sourceId)).toThrow(/runtime original ownership differs/);
    expect(connection!.isTransaction).toBe(false);
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { observe.mockRestore(); x.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
