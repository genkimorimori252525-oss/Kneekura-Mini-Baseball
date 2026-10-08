import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedBattedEpisodeFieldBinding, DurableBattedEpisodeFieldBinding, SqliteBattedEpisodeFieldBindingStore } from './BattedEpisodeFieldBinding';
import { battedEpisodeFieldBindingEvidenceFromSqlite, openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';

let directory: string, x: ReturnType<typeof battedWorldFieldFixture>, bindings: SqliteBattedEpisodeFieldBindingStore;
let source: AcceptedBattedEpisodeFieldBinding;
const accepted = new Map<string, AcceptedBattedEpisodeFieldBinding>();
const exists = () => !!x.f.db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='batted_episode_field_bindings'").get();
const rows = () => exists() ? Number(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n) : 0;
const archives = () => json(['physical_pitch_progress_actions', 'batted_ball_flights', 'batted_world_contacts', 'batted_world_models',
  'batted_contact_response_models', 'batted_contact_responses', 'batted_world_base_geometries', 'batted_world_field_geometries',
  'batted_world_field_actions', 'batted_world_field_heads'].map(table => ({ table, rows: x.f.db.prepare(`SELECT * FROM main.${table}`).all() })));
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'episode-field-binding-'));
  x = battedWorldFieldFixture(join(directory, 'world.sqlite'));
  const pitch = x.response.touch.worldContact.flight.physicalPitch;
  expect(pitch.result.pitch.resolution.kind).toBe('recorded');
  expect(pitch.result.pitch.resolution.timeline.events.filter(event => event.kind === 'BatBallContact')).toHaveLength(1);
  expect(x.response.result.kind).toBe('airborne');
  expect(x.response.touch.worldContact.flight.source.searchDurationTicks).toBe(0);
  expect(x.response.touch.worldContact.actors).toHaveLength(50);
  expect(pitch.frame.batterActor!.defenderBindings).toHaveLength(9);
  expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_world_field_actions').get()!.n).toBe(0);
}, 60_000);
beforeEach(() => {
  if (exists()) x.f.db.exec('DELETE FROM main.batted_episode_field_bindings');
  source = { sourceId: 'episode-field-binding', sourceVersion: 'accepted-fixture-v1', version: 'batted_episode_field_binding_v1',
    responseSourceId: x.response.source.sourceId, fieldCalibrationSourceId: x.geometrySource.sourceId };
  accepted.clear(); accepted.set(source.sourceId, source);
  bindings = openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: id => accepted.get(id) ?? null });
});
afterEach(() => bindings?.close());
afterAll(() => { x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('binds the genuine original contact to immutable accepted field calibration without changing existing rows', () => {
  // This is the first genuine behavioral RED. Removing acceptance (or using the
  // throwing scaffold) fails only after the real pitch/response/calibration setup.
  const before = archives(), pitch = x.response.touch.worldContact.flight.physicalPitch;
  const contact = pitch.result.pitch.resolution.timeline.events.find(event => event.kind === 'BatBallContact')!;
  let value: DurableBattedEpisodeFieldBinding | undefined;
  expect(() => { value = bindings.accept(source.sourceId); }).not.toThrow();
  expect(value).toEqual({ source, gameId: pitch.frame.gameId, playId: pitch.frame.match.playId,
    physicalPitchSourceId: pitch.source.sourceId, contactSequence: contact.sequence, contactTick: contact.tick,
    response: x.response, calibration: x.geometry, geometry: x.geometry.geometry });
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value!.geometry)).toBe(true);
  expect(rows()).toBe(1);
  expect(archives()).toBe(before);
  expect(value).not.toHaveProperty('resume');
  expect(value).not.toHaveProperty('nextPitch');
});

