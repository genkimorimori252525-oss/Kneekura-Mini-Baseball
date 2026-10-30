import { expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION, createVersionedFreeBallTrajectory,
  CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION, type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { battedBallFlightFixture as fixture } from './BattedBallFlightFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertLegacyBattedBallFlightConsumer, openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';
import { openSqliteBattedWorldContactStore, type AcceptedBattedWorldModel, type AcceptedBattedWorldContact } from './SqliteBattedWorldContactStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { CONTINUOUS_AERO_GROUND_BATTED_WORLD_SOURCE_VERSION, CONTINUOUS_AERO_GROUND_TOUCH_SOURCE_VERSION,
  CONTINUOUS_AERO_GROUND_RESPONSE_SOURCE_VERSION, CONTINUOUS_AERO_GROUND_CONTINUATION_SOURCE_VERSION, battedWorldFlightSourceCurve } from './BattedWorldSourceCurve';
import { deriveFirstBattedWorldContactGeometry } from '../../core/sim/ball/BattedBallWorldContacts';
import { openSqliteBattedFirstFielderTouchStore } from './SqliteBattedFirstFielderTouchStore';
import { openSqliteBattedContactResponseStore, type AcceptedBattedContactResponseModel } from './SqliteBattedContactResponseStore';
import { openSqliteBattedWorldContinuationStore, type AcceptedBattedWorldContinuation } from './SqliteBattedWorldContinuationStore';
import { querySourceFreeBallWorldV2 } from '../../core/sim/ball/SourceFreeBallWorldQuery';
import { openSqliteBattedWorldContinuationV3Store, SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3,
  SOURCE_IMPACT_ESCAPE_CONTINUATION_VERSION_V3, type AcceptedBattedWorldContinuationV3 } from './SqliteBattedWorldContinuationV3Store';

const profile = (source: AcceptedBattedBallFlight): AeroGroundBallPhysicsV1 => ({ kind: 'aero_ground_v1',
  air: { ticksPerSecond: source.execution.ballFlightParameters.ticksPerSecond,
    integrationStepTicks: source.execution.ballFlightParameters.integrationStepTicks,
    gravityY: source.execution.ballFlightParameters.gravityY, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
  ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378,
    restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } });
const originalPitchRows = (x: ReturnType<typeof fixture>) => x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY source_id').all();

const modelFor = (x: ReturnType<typeof fixture>, sourceId: string): AcceptedBattedWorldModel => {
  const { f, input, physical } = x, batter = physical.frame.batterActor!;
  return { sourceId, sourceVersion: 'fixture-v1', gameId: batter.source.gameId,
      careerId: batter.binding.careerId, fixtureEventId: batter.binding.fixtureEventId, venueId: input.execution.venueId, availableAtDay: 1,
      actors: f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=?').all(batter.source.gameId)
        .map(row => JSON.parse(row.binding_json as string) as OfficialParticipantBinding).map(binding => ({ playerId: binding.playerId, personId: binding.personId,
          heightMeters: binding.playerId === physical.frame.workload.playerId ? physical.frame.release.body.heightMeters : 1.8,
          bodyOriginHeightMeters: 0, primitives: (['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const).map(role => ({ role, radius: 0.05,
            offset: { x: role === 'left_foot' ? -0.1 : role === 'right_foot' ? 0.1 : 0, y: role.endsWith('foot') ? 0.05 : 0.9, z: 0 } })) })),
      batterGripOffset: { x: 0.5, y: 0.9, z: 0 }, surfaces: [] };
};


