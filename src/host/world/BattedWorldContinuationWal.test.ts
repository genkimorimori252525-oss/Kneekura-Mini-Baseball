import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldContinuationFixture as fixture } from './BattedWorldContinuationFixtures.test-support';
import { openSqliteBattedWorldContinuationStore } from './SqliteBattedWorldContinuationStore';

it.each([
  ['response', "UPDATE batted_contact_responses SET snapshot_hash='changed';"],
  ['response_model', "UPDATE batted_contact_response_models SET source_hash='changed';"],
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
  ['own_source', "UPDATE batted_world_continuations SET source_hash='changed';"],
  ['own_mirror', "UPDATE batted_world_continuations SET response_source_id='missing';"],
  ['own_archive', 'DELETE FROM batted_world_continuations;'],
  ['own_head', 'UPDATE batted_world_continuation_heads SET revision=revision+1;'],
])('rolls back a late %s change after the actual Native prefix/head write on disk WAL', (_name, sql) => {
  const { f, response, responses, continuationSource: source, continuations } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-continuation-wal-')), 'state.sqlite'));
  try {
    f.db.exec(`CREATE TRIGGER alter_continuation AFTER INSERT ON batted_world_continuation_heads BEGIN ${sql} END`);
    expect(() => continuations.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuation_heads').get()).toEqual({ n: 0 });
    expect(responses.read(response.source.sourceId)).toEqual(response);
    f.db.exec('DROP TRIGGER alter_continuation');
    expect(continuations.accept(source.sourceId).revision).toBe(1);
  } finally { f.close(); }
});
it('checks all earlier owned prefix rows after a late mutation during a real append and rolls back both row and head', () => {
  const { f, continuationSource: source, continuationSources: sources, continuations } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-continuation-prefix-')), 'state.sqlite'));
  try {
    const first = continuations.accept(source.sourceId);
    const next = { ...source, sourceId: 'continuation-2', previousContinuationSourceId: source.sourceId }; sources.set(next.sourceId, next);
    f.db.exec("CREATE TRIGGER alter_old_prefix AFTER UPDATE OF source_id ON batted_world_continuation_heads BEGIN UPDATE batted_world_continuations SET snapshot_hash='changed' WHERE revision=1; END");
    expect(() => continuations.accept(next.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations').get()).toEqual({ n: 1 });
    expect(continuations.read(source.sourceId)).toEqual(first);
    f.db.exec('DROP TRIGGER alter_old_prefix');
    expect(continuations.accept(next.sourceId).revision).toBe(2);
  } finally { f.close(); }
});
it('does not trust a cached peer after its getter changes the actual original response archive', () => {
  const { f, response, continuationSource: source, continuationAuthority: authority } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-continuation-peer-')), 'state.sqlite'));
  try {
    const changed = f.track(openSqliteBattedWorldContinuationStore(f.path, { read: () => {
      f.db.exec("UPDATE batted_contact_responses SET snapshot_hash='changed'"); return response;
    } }, authority));
    expect(() => changed.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('revalidates the immutable original prefix after an identical retry Source callback changes its head', () => {
  const { f, responses, continuationSource: source, continuations } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-continuation-retry-')), 'state.sqlite'));
  try {
    continuations.accept(source.sourceId);
    const changed = f.track(openSqliteBattedWorldContinuationStore(f.path, responses, { readAcceptedContinuation: () => {
      f.db.exec('UPDATE batted_world_continuation_heads SET revision=revision+1'); return source;
    } }));
    expect(() => changed.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('keeps original Native history after legitimate later workload recovery while rejecting a fresh stale continuation', () => {
  const { f, responses, continuationSource: source, continuationSources: sources, continuations } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-continuation-history-')), 'state.sqlite'));
  try {
    const first = continuations.accept(source.sourceId);
    const rest = { sourceEventId: 'continuation-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    const next = { ...source, sourceId: 'continuation-2', previousContinuationSourceId: source.sourceId }; sources.set(next.sourceId, next);
    expect(() => continuations.accept(next.sourceId)).toThrow('workload');
    expect(continuations.read(source.sourceId)).toEqual(first);
    const reopened = f.track(openSqliteBattedWorldContinuationStore(f.path, responses));
    expect(reopened.accept(source.sourceId)).toEqual(first);
  } finally { f.close(); }
});
