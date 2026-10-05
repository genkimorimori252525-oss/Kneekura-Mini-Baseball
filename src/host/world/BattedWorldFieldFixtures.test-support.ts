import type { BattedFixturePitchPhysics } from './BattedBallFlightFixtures.test-support';
import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { openSqliteBattedWorldBaseGeometryStore, type AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import { openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldGeometry, type AcceptedBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';

/** Explicit oversized synthetic third-base prism exposes bag-before-forecast ordering; it is not production venue calibration. */
export const battedWorldFieldFixture = (path?: string, initialOnly = true, oversizedThird = true, rollingDecelerationMps2?: number,
  configure?: Readonly<{ world?: Parameters<typeof battedContactResponseFixture>[2]; response?: (base: ReturnType<typeof battedContactResponseFixture>) => void;
    groundRestitution?: number; pitchPhysics?: BattedFixturePitchPhysics; originalProfile?: Parameters<typeof battedContactResponseFixture>[8]; material?: AcceptedBattedWorldFieldGeometry['baseModels']['third']['material'] }>) => {
  const base = battedContactResponseFixture(path, initialOnly ? 'airborne' : 'ground', configure?.world, true, initialOnly, rollingDecelerationMps2, configure?.groundRestitution, configure?.pitchPhysics, configure?.originalProfile);
  configure?.response?.(base);
  const response = base.responses.accept(base.responseSource.sourceId);
  const flight = response.touch.worldContact.flight, centers = flight.physicalPitch.frame.initialWorld!.source.worldSetup.baseCenters;
  const surface = (center: { x: number; z: number }, long = false) => ({ region: { center,
    halfSize: { x: oversizedThird ? 0.5 : 0.01, z: long && oversizedThird ? 20 : 0.2 }, rotationRadians: 0 }, surfaceHeightMeters: oversizedThird ? 3 : 0.1 });
  const baseSource: AcceptedBattedWorldBaseGeometry = { sourceId: 'field-original-base-geometry', sourceVersion: 'synthetic-v1',
    flightSourceId: flight.source.sourceId, geometryRef: 'synthetic-field-contact-v1', availableAtDay: 1,
    bases: { home: { ...surface(flight.source.execution.field.homePlate), surfaceHeightMeters: 0.1 },
      first: surface(centers.first), second: surface(centers.second), third: surface(centers.third, true) } };
  const bases = base.f.track(openSqliteBattedWorldBaseGeometryStore(base.f.path, base.flights,
    { readAcceptedGeometry: (id) => id === baseSource.sourceId ? baseSource : null }));
  const baseGeometry = bases.accept(baseSource.sourceId);
  const material = configure?.material ?? { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
  const model = { bottomY: 0, material };
  const geometrySource: AcceptedBattedWorldFieldGeometry = { sourceId: 'field-bags', sourceVersion: 'synthetic-v1',
    baseGeometrySourceId: baseSource.sourceId, baseModels: { home: model, first: model, second: model, third: model } };
  const source: AcceptedBattedWorldFieldAction = { sourceId: 'field-motion-1', sourceVersion: 'fixture-v1', responseSourceId: response.source.sourceId,
    geometrySourceId: geometrySource.sourceId, previousFieldSourceId: null, availableAtTick: flight.flight.initialBall.tick,
    throughTick: flight.flight.initialBall.tick + 2_000_000,
    commands: response.touch.worldContact.source.commands.map((c) => ({ playerId: c.playerId, bodyAcceleration: c.bodyAcceleration,
      primitiveMotions: c.primitiveMotions.map((p) => ({ role: p.role, offsetAcceleration: p.offsetAcceleration })) })) };
  const geometrySources = new Map([[geometrySource.sourceId, geometrySource]]), sources = new Map([[source.sourceId, source]]);
  const authority = { readAcceptedGeometry: (id: string) => geometrySources.get(id) ?? null,
    readAcceptedAction: (id: string) => sources.get(id) ?? null };
  const fields = base.f.track(openSqliteBattedWorldFieldStore(base.f.path, base.responses, bases, authority));
  const geometry = fields.acceptGeometry(geometrySource.sourceId);
  const forecast = createBattedBallFlightEvidence({ contact: flight.flight.contact, parameters: flight.source.execution.ballFlightParameters, searchDurationTicks: 2_000_000 });
  return { ...base, response, forecast, bases, baseSource, baseGeometry, geometrySource, geometrySources, geometry, source, sources, authority, fields };
};
