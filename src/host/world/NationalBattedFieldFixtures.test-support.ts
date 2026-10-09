import assert from 'node:assert/strict';
import { nationalBattedPitchFixtureSource, nationalBattedFixtureBallParameters, type NationalBattedFixtureDeclaration } from './NationalBattedFixtureDeclaration.test-support';
import { openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import type { nationalPhysicalFixture } from './NationalPhysicalMatchFixtures.test-support';
import type { DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';
import { openSqliteBattedWorldContactStore, type AcceptedBattedWorldModel, type AcceptedBattedWorldContact } from './SqliteBattedWorldContactStore';
import { openSqliteBattedFirstFielderTouchStore } from './SqliteBattedFirstFielderTouchStore';
import { openSqliteBattedContactResponseStore, type AcceptedBattedContactResponseModel } from './SqliteBattedContactResponseStore';
import { openSqliteBattedWorldBaseGeometryStore, type AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import { openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldAction, type AcceptedBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import { calibrateActualFirstBaseWorldInputs, calibrateActualFirstBaseCaptureResponse } from './ActualFirstBasePlayEndFixtures.test-support';

/** Existing explicit contact/body/material fixtures applied before acceptance to
 * the actual National actor. No domestic root, generated result, row rewrite or
 * copied database is involved. Both callers share the same original enrollment. */
export type NationalBattedFieldContext = Pick<ReturnType<typeof nationalPhysicalFixture>,
  'path' | 'db' | 'track' | 'close' | 'pitchSource' | 'workload' | 'effort' | 'actions' | 'pitches' | 'setup' | 'official' | 'links'> & Readonly<{
    fixture: Readonly<{ binding: Readonly<{ venueId: string }> }>;
    battedFixtureDeclaration?: NationalBattedFixtureDeclaration;
    stores: Parameters<typeof resolveContinuousPlayerPitchAgainstBatterFromWorld>[0];
  }>;
export const nationalBattedFieldFixture = (f: NationalBattedFieldContext,
  actor: DurablePhysicalPlateAppearanceActor, label: string, kind: 'terminal_foul' | 'first_base') => {
  const declaration = f.battedFixtureDeclaration;
  if (declaration) {
    assert.equal(label, kind === 'terminal_foul' ? 'national-foul' : 'national-live');
    assert.equal(actor.binding.playerId, kind === 'terminal_foul' ? 'p9' : 'p10');
    assert.equal(actor.source.gameId, declaration.scope.gameId);
    assert.equal(actor.binding.fixtureEventId, declaration.scope.fixtureEventId);
    assert.equal(actor.binding.careerId, declaration.scope.careerId);
    assert.equal(f.fixture.binding.venueId, declaration.scope.venueId);
    assert.deepEqual(f.setup, declaration.scope.setup);
    for (const binding of [actor.binding, ...actor.defenderBindings]) assert.deepEqual(
      declaration.scope.roster.find(a => a.playerId === binding.playerId), { playerId: binding.playerId, personId: binding.personId });
  }
  let timeline = createCanonicalPlateAppearanceTimeline(actor.match, actor.world.tick), index = 0;
  const action = (pitchIndex: number, readyAtUs: number): AcceptedPhysicalPitchActionSource => {
    const recipe = f.pitchSource(pitchIndex, readyAtUs), { initialWorldSourceId: _initial, ...rest } = recipe as
      Extract<AcceptedPhysicalPitchActionSource, { initialWorldSourceId: string }>;
    return { ...rest, sourceId: `${label}:pitch-${pitchIndex}`,
      ...('activationApplicationId' in actor.source ? { activationApplicationId: actor.source.activationApplicationId }
        : { initialWorldSourceId: actor.source.initialWorldSourceId }),
      request: { ...recipe.request, workloadRevision: f.workload.readHead(actor.binding.careerId, 'p0')!.revision } };
  };
  if (kind === 'terminal_foul') {
    for (; index < 2; index++) {
      const taken = action(index, timeline.lastEventTick); f.actions.set(taken.sourceId, taken);
      timeline = f.pitches.accept(taken.sourceId, index).result.pitch.resolution.timeline;
    }
    if (timeline.status.kind !== 'active' || timeline.status.count.strikes !== 2) throw new Error('National original TAKE prefix lacks two strikes');
  }
  const source = nationalBattedPitchFixtureSource(action(index, timeline.lastEventTick), timeline, f.stores, actor.source.sourceId, kind, index);
  f.actions.set(source.sourceId, source); const physical = f.pitches.accept(source.sourceId, index);
  if (physical.result.pitch.resolution.timeline.status.kind !== 'batted_ball_pending') throw new Error('National actual pitch did not contact the bat');
  const centers = f.setup.baseCenters, ray = (v: { x: number; z: number }) => { const n = Math.hypot(v.x, v.z); return { x: v.x / n, z: v.z / n }; };
  const flightInput: AcceptedBattedBallFlight = { sourceId: label + ':flight', sourceVersion: 'fixture-v1', physicalPitchSourceId: source.sourceId,
    previousFlightSourceId: null, searchDurationTicks: 0, execution: { venueId: f.fixture.binding.venueId, availableAtDay: 1,
      field: createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: ray(centers.first), thirdBaseLineUnit: ray(centers.third) }),
      ballFlightParameters: nationalBattedFixtureBallParameters } };
  const flights = f.track(openSqliteBattedBallFlightStore(f.path, f.pitches, { readAcceptedFlight: id => id === flightInput.sourceId ? flightInput : null }));
  const flight = flights.accept(flightInput.sourceId), bindings = [actor.binding, ...actor.defenderBindings];
  const model: Extract<AcceptedBattedWorldModel, { kind?: never }> = declaration?.model ?? { sourceId: label + ':world-model', sourceVersion: 'fixture-v1', gameId: actor.source.gameId,
    careerId: actor.binding.careerId, fixtureEventId: actor.binding.fixtureEventId, venueId: flightInput.execution.venueId, availableAtDay: 1,
    actors: bindings.map(b => ({ playerId: b.playerId, personId: b.personId, heightMeters: 1.8, bodyOriginHeightMeters: 0,
      primitives: (['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const).map(role => ({ role, radius: .05,
        offset: { x: role === 'left_foot' ? -.1 : role === 'right_foot' ? .1 : 0, y: role.endsWith('foot') ? .05 : .9, z: 0 } })) })),
    batterGripOffset: { x: .5, y: .9, z: 0 }, surfaces: [] };
  const contactSource: AcceptedBattedWorldContact = { sourceId: label + ':world-contact', sourceVersion: 'fixture-v1', flightSourceId: flight.source.sourceId,
    modelSourceId: model.sourceId, previousContactSourceId: null, commands: model.actors.filter(a => bindings.some(b => b.playerId === a.playerId)).map(a => ({ playerId: a.playerId,
      bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: a.primitives.map(p => ({ role: p.role,
        offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) };
  const models = new Map([[model.sourceId, model]]), contactSources = new Map([[contactSource.sourceId, contactSource]]);
  const forecastGroundElapsedSeconds = kind === 'first_base'
    ? calibrateActualFirstBaseWorldInputs({ flight, model, models, source: contactSource, sources: contactSources }, centers.first) : null;
  if (declaration) assert.deepEqual(models.get(model.sourceId), declaration.model, 'actual next-play calibration differs from the prospective common model');
  const contacts = f.track(openSqliteBattedWorldContactStore(f.path, flights, {
    readAcceptedModel: id => models.get(id) ?? null, readAcceptedContact: id => contactSources.get(id) ?? null }));
  const worldContact = contacts.accept(contactSource.sourceId), touchSource = { sourceId: label + ':touch', sourceVersion: 'fixture-v1', worldContactSourceId: contactSource.sourceId };
  const touches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, { readAcceptedTouch: id => id === touchSource.sourceId ? touchSource : null }));
  touches.accept(touchSource.sourceId);
  const p = flightInput.execution.ballFlightParameters, material = { restitution: .5, tangentialDamping: .25, spinDamping: .2 };
  const responseModel: AcceptedBattedContactResponseModel = declaration?.responseModel ?? { sourceId: label + ':response-model', sourceVersion: 'fixture-v1', gameId: model.gameId,
    careerId: model.careerId, fixtureEventId: model.fixtureEventId, venueId: model.venueId, availableAtDay: 1,
    actors: model.actors.map(a => ({ playerId: a.playerId, personId: a.personId, primitives: a.primitives.map(s => s.role !== 'glove' ? { role: s.role, material } : {
      role: 'glove', pocketCenterOffset: { x: 0, y: 0, z: -.08 }, bodyStability: 1,
      parameters: { ticksPerSecond: p.ticksPerSecond, ballMassKg: .145, ballRadiusMeters: p.ballRadius, pocketRadiusMeters: .2,
        centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1000, failedContactRestitution: material.restitution,
        failedTangentialDamping: material.tangentialDamping, failedSpinDamping: material.spinDamping } } ) })), surfaces: [] };
  const responseModels = new Map([[responseModel.sourceId, responseModel]]);
  if (kind === 'first_base' && !declaration) calibrateActualFirstBaseCaptureResponse({ responseModel, responseModels });
  const responseSource = { sourceId: label + ':response', sourceVersion: 'fixture-v1', firstFielderTouchSourceId: touchSource.sourceId, responseModelSourceId: responseModel.sourceId };
  const responses = f.track(openSqliteBattedContactResponseStore(f.path, touches, {
    readAcceptedResponse: id => id === responseSource.sourceId ? responseSource : null, readAcceptedModel: id => responseModels.get(id) ?? null }));
  const response = responses.accept(responseSource.sourceId);
  const surface = (center: { x: number; z: number }) => ({ region: { center, halfSize: { x: .01, z: .2 }, rotationRadians: 0 }, surfaceHeightMeters: .1 });
  const baseSource: AcceptedBattedWorldBaseGeometry = declaration?.baseSource ?? { sourceId: label + ':bases', sourceVersion: 'synthetic-v1', flightSourceId: flight.source.sourceId,
    geometryRef: 'synthetic-field-contact-v1', availableAtDay: 1, bases: { home: surface(flightInput.execution.field.homePlate),
      first: surface(centers.first), second: surface(centers.second), third: surface(centers.third) } };
  const bases = f.track(openSqliteBattedWorldBaseGeometryStore(f.path, flights, { readAcceptedGeometry: id => id === baseSource.sourceId ? baseSource : null }));
  if (!declaration || kind === 'terminal_foul') bases.accept(baseSource.sourceId);
  const bag = { bottomY: 0, material }, geometrySource: AcceptedBattedWorldFieldGeometry = declaration?.geometrySource ?? { sourceId: label + ':geometry', sourceVersion: 'synthetic-v1',
    baseGeometrySourceId: baseSource.sourceId, baseModels: { home: bag, first: bag, second: bag, third: bag } };
  const bindingSource = declaration && kind === 'first_base' ? { sourceId: label + ':episode-binding', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v3' as const, responseSourceId: response.source.sourceId, fieldCalibrationSourceId: geometrySource.sourceId,
    physicalActorSourceId: actor.source.sourceId, completedOrigin: { kind: 'foul_terminal_completion' as const, sourceId: 'national-foul:terminal' } } : null;
  const fieldInput = { sourceId: label + ':field', sourceVersion: 'fixture-v1', responseSourceId: response.source.sourceId,
    geometrySourceId: geometrySource.sourceId, previousFieldSourceId: null, availableAtTick: flight.flight.initialBall.tick,
    throughTick: flight.flight.initialBall.tick + 2_000_000, commands: worldContact.source.commands.map(c => ({ playerId: c.playerId,
      bodyAcceleration: c.bodyAcceleration, primitiveMotions: c.primitiveMotions.map(m => ({ role: m.role, offsetAcceleration: m.offsetAcceleration })) })) };
  const fieldSource: Extract<AcceptedBattedWorldFieldAction, { kind?: never }> = bindingSource
    ? { ...fieldInput, episodeFieldBinding: { version: bindingSource.version, sourceId: bindingSource.sourceId } } : fieldInput;
  const sources = new Map<string, AcceptedBattedWorldFieldAction>([[fieldSource.sourceId, fieldSource]]);
  const fields = f.track(openSqliteBattedWorldFieldStore(f.path, responses, bases, {
    readAcceptedGeometry: id => id === geometrySource.sourceId ? geometrySource : null, readAcceptedAction: id => sources.get(id) ?? null }));
  const geometry = declaration && kind === 'first_base' ? fields.readGeometry(geometrySource.sourceId)! : fields.acceptGeometry(geometrySource.sourceId);
  if (!geometry) throw new Error('original National common calibration is missing');
  if (bindingSource) f.track(openSqliteBattedEpisodeFieldBindingStore(f.path, {
    readAcceptedBinding: id => id === bindingSource.sourceId ? bindingSource : null })).accept(bindingSource.sourceId);
  return { f, actor, physical, flight, worldContact, response, fields, source: fieldSource, sources, geometry, forecastGroundElapsedSeconds };
};
