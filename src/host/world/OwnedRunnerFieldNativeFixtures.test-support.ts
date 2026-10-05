import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { createBattedBallInitialStateFromContact } from '../../core/sim/contact/BatBallContact';
import { advanceBallState, DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';
import { openSqliteBattedWorldContactStore, type AcceptedBattedWorldContact, type AcceptedBattedWorldModel } from './SqliteBattedWorldContactStore';
import { openSqliteBattedFirstFielderTouchStore, type AcceptedBattedFirstFielderTouch } from './SqliteBattedFirstFielderTouchStore';
import { openSqliteBattedContactResponseStore, type AcceptedBattedContactResponse, type AcceptedBattedContactResponseModel } from './SqliteBattedContactResponseStore';
import { openSqliteBattedWorldBaseGeometryStore, type AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import { openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import type { AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { material, zero, type OwnedRunnerFieldAction, type OwnedRunnerFieldRootTag } from './OwnedRunnerFieldFixtures.test-support';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';

/** One legal producer chain adapted from PrePitchRunnerNative.test.ts. All inputs
 * are prospectively accepted synthetic fixture values, never production calibration.
 * Call once per Native test; reuse its saved Sources for failure mutations. */
export const ownedRunnerFieldNativeFixture = () => {
  const x = physicalPlateAppearanceActorFixture(undefined, undefined, { ruleProfileId: asRuleProfileId('npb-2026') }), { f } = x;
  try {
    x.actors.accept(x.source.sourceId); let tick = 0;
    for (let i = 0; i < 4; i++) {
      const action = continuousPitchAction(f, i, tick);
      x.actions.set(action.sourceId, { ...action, request: { ...action.request, delivery: { ...action.request.delivery,
        moundReference: { ...action.request.delivery.moundReference, x: 1 } } } });
      tick = x.pitches.accept(action.sourceId, i).result.pitch.resolution.timeline.lastEventTick;
    }
    const close = x.closeInput(tick, 'pitch-3', 'away-1'); x.closes.set(close.sourceId, close); x.closure.submit(close.sourceId);
    x.accepted.set('batter-2', { sourceId: 'batter-2', sourceVersion: 'v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: 'application-1' });
    const actor = x.actors.accept('batter-2'), originalWorld = actor.world, originalMatch = actor.match, worldRunner = originalWorld.runners[0];
    if (originalMatch.bases.first !== 'away-1' || originalWorld.runners.length !== 1) throw new Error('fixture requires legal walked runner');
    const initial = continuousPitchAction(f, 0, originalWorld.tick), timeline = createCanonicalPlateAppearanceTimeline(originalMatch, originalWorld.tick);
    const { initialWorldSourceId: _initialWorld, ...rest } = initial as typeof initial & { initialWorldSourceId: string };
    const next = { ...rest, sourceId: 'owned-runner-field-pitch', activationApplicationId: 'application-1', request: { ...initial.request, workloadRevision: 1 } };
    const request = { ...next.request, timeline, effortPolicySourceId: f.effort.sourceId,
      delivery: { ...next.request.delivery, playId: originalMatch.playId, pitchIndex: 0 } };
    const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, request);
    const startTick = preview.pitch.trajectory.start.tick + 590_000, ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
    const swing = { action: { kind: 'swing' as const, swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } }, linearVelocity: zero, angularVelocity: zero } } } };
    const planned = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...request, batter: swing });
    const contact = planned.pitch.resolution.timeline.events.find(e => e.kind === 'BatBallContact');
    if (!contact || contact.kind !== 'BatBallContact') throw new Error('fixture requires actual planned contact');
    const at = contact.tick, hitTick = at + 200_000, throughTick = at + 300_000;
    const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 };
    const target = advanceBallState(createBattedBallInitialStateFromContact(contact.payload.contact), hitTick - at, parameters).position;
    const dx = target.x - worldRunner.position.x, dz = target.z - worldRunner.position.z, distance = Math.hypot(dx, dz);
    const elapsed = (hitTick - originalWorld.tick) / parameters.ticksPerSecond;
    const runner: AcceptedPrePitchRunnerExecution = { kind: 'pre_pitch_upright_runner_v1', sourceId: 'original-field-runner-motion', sourceVersion: 'synthetic-v1',
      gameId: 'game-1', physicalActorSourceId: actor.source.sourceId, playerId: worldRunner.playerId, motionRevision: 0,
      route: { segments: [{ kind: 'line', start: worldRunner.position,
        end: { x: worldRunner.position.x + dx / distance * (distance + 100), z: worldRunner.position.z + dz / distance * (distance + 100) } }] },
      startMotion: { tick: originalWorld.tick, routeDistanceMeters: 0, speedMps: 0, driveDirection: 1, bodyMode: 'upright' },
      intent: { kind: 'advance', issuedTick: originalWorld.tick }, parameters: { ticksPerSecond: 1_000_000, reactionDelayTicks: 0,
        accelerationMps2: 2 * distance / (elapsed * elapsed), brakingMps2: 4, slideDecelerationMps2: 4, topSpeedMps: 100 }, coverageThroughTick: throughTick,
      bodyPose: { bodyOriginHeightMeters: 0, primitiveMotions: (['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const).map((role, index) => ({
        role, startOffset: { x: 0, y: role === 'body' ? target.y : 20 + index, z: 0 }, offsetVelocity: zero, offsetAcceleration: zero })) } };
    const action = { ...next, request: { ...next.request, batter: swing }, prePitchRunner: runner };
    x.actions.set(action.sourceId, action); const physical = x.pitches.accept(action.sourceId, 0);
    const fixture = f.db.prepare('SELECT venue_id FROM official_fixtures WHERE game_id=?').get('game-1')!;
    const centers = f.firstInput.worldSetup.baseCenters;
    const unit = (v: { x: number; z: number }) => ({ x: v.x / Math.hypot(v.x, v.z), z: v.z / Math.hypot(v.x, v.z) });
    const field = createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: unit(centers.first), thirdBaseLineUnit: unit(centers.third) });
    const flightSource: AcceptedBattedBallFlight = { sourceId: 'runner-field-flight', sourceVersion: 'synthetic-v1', physicalPitchSourceId: action.sourceId,
      previousFlightSourceId: null, searchDurationTicks: 0, execution: { venueId: fixture.venue_id as string, availableAtDay: 1, field, ballFlightParameters: parameters } };
    const flights = f.track(openSqliteBattedBallFlightStore(f.path, x.pitches, { readAcceptedFlight: id => id === flightSource.sourceId ? flightSource : null }));
    const flight = flights.accept(flightSource.sourceId);
    const bindings = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=?').all('game-1')
      .map(row => JSON.parse(row.binding_json as string) as OfficialParticipantBinding);
    const model: AcceptedBattedWorldModel = { sourceId: 'runner-field-model', sourceVersion: 'synthetic-v1', gameId: 'game-1', careerId: actor.binding.careerId,
      fixtureEventId: actor.binding.fixtureEventId, venueId: flightSource.execution.venueId, availableAtDay: 1, batterGripOffset: zero, surfaces: [],
      actors: bindings.map(b => ({ playerId: b.playerId, personId: b.personId,
        heightMeters: b.playerId === physical.frame.workload.playerId ? physical.frame.release.body.heightMeters : 1.8, bodyOriginHeightMeters: 0,
        primitives: runner.bodyPose.primitiveMotions.map(p => ({ role: p.role, radius: 0.05, offset: b.playerId === runner.playerId ? p.startOffset : { x: 0, y: 40, z: 0 } })) })) };
    const contactSource: AcceptedBattedWorldContact = { kind: 'owned_runner_contact_v1', prePitchRunnerSourceId: runner.sourceId,
      sourceId: 'runner-field-contact', sourceVersion: 'synthetic-v1', flightSourceId: flight.source.sourceId, modelSourceId: model.sourceId, previousContactSourceId: null,
      commands: [...actor.defenderBindings, actor.binding].map(b => ({ playerId: b.playerId, bodyAcceleration: zero,
        primitiveMotions: runner.bodyPose.primitiveMotions.map(p => ({ role: p.role, offsetVelocity: zero, offsetAcceleration: zero })) })) };
    const contacts = f.track(openSqliteBattedWorldContactStore(f.path, flights, { readAcceptedContact: id => id === contactSource.sourceId ? contactSource : null,
      readAcceptedModel: id => id === model.sourceId ? model : null }));
    const world = contacts.accept(contactSource.sourceId);
    const tag: OwnedRunnerFieldRootTag = { kind: 'owned_runner_field_root_v1', prePitchRunnerSourceId: runner.sourceId };
    const touchSource: AcceptedBattedFirstFielderTouch & OwnedRunnerFieldRootTag = { ...tag, sourceId: 'runner-field-touch', sourceVersion: 'synthetic-v1', worldContactSourceId: contactSource.sourceId };
    const touches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, { readAcceptedTouch: id => id === touchSource.sourceId ? touchSource : null }));
    const responseModel: AcceptedBattedContactResponseModel = { sourceId: 'runner-field-response-model', sourceVersion: 'synthetic-v1', gameId: model.gameId,
      careerId: model.careerId, fixtureEventId: model.fixtureEventId, venueId: model.venueId, availableAtDay: 1,
      actors: model.actors.map(a => ({ playerId: a.playerId, personId: a.personId, primitives: a.primitives.map(s => s.role !== 'glove' ? { role: s.role, material }
        : { role: 'glove', pocketCenterOffset: zero, bodyStability: 1, parameters: { ticksPerSecond: parameters.ticksPerSecond, ballMassKg: 0.145,
          ballRadiusMeters: parameters.ballRadius, pocketRadiusMeters: 0.2, centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1000,
          failedContactRestitution: material.restitution, failedTangentialDamping: material.tangentialDamping, failedSpinDamping: material.spinDamping } }) })), surfaces: [] };
    const responseSource: AcceptedBattedContactResponse & OwnedRunnerFieldRootTag = { ...tag, sourceId: 'runner-field-response', sourceVersion: 'synthetic-v1',
      firstFielderTouchSourceId: touchSource.sourceId, responseModelSourceId: responseModel.sourceId };
    const responses = f.track(openSqliteBattedContactResponseStore(f.path, touches, { readAcceptedResponse: id => id === responseSource.sourceId ? responseSource : null,
      readAcceptedModel: id => id === responseModel.sourceId ? responseModel : null }));
    const surface = (center: { x: number; z: number }) => ({ region: { center, halfSize: { x: 0.01, z: 0.01 }, rotationRadians: 0 }, surfaceHeightMeters: 0.05 });
    const baseSource: AcceptedBattedWorldBaseGeometry = { sourceId: 'runner-field-bases', sourceVersion: 'synthetic-v1', flightSourceId: flight.source.sourceId,
      geometryRef: 'synthetic-runner-field-v1', availableAtDay: 1,
      bases: { home: surface(field.homePlate), first: surface(centers.first), second: surface(centers.second), third: surface(centers.third) } };
    const bases = f.track(openSqliteBattedWorldBaseGeometryStore(f.path, flights, { readAcceptedGeometry: id => id === baseSource.sourceId ? baseSource : null }));
    const baseModel = { bottomY: 0, material };
    const geometrySource: AcceptedBattedWorldFieldGeometry = { sourceId: 'runner-field-geometry', sourceVersion: 'synthetic-v1', baseGeometrySourceId: baseSource.sourceId,
      baseModels: { home: baseModel, first: baseModel, second: baseModel, third: baseModel } };
    const source: OwnedRunnerFieldAction = { kind: 'owned_runner_field_v1', prePitchRunnerSourceId: runner.sourceId, sourceId: 'runner-field-1', sourceVersion: 'synthetic-v1',
      responseSourceId: responseSource.sourceId, geometrySourceId: geometrySource.sourceId, previousFieldSourceId: null, availableAtTick: at, throughTick: at + 50_000,
      commands: contactSource.commands.map(c => ({ playerId: c.playerId, bodyAcceleration: c.bodyAcceleration,
        primitiveMotions: c.primitiveMotions.map(p => ({ role: p.role, offsetAcceleration: p.offsetAcceleration })) })) };
    const sources = new Map([[source.sourceId, source]]);
    const fields = f.track(openSqliteBattedWorldFieldStore(f.path, responses, bases, { readAcceptedGeometry: id => id === geometrySource.sourceId ? geometrySource : null,
      readAcceptedAction: id => sources.get(id) ?? null }));
    return { ...x, actor, originalWorld, originalMatch, runner, action, physical, flight, flights, model, contactSource, contacts, world,
      touchSource, touches, responseSource, responseModel, responses, baseSource, bases, geometrySource, source, sources, fields, at, hitTick, throughTick };
  } catch (error) { f.close(); throw error; }
};
