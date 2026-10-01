import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedContactResponseFixture as fixture } from './BattedContactResponseFixtures.test-support';
import { openSqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';

it.each([
  ['touch', "UPDATE batted_first_fielder_touches SET snapshot_hash='changed';"],
  ['world', "UPDATE batted_world_contacts SET snapshot_hash='changed';"],
  ['world_model', "UPDATE batted_world_models SET source_hash='changed';"],
  ['person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['flight', "UPDATE batted_ball_flights SET snapshot_hash='changed';"],
  ['physical', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['venue', "UPDATE official_fixtures SET venue_id='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['world_head', 'UPDATE batted_world_contact_heads SET revision=revision+1;'],
  ['flight_head', 'UPDATE batted_ball_flight_heads SET revision=revision+1;'],
  ['response_model', "UPDATE batted_contact_response_models SET source_hash='changed';"],
  ['own_source', "UPDATE batted_contact_responses SET source_hash='changed';"],
  ['own_mirror', "UPDATE batted_contact_responses SET world_contact_source_id='missing';"],
  ['own_archive', 'DELETE FROM batted_contact_responses;'],
])('rolls back late %s change, preserves actual originals, and retries on real disk WAL', (_name, sql) => {
  const { f, responses, responseSource, touch, touches } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-response-wal-')), 'state.sqlite'));
  try {
    f.db.exec(`CREATE TRIGGER alter_response AFTER INSERT ON batted_contact_responses BEGIN ${sql} END`);
    expect(() => responses.accept(responseSource.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_contact_responses').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_contact_response_models').get()).toEqual({ n: 0 });
    expect(touches.read(touch.source.sourceId)).toEqual(touch);
    f.db.exec('DROP TRIGGER alter_response');
    expect(responses.accept(responseSource.sourceId).result.kind).toBe('rebound');
  } finally { f.close(); }
});
it('rejects stale peer Source after its getter changes the original and writes no response', () => {
  const { f, touch, responseSource, responseAuthority } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-response-peer-')), 'state.sqlite'));
  try {
    const changed = f.track(openSqliteBattedContactResponseStore(f.path, { read: () => {
      f.db.prepare("UPDATE batted_first_fielder_touches SET snapshot_hash='changed'").run(); return touch;
    } }, responseAuthority));
    expect(() => changed.accept(responseSource.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_contact_responses').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('revalidates original model after the accepted identical-retry callback changes its stored hash', () => {
  const { f, responses, touches, responseSource, responseAuthority } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-response-retry-')), 'state.sqlite'));
  try {
    responses.accept(responseSource.sourceId);
    const changed = f.track(openSqliteBattedContactResponseStore(f.path, touches, { ...responseAuthority, readAcceptedResponse: () => {
      f.db.prepare("UPDATE batted_contact_response_models SET source_hash='changed'").run(); return responseSource;
    } }));
    expect(() => changed.accept(responseSource.sourceId)).toThrow();
  } finally { f.close(); }
});
it('retains original response across later real workload recovery and rejects fresh stale execution', () => {
  const { f, responses, touches, responseSource, responseSources } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-response-history-')), 'state.sqlite'));
  try {
    const original = responses.accept(responseSource.sourceId);
    const rest = { sourceEventId: 'response-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    responseSources.set('later', { ...responseSource, sourceId: 'later' });
    expect(() => responses.accept('later')).toThrow('workload');
    expect(responses.read(responseSource.sourceId)).toEqual(original);
    const reopened = f.track(openSqliteBattedContactResponseStore(f.path, touches));
    expect(reopened.accept(responseSource.sourceId)).toEqual(original);
  } finally { f.close(); }
});
it('rejects freshly deriving from an old airborne World prefix after actual contact execution extends it', () => {
  const { f, responses, responseSource, source, sources, contacts } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-response-head-')), 'state.sqlite'), 'airborne');
  try {
    const next = { ...source, sourceId: 'extended-world', previousContactSourceId: source.sourceId };
    sources.set(next.sourceId, next); contacts.accept(next.sourceId);
    expect(() => responses.accept(responseSource.sourceId)).toThrow('not current');
  } finally { f.close(); }
});
it('freezes independently accepted game response calibration rather than replacing it on another Source', () => {
  const { f, responses, responseSource, responseModel, responseSources, responseModels } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-response-model-')), 'state.sqlite'));
  try {
    responses.accept(responseSource.sourceId);
    responseModels.set('other-model', { ...responseModel, sourceId: 'other-model' });
    responseSources.set('other', { ...responseSource, sourceId: 'other', responseModelSourceId: 'other-model' });
    expect(() => responses.accept('other')).toThrow('frozen');
  } finally { f.close(); }
});
