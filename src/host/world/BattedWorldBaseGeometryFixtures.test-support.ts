import { battedBallFlightFixture } from './BattedBallFlightFixtures.test-support';
import { openSqliteBattedWorldBaseGeometryStore, type AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';

export const battedWorldBaseGeometryFixture = (path?: string, domestic = false) => {
  const fixture = domestic ? { gameId: 'game-1', venueId: 'stadium-a', fixtureEventId:
    JSON.stringify(['domestic-fixture-venue-v1', 'career-a', 'league-season-1', 'game-1', 0, 'stadium-a']), fixtureRevision: 1 } : undefined;
  const f = battedBallFlightFixture(path, true, true, true, fixture), flight = f.flights.accept(f.input.sourceId);
  const surface = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 }, surfaceHeightMeters: 0 });
  const source: AcceptedBattedWorldBaseGeometry = { sourceId: 'base-geometry-1', sourceVersion: 'fixture-v1', flightSourceId: flight.source.sourceId,
    geometryRef: domestic ? 'geometry-a' : 'explicit-fixture-geometry-v1', availableAtDay: 1,
    bases: { home: surface(0, 0), first: surface(27, 0), second: surface(27, 27), third: surface(0, 27) } };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedGeometry: (id: string) => sources.get(id) ?? null };
  const store = f.f.track(openSqliteBattedWorldBaseGeometryStore(f.f.path, f.flights, authority));
  return { f, flight, source, sources, authority, store };
};
