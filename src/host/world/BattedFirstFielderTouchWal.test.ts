import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedFirstFielderTouchFixture as fixture } from './BattedFirstFielderTouchFixtures.test-support';
import { openSqliteBattedFirstFielderTouchStore } from './SqliteBattedFirstFielderTouchStore';

it.each([
  ['world', "UPDATE batted_world_contacts SET snapshot_hash='changed';"],
  ['model', "UPDATE batted_world_models SET source_hash='changed';"],
  ['person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['flight', "UPDATE batted_ball_flights SET snapshot_hash='changed';"],
  ['physical', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['venue', "UPDATE official_fixtures SET venue_id='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['world_head', 'UPDATE batted_world_contact_heads SET revision=revision+1;'],
  ['flight_head', 'UPDATE batted_ball_flight_heads SET revision=revision+1;'],
  ['own_source', "UPDATE batted_first_fielder_touches SET source_hash='changed';"],
  ['own_mirror', "UPDATE batted_first_fielder_touches SET world_contact_source_id='missing';"],
  ['own_archive', 'DELETE FROM batted_first_fielder_touches;'],
])('rolls back late %s change and retries with the original actual World contact', (_name, sql) => {
  const { f, touchSource, touches, worldContact, contacts } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-first-touch-wal-')), 'state.sqlite'));
  try {
    f.db.exec(`CREATE TRIGGER alter_touch AFTER INSERT ON batted_first_fielder_touches BEGIN ${sql} END`);
    expect(() => touches.accept(touchSource.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_first_fielder_touches').get()).toEqual({ n: 0 });
    expect(contacts.read(worldContact.source.sourceId)).toEqual(worldContact);
    f.db.exec('DROP TRIGGER alter_touch');
    expect(touches.accept(touchSource.sourceId).result.kind).toBe('recorded');
  } finally { f.close(); }
});

it('rejects a stale peer result after its getter mutates the original World contact', () => {
  const { f, touchSource, touchAuthority, worldContact } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-first-touch-peer-')), 'state.sqlite'));
  try {
    const changed = f.track(openSqliteBattedFirstFielderTouchStore(f.path, { read: () => {
      f.db.prepare("UPDATE batted_world_contacts SET snapshot_hash='changed'").run(); return worldContact;
    } }, touchAuthority));
    expect(() => changed.accept(touchSource.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_first_fielder_touches').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('revalidates own original after an identical accepted Source retry callback mutates it', () => {
  const { f, touchSource, touches, contacts } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-first-touch-retry-')), 'state.sqlite'));
  try {
    touches.accept(touchSource.sourceId);
    const changed = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, { readAcceptedTouch: () => {
      f.db.prepare("UPDATE batted_first_fielder_touches SET source_hash='changed'").run(); return touchSource;
    } }));
    expect(() => changed.accept(touchSource.sourceId)).toThrow();
  } finally { f.close(); }
});

it('preserves original interpretation after legitimate later recovery while rejecting fresh acceptance', () => {
  const { f, touches, touchSource, contacts, touchSources } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-first-touch-history-')), 'state.sqlite'));
  try {
    const original = touches.accept(touchSource.sourceId);
    const rest = { sourceEventId: 'rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    touchSources.set('later', { ...touchSource, sourceId: 'later' });
    expect(() => touches.accept('later')).toThrow('workload');
    expect(touches.read(touchSource.sourceId)).toEqual(original);
    const reopened = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts));
    expect(reopened.accept(touchSource.sourceId)).toEqual(original);
  } finally { f.close(); }
});

it('does not freshly interpret an older airborne World contact after actual execution extends it', () => {
  const { f, touches, touchSource, source, sources, contacts } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-first-touch-head-')), 'state.sqlite'), 'airborne');
  try {
    const next = { ...source, sourceId: 'extended-world', previousContactSourceId: source.sourceId };
    sources.set(next.sourceId, next); contacts.accept(next.sourceId);
    expect(() => touches.accept(touchSource.sourceId)).toThrow('not current');
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_first_fielder_touches').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('preserves lifecycle checks after extracting the own World reader', () => {
  const { f, contacts, worldContact, touches, touchSource } = fixture();
  try {
    contacts.close();
    expect(() => contacts.read(worldContact.source.sourceId)).toThrow('closed');
    touches.close();
    expect(() => touches.read(touchSource.sourceId)).toThrow('closed');
  } finally { f.close(); }
});
