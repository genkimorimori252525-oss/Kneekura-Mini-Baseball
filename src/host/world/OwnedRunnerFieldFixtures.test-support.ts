import { prePitchRunnerContactFixture } from './PrePitchRunnerContactFixtures.test-support';
import { battedWorldContactEvidenceFromSqlite, type DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import type { AcceptedBattedFirstFielderTouch, DurableBattedFirstFielderTouch } from './SqliteBattedFirstFielderTouchStore';
import type { AcceptedBattedContactResponse, AcceptedBattedContactResponseModel, DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import type { AcceptedBattedWorldFieldAction, AcceptedBattedWorldFieldGeometry, DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { createBattedWorldBaseGeometry } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveAndRecordBattedWorldFirstFielderTouch } from '../../core/sim/plateAppearance/BattedWorldFirstFielderTouch';
import { deriveBattedBallContactResponse } from '../../core/sim/ball/BattedBallContactResponse';

export type OwnedRunnerFieldRootTag = Readonly<{ kind: 'owned_runner_field_root_v1'; prePitchRunnerSourceId: string }>;
export type OwnedRunnerFieldAction = AcceptedBattedWorldFieldAction & Readonly<{ kind: 'owned_runner_field_v1'; prePitchRunnerSourceId: string }>;
export const zero = { x: 0, y: 0, z: 0 };
export const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };

/** Small source-boundary fixture. Only the original flight reader is substituted by tests.
 * Contact, zero-time response and field geometry are real existing Core outputs.
 * These isolated inputs are not a Native ownership acceptance proof. */
export const ownedRunnerFieldInputs = (path?: string) => {
  const x = prePitchRunnerContactFixture(path);
  const field = createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
    thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } });
  const flight = { ...x.flight, source: { ...x.flight.source, searchDurationTicks: 0, execution: { ...x.flight.source.execution, field } },
    flight: createBattedBallFlightEvidence({ contact: x.flight.flight.contact, parameters: x.flight.source.execution.ballFlightParameters, searchDurationTicks: 0 }) };
  const rootTag: OwnedRunnerFieldRootTag = { kind: 'owned_runner_field_root_v1', prePitchRunnerSourceId: x.source.prePitchRunnerSourceId! };
  const touchSource: AcceptedBattedFirstFielderTouch & OwnedRunnerFieldRootTag = { ...rootTag, sourceId: 'runner-field-touch', sourceVersion: 'fixture-v1', worldContactSourceId: x.source.sourceId };
  const responseSource: AcceptedBattedContactResponse & OwnedRunnerFieldRootTag = { ...rootTag, sourceId: 'runner-field-response', sourceVersion: 'fixture-v1',
    firstFielderTouchSourceId: touchSource.sourceId, responseModelSourceId: 'runner-field-response-model' };
  const p = flight.source.execution.ballFlightParameters;
  const responseModel: AcceptedBattedContactResponseModel = { sourceId: responseSource.responseModelSourceId, sourceVersion: 'synthetic-v1', gameId: x.model.gameId,
    careerId: x.model.careerId, fixtureEventId: x.model.fixtureEventId, venueId: x.model.venueId, availableAtDay: 1,
    actors: x.model.actors.map(a => ({ playerId: a.playerId, personId: a.personId, primitives: a.primitives.map(s => s.role !== 'glove'
      ? { role: s.role, material } : { role: 'glove', pocketCenterOffset: zero, bodyStability: 1,
        parameters: { ticksPerSecond: p.ticksPerSecond, ballMassKg: 0.145, ballRadiusMeters: p.ballRadius, pocketRadiusMeters: 0.2,
          centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1000, failedContactRestitution: material.restitution,
          failedTangentialDamping: material.tangentialDamping, failedSpinDamping: material.spinDamping } }) })), surfaces: [] };
  const surface = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.1, z: 0.1 }, rotationRadians: 0 }, surfaceHeightMeters: 0.1 });
  const baseSource = { sourceId: 'runner-field-bases', sourceVersion: 'synthetic-v1', flightSourceId: flight.source.sourceId, geometryRef: 'synthetic-v1', availableAtDay: 1,
    bases: { home: surface(0, 0), first: surface(20, 20), second: surface(0, 40), third: surface(-20, 20) } };
  const bases = { source: baseSource, flight, fixture: { game_id: x.model.gameId, fixture_event_id: x.model.fixtureEventId, venue_id: x.model.venueId },
    geometry: createBattedWorldBaseGeometry({ field, bases: baseSource.bases }), domesticVenueHistory: null } as unknown as DurableBattedWorldBaseGeometry;
  const baseModel = { bottomY: 0, material };
  const geometrySource: AcceptedBattedWorldFieldGeometry = { sourceId: 'runner-field-geometry', sourceVersion: 'synthetic-v1', baseGeometrySourceId: baseSource.sourceId,
    baseModels: { home: baseModel, first: baseModel, second: baseModel, third: baseModel } };
  const geometry = { source: geometrySource, baseGeometry: bases,
    geometry: createBattedWorldFieldGeometry({ baseGeometry: bases.geometry, baseModels: geometrySource.baseModels }) };
  const source: OwnedRunnerFieldAction = { kind: 'owned_runner_field_v1', prePitchRunnerSourceId: rootTag.prePitchRunnerSourceId,
    sourceId: 'runner-field-1', sourceVersion: 'fixture-v1', responseSourceId: responseSource.sourceId, geometrySourceId: geometrySource.sourceId,
    previousFieldSourceId: null, availableAtTick: flight.flight.contact.tick, throughTick: flight.flight.contact.tick + 100_000,
    commands: x.source.commands.map(c => ({ playerId: c.playerId, bodyAcceleration: c.bodyAcceleration,
      primitiveMotions: c.primitiveMotions.map(m => ({ role: m.role, offsetAcceleration: m.offsetAcceleration })) })) };
  x.db.exec(`CREATE TABLE batted_world_field_geometries(source_id TEXT,base_geometry_source_id TEXT,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE batted_world_field_actions(source_id TEXT,physical_pitch_source_id TEXT,response_source_id TEXT,geometry_source_id TEXT,previous_source_id TEXT,revision INTEGER,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE batted_world_field_heads(physical_pitch_source_id TEXT,response_source_id TEXT,geometry_source_id TEXT,source_id TEXT,revision INTEGER);`);
  x.db.prepare('INSERT INTO batted_world_field_geometries VALUES(?,?,?,?,?,?,?)').run(geometrySource.sourceId, baseSource.sourceId, x.model.gameId,
    json(geometrySource), hash(geometrySource), json(geometry), hash(geometry));
  const deriveWorld = () => battedWorldContactEvidenceFromSqlite(x.db).derive(x.source, x.model, null);
  const deriveRoot = (world: DurableBattedWorldContact) => {
    const worldInput = { flight: world.flight.flight, parameters: p, throughTick: flight.flight.contact.tick, actors: world.actors, surfaces: world.model.surfaces };
    const touch: DurableBattedFirstFielderTouch = { source: touchSource, worldContact: world,
      result: deriveAndRecordBattedWorldFirstFielderTouch({ timeline: world.timeline, world: worldInput, defenderIds: world.flight.physicalPitch.frame.batterActor!.defenderBindings.map(b => b.playerId), field }) };
    const responseInput = { world: worldInput, actors: responseModel.actors.filter(a => world.actors.some(actor => actor.playerId === a.playerId))
      .flatMap(a => a.primitives.map(profile => ({ playerId: a.playerId, profile }))), surfaces: responseModel.surfaces };
    const response: DurableBattedContactResponse = { source: responseSource, model: responseModel, touch, result: deriveBattedBallContactResponse(responseInput) };
    return { touch, response, responseInput };
  };
  const archive = (value: DurableBattedWorldFieldAction) => {
    const s = value.source, pitchId = value.response.touch.worldContact.flight.source.physicalPitchSourceId;
    x.db.prepare('INSERT INTO batted_world_field_actions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(s.sourceId, pitchId, s.responseSourceId, s.geometrySourceId,
      s.previousFieldSourceId, value.revision, x.model.gameId, json(s), hash(s), json(value), hash(value));
    x.db.prepare('DELETE FROM batted_world_field_heads').run();
    x.db.prepare('INSERT INTO batted_world_field_heads VALUES(?,?,?,?,?)').run(pitchId, s.responseSourceId, s.geometrySourceId, s.sourceId, value.revision);
  };
  return { ...x, flight, source, contactSource: x.source, touchSource, responseSource, responseModel, bases, geometry, deriveWorld, deriveRoot, archive };
};
