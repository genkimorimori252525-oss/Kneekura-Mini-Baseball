import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldContactFixture as fixture } from './BattedWorldContactFixtures.test-support';
import { openSqliteBattedWorldContactStore } from './SqliteBattedWorldContactStore';

it.each([
  ['flight', 'batted_world_contacts', "UPDATE batted_ball_flights SET snapshot_hash='changed';"],
  ['physical', 'batted_world_contacts', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['person', 'batted_world_contacts', "UPDATE world_player_person_links SET person_id='changed';"],
  ['venue', 'batted_world_contacts', "UPDATE official_fixtures SET venue_id='changed';"],
  ['workload', 'batted_world_contacts', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['model', 'batted_world_contacts', "UPDATE batted_world_models SET source_hash='changed';"],
  ['own_archive', 'batted_world_contacts', 'DELETE FROM batted_world_contacts;'],
  ['head', 'batted_world_contact_heads', 'UPDATE batted_world_contact_heads SET revision=revision+1;'],
])('rolls back late %s mutation on the actual contact writer and can retry', (_name, table, sql) => {
  const { f, source, contacts, flight, flights } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-world-wal-')), 'state.sqlite'));
  try {
    f.db.exec(`CREATE TRIGGER alter_evidence AFTER INSERT ON ${table} BEGIN ${sql} END`);
    expect(() => contacts.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_models').get()).toEqual({ n: 0 });
    expect(flights.read(flight.source.sourceId)).toEqual(flight);
    f.db.exec('DROP TRIGGER alter_evidence');
    expect(contacts.accept(source.sourceId).revision).toBe(1);
  } finally { f.close(); }
});

it('rejects a stale peer flight after its getter changes the actual archive', () => {
  const { f, source, authority, contacts, flight } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-world-peer-')), 'state.sqlite'));
  try {
    const changed = f.track(openSqliteBattedWorldContactStore(f.path, { read: () => {
      f.db.prepare("UPDATE batted_ball_flights SET source_hash='changed'").run(); return flight;
    } }, authority));
    expect(() => changed.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get()).toEqual({ n: 0 });
    expect(() => contacts.read(source.sourceId)).not.toThrow();
  } finally { f.close(); }
});

it('revalidates original evidence after an identical retry callback mutates its archive', () => {
  const { f, source, authority, contacts, flights } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-world-retry-')), 'state.sqlite'));
  try {
    contacts.accept(source.sourceId);
    const changed = f.track(openSqliteBattedWorldContactStore(f.path, flights, { ...authority, readAcceptedContact: () => {
      f.db.prepare("UPDATE batted_world_models SET source_hash='changed'").run(); return source;
    } }));
    expect(() => changed.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});

it.each([1, -1])('rolls back an orphan revision %s steps from the actual result', (offset) => {
  const { f, source, contacts } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-world-orphan-')), 'state.sqlite'));
  try {
    f.db.exec(`CREATE TRIGGER orphan AFTER INSERT ON batted_world_contact_heads BEGIN
      INSERT INTO batted_world_contacts SELECT 'orphan',physical_pitch_source_id,game_id,revision+${offset},source_id,
        source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_contacts WHERE source_id=NEW.source_id; END`);
    expect(() => contacts.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('preserves verified original contact after later recovery and offline reopen while rejecting new execution', () => {
  const { f, source, contacts, flights, input, sources } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-world-history-')), 'state.sqlite'));
  try {
    const first = { ...source, sourceId: 'early-world', flightSourceId: input.sourceId };
    sources.set(first.sourceId, first);
    const original = contacts.accept(first.sourceId);
    const rest = { sourceEventId: 'rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    sources.set(source.sourceId, { ...source, previousContactSourceId: first.sourceId });
    expect(() => contacts.accept(source.sourceId)).toThrow('workload');
    expect(contacts.read(first.sourceId)).toEqual(original);
    const offline = f.track(openSqliteBattedWorldContactStore(f.path, flights));
    expect(offline.accept(first.sourceId)).toEqual(original);
  } finally { f.close(); }
});