it('replays exact immutable references without acceptance callbacks', () => {
  const original = bindings.accept(source.sourceId), before = archives();
  accepted.clear();
  expect(bindings.accept(source.sourceId)).toEqual(original);
  expect(bindings.read(source.sourceId)).toEqual(original);
  expect(rows()).toBe(1);
  expect(archives()).toBe(before);
});
it('requires a known explicitly accepted Source without installing schema during an evidence read', () => {
  expect(bindings.read('unknown')).toBeNull();
  expect(() => bindings.accept('unknown')).toThrow();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const empty = new DatabaseSync(':memory:');
  try {
    expect(battedEpisodeFieldBindingEvidenceFromSqlite(empty).read('unknown')).toBeNull();
    expect(empty.prepare('SELECT name FROM main.sqlite_master').all()).toEqual([]);
    expect(empty.isTransaction).toBe(false);
  } finally { empty.close(); }
  expect(rows()).toBe(0);
});
it.each(['world', 'geometry', 'model', 'count', 'out', 'physicalPitchSourceId', 'contactSequence'])(
  'rejects caller-supplied %s rather than accepting another authority route', key => {
    accepted.set(source.sourceId, { ...source, [key]: true } as never);
    expect(() => bindings.accept(source.sourceId)).toThrow();
    expect(rows()).toBe(0);
  });
it.each(['responseSourceId', 'fieldCalibrationSourceId'] as const)('rejects an unknown %s reference', key => {
  accepted.set(source.sourceId, { ...source, [key]: 'foreign-reference' });
  expect(() => bindings.accept(source.sourceId)).toThrow();
  expect(rows()).toBe(0);
});
it('rejects getter inputs without evaluating them', () => {
  let reads = 0;
  accepted.set(source.sourceId, Object.defineProperty({ ...source }, 'responseSourceId', {
    enumerable: true, get: () => { reads++; return source.responseSourceId; },
  }));
  expect(() => bindings.accept(source.sourceId)).toThrow();
  expect(reads).toBe(0); expect(rows()).toBe(0);
});
it('rejects changed same-Source references and a second identity for the same pitch', () => {
  const original = bindings.accept(source.sourceId);
  for (const key of ['responseSourceId', 'fieldCalibrationSourceId'] as const) {
    accepted.set(source.sourceId, { ...source, [key]: 'changed' });
    expect(() => bindings.accept(source.sourceId)).toThrow();
  }
  accepted.set(source.sourceId, source);
  const alias = { ...source, sourceId: 'second-binding' }; accepted.set(alias.sourceId, alias);
  expect(() => bindings.accept(alias.sourceId)).toThrow();
  expect(bindings.read(source.sourceId)).toEqual(original);
  expect(rows()).toBe(1);
});
it.each(['source_version', 'binding_version', 'game_id', 'play_id', 'physical_pitch_source_id', 'response_source_id',
  'field_calibration_source_id', 'source_hash', 'snapshot_hash'])(
  'rejects a corrupted %s mirror', column => {
    bindings.accept(source.sourceId);
    x.f.db.prepare(`UPDATE main.batted_episode_field_bindings SET ${column}=? WHERE source_id=?`).run('changed', source.sourceId);
    expect(() => bindings.read(source.sourceId)).toThrow();
  });
it('discovers hidden pitch/response ownership through archived Source and snapshot claims', () => {
  bindings.accept(source.sourceId);
  x.f.db.exec("UPDATE main.batted_episode_field_bindings SET physical_pitch_source_id='hidden',response_source_id='hidden',game_id='hidden'");
  const alias = { ...source, sourceId: 'hidden-alias' }; accepted.set(alias.sourceId, alias);
  expect(() => bindings.accept(alias.sourceId)).toThrow();
  expect(rows()).toBe(1);
});
it('discovers a moved Source identity instead of treating it as unknown', () => {
  bindings.accept(source.sourceId);
  x.f.db.prepare('UPDATE main.batted_episode_field_bindings SET source_id=? WHERE source_id=?').run('moved', source.sourceId);
  expect(() => bindings.read(source.sourceId)).toThrow();
  expect(rows()).toBe(1);
});
it.each(['batted_world_field_geometries', 'batted_world_base_geometries', 'batted_world_models', 'batted_contact_response_models',
  'batted_contact_responses', 'batted_world_contacts', 'physical_pitch_progress_actions'])(
  'rederives and rejects corrupt original %s dependencies', table => {
    const original = x.f.db.prepare(`SELECT source_id,source_hash FROM main.${table}`).all();
    try {
      x.f.db.exec(`UPDATE main.${table} SET source_hash='corrupt'`);
      expect(() => bindings.accept(source.sourceId)).toThrow();
      expect(rows()).toBe(0);
    } finally {
      for (const row of original) x.f.db.prepare(`UPDATE main.${table} SET source_hash=? WHERE source_id=?`).run(row.source_hash!, row.source_id!);
    }
  });
