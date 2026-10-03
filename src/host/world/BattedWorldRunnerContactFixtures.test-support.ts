import { battedWorldExecutionFixture } from './BattedWorldExecutionFixtures.test-support';
import { openSqliteBattedWorldBaseGeometryStore, type AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import type { AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

export const battedWorldRunnerContactFixture = (path?: string, kind: 'free' | 'carried' | 'candidate' = 'free') => {
  const base = battedWorldExecutionFixture(path, kind, true), world = base.motion.response.touch.worldContact;
  const batter = world.flight.physicalPitch.frame.batterActor!, foot = base.motion.motion.actors.find((a) =>
    a.playerId === batter.binding.playerId && a.primitive.role === 'left_foot')!;
  const centers = world.flight.physicalPitch.frame.initialWorld!.source.worldSetup.baseCenters;
  const surface = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 }, surfaceHeightMeters: 0 });
  // Explicit synthetic calibration includes the actual batter foot; it supplies no result or afterWorld.
  const home = surface(0, 0);
  home.region.halfSize = { x: Math.abs(foot.primitive.startCenter.x) + 1, z: Math.abs(foot.primitive.startCenter.z) + 1 };
  home.surfaceHeightMeters = foot.primitive.startCenter.y;
  const geometrySource: AcceptedBattedWorldBaseGeometry = { sourceId: 'runner-base-geometry', sourceVersion: 'fixture-v1',
    flightSourceId: world.flight.source.sourceId, geometryRef: 'explicit-fixture-geometry-v1', availableAtDay: 1,
    bases: { home, first: surface(centers.first.x, centers.first.z), second: surface(centers.second.x, centers.second.z), third: surface(centers.third.x, centers.third.z) } };
  const geometrySources = new Map([[geometrySource.sourceId, geometrySource]]);
  const geometries = base.f.track(openSqliteBattedWorldBaseGeometryStore(base.f.path, base.flights,
    { readAcceptedGeometry: (id) => geometrySources.get(id) ?? null }));
  const geometry = geometries.accept(geometrySource.sourceId);
  const source: AcceptedBattedWorldExecution = { ...base.source, sourceId: 'runner-touch-execution', action: { kind: 'runner_base_touch',
    geometrySourceId: geometrySource.sourceId, playerId: batter.binding.playerId, base: 'home' } };
  base.sources.set(source.sourceId, source);
  return { ...base, source, geometrySource, geometrySources, geometry, geometries, batter, foot };
};
