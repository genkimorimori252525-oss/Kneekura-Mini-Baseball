import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { battedBallFlightFixture as fixture } from './BattedBallFlightFixtures.test-support';
import { openSqliteBattedBallFlightStore } from './SqliteBattedBallFlightStore';

it.each([
  ['physical_source', 'batted_ball_flights', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['physical_head', 'batted_ball_flights', 'DELETE FROM physical_pitch_progress_heads;'],
  ['actor', 'batted_ball_flights', "UPDATE physical_plate_appearance_actors SET source_hash='changed';"],
  ['fixture', 'batted_ball_flights', "UPDATE official_fixtures SET venue_id='changed';"],
  ['workload', 'batted_ball_flights', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['own_archive', 'batted_ball_flights', 'DELETE FROM batted_ball_flights;'],
  ['own_head', 'batted_ball_flight_heads', 'UPDATE batted_ball_flight_heads SET revision=revision+1;'],
])('rolls back actual late %s changes on the flight writer connection', (_name, table, sql) => {
  const { f, input, physical, flights, pitches } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-flight-wal-')), 'state.sqlite'));
  try {
    f.db.exec(`CREATE TRIGGER change_evidence AFTER INSERT ON ${table} BEGIN ${sql} END`);
    expect(() => flights.accept(input.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()).toEqual({ n: 0 });
    expect(pitches.readAcceptedPitch(physical.source.sourceId)).toEqual(physical);
    f.db.exec('DROP TRIGGER change_evidence');
    expect(flights.accept(input.sourceId).revision).toBe(1);
  } finally { f.close(); }
});

it('does not trust a cached physical getter while the actual action archive changes before the flight transaction', () => {
  const { f, input, physical, flights } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-flight-peer-')), 'state.sqlite'));
  try {
    const row = f.db.prepare('SELECT source_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(physical.source.sourceId) as { source_hash: string };
    const changed = f.track(openSqliteBattedBallFlightStore(f.path, { readAcceptedPitch: () => {
      f.db.prepare("UPDATE physical_pitch_progress_actions SET source_hash='changed' WHERE source_id=?").run(physical.source.sourceId);
      return physical;
    } }, { readAcceptedFlight: () => input }));
    expect(() => changed.accept(input.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()).toEqual({ n: 0 });
    f.db.prepare('UPDATE physical_pitch_progress_actions SET source_hash=? WHERE source_id=?').run(row.source_hash, physical.source.sourceId);
    expect(flights.accept(input.sourceId).flight.contact).toEqual(physical.result.pitch.resolution.timeline.events.find((e) => e.kind === 'BatBallContact')!.payload.contact);
  } finally { f.close(); }
});

it('preserves original flight after legitimate later recovery and disk reopen but rejects a new flight on the advanced current workload', () => {
  const { f, input, acceptedFlights, flights, pitches } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-flight-history-')), 'state.sqlite'));
  try {
    const first = flights.accept(input.sourceId);
    const rest = { sourceEventId: 'rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    const next = { ...input, sourceId: 'later-flight', previousFlightSourceId: input.sourceId, searchDurationTicks: 2_000_000 };
    acceptedFlights.set(next.sourceId, next);
    expect(() => flights.accept(next.sourceId)).toThrow('workload');
    expect(flights.read(input.sourceId)).toEqual(first);
    flights.close(); acceptedFlights.clear();
    const offline = f.track(openSqliteBattedBallFlightStore(f.path, pitches));
    expect(offline.accept(input.sourceId)).toEqual(first);
    f.db.prepare("UPDATE batted_ball_flights SET snapshot_json='{}'").run();
    expect(() => offline.read(input.sourceId)).toThrow('archive');
  } finally { f.close(); }
});

it('revalidates original evidence after an identical retry Source callback changes the actual physical archive', () => {
  const { f, input, flights, pitches } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-flight-retry-')), 'state.sqlite'));
  try {
    flights.accept(input.sourceId);
    const retry = f.track(openSqliteBattedBallFlightStore(f.path, pitches, { readAcceptedFlight: () => {
      f.db.prepare("UPDATE physical_pitch_progress_actions SET source_hash='changed'").run(); return input;
    } }));
    expect(() => retry.accept(input.sourceId)).toThrow();
  } finally { f.close(); }
});

it.each([1, -1])('rolls back an unowned revision inserted %s steps from the actual result', (offset) => {
  const { f, input, flights } = fixture(join(mkdtempSync(join(tmpdir(), 'batted-flight-orphan-')), 'state.sqlite'));
  try {
    f.db.exec(`CREATE TRIGGER unowned AFTER INSERT ON batted_ball_flight_heads BEGIN
      INSERT INTO batted_ball_flights SELECT 'unowned',physical_pitch_source_id,game_id,play_id,revision+${offset},source_id,
        source_json,source_hash,snapshot_json,snapshot_hash FROM batted_ball_flights WHERE source_id=NEW.source_id; END`);
    expect(() => flights.accept(input.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
