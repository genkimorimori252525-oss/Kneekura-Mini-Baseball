import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldFieldFixture as fixture } from './BattedWorldFieldFixtures.test-support';
import { openSqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedWorldMotionStore, type AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';

const path = () => join(mkdtempSync(join(tmpdir(), 'batted-field-wal-')), 'state.sqlite');
it.each([
  ['response', "UPDATE batted_contact_responses SET source_hash='changed';"],
  ['Person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['base geometry', "UPDATE batted_world_base_geometries SET snapshot_hash='changed';"],
  ['bag geometry', "UPDATE batted_world_field_geometries SET source_hash='changed';"],
  ['own mirror', "UPDATE batted_world_field_actions SET geometry_source_id='missing';"],
  ['own Source', "UPDATE batted_world_field_actions SET source_hash='changed';"],
  ['own head', 'UPDATE batted_world_field_heads SET revision=revision+1;'],
])('rolls back late %s mutation with both original field rows and head absent, then retries', (name, sql) => {
  const x = fixture(path());
  try {
    const table = name === 'own head' ? 'batted_world_field_heads' : 'batted_world_field_actions';
    x.f.db.exec(`CREATE TRIGGER mutate_field AFTER INSERT ON ${table} BEGIN ${sql} END`);
    expect(() => x.fields.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_heads').get()).toEqual({ n: 0 });
    expect(x.responses.read(x.response.source.sourceId)).toEqual(x.response);
    expect(x.fields.readGeometry(x.geometrySource.sourceId)).toEqual(x.geometry);
    x.f.db.exec('DROP TRIGGER mutate_field');
    expect(x.fields.accept(x.source.sourceId).field.baseContacts[0].baseId).toBe('third');
  } finally { x.f.close(); }
});
it('rechecks an own profile changed by a peer getter before the transaction and writes no field action', () => {
  const x = fixture(path());
  try {
    const fields = x.f.track(openSqliteBattedWorldFieldStore(x.f.path, { read: () => {
      x.f.db.exec("UPDATE batted_contact_responses SET snapshot_hash='changed'"); return x.response;
    } }, x.bases, x.authority));
    expect(() => fields.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});
it('keeps original historical actions after actual recovery and rejects a fresh stale append', () => {
  const x = fixture(path());
  try {
    const first = x.fields.accept(x.source.sourceId), rest = { sourceEventId: 'field-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    x.f.activities.set(rest.sourceEventId, rest); x.f.workload.apply(rest.sourceEventId, 0);
    expect(x.fields.read(first.source.sourceId)).toEqual(first);
    expect(x.fields.accept(first.source.sourceId)).toEqual(first);
    const next = { ...x.source, sourceId: 'field-after-rest', previousFieldSourceId: x.source.sourceId,
      throughTick: first.field.motion.world.moment.ball.tick + 1000 };
    x.sources.set(next.sourceId, next);
    expect(() => x.fields.accept(next.sourceId)).toThrow(/workload/);
  } finally { x.f.close(); }
});
it('does not replay future field Source payloads for a bounded original read, but proves all future metadata', () => {
  const x = fixture(path());
  try {
    const first = x.fields.accept(x.source.sourceId), next = { ...x.source, sourceId: 'field-next', previousFieldSourceId: x.source.sourceId,
      throughTick: first.field.motion.world.moment.ball.tick + 1000 };
    x.sources.set(next.sourceId, next); x.fields.accept(next.sourceId);
    x.f.db.prepare("UPDATE batted_world_field_actions SET source_json='deliberately-invalid-future' WHERE source_id=?").run(next.sourceId);
    expect(x.fields.read(first.source.sourceId)).toEqual(first);
    expect(() => x.fields.read(next.sourceId)).toThrow();
    x.f.db.prepare('UPDATE batted_world_field_actions SET revision=1.5 WHERE source_id=?').run(next.sourceId);
    expect(() => x.fields.read(first.source.sourceId)).toThrow(/prefix|metadata/);
  } finally { x.f.close(); }
});
it('finds a hidden original field prefix from owned Source and rejects a fresh root or competing old motion', () => {
  const x = fixture(path());
  try {
    x.fields.accept(x.source.sourceId);
    x.f.db.exec("UPDATE batted_world_field_actions SET physical_pitch_source_id='foreign-pitch',response_source_id='foreign-response'; UPDATE batted_world_field_heads SET physical_pitch_source_id='foreign-pitch',response_source_id='foreign-response';");
    const restarted = { ...x.source, sourceId: 'field-silent-restart', previousFieldSourceId: null };
    x.sources.set(restarted.sourceId, restarted);
    expect(() => x.fields.accept(restarted.sourceId)).toThrow(/prefix|metadata/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()).toEqual({ n: 1 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_heads').get()).toEqual({ n: 1 });
  } finally { x.f.close(); }
});
it('fences old motion from a hidden original field owner using original Source proof', () => {
  const x = fixture(path());
  try {
    const first = x.fields.accept(x.source.sourceId);
    x.f.db.exec("UPDATE batted_world_field_actions SET physical_pitch_source_id='foreign-pitch',response_source_id='foreign-response'; UPDATE batted_world_field_heads SET physical_pitch_source_id='foreign-pitch',response_source_id='foreign-response';");
    x.f.db.exec("UPDATE batted_world_field_actions SET snapshot_json='invalid-hidden-snapshot'");
    const oldSource: AcceptedBattedWorldMotion = { sourceId: 'old-after-hidden-field', sourceVersion: 'fixture-v1',
      responseSourceId: first.response.source.sourceId, continuationSourceId: null, acquisitionSourceId: null, previousMotionSourceId: null,
      availableAtTick: x.source.availableAtTick, throughTick: x.source.throughTick, commands: x.source.commands };
    const old = x.f.track(openSqliteBattedWorldMotionStore(x.f.path, x.responses,
      { readAcceptedMotion: (id) => id === oldSource.sourceId ? oldSource : null }));
    expect(() => old.accept(oldSource.sourceId)).toThrow(/field|owner/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});
it('finds an original frozen field calibration even when its game mirror was hidden', () => {
  const x = fixture(path());
  try {
    x.f.db.exec("UPDATE batted_world_field_geometries SET game_id='foreign-game'");
    const source = { ...x.geometrySource, sourceId: 'geometry-silent-restart' };
    x.geometrySources.set(source.sourceId, source);
    expect(() => x.fields.acceptGeometry(source.sourceId)).toThrow(/calibration|geometry/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_geometries').get()).toEqual({ n: 1 });
  } finally { x.f.close(); }
});
it('rejects a new field root over an older executed motion hidden by corrupt mirrors and snapshot', () => {
  const x = fixture(path());
  try {
    const source: AcceptedBattedWorldMotion = { sourceId: 'earlier-actual-motion', sourceVersion: 'fixture-v1',
      responseSourceId: x.response.source.sourceId, continuationSourceId: null, acquisitionSourceId: null, previousMotionSourceId: null,
      availableAtTick: x.source.availableAtTick, throughTick: x.source.throughTick, commands: x.source.commands };
    const old = x.f.track(openSqliteBattedWorldMotionStore(x.f.path, x.responses, { readAcceptedMotion: (id) => id === source.sourceId ? source : null }));
    old.accept(source.sourceId);
    x.f.db.exec("UPDATE batted_world_motions SET physical_pitch_source_id='foreign-pitch',response_source_id='foreign-response',snapshot_json='invalid-hidden-snapshot'; UPDATE batted_world_motion_heads SET physical_pitch_source_id='foreign-pitch',response_source_id='foreign-response';");
    expect(() => x.fields.accept(x.source.sourceId)).toThrow(/owner|prefix/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});
