import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedBattedEpisodeFieldBinding, SqliteBattedEpisodeFieldBindingStore } from './BattedEpisodeFieldBinding';
import { battedEpisodeFieldBindingEvidenceFromSqlite, openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';

let directory: string, x: ReturnType<typeof battedWorldFieldFixture>, bindings: SqliteBattedEpisodeFieldBindingStore;
let source: AcceptedBattedEpisodeFieldBinding;
const exists = () => !!x.f.db.prepare("SELECT 1 FROM main.sqlite_master WHERE name='batted_episode_field_bindings'").get();
const bytes = () => json(['batted_world_field_geometries', 'batted_contact_responses', 'batted_ball_flights', 'batted_world_models',
  'batted_contact_response_models'].map(table => ({ table, rows: x.f.db.prepare(`SELECT * FROM main.${table}`).all() })));
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'episode-field-wal-'));
  x = battedWorldFieldFixture(join(directory, 'world.sqlite'));
}, 60_000);
beforeEach(() => {
  if (exists()) x.f.db.exec('DELETE FROM main.batted_episode_field_bindings');
  source = { sourceId: 'episode-binding', sourceVersion: 'fixture-v1', version: 'batted_episode_field_binding_v1',
    responseSourceId: x.response.source.sourceId, fieldCalibrationSourceId: x.geometrySource.sourceId };
  bindings = openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: id => id === source.sourceId ? source : null });
});
afterEach(() => bindings?.close());
afterAll(() => { x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it.each(['batted_world_field_geometries', 'batted_contact_responses', 'batted_world_models', 'batted_contact_response_models'])(
  'rolls back a late %s trigger mutation and its binding insertion together', table => {
    expect(exists()).toBe(true);
    const original = bytes();
    x.f.db.exec(`CREATE TRIGGER corrupt_episode_binding AFTER INSERT ON batted_episode_field_bindings
      BEGIN UPDATE ${table} SET source_hash='corrupt'; END`);
    try {
      expect(() => bindings.accept(source.sourceId)).toThrow();
      expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(0);
      expect(bytes()).toBe(original);
    } finally { x.f.db.exec('DROP TRIGGER corrupt_episode_binding'); }
    expect(bindings.accept(source.sourceId).source).toEqual(source);
  });
it('rejects an insert-delete trigger side effect even when the final dependency bytes match', () => {
  const original = bytes();
  x.f.db.exec(`CREATE TABLE episode_side_effect(value TEXT);
    CREATE TRIGGER hidden_episode_write AFTER INSERT ON batted_episode_field_bindings BEGIN
    INSERT INTO episode_side_effect VALUES ('not-owned'); DELETE FROM episode_side_effect; END`);
  try {
    expect(() => bindings.accept(source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_episode_field_bindings').get()!.n).toBe(0);
    expect(bytes()).toBe(original);
  } finally { x.f.db.exec('DROP TRIGGER hidden_episode_write; DROP TABLE episode_side_effect'); }
});
it('uses the writer-local snapshot rather than a peer older committed dependency and preserves its transaction', () => {
  const original = bindings.accept(source.sourceId), own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
  const queryOnly = x.f.db.prepare('PRAGMA query_only').get()!.query_only;
  x.f.db.exec('BEGIN IMMEDIATE');
  try {
    x.f.db.exec("UPDATE main.batted_world_field_geometries SET source_hash='writer-local'");
    expect(bindings.read(source.sourceId)).toEqual(original);
    expect(() => own.read(source.sourceId)).toThrow();
    expect(x.f.db.isTransaction).toBe(true);
    expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(queryOnly);
    expect(x.f.db.prepare('SELECT source_hash FROM main.batted_world_field_geometries').get()!.source_hash).toBe('writer-local');
  } finally { x.f.db.exec('ROLLBACK'); }
  expect(own.read(source.sourceId)).toEqual(original);
});
it('keeps a successful enclosing snapshot and its query-only setting intact', () => {
  const original = bindings.accept(source.sourceId), own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
  x.f.db.exec('BEGIN; PRAGMA query_only=ON');
  try {
    expect(own.read(source.sourceId)).toEqual(original);
    expect(x.f.db.isTransaction).toBe(true);
    expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
  } finally { x.f.db.exec('PRAGMA query_only=OFF; ROLLBACK'); }
});
it.each(['temp', 'attached'] as const)('rejects %s substitution for main-only evidence', kind => {
  bindings.accept(source.sourceId);
  const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
  if (kind === 'temp') x.f.db.exec('CREATE TEMP TABLE batted_world_field_geometries AS SELECT * FROM main.batted_world_field_geometries');
  else x.f.db.exec("ATTACH ':memory:' AS substitute");
  try { expect(() => own.read(source.sourceId)).toThrow(/main|storage|authority/); }
  finally { x.f.db.exec(kind === 'temp' ? 'DROP TABLE temp.batted_world_field_geometries' : 'DETACH substitute'); }
});

it('closes every physical owner and reopens the real-file receipt without any callbacks', () => {
  const localDirectory = mkdtempSync(join(tmpdir(), 'episode-binding-full-reopen-'));
  const local = battedWorldFieldFixture(join(localDirectory, 'world.sqlite'));
  const accepted: AcceptedBattedEpisodeFieldBinding = { ...source, responseSourceId: local.response.source.sourceId,
    fieldCalibrationSourceId: local.geometrySource.sourceId };
  const store = openSqliteBattedEpisodeFieldBindingStore(local.f.path, { readAcceptedBinding: id => id === accepted.sourceId ? accepted : null });
  const path = local.f.path;
  let value: string, original: string;
  try {
    original = json(local.f.db.prepare('SELECT * FROM main.batted_world_field_geometries').all());
    value = json(store.accept(accepted.sourceId));
  } finally { store.close(); local.f.close(); }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const reopened = new DatabaseSync(path, { readOnly: true });
  try {
    expect(json(battedEpisodeFieldBindingEvidenceFromSqlite(reopened).read(accepted.sourceId))).toBe(value!);
    expect(json(reopened.prepare('SELECT * FROM main.batted_world_field_geometries').all())).toBe(original!);
    expect(reopened.isTransaction).toBe(false);
  } finally { reopened.close(); rmSync(localDirectory, { recursive: true, force: true }); }
});
