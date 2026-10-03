import { expect, it } from 'vitest';
import { battedWorldBaseGeometryFixture } from './BattedWorldBaseGeometryFixtures.test-support';
import { openSqliteBattedWorldBaseGeometryStore } from './SqliteBattedWorldBaseGeometryStore';
import { applyClubCommand } from '../../core/world/club';
import { command } from '../../core/world/club/ClubFixtures.test-support';
import { appendAcceptedClubEvents } from './SqliteClubEventJournal';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const setup = (domestic = false) => battedWorldBaseGeometryFixture(undefined, domestic);
it('owns explicit actual fixture geometry and reopens without the external Source', () => {
  const g = setup(); try {
    const value = g.store.accept(g.source.sourceId);
    expect(value.geometry.bases).toEqual(g.source.bases); expect(value.flight).toEqual(g.flight);
    expect(value.fixture.venue_id).toBe(g.flight.source.execution.venueId);
    expect(value.geometry.gates.firstBase).toEqual({ x: 27, z: 0 });
    expect(value).not.toHaveProperty('possession'); expect(value).not.toHaveProperty('out');
    g.sources.clear(); expect(g.store.accept(g.source.sourceId)).toEqual(value);
    const reopened = g.f.f.track(openSqliteBattedWorldBaseGeometryStore(g.f.f.path, { read: () => null }));
    expect(reopened.read(g.source.sourceId)).toEqual(value);
  } finally { g.f.f.close(); }
});
it('pins the own domestic stadium reference and preserves historical geometry after a later Club change', () => {
  const g = setup(true); try {
    const value = g.store.accept(g.source.sourceId); expect(value.domesticVenueHistory).not.toBeNull();
    const before = g.f.f.world.readClub('career-a', 'club-a')!.state;
    const changed = applyClubCommand(before, { ...command([{ kind: 'REPLACE_STADIUM',
      stadium: { ...before.institutional.stadium, geometryRef: 'future-geometry' } }]), effectiveDay: 20 });
    if (!changed.ok) throw new Error('explicit future Club fixture change');
    g.f.f.db.exec('BEGIN IMMEDIATE');
    appendAcceptedClubEvents(g.f.f.db, before, [changed.event], changed.state);
    g.f.f.db.prepare('UPDATE world_club_heads SET revision=?,state_json=? WHERE career_id=? AND club_id=?')
      .run(changed.state.revision, actorJson(changed.state), 'career-a', 'club-a');
    g.f.f.db.exec('COMMIT');
    expect(g.store.read(g.source.sourceId)).toEqual(value);
  } finally { g.f.f.close(); }
});
it('rejects a domestic geometry reference outside the pinned own stadium history', () => {
  const g = setup(true); try {
    g.sources.set(g.source.sourceId, { ...g.source, geometryRef: 'foreign-geometry' });
    expect(() => g.store.accept(g.source.sourceId)).toThrow('stadium geometry reference');
  } finally { g.f.f.close(); }
});
it.each(['missing', 'future', 'flight', 'ref', 'outcome', 'unknown_bases'] as const)('rejects invalid %s geometry Source', (kind) => {
  const g = setup(); try {
    if (kind === 'missing') g.sources.clear();
    else g.sources.set(g.source.sourceId, kind === 'future' ? { ...g.source, availableAtDay: 11 }
      : kind === 'flight' ? { ...g.source, flightSourceId: 'missing-flight' }
      : kind === 'ref' ? { ...g.source, geometryRef: '' }
      : kind === 'outcome' ? { ...g.source, out: true } as typeof g.source
      : { ...g.source, bases: { ...g.source.bases, fifth: g.source.bases.first } } as typeof g.source);
    expect(() => g.store.accept(g.source.sourceId)).toThrow();
    expect(g.f.f.db.prepare('SELECT count(*) AS n FROM batted_world_base_geometries').get()).toEqual({ n: 0 });
  } finally { g.f.f.close(); }
});
it('rejects a second geometry for the same actual game', () => {
  const g = setup(); try {
    g.store.accept(g.source.sourceId); const second = { ...g.source, sourceId: 'geometry-2' }; g.sources.set(second.sourceId, second);
    expect(() => g.store.accept(second.sourceId)).toThrow();
    expect(g.f.f.db.prepare('SELECT count(*) AS n FROM batted_world_base_geometries').get()).toEqual({ n: 1 });
  } finally { g.f.f.close(); }
});
it('rejects calibration centers different from the actual initial World setup', () => {
  const g = setup(); try {
    const source = { ...g.source, bases: { ...g.source.bases, first: { ...g.source.bases.first,
      region: { ...g.source.bases.first.region, center: { x: g.source.bases.first.region.center.x * 1.1, z: g.source.bases.first.region.center.z * 1.1 } } } } };
    g.sources.set(source.sourceId, source);
    expect(() => g.store.accept(source.sourceId)).toThrow();
  } finally { g.f.f.close(); }
});
it('detects an existing same-game owner with a corrupt game mirror when accepting from a different genuine flight', () => {
  const g = setup(); try {
    g.store.accept(g.source.sourceId);
    const next = { ...g.f.input, sourceId: 'flight-later', previousFlightSourceId: g.f.input.sourceId, searchDurationTicks: 1 };
    g.f.acceptedFlights.set(next.sourceId, next); g.f.flights.accept(next.sourceId);
    g.f.f.db.exec("UPDATE batted_world_base_geometries SET game_id='foreign-game'");
    const second = { ...g.source, sourceId: 'geometry-2', flightSourceId: next.sourceId,
      bases: { ...g.source.bases, home: { ...g.source.bases.home, surfaceHeightMeters: 10 } } };
    g.sources.set(second.sourceId, second);
    expect(() => g.store.accept(second.sourceId)).toThrow();
    expect(g.f.f.db.prepare('SELECT count(*) AS n FROM batted_world_base_geometries').get()).toEqual({ n: 1 });
  } finally { g.f.f.close(); }
});
it.each(['source', 'snapshot', 'fixture', 'root', 'mirror'] as const)('rejects corruption of the own %s geometry proof', (kind) => {
  const g = setup(); try {
    g.store.accept(g.source.sourceId);
    const sql = kind === 'source' ? "UPDATE batted_world_base_geometries SET source_json=json_set(source_json,'$.bases.first.region.center.x',21)"
      : kind === 'snapshot' ? "UPDATE batted_world_base_geometries SET snapshot_json=json_set(snapshot_json,'$.geometry.bases.first.surfaceHeightMeters',1)"
      : kind === 'fixture' ? "UPDATE official_fixtures SET venue_id='foreign-venue'"
      : kind === 'root' ? "UPDATE batted_ball_flights SET snapshot_hash='foreign-hash'"
      : "UPDATE batted_world_base_geometries SET geometry_ref='foreign-ref'";
    g.f.f.db.exec(sql); expect(() => g.store.read(g.source.sourceId)).toThrow();
  } finally { g.f.f.close(); }
});
