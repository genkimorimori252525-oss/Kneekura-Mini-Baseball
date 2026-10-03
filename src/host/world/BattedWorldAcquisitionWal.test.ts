import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldAcquisitionFixture as fixture } from './BattedWorldAcquisitionFixtures.test-support';
import { openSqliteBattedWorldAcquisitionStore } from './SqliteBattedWorldAcquisitionStore';
import { openSqliteBattedWorldContinuationStore } from './SqliteBattedWorldContinuationStore';

const path = () => join(mkdtempSync(join(tmpdir(), 'batted-acquisition-wal-')), 'state.sqlite');
it('rolls back an orphan continuation introduced after the actual null-prefix acquisition insert', () => {
  const { f, responses, acquisitionSource: source, acquisitions } = fixture(path());
  try {
    f.track(openSqliteBattedWorldContinuationStore(f.path, responses));
    f.db.exec(`CREATE TRIGGER orphan_acquisition AFTER INSERT ON batted_world_acquisitions BEGIN
      INSERT INTO batted_world_continuations VALUES ('orphan',NEW.response_source_id,NULL,'orphan-predecessor',
        NEW.physical_pitch_source_id,NEW.game_id,1,'{}','invalid','{}','invalid'); END`);
    expect(() => acquisitions.accept(source.sourceId)).toThrow(/prefix head/);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_acquisitions').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER orphan_acquisition');
    expect(acquisitions.accept(source.sourceId).result.kind).toBe('secured');
  } finally { f.close(); }
});
it.each([
  ['response', "UPDATE batted_contact_responses SET snapshot_hash='changed';"],
  ['response_model', "UPDATE batted_contact_response_models SET source_hash='changed';"],
  ['world', "UPDATE batted_world_contacts SET snapshot_hash='changed';"],
  ['world_model', "UPDATE batted_world_models SET source_hash='changed';"],
  ['person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['physical', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['own_source', "UPDATE batted_world_acquisitions SET source_hash='changed';"],
  ['own_mirror', "UPDATE batted_world_acquisitions SET physical_pitch_source_id='wrong';"],
  ['own_archive', 'DELETE FROM batted_world_acquisitions;'],
])('rolls back late %s mutation after the actual acquisition insert', (_kind, sql) => {
  const { f, response, responses, acquisitionSource: source, acquisitions } = fixture(path());
  try {
    f.db.exec(`CREATE TRIGGER alter_acquisition AFTER INSERT ON batted_world_acquisitions BEGIN ${sql} END`);
    expect(() => acquisitions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_acquisitions').get()).toEqual({ n: 0 });
    expect(responses.read(response.source.sourceId)).toEqual(response);
    f.db.exec('DROP TRIGGER alter_acquisition');
    expect(acquisitions.accept(source.sourceId).result.kind).toBe('secured');
  } finally { f.close(); }
});
it.each([
  "UPDATE batted_world_continuations SET snapshot_hash='changed';",
  'UPDATE batted_world_continuation_heads SET revision=revision+1;',
])('owns the complete actual prefix even after a late write: %s', (sql) => {
  const { f, continuation, continuations, acquisitionSource: source, acquisitions } = fixture(path(), 'later');
  try {
    f.db.exec(`CREATE TRIGGER alter_acquisition AFTER INSERT ON batted_world_acquisitions BEGIN ${sql} END`);
    expect(() => acquisitions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_acquisitions').get()).toEqual({ n: 0 });
    expect(continuations!.read(continuation!.source.sourceId)).toEqual(continuation);
  } finally { f.close(); }
});
it('rechecks the actual original when a cached peer mutates it before the transaction', () => {
  const { f, response, acquisitionSource: source, acquisitionAuthority: authority } = fixture(path());
  try {
    const changed = f.track(openSqliteBattedWorldAcquisitionStore(f.path, { read: () => {
      f.db.exec("UPDATE batted_contact_responses SET snapshot_hash='changed'"); return response;
    } }, authority));
    expect(() => changed.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_acquisitions').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('revalidates immutable own acquisition after an identical-retry Source callback mutates the archive', () => {
  const { f, responses, acquisitionSource: source, acquisitions } = fixture(path());
  try {
    acquisitions.accept(source.sourceId);
    const changed = f.track(openSqliteBattedWorldAcquisitionStore(f.path, responses, { readAcceptedAcquisition: () => {
      f.db.exec("UPDATE batted_world_acquisitions SET snapshot_hash='changed'"); return source;
    } }));
    expect(() => changed.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('keeps immutable acquisition history after legitimate recovery while rejecting fresh stale writes', () => {
  const { f, responses, acquisitionSource: source, acquisitionSources: sources, acquisitions } = fixture(path());
  try {
    const value = acquisitions.accept(source.sourceId);
    const rest = { sourceEventId: 'acquisition-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    expect(acquisitions.read(source.sourceId)).toEqual(value);
    const reopened = f.track(openSqliteBattedWorldAcquisitionStore(f.path, responses));
    expect(reopened.accept(source.sourceId)).toEqual(value);
    const next = { ...source, sourceId: 'fresh-stale' }; sources.set(next.sourceId, next);
    expect(() => acquisitions.accept(next.sourceId)).toThrow('workload');
  } finally { f.close(); }
});
