import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import * as calibrationOwner from './BattedWorldFieldCalibrationEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('derives once in each public admission phase and starts fresh after callbacks, writes and independent retries', () => {
  const directory = mkdtempSync(join(tmpdir(), 'episode-owner-phase-'));
  const x = battedWorldFieldFixture(join(directory, 'world.sqlite'));
  const source: AcceptedBattedEpisodeFieldBinding = { sourceId: 'owner-phase-binding', sourceVersion: 'explicit-fixture-v1',
    version: 'batted_episode_field_binding_v1', responseSourceId: x.response.source.sourceId, fieldCalibrationSourceId: x.geometrySource.sourceId };
  const originalFactory = calibrationOwner.battedWorldFieldCalibrationEvidenceFromSqlite;
  const frames: (object | null)[] = [];
  let connection: import('node:sqlite').DatabaseSync | undefined, callbacks = 0;
  // Passive witness around the actual lower owner, preserving its statements,
  // returned values and failures. Every full binding derive reads its geometry.
  const observe = vi.spyOn(calibrationOwner, 'battedWorldFieldCalibrationEvidenceFromSqlite').mockImplementation(db => {
    if (!(db instanceof DatabaseSync)) throw new Error('owner phase witness requires the actual Native connection');
    connection = db;
    const own = originalFactory(db);
    return { ...own, readGeometry(id) { frames.push(activeBattedWorldFieldReadFrame(db)); return own.readGeometry(id); } };
  });
  const authority = () => {
    callbacks++;
    expect(connection!.isTransaction).toBe(false);
    expect(activeBattedWorldFieldReadFrame(connection!)).toBeNull();
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    return source;
  };
  const store = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: authority }));
  try {
    const value = store.accept(source.sourceId);
    expect(frames).toHaveLength(3);
    expect(frames.every(frame => frame !== null)).toBe(true);
    expect(new Set(frames).size).toBe(3);
    const archived = json(x.f.db.prepare('SELECT rowid,* FROM batted_episode_field_bindings').all());
    expect(store.accept(source.sourceId)).toEqual(value);
    expect(frames).toHaveLength(5); // Two separate retry reads surround its callback.
    expect(store.read(source.sourceId)).toEqual(value);
    expect(frames).toHaveLength(6);
    expect(new Set(frames).size).toBe(6); expect(callbacks).toBe(2);
    expect(json(x.f.db.prepare('SELECT rowid,* FROM batted_episode_field_bindings').all())).toBe(archived);

    const hash = x.f.db.prepare('SELECT source_hash FROM batted_episode_field_bindings').get()!.source_hash;
    const changed = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: () => {
      authority();
      x.f.db.exec("UPDATE batted_episode_field_bindings SET source_hash='changed-after-callback'");
      return source;
    } }));
    try { expect(() => changed.accept(source.sourceId)).toThrow(/corrupt episode field binding/); }
    finally { x.f.db.prepare('UPDATE batted_episode_field_bindings SET source_hash=?').run(hash); }
    expect(store.read(source.sourceId)).toEqual(value);
    expect(connection!.isTransaction).toBe(false);
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { observe.mockRestore(); x.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 45_000);
