import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedEpisodeFieldBindingEvidenceFromSqlite, openSqliteBattedEpisodeFieldBindingStore,
  withBattedEpisodeFieldBindingReadPhase as phase } from './SqliteBattedEpisodeFieldBindingStore';
import { battedWorldFieldEvidenceFromSqlite, openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { AcceptedBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';

let directory: string, x: ReturnType<typeof battedWorldFieldFixture>, source: AcceptedBattedWorldFieldAction;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'episode-read-phase-'));
  x = battedWorldFieldFixture(join(directory, 'world.sqlite'));
  const binding: AcceptedBattedEpisodeFieldBinding = { sourceId: 'phase-binding', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v1', responseSourceId: x.response.source.sourceId,
    fieldCalibrationSourceId: x.geometrySource.sourceId };
  const store = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: () => binding }));
  store.accept(binding.sourceId);
  source = { ...x.source, throughTick: x.source.availableAtTick + 1000,
    episodeFieldBinding: { version: binding.version, sourceId: binding.sourceId } };
  x.sources.set(source.sourceId, source as never);
}, 60_000);
afterAll(() => { vi.restoreAllMocks(); x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('derives the adjacent current-root and current-before binding once in one Native read phase', () => {
  const own = battedWorldFieldEvidenceFromSqlite(x.f.db), value = own.derive(source);
  const before = json(x.f.db.prepare('SELECT * FROM main.batted_episode_field_bindings').all());
  const prepare = x.f.db.prepare.bind(x.f.db);
  let responseReads = 0;
  const observe = vi.spyOn(x.f.db, 'prepare').mockImplementation(sql => {
    if (sql === 'SELECT * FROM batted_contact_responses WHERE source_id=?') responseReads++;
    return prepare(sql);
  });
  try { own.currentBefore(value); } finally { observe.mockRestore(); }
  expect(json(x.f.db.prepare('SELECT * FROM main.batted_episode_field_bindings').all())).toBe(before);
  expect(x.f.db.isTransaction).toBe(false);
  expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  // One fresh response current check and one complete binding derivation.
  console.log(JSON.stringify({ kind: 'adjacent_binding_derivation_count', responseReads }));
  expect(responseReads).toBe(2);
});

it('reuses only complete derivations while reading archive identity and row bytes every time', () => {
  const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db), prepare = x.f.db.prepare.bind(x.f.db);
  let identities = 0;
  const observe = vi.spyOn(x.f.db, 'prepare').mockImplementation(sql => {
    if (sql.startsWith('SELECT * FROM main.batted_episode_field_bindings\n    WHERE source_id=')) identities++;
    return prepare(sql);
  });
  try {
    phase(x.f.db, () => {
      const first = own.read('phase-binding');
      expect(own.read('phase-binding')).toBe(first);
      expect(identities).toBe(2);
    });
  } finally { observe.mockRestore(); }
});

it('starts separate and nested phases empty and never promotes child proof', () => {
  const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
  let first: unknown;
  phase(x.f.db, () => {
    first = phase(x.f.db, () => own.read('phase-binding'));
    const parent = own.read('phase-binding');
    expect(parent).not.toBe(first); expect(json(parent)).toBe(json(first));
    expect(phase(x.f.db, () => own.read('phase-binding'))).not.toBe(parent);
    expect(own.read('phase-binding')).toBe(parent);
  });
  expect(phase(x.f.db, () => own.read('phase-binding'))).not.toBe(first);
});

it('keys completed derivation by the entire accepted Source', () => {
  const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
  phase(x.f.db, () => {
    const first = own.read('phase-binding')!;
    const changed = own.derive({ ...first.source, sourceVersion: 'another-provenance' });
    expect(changed).not.toBe(first); expect(changed.source.sourceVersion).toBe('another-provenance');
    expect(own.read('phase-binding')).toBe(first);
  });
});

it.each(['query_only', 'write_and_restore', 'rollback_rebegin'] as const)('rejects %s within an owned phase', change => {
  const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db);
  x.f.db.exec('BEGIN');
  try {
    expect(() => phase(x.f.db, () => {
      own.read('phase-binding');
      if (change === 'query_only') x.f.db.exec('PRAGMA query_only=OFF');
      else if (change === 'rollback_rebegin') x.f.db.exec('ROLLBACK; BEGIN');
      else {
        x.f.db.exec('PRAGMA query_only=OFF');
        x.f.db.exec('UPDATE main.batted_episode_field_bindings SET source_version=source_version');
        x.f.db.exec('PRAGMA query_only=ON');
      }
      own.read('phase-binding');
    })).toThrow();
  } finally { if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK'); x.f.db.exec('PRAGMA query_only=OFF'); }
  expect(own.read('phase-binding')).not.toBeNull();
});

it.each(['temp', 'attached'] as const)('rejects %s authority before enrollment', change => {
  x.f.db.exec(change === 'temp' ? 'CREATE TEMP TABLE unexpected (id TEXT)' : "ATTACH ':memory:' AS unexpected");
  try { expect(() => phase(x.f.db, () => undefined)).toThrow(/main-only/); }
  finally { x.f.db.exec(change === 'temp' ? 'DROP TABLE temp.unexpected' : 'DETACH unexpected'); }
});

it('rechecks the current head even after the historical binding was authenticated', () => {
  const own = battedEpisodeFieldBindingEvidenceFromSqlite(x.f.db), original = own.read('phase-binding')!;
  x.f.db.exec('BEGIN');
  try {
    x.f.db.prepare("UPDATE batted_ball_flight_heads SET source_id='foreign' WHERE physical_pitch_source_id=?").run(original.physicalPitchSourceId);
    phase(x.f.db, () => {
      expect(own.read('phase-binding')).toEqual(original);
      expect(() => own.current(original)).toThrow('batted flight progress head or owned prefix differs');
    });
  } finally { x.f.db.exec('ROLLBACK'); }
});

it('begins a fresh proof after the peer callback and rejects a changed current head', () => {
  const pitchId = x.response.touch.worldContact.flight.source.physicalPitchSourceId;
  const head = x.f.db.prepare('SELECT source_id FROM batted_ball_flight_heads WHERE physical_pitch_source_id=?').get(pitchId)!;
  const store = openSqliteBattedWorldFieldStore(x.f.path, { read: () => {
    x.f.db.prepare("UPDATE batted_ball_flight_heads SET source_id='foreign' WHERE physical_pitch_source_id=?").run(pitchId);
    return x.response;
  } }, x.bases, x.authority);
  try {
    expect(() => store.accept(source.sourceId)).toThrow('batted flight progress head or owned prefix differs');
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
  } finally {
    store.close(); x.f.db.prepare('UPDATE batted_ball_flight_heads SET source_id=? WHERE physical_pitch_source_id=?').run(head.source_id, pitchId);
  }
});

it('begins a fresh proof after insertion and rolls back a trigger-altered binding', () => {
  const before = json(x.f.db.prepare('SELECT * FROM batted_episode_field_bindings').all());
  x.f.db.exec(`CREATE TRIGGER corrupt_binding_after_field AFTER INSERT ON batted_world_field_actions
    BEGIN UPDATE batted_episode_field_bindings SET source_hash='corrupt'; END`);
  try {
    expect(() => x.fields.accept(source.sourceId)).toThrow(/corrupt episode field binding/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
    expect(json(x.f.db.prepare('SELECT * FROM batted_episode_field_bindings').all())).toBe(before);
  } finally { x.f.db.exec('DROP TRIGGER corrupt_binding_after_field'); }
});

it('accepts, retries and re-reads the original v1 field through the three separate read phases', () => {
  const value = x.fields.accept(source.sourceId);
  expect(value.rootKind).toBe('episode_field_binding_v1');
  expect(x.fields.accept(source.sourceId)).toEqual(value);
  expect(x.fields.read(source.sourceId)).toEqual(value);
  expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(1);
});
