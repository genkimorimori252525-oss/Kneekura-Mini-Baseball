import { battedWorldExecutionFixture } from './BattedWorldExecutionFixtures.test-support';
import { openSqliteBattedWorldBaseGeometryStore, type AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import type { AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

export const battedWorldBaseContactFixture = (path?: string, carried = true) => {
  const base = battedWorldExecutionFixture(path, carried ? 'carried' : 'free', true);
  const carrier = base.motion.motion.carrierPlayerId, foot = base.motion.motion.actors.find((a) => a.playerId === carrier && a.primitive.role === 'left_foot');
  const surface = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 }, surfaceHeightMeters: 0 });
  const world = base.motion.response.touch.worldContact;
  const centers = world.flight.physicalPitch.frame.initialWorld!.source.worldSetup.baseCenters;
  // Explicit synthetic broad home region exercises physical contact with the actual fixture foot, not a forced ruling.
  const home = surface(0, 0);
  if (foot) { home.region.halfSize = { x: Math.abs(foot.primitive.startCenter.x) + 1, z: Math.abs(foot.primitive.startCenter.z) + 1 };
    home.surfaceHeightMeters = foot.primitive.startCenter.y; }
  const geometrySource: AcceptedBattedWorldBaseGeometry = { sourceId: 'actual-base-geometry', sourceVersion: 'fixture-v1',
    flightSourceId: world.flight.source.sourceId, geometryRef: 'explicit-fixture-geometry-v1', availableAtDay: 1,
    bases: { home, first: surface(centers.first.x, centers.first.z), second: surface(centers.second.x, centers.second.z),
      third: surface(centers.third.x, centers.third.z) } };
  const geometrySources = new Map([[geometrySource.sourceId, geometrySource]]);
  const geometries = base.f.track(openSqliteBattedWorldBaseGeometryStore(base.f.path, base.flights,
    { readAcceptedGeometry: (id) => geometrySources.get(id) ?? null }));
  const geometry = geometries.accept(geometrySource.sourceId);
  const source = { ...base.source, sourceId: 'base-contact-execution', action: { kind: 'base_contact',
    geometrySourceId: geometrySource.sourceId, base: 'home' } } as unknown as AcceptedBattedWorldExecution;
  base.sources.set(source.sourceId, source);
  return { ...base, source, geometrySource, geometrySources, geometry, geometries, foot };
};
