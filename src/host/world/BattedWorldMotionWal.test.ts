import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldMotionFixture as fixture } from './BattedWorldMotionFixtures.test-support';
import { openSqliteBattedWorldMotionStore } from './SqliteBattedWorldMotionStore';
import { openSqliteBattedWorldContinuationStore } from './SqliteBattedWorldContinuationStore';

const path = () => join(mkdtempSync(join(tmpdir(), 'batted-motion-wal-')), 'state.sqlite');
it.each([
  ['response', "UPDATE batted_contact_responses SET snapshot_hash='changed';"],
  ['model', "UPDATE batted_contact_response_models SET source_hash='changed';"],
  ['world', "UPDATE batted_world_contacts SET snapshot_hash='changed';"],
  ['person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['physical', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['own_source', "UPDATE batted_world_motions SET source_hash='changed';"],
  ['own_mirror', "UPDATE batted_world_motions SET response_source_id='wrong';"],
  ['own_head', 'UPDATE batted_world_motion_heads SET revision=revision+1;'],
  ['own_archive', 'DELETE FROM batted_world_motions;'],
])('rolls back late %s evidence mutation after the actual motion head write', (_kind, sql) => {
  const { f, responses, response, motions, motionSource: source } = fixture(path());
  try {
    f.db.exec(`CREATE TRIGGER mutate_motion AFTER INSERT ON batted_world_motion_heads BEGIN ${sql} END`);
    expect(() => motions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motion_heads').get()).toEqual({ n: 0 });
    expect(responses.read(response.source.sourceId)).toEqual(response);
    f.db.exec('DROP TRIGGER mutate_motion'); expect(motions.accept(source.sourceId).revision).toBe(1);
  } finally { f.close(); }
});
it.each([
  "UPDATE batted_world_acquisitions SET snapshot_hash='changed';",
  "UPDATE batted_world_continuations SET snapshot_hash='changed';",
  'UPDATE batted_world_continuation_heads SET revision=revision+1;',
])('owns the complete secured later original even after a late motion insert: %s', (sql) => {
  const { f, acquisition, motions, motionSource: source } = fixture(path(), 'later');
  try {
    f.db.exec(`CREATE TRIGGER mutate_motion AFTER INSERT ON batted_world_motion_heads BEGIN ${sql} END`);
    expect(() => motions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER mutate_motion'); expect(motions.accept(source.sourceId).acquisition).toEqual(acquisition);
  } finally { f.close(); }
});
it('rejects a cached peer that changes the original before the transaction', () => {
  const { f, response, motionAuthority: authority, motionSource: source } = fixture(path());
  try {
    const changed = f.track(openSqliteBattedWorldMotionStore(f.path, { read: () => {
      f.db.exec("UPDATE batted_contact_responses SET snapshot_hash='changed'"); return response;
    } }, authority));
    expect(() => changed.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('re-reads the own original on an identical retry after an authority callback changes its head', () => {
  const { f, responses, motions, motionSource: source } = fixture(path());
  try {
    motions.accept(source.sourceId);
    const changed = f.track(openSqliteBattedWorldMotionStore(f.path, responses, { readAcceptedMotion: () => {
      f.db.exec("UPDATE batted_world_motion_heads SET source_id='missing'"); return source;
    } }));
    expect(() => changed.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('keeps historical original motion after legitimate recovery and rejects a fresh stale append', () => {
  const { f, responses, response, motions, motionSources: sources, motionSource: source } = fixture(path());
  try {
    const value = motions.accept(source.sourceId), rest = { sourceEventId: 'motion-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    expect(motions.read(source.sourceId)).toEqual(value); expect(motions.accept(source.sourceId)).toEqual(value);
    expect(responses.read(response.source.sourceId)).toEqual(response);
    const next = { ...source, sourceId: 'stale-append', previousMotionSourceId: source.sourceId, throughTick: source.throughTick + 1000 };
    sources.set(next.sourceId, next); expect(() => motions.accept(next.sourceId)).toThrow(/workload/);
  } finally { f.close(); }
});
it('rolls back original continuation when a motion owner appears after its actual insert', () => {
  const { f, responses, response } = fixture(path());
  try {
    const source = { sourceId: 'original-before-motion', sourceVersion: 'fixture-v1', responseSourceId: response.source.sourceId,
      previousContinuationSourceId: null, throughTick: response.touch.worldContact.actors[0].primitive.endTick };
    const continuations = f.track(openSqliteBattedWorldContinuationStore(f.path, responses, { readAcceptedContinuation: () => source }));
    f.db.exec(`CREATE TRIGGER introduce_motion AFTER INSERT ON batted_world_continuations BEGIN
      INSERT INTO batted_world_motion_heads VALUES (NEW.physical_pitch_source_id,NEW.response_source_id,'orphan-motion',1); END`);
    expect(() => continuations.accept(source.sourceId)).toThrow(/motion owner/);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motion_heads').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER introduce_motion'); expect(continuations.accept(source.sourceId).revision).toBe(1);
  } finally { f.close(); }
});