it('accepts explicit physics from original Native contact, replays after reopen, and refuses the legacy World consumer', () => {
  const x = fixture(), { f, input, flights, acceptedFlights, pitches, physical } = x;
  try {
    const rows = originalPitchRows(x), p = profile(input);
    const versioned = { ...input, sourceVersion: AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION,
      execution: { ...input.execution, ballPhysics: p } };
    acceptedFlights.set(input.sourceId, versioned);
    const root = flights.accept(input.sourceId);
    const next = { ...versioned, sourceId: 'flight-aero-full', previousFlightSourceId: input.sourceId, searchDurationTicks: 2_000_000 };
    acceptedFlights.set(next.sourceId, next);
    const flight = flights.accept(next.sourceId);
    const trajectory = createVersionedFreeBallTrajectory(flight.flight.initialBall, flight.flight.initialBall.tick + next.searchDurationTicks, p);
    expect(flight.flight.firstGroundContact).toEqual({ tick: trajectory.groundContacts[0].incoming.tick,
      state: trajectory.groundContacts[0].incoming });
    expect(flight.flight.firstGroundContact!.state.spin).not.toEqual(flight.flight.initialBall.spin);
    const old = createBattedBallFlightEvidence({ contact: flight.flight.contact, searchDurationTicks: next.searchDurationTicks,
      parameters: input.execution.ballFlightParameters });
    expect(flight.flight.firstGroundContact).not.toEqual(old.firstGroundContact);
    expect(() => assertLegacyBattedBallFlightConsumer(flight.source, 'field_prefix')).toThrow('unsupported versioned Aero/ground');
    expect(originalPitchRows(x)).toEqual(rows);
    expect(physical.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);

    const batter = physical.frame.batterActor!;
    const model = modelFor(x, 'aero-world-model');
    const source: AcceptedBattedWorldContact = { sourceId: 'aero-world-contact', sourceVersion: 'fixture-v1', flightSourceId: flight.source.sourceId,
      modelSourceId: model.sourceId, previousContactSourceId: null, commands: model.actors.filter(actor => [...batter.defenderBindings, batter.binding]
        .some(binding => binding.playerId === actor.playerId)).map(actor => ({ playerId: actor.playerId,
        bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: actor.primitives.map(primitive => ({ role: primitive.role,
          offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) };
    const contacts = f.track(openSqliteBattedWorldContactStore(f.path, flights, {
      readAcceptedModel: id => id === model.sourceId ? model : null,
      readAcceptedContact: id => id === source.sourceId ? source : null }));
    expect(() => contacts.accept(source.sourceId)).toThrow('unsupported versioned Aero/ground ball consumer: first_world_contact');
    expect((f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get() as { n: number }).n).toBe(0);

    acceptedFlights.clear();
    const offline = f.track(openSqliteBattedBallFlightStore(f.path, pitches));
    expect(offline.read(input.sourceId)).toEqual(root);
    expect(offline.read(next.sourceId)).toEqual(flight);
    const saved = f.db.prepare('SELECT source_json,snapshot_json FROM batted_ball_flights WHERE source_id=?').get(next.sourceId) as { source_json: string; snapshot_json: string };
    const corrupted = { ...next, execution: { ...next.execution, ballPhysics: { ...p,
      air: { ...p.air, aerodynamics: { ...p.air.aerodynamics, dragCoefficient: 0.7 } } } } };
    f.db.prepare('UPDATE batted_ball_flights SET source_json=?,source_hash=? WHERE source_id=?').run(json(corrupted), hash(corrupted), next.sourceId);
    expect(() => offline.read(next.sourceId)).toThrow();
    expect(originalPitchRows(x)).toEqual(rows);
    expect(saved.source_json).toBe(json(next));
    expect(saved.snapshot_json).toBe(json(flight));
  } finally { f.close(); }
});

it('requires the exact opt-in version, complete profile and matching source clock/geometry before any SQLite admission', () => {
  const { f, input, flights, acceptedFlights } = fixture();
  try {
    const p = profile(input), versioned = { ...input, sourceVersion: AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION,
      execution: { ...input.execution, ballPhysics: p } };
    for (const value of [
      { ...versioned, sourceVersion: input.sourceVersion },
      { ...versioned, execution: input.execution },
      { ...versioned, execution: { ...versioned.execution, ballPhysics: { ...p, air: { ...p.air, integrationStepTicks: 1_000 } } } },
      { ...versioned, execution: { ...versioned.execution, ballPhysics: { ...p, ground: { ...p.ground, radiusM: 0.04 } } } },
      { ...versioned, execution: { ...versioned.execution, ballPhysics: { ...p, ground: { ...p.ground, gravityMps2: 10 } } } },
    ]) {
      acceptedFlights.set(input.sourceId, value);
      expect(() => flights.accept(input.sourceId)).toThrow();
      expect((f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get() as { n: number }).n).toBe(0);
    }
  } finally { f.close(); }
});

it('preserves original legacy Source and snapshot byte conventions without adding a physics field', () => {
  const { f, input, flights } = fixture();
  try {
    const flight = flights.accept(input.sourceId);
    const expected = { source: input, revision: 1, physicalPitch: flight.physicalPitch, originalPitchRows: flight.originalPitchRows,
      flight: createBattedBallFlightEvidence({ contact: flight.flight.contact, searchDurationTicks: input.searchDurationTicks,
        parameters: input.execution.ballFlightParameters }), projectedGroundTerritory: null };
    const row = f.db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM batted_ball_flights WHERE source_id=?').get(input.sourceId) as {
      source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
    expect(row).toEqual({ source_json: json(input), source_hash: hash(input), snapshot_json: json(expected), snapshot_hash: hash(expected) });
    expect(flight.source.execution).not.toHaveProperty('ballPhysics');
    expect(() => assertLegacyBattedBallFlightConsumer(flight.source, 'field_prefix')).not.toThrow();
  } finally { f.close(); }
});

it('admits continuous v2 only as its own frozen kernel version and replays original contact/floor states after reopen', () => {
  const x = fixture(), { f, input, flights, acceptedFlights, pitches } = x;
  try {
    const originalRows = originalPitchRows(x), p = profile(input);
    const rootSource = { ...input, sourceVersion: CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION,
      execution: { ...input.execution, ballPhysics: p } };
    acceptedFlights.set(rootSource.sourceId, rootSource);
    const root = flights.accept(rootSource.sourceId);
    const fullSource = { ...rootSource, sourceId: 'continuous-flight-full', previousFlightSourceId: rootSource.sourceId,
      searchDurationTicks: 2_000_000 };
    acceptedFlights.set(fullSource.sourceId, fullSource);
    const full = flights.accept(fullSource.sourceId), initial = full.flight.initialBall;
    const kernel = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
      initial: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, throughElapsedSeconds: 2, profile: p });
    const contact = kernel.boundaries.find(b => b.kind === 'ground')!;
    const incoming = kernel.evaluateAt(contact.elapsedSeconds, 'incoming').moment.ball;
    expect(full.flight.firstGroundContact).toEqual({ tick: incoming.tick, state: incoming });
    expect(() => assertLegacyBattedBallFlightConsumer(full.source, 'first_world_contact')).toThrow('unsupported versioned');
    const downgrade = { ...fullSource, sourceId: 'kernel-downgrade', previousFlightSourceId: fullSource.sourceId,
      searchDurationTicks: 3_000_000, sourceVersion: AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION };
    acceptedFlights.set(downgrade.sourceId, downgrade);
    expect(() => flights.accept(downgrade.sourceId)).toThrow('previous Source');
    expect((f.db.prepare('SELECT count(*) AS n FROM batted_ball_flights').get() as { n: number }).n).toBe(2);
    acceptedFlights.clear();
    const offline = f.track(openSqliteBattedBallFlightStore(f.path, pitches));
    expect(offline.read(rootSource.sourceId)).toEqual(root);
    expect(offline.read(fullSource.sourceId)).toEqual(full);
    expect(originalPitchRows(x)).toEqual(originalRows);
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
  } finally { f.close(); }
});

it('admits original Native v2 first-World contact and geometry, preserves the lattice across extension, and replays offline', () => {
  const x = fixture(), { f, input, flights, acceptedFlights, physical } = x;
  try {
    const originalRows = originalPitchRows(x), p = profile(input), batter = physical.frame.batterActor!;
    const rootSource = { ...input, sourceVersion: CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION,
      execution: { ...input.execution, ballPhysics: p } };
    acceptedFlights.set(rootSource.sourceId, rootSource);
    flights.accept(rootSource.sourceId);
    const fullSource = { ...rootSource, sourceId: 'world-continuous-full', previousFlightSourceId: rootSource.sourceId, searchDurationTicks: 2_000_000 };
    acceptedFlights.set(fullSource.sourceId, fullSource);
    const full = flights.accept(fullSource.sourceId);
    const model = modelFor(x, 'continuous-world-model');
    const rootWorld: AcceptedBattedWorldContact = { sourceId: 'continuous-world-root', sourceVersion: CONTINUOUS_AERO_GROUND_BATTED_WORLD_SOURCE_VERSION,
      flightSourceId: rootSource.sourceId, modelSourceId: model.sourceId, previousContactSourceId: null,
      commands: model.actors.filter(actor => [...batter.defenderBindings, batter.binding].some(binding => binding.playerId === actor.playerId))
        .map(actor => ({ playerId: actor.playerId, bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: actor.primitives.map(primitive => ({
          role: primitive.role, offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) };
    const sources = new Map<string, AcceptedBattedWorldContact>([[rootWorld.sourceId, rootWorld]]);
    const contacts = f.track(openSqliteBattedWorldContactStore(f.path, flights, {
      readAcceptedModel: id => id === model.sourceId ? model : null, readAcceptedContact: id => sources.get(id) ?? null }));
    sources.set(rootWorld.sourceId, { ...rootWorld, sourceVersion: 'fixture-v1' });
    expect(() => contacts.accept(rootWorld.sourceId)).toThrow('Source version differs');
    expect((f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get() as { n: number }).n).toBe(0);
    sources.set(rootWorld.sourceId, rootWorld);
    const root = contacts.accept(rootWorld.sourceId);
    expect(root.result.kind).toBe('airborne');
    const extended = { ...rootWorld, sourceId: 'continuous-world-contact', flightSourceId: fullSource.sourceId,
      previousContactSourceId: rootWorld.sourceId };
    sources.set(extended.sourceId, extended);
    const value = contacts.accept(extended.sourceId);
    expect(value.result.kind).toBe('contact');
    const derived = deriveFirstBattedWorldContactGeometry({ flight: full.flight, parameters: full.source.execution.ballFlightParameters,
      throughTick: full.flight.initialBall.tick + full.source.searchDurationTicks, actors: value.actors, surfaces: value.model.surfaces,
      sourceCurve: battedWorldFlightSourceCurve(full) });
    expect(value.result).toEqual(derived.world);
    expect(value.result.sourceMoment).toEqual(createSourceFreeBallKernel(battedWorldFlightSourceCurve(full)!)
      .evaluateAt(value.result.sourceMoment!.elapsedSeconds, 'incoming').moment);
    expect(value.result.sourceMoment!.originTick).toBe(full.flight.initialBall.tick);
    if (value.result.kind !== 'contact') throw new Error('expected original World contact');
    expect(value.result.contacts).toEqual([{ kind: 'ground' }]);
    expect(value.timeline.events.at(-1)!.kind).toBe('BattedBallFirstGroundContact');
    expect(value.result.ball).toEqual(full.flight.firstGroundContact!.state);
    const touchSource = { sourceId: 'continuous-touch', sourceVersion: CONTINUOUS_AERO_GROUND_TOUCH_SOURCE_VERSION, worldContactSourceId: extended.sourceId };
    const touches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, { readAcceptedTouch: id => id === touchSource.sourceId ? touchSource : null }));
    const touch = touches.accept(touchSource.sourceId);
    expect(touch.result).toMatchObject({ kind: 'unresolved', reason: 'ground' });
    const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
    const responseModel: AcceptedBattedContactResponseModel = { sourceId: 'continuous-response-model', sourceVersion: 'fixture-v1',
      gameId: model.gameId, careerId: model.careerId, fixtureEventId: model.fixtureEventId, venueId: model.venueId, availableAtDay: 1,
      actors: model.actors.map(a => ({ playerId: a.playerId, personId: a.personId, primitives: a.primitives.map(s => s.role !== 'glove'
        ? { role: s.role, material } : { role: 'glove', pocketCenterOffset: { x: 0, y: 0, z: -0.08 }, bodyStability: 1, parameters: {
          ticksPerSecond: 1_000_000, ballMassKg: 0.145, ballRadiusMeters: p.ground.radiusM, pocketRadiusMeters: 0.2,
          centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1_000, failedContactRestitution: material.restitution,
          failedTangentialDamping: material.tangentialDamping, failedSpinDamping: material.spinDamping } }) })), surfaces: [] };
    const responseSource = { sourceId: 'continuous-response', sourceVersion: CONTINUOUS_AERO_GROUND_RESPONSE_SOURCE_VERSION,
      firstFielderTouchSourceId: touchSource.sourceId, responseModelSourceId: responseModel.sourceId };
    const responses = f.track(openSqliteBattedContactResponseStore(f.path, touches, {
      readAcceptedResponse: id => id === responseSource.sourceId ? responseSource : null,
      readAcceptedModel: id => id === responseModel.sourceId ? responseModel : null }));
    const response = responses.accept(responseSource.sourceId);
    expect(response.result.kind).toBe('ground');
    expect(response.result.world).toEqual(value.result);
    const continuationSources = new Map<string, AcceptedBattedWorldContinuation>();
    const continuations = f.track(openSqliteBattedWorldContinuationStore(f.path, responses,
      { readAcceptedContinuation: id => continuationSources.get(id) ?? null }));
    const next = { sourceId: 'continuous-step-1', sourceVersion: CONTINUOUS_AERO_GROUND_CONTINUATION_SOURCE_VERSION,
      responseSourceId: responseSource.sourceId, previousContinuationSourceId: null, throughTick: full.flight.initialBall.tick + 2_000_000 };
    continuationSources.set(next.sourceId, { ...next, sourceVersion: 'fixture-v1' });
    expect(() => continuations.accept(next.sourceId)).toThrow('Source version differs');
    continuationSources.set(next.sourceId, next);
    const step1 = continuations.accept(next.sourceId);
    const next2 = { ...next, sourceId: 'continuous-step-2', previousContinuationSourceId: next.sourceId };
    continuationSources.set(next2.sourceId, next2);
    const step2 = continuations.accept(next2.sourceId), sourceKernel = createSourceFreeBallKernel(battedWorldFlightSourceCurve(full)!);
    expect(step2.result.cursor!.sourceCurve!.initial).toEqual(battedWorldFlightSourceCurve(full)!.initial);
    expect(step2.result.cursor!.moment).toEqual(sourceKernel.evaluateAt(step2.result.cursor!.moment.elapsedSeconds, 'outgoing').moment);
    expect(step2.result.steps[1].world.moment.elapsedSeconds).toBeGreaterThan(step2.result.steps[0].world.moment.elapsedSeconds);
    const offlineTouches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, { read: () => { throw new Error('peer read is forbidden'); } }));
    const offlineResponses = f.track(openSqliteBattedContactResponseStore(f.path, { read: () => { throw new Error('peer read is forbidden'); } }));
    const offlineContinuations = f.track(openSqliteBattedWorldContinuationStore(f.path, { read: () => { throw new Error('peer read is forbidden'); } }));
    expect(offlineTouches.read(touchSource.sourceId)).toEqual(touch);
    expect(offlineResponses.read(responseSource.sourceId)).toEqual(response);
    expect(offlineContinuations.read(next.sourceId)).toEqual(step1);
    expect(offlineContinuations.read(next2.sourceId)).toEqual(step2);
    const savedStep = f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_continuations WHERE source_id=?').get(next2.sourceId) as { snapshot_json: string; snapshot_hash: string };
    const changedStep = { ...step2, result: { ...step2.result, cursor: { ...step2.result.cursor!, moment: { ...step2.result.cursor!.moment,
      elapsedSeconds: step2.result.cursor!.moment.elapsedSeconds + 1e-8 } } } };
    f.db.prepare('UPDATE batted_world_continuations SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(changedStep), hash(changedStep), next2.sourceId);
    expect(() => offlineContinuations.read(next2.sourceId)).toThrow('corrupt original batted continuation snapshot');
    f.db.prepare('UPDATE batted_world_continuations SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(savedStep.snapshot_json, savedStep.snapshot_hash, next2.sourceId);
    sources.clear(); acceptedFlights.clear();
    const offline = f.track(openSqliteBattedWorldContactStore(f.path, { read: () => { throw new Error('peer read is forbidden'); } }));
    expect(offline.read(rootWorld.sourceId)).toEqual(root);
    expect(offline.read(extended.sourceId)).toEqual(value);
    const row = f.db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_contacts WHERE source_id=?')
      .get(extended.sourceId) as { source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
    expect(row).toEqual({ source_json: json(extended), source_hash: hash(extended), snapshot_json: json(value), snapshot_hash: hash(value) });
    const corrupted = { ...value, result: { ...value.result, sourceMoment: { ...value.result.sourceMoment!, elapsedSeconds: value.result.sourceMoment!.elapsedSeconds + 1e-8 } } };
    f.db.prepare('UPDATE batted_world_contacts SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(corrupted), hash(corrupted), extended.sourceId);
    expect(() => offline.read(extended.sourceId)).toThrow('corrupt original batted World archive');
    expect(originalPitchRows(x)).toEqual(originalRows);
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
  } finally { f.close(); }
});

it('owns a real nonlinear Native wall impulse, preserves the stopped v2 archive and independently branches with v3 certificates', () => {
  const x = fixture(), { f, input, flights, acceptedFlights, physical } = x;
  try {
    const p = profile(input), flightSource = { ...input, sourceVersion: CONTINUOUS_AERO_GROUND_BATTED_FLIGHT_SOURCE_VERSION,
      searchDurationTicks: 2_000_000, execution: { ...input.execution, ballPhysics: p } };
    acceptedFlights.set(flightSource.sourceId, flightSource);
    const flight = flights.accept(flightSource.sourceId), curve = battedWorldFlightSourceCurve(flight)!, kernel = createSourceFreeBallKernel(curve);
    const point = kernel.evaluateAt(0.01).moment.ball.position;
    const model = { ...modelFor(x, 'native-wall-model'), surfaces: [{ surfaceId: 'real-wall',
      start: { x: point.x - 5, z: point.z }, end: { x: point.x + 5, z: point.z }, minimumHeight: 0, maximumHeight: point.y + 1 }] };
    const batter = physical.frame.batterActor!, worldSource: AcceptedBattedWorldContact = { sourceId: 'native-wall-contact',
      sourceVersion: CONTINUOUS_AERO_GROUND_BATTED_WORLD_SOURCE_VERSION, flightSourceId: flightSource.sourceId, modelSourceId: model.sourceId,
      previousContactSourceId: null, commands: model.actors.filter(a => [...batter.defenderBindings, batter.binding].some(b => b.playerId === a.playerId))
        .map(a => ({ playerId: a.playerId, bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: a.primitives.map(s => ({ role: s.role,
          offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) };
    const contacts = f.track(openSqliteBattedWorldContactStore(f.path, flights, {
      readAcceptedModel: id => id === model.sourceId ? model : null, readAcceptedContact: id => id === worldSource.sourceId ? worldSource : null }));
    const world = contacts.accept(worldSource.sourceId);
    expect(world.result.kind).toBe('contact');
    if (world.result.kind !== 'contact') throw new Error('expected Source wall');
    expect(world.result.contacts[0]).toMatchObject({ kind: 'surface', surfaceId: 'real-wall' });
    expect(world.result.sourceMoment!.elapsedSeconds).toBeGreaterThan(0);
    expect(world.result.sourceMoment!.elapsedSeconds).toBeLessThan(0.01);
    expect(world.result.sourceMoment).toEqual(kernel.evaluateAt(world.result.sourceMoment!.elapsedSeconds, 'incoming').moment);
    const touchSource = { sourceId: 'native-wall-touch', sourceVersion: CONTINUOUS_AERO_GROUND_TOUCH_SOURCE_VERSION, worldContactSourceId: worldSource.sourceId };
    const touches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, { readAcceptedTouch: id => id === touchSource.sourceId ? touchSource : null }));
    touches.accept(touchSource.sourceId);
    const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
    const responseModel: AcceptedBattedContactResponseModel = { sourceId: 'native-wall-response-model', sourceVersion: 'fixture-v1',
      gameId: model.gameId, careerId: model.careerId, fixtureEventId: model.fixtureEventId, venueId: model.venueId, availableAtDay: 1,
      actors: model.actors.map(a => ({ playerId: a.playerId, personId: a.personId, primitives: a.primitives.map(s => s.role !== 'glove'
        ? { role: s.role, material } : { role: 'glove', pocketCenterOffset: { x: 0, y: 0, z: -0.08 }, bodyStability: 1, parameters: {
          ticksPerSecond: 1_000_000, ballMassKg: 0.145, ballRadiusMeters: p.ground.radiusM, pocketRadiusMeters: 0.2,
          centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1_000, failedContactRestitution: material.restitution,
          failedTangentialDamping: material.tangentialDamping, failedSpinDamping: material.spinDamping } }) })),
      surfaces: [{ surfaceId: 'real-wall', material }] };
    const responseSource = { sourceId: 'native-wall-response', sourceVersion: CONTINUOUS_AERO_GROUND_RESPONSE_SOURCE_VERSION,
      firstFielderTouchSourceId: touchSource.sourceId, responseModelSourceId: responseModel.sourceId };
    const responses = f.track(openSqliteBattedContactResponseStore(f.path, touches, { readAcceptedResponse: id => id === responseSource.sourceId ? responseSource : null,
      readAcceptedModel: id => id === responseModel.sourceId ? responseModel : null }));
    const response = responses.accept(responseSource.sourceId);
    expect(response.result.kind).toBe('rebound');
    if (response.result.kind !== 'rebound') throw new Error('expected actual wall impulse');
    expect(response.result.ball.velocity.z * response.result.geometry.ball.velocity.z).toBeLessThan(0);
    const source = { sourceId: 'native-wall-step', sourceVersion: CONTINUOUS_AERO_GROUND_CONTINUATION_SOURCE_VERSION,
      responseSourceId: responseSource.sourceId, previousContinuationSourceId: null, throughTick: flight.flight.initialBall.tick + 2_000_000 };
    const continuations = f.track(openSqliteBattedWorldContinuationStore(f.path, responses, { readAcceptedContinuation: id => id === source.sourceId ? source : null }));
    const step = continuations.accept(source.sourceId);
    expect(step.result.initialCursor!.sourceCurve!.initial).toEqual(step.result.initialCursor!.moment);
    expect(step.result.initialCursor!.moment.elapsedSeconds).toBe(world.result.sourceMoment!.elapsedSeconds);
    expect(step.result.initialCursor!.moment.originTick).toBe(flight.flight.initialBall.tick);
    const geometry = response.result.geometry;
    const overlap = Math.hypot(geometry.ball.position.x - geometry.point.x, geometry.ball.position.y - geometry.point.y,
      geometry.ball.position.z - geometry.point.z) - p.ground.radiusM;
    expect(overlap).toBeLessThan(0);
    expect(overlap).toBeGreaterThan(-1e-10);
    const queried = querySourceFreeBallWorldV2({ descriptor: curve, moment: curve.initial, side: 'incoming',
      throughElapsedSeconds: curve.throughElapsedSeconds, actors: world.actors, surfaces: world.model.surfaces });
    if (queried.kind === 'unresolved') throw new Error('original contact query must retain its witness');
    const witness = queried.contactSearchWitnesses.find(w => w.colliderKey === JSON.stringify(['surface', 'real-wall']))!;
    expect(witness.witnessElapsedSeconds).toBe(world.result.sourceMoment!.elapsedSeconds);
    expect(witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds).toBeLessThanOrEqual(1e-12);
    const outgoingBall = response.result.ball;
    const outwardSpeed = (['x', 'y', 'z'] as const).reduce((sum, axis) => sum + geometry.normal![axis] * outgoingBall.velocity[axis], 0);
    console.info('SOURCE_WALL_NUMERICAL_DIAGNOSTIC', JSON.stringify({ physicsVersion: flightSource.sourceVersion,
      sourceCurveHash: hash(curve), worldSourceHash: hash(worldSource), initialSignedGapMeters: overlap,
      queryWitness: witness, outgoingNormalSpeedMps: outwardSpeed, responseBasis: step.result.initialCursor!.sourceCurve!.initial,
      v2Result: 'UNRESOLVED_PERSISTENT_CONTACT_NO_ESCAPE_CERTIFICATE' }));
    expect(step.result.steps[0]).toMatchObject({ world: { kind: 'boundary', pendingReason: 'persistent_contact' },
      response: { kind: 'unresolved', reason: 'persistent_contact', cursor: null } });
    const offline = f.track(openSqliteBattedWorldContinuationStore(f.path, { read: () => { throw new Error('peer read is forbidden'); } }));
    expect(offline.read(source.sourceId)).toEqual(step);
    const oldRows = f.db.prepare('SELECT * FROM batted_world_continuations ORDER BY source_id').all();
    const oldHeads = f.db.prepare('SELECT * FROM batted_world_continuation_heads ORDER BY source_id').all();
    expect(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='batted_world_continuations_v3'").get()).toBeUndefined();
    const v3Source: AcceptedBattedWorldContinuationV3 = { ...source, owner: SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3,
      sourceVersion: SOURCE_IMPACT_ESCAPE_CONTINUATION_VERSION_V3, sourceId: 'native-wall-v3-step', previousContinuationSourceId: null };
    const v3Sources = new Map<string, AcceptedBattedWorldContinuationV3>([[v3Source.sourceId, v3Source]]);
    const v3 = f.track(openSqliteBattedWorldContinuationV3Store(f.path, responses, { readAcceptedContinuation: id => v3Sources.get(id) ?? null }));
    v3Sources.set(v3Source.sourceId, { ...v3Source, owner: 'batted_world_continuations' } as unknown as AcceptedBattedWorldContinuationV3);
    expect(() => v3.accept(v3Source.sourceId)).toThrow('owner/Source');
    v3Sources.set(v3Source.sourceId, { ...v3Source, previousContinuationSourceId: source.sourceId });
    expect(() => v3.accept(v3Source.sourceId)).toThrow('own current head');
    expect((f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations_v3').get() as { n: number }).n).toBe(0);
    v3Sources.set(v3Source.sourceId, v3Source);
    const v3Step = v3.accept(v3Source.sourceId);
    expect(v3Step.owner).toBe(SOURCE_IMPACT_ESCAPE_CONTINUATION_OWNER_V3);
    expect(v3Step.result.solverVersion).toBe('source_contact_escape_v3');
    expect(v3Step.result.steps[0].response.kind).toBe('ground');
    expect(v3Step.result.cursor).not.toBeNull();
    const adoptedCurve = v3Step.result.cursor!.sourceCurve!, groundKernel = createSourceFreeBallKernel(adoptedCurve);
    expect(v3Step.result.steps[0].world.moment).toEqual(groundKernel.evaluateAt(v3Step.result.steps[0].world.moment.elapsedSeconds, 'incoming').moment);
    expect(v3Step.result.cursor!.moment).toEqual(groundKernel.evaluateAt(v3Step.result.cursor!.moment.elapsedSeconds, 'outgoing').moment);
    expect(v3Step.result.impulseCertificates).toHaveLength(1);
    const advance = v3Step.result.escapedIntervals[0].advance;
    expect(advance.escapeBracketThroughElapsedSeconds - advance.fromElapsedSeconds).toBeLessThanOrEqual(1e-12);
    expect(advance.supportingPlaneLowerGapAtEscapeMeters).toBeGreaterThan(0);
    expect(advance.signedGapAtEscapeMeters).toBeGreaterThan(0);
    const v3Source2 = { ...v3Source, sourceId: 'native-wall-v3-step-2', previousContinuationSourceId: v3Source.sourceId };
    v3Sources.set(v3Source2.sourceId, v3Source2);
    f.db.exec(`CREATE TRIGGER corrupt_v3_insert AFTER INSERT ON batted_world_continuations_v3
      WHEN NEW.source_id='native-wall-v3-step-2' BEGIN UPDATE batted_world_continuations_v3 SET snapshot_hash='changed' WHERE source_id=NEW.source_id; END`);
    expect(() => v3.accept(v3Source2.sourceId)).toThrow('independently rederived snapshot');
    expect((f.db.prepare('SELECT count(*) AS n FROM batted_world_continuations_v3').get() as { n: number }).n).toBe(1);
    expect((f.db.prepare('SELECT source_id FROM batted_world_continuation_heads_v3').get() as { source_id: string }).source_id).toBe(v3Source.sourceId);
    f.db.exec('DROP TRIGGER corrupt_v3_insert');
    const v3Step2 = v3.accept(v3Source2.sourceId);
    expect(v3Step2.result.steps[1].world.moment.elapsedSeconds).toBeGreaterThan(v3Step2.result.steps[0].world.moment.elapsedSeconds);
    expect(v3Step2.result.cursor!.sourceCurve!.initial).toEqual(v3Step.result.cursor!.sourceCurve!.initial);
    expect(f.db.prepare('SELECT * FROM batted_world_continuations ORDER BY source_id').all()).toEqual(oldRows);
    expect(f.db.prepare('SELECT * FROM batted_world_continuation_heads ORDER BY source_id').all()).toEqual(oldHeads);
    expect(offline.read(source.sourceId)).toEqual(step);
    const coldV3 = f.track(openSqliteBattedWorldContinuationV3Store(f.path, { read: () => { throw new Error('peer read is forbidden'); } }));
    expect(coldV3.read(v3Source.sourceId)).toEqual(v3Step);
    expect(coldV3.read(v3Source2.sourceId)).toEqual(v3Step2);
    v3Sources.set('competing-v3', { ...v3Source, sourceId: 'competing-v3' });
    expect(() => v3.accept('competing-v3')).toThrow('own current head');
    expect(() => coldV3.read(source.sourceId)).toThrow('v2 owner');
    const savedV3 = f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_continuations_v3 WHERE source_id=?').get(v3Source2.sourceId) as { snapshot_json: string; snapshot_hash: string };
    const forgedV3 = { ...v3Step2, result: { ...v3Step2.result, impulseCertificates: [{ ...v3Step2.result.impulseCertificates[0],
      diagnostic: { ...v3Step2.result.impulseCertificates[0].diagnostic, gapBoundMeters: 999 } }] } };
    f.db.prepare('UPDATE batted_world_continuations_v3 SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(forgedV3), hash(forgedV3), v3Source2.sourceId);
    expect(() => coldV3.read(v3Source2.sourceId)).toThrow('independently rederived snapshot');
    f.db.prepare('UPDATE batted_world_continuations_v3 SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(savedV3.snapshot_json, savedV3.snapshot_hash, v3Source2.sourceId);
    f.db.prepare('UPDATE batted_world_continuation_heads_v3 SET source_id=?').run(source.sourceId);
    expect(() => coldV3.read(v3Source.sourceId)).toThrow('own prefix/head differs');
    f.db.prepare('UPDATE batted_world_continuation_heads_v3 SET source_id=?').run(v3Source2.sourceId);
    expect(coldV3.read(v3Source.sourceId)).toEqual(v3Step);
    const evidenceDir = process.env.MINI_BASEBALL_AERO_V3_EVIDENCE_DIR;
    if (evidenceDir) {
      const directory = resolve(evidenceDir), work = resolve('../../work');
      if (!directory.startsWith(work + sep) || existsSync(directory)) throw new Error('v3 evidence requires a new workspace work directory');
      mkdirSync(directory, { recursive: true });
      const databasePath = join(directory, 'original-native-v3.sqlite');
      f.db.exec(`VACUUM INTO '${databasePath.replaceAll("'", "''")}'`);
      const databaseSha256 = createHash('sha256').update(readFileSync(databasePath)).digest('hex');
      writeFileSync(join(directory, 'receipt.json'), JSON.stringify({ kind: 'SYNTHETIC_NATIVE_SOURCE_V2_V3_COEXISTENCE_EVIDENCE',
        databasePath, databaseSha256, physicalPitchSourceId: flight.source.physicalPitchSourceId, forceKernelVersion: curve.kind,
        v2Owner: 'batted_world_continuations', v2SourceId: source.sourceId, v2SourceHash: hash(source), v2SnapshotHash: hash(step),
        v2Result: 'UNRESOLVED_PERSISTENT_CONTACT', v3Owner: v3Step2.owner, v3SourceId: v3Source2.sourceId,
        v3SourceHash: hash(v3Source2), v3SnapshotHash: hash(v3Step2), v3SolverVersion: v3Step2.result.solverVersion,
        v3Certificates: v3Step2.result.impulseCertificates, v3EscapedIntervals: v3Step2.result.escapedIntervals,
        v3Horizon: v3Step2.result.cursor!.moment, officialRevision: f.official.getMatch('game-1')!.durableRevision,
        claim: 'WALL_IMPULSE_ESCAPE_GROUND_CONTINUATION_REOPEN_ONLY_NO_OFFICIAL_OUT_OR_SCORING' }, null, 2), { flag: 'wx' });
      console.info('SOURCE_V3_NATIVE_ARCHIVE', JSON.stringify({ databasePath, databaseSha256 }));
    }
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
  } finally { f.close(); }
});
