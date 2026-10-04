import { actualPlayerKinematicsEvidenceFromSqlite, openSqliteActualPlayerKinematicsReader } from './SqliteActualPlayerKinematicsReader';
import { openSqliteBattedFirstFielderTouchStore } from './SqliteBattedFirstFielderTouchStore';
import { expect, it } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { createBattedBallInitialStateFromContact } from '../../core/sim/contact/BatBallContact';
import { advanceBallState, DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { deriveFirstBattedWorldContact } from '../../core/sim/ball/BattedBallWorldContacts';
import { openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';
import { openSqliteBattedWorldContactStore, type AcceptedBattedWorldContact, type AcceptedBattedWorldModel } from './SqliteBattedWorldContactStore';
import { openSqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';
import type { AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorJson, actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const zero = { x: 0, y: 0, z: 0 };

// Resource-heavy legal producer chain. Run only when the coordinator grants a Native slot.
it('freezes the legal walk runner before the next actual bat contact, collides its moving body, and authenticates reopen/retry/rollback', () => {
  const x = physicalPlateAppearanceActorFixture(), { f } = x;
  try {
    x.actors.accept(x.source.sourceId); let tick = 0;
    for (let i = 0; i < 4; i++) {
      const action = continuousPitchAction(f, i, tick);
      x.actions.set(action.sourceId, { ...action, request: { ...action.request, delivery: { ...action.request.delivery,
        moundReference: { ...action.request.delivery.moundReference, x: 1 } } } });
      tick = x.pitches.accept(action.sourceId, i).result.pitch.resolution.timeline.lastEventTick;
    }
    const closing = x.closeInput(tick, 'pitch-3', 'away-1'); x.closes.set(closing.sourceId, closing); x.closure.submit(closing.sourceId);
    x.accepted.set('batter-2', { sourceId: 'batter-2', sourceVersion: 'v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: 'application-1' });
    const actor = x.actors.accept('batter-2');
    expect(actor.match.bases).toEqual({ first: 'away-1', second: null, third: null });
    const originalWorld = actor.world, originalMatch = actor.match, worldRunner = originalWorld.runners[0];
    const timeline = createCanonicalPlateAppearanceTimeline(originalMatch, originalWorld.tick);
    const initial = continuousPitchAction(f, 0, originalWorld.tick);
    const { initialWorldSourceId: _initialWorld, ...rest } = initial as typeof initial & { initialWorldSourceId: string };
    const next = { ...rest, sourceId: 'owned-runner-pitch', activationApplicationId: 'application-1',
      request: { ...initial.request, workloadRevision: 1 } };
    const request = { ...next.request, timeline, effortPolicySourceId: f.effort.sourceId,
      delivery: { ...next.request.delivery, playId: originalMatch.playId, pitchIndex: 0 } };
    const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, request);
    const startTick = preview.pitch.trajectory.start.tick + 590_000, ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
    const swing = { action: { kind: 'swing' as const, swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } }, linearVelocity: zero, angularVelocity: zero } } } };
    const planned = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...request, batter: swing });
    const plannedContact = planned.pitch.resolution.timeline.events.find(e => e.kind === 'BatBallContact');
    if (!plannedContact || plannedContact.kind !== 'BatBallContact') throw new Error('fixture requires planned bat contact');
    const at = plannedContact.tick, hitTick = at + 200_000, through = at + 300_000;
    const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 };
    const target = advanceBallState(createBattedBallInitialStateFromContact(plannedContact.payload.contact), hitTick - at, parameters).position;
    const dx = target.x - worldRunner.position.x, dz = target.z - worldRunner.position.z, distance = Math.hypot(dx, dz);
    const elapsed = (hitTick - originalWorld.tick) / parameters.ticksPerSecond;
    // Explicit synthetic acceptance inputs chosen before execution; this is not production calibration.
    const acceleration = 2 * distance / (elapsed * elapsed);
    const runner: AcceptedPrePitchRunnerExecution = { kind: 'pre_pitch_upright_runner_v1', sourceId: 'original-runner-motion', sourceVersion: 'fixture-v1',
      gameId: 'game-1', physicalActorSourceId: actor.source.sourceId, playerId: worldRunner.playerId, motionRevision: 0,
      route: { segments: [{ kind: 'line', start: worldRunner.position,
        end: { x: worldRunner.position.x + dx / distance * (distance + 100), z: worldRunner.position.z + dz / distance * (distance + 100) } }] },
      startMotion: { tick: originalWorld.tick, routeDistanceMeters: 0, speedMps: 0, driveDirection: 1, bodyMode: 'upright' },
      intent: { kind: 'advance', issuedTick: originalWorld.tick }, parameters: { ticksPerSecond: 1_000_000, reactionDelayTicks: 0,
        accelerationMps2: acceleration, brakingMps2: 4, slideDecelerationMps2: 4, topSpeedMps: 100 }, coverageThroughTick: through,
      bodyPose: { bodyOriginHeightMeters: 0, primitiveMotions: (['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const).map((role, index) => ({
        role, startOffset: { x: 0, y: role === 'body' ? target.y : 20 + index, z: 0 }, offsetVelocity: zero, offsetAcceleration: zero })) } };
    const action = { ...next, request: { ...next.request, batter: swing }, prePitchRunner: runner };
    const before = f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?').get('game-1', originalMatch.playId);
    expect(before).toEqual({ n: 0 });
    x.actions.set(action.sourceId, action);
    const prePitchBinding = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get(runner.playerId)!;
    f.db.exec(`CREATE TRIGGER tamper_runner_pitch AFTER INSERT ON physical_pitch_progress_actions BEGIN
      UPDATE official_participant_bindings SET binding_json='{}' WHERE player_id='away-1'; END;`);
    expect(() => x.pitches.accept(action.sourceId, 0)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?').get('game-1', originalMatch.playId)).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get(runner.playerId)).toEqual(prePitchBinding);
    f.db.exec('DROP TRIGGER tamper_runner_pitch');
    const physical = x.pitches.accept(action.sourceId, 0);
    x.actions.set(action.sourceId, { ...action, prePitchRunner: { ...runner, sourceVersion: 'rewritten' } });
    expect(() => x.pitches.accept(action.sourceId, 0)).toThrow(/frozen differently/);
    x.actions.set(action.sourceId, action);
    expect(physical.source.prePitchRunner).toEqual(runner); expect(physical.frame.prePitchRunner?.source).toEqual(runner);
    expect(physical.frame.world).toEqual(originalWorld); expect(physical.frame.match).toEqual(originalMatch);
    expect(physical.frame.prePitchRunner?.canonical.position).toEqual(worldRunner.position);
    const fixture = f.db.prepare('SELECT venue_id FROM official_fixtures WHERE game_id=?').get('game-1')!;
    const flightSource: AcceptedBattedBallFlight = { sourceId: 'runner-flight', sourceVersion: 'fixture-v1', physicalPitchSourceId: action.sourceId,
      previousFlightSourceId: null, searchDurationTicks: through - at, execution: { venueId: fixture.venue_id as string, availableAtDay: 1,
        field: createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
          thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } }), ballFlightParameters: parameters } };
    const flights = f.track(openSqliteBattedBallFlightStore(f.path, x.pitches, { readAcceptedFlight: id => id === flightSource.sourceId ? flightSource : null }));
    const flight = flights.accept(flightSource.sourceId);
    const bindings = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=?').all('game-1')
      .map(r => JSON.parse(r.binding_json as string) as OfficialParticipantBinding);
    const model: AcceptedBattedWorldModel = { sourceId: 'runner-model', sourceVersion: 'fixture-v1', gameId: 'game-1', careerId: actor.binding.careerId,
      fixtureEventId: actor.binding.fixtureEventId, venueId: flightSource.execution.venueId, availableAtDay: 1, batterGripOffset: zero, surfaces: [],
      actors: bindings.map(b => ({ playerId: b.playerId, personId: b.personId, heightMeters: b.playerId === physical.frame.workload.playerId ? physical.frame.release.body.heightMeters : 1.8,
        bodyOriginHeightMeters: 0, primitives: runner.bodyPose.primitiveMotions.map(p => ({ role: p.role, radius: 0.05,
          offset: b.playerId === runner.playerId ? p.startOffset : { x: 0, y: 40, z: 0 } })) })) };
    const source: AcceptedBattedWorldContact = { kind: 'owned_runner_contact_v1', prePitchRunnerSourceId: runner.sourceId,
      sourceId: 'runner-contact', sourceVersion: 'fixture-v1', flightSourceId: flightSource.sourceId, modelSourceId: model.sourceId, previousContactSourceId: null,
      commands: [...actor.defenderBindings, actor.binding].map(b => ({ playerId: b.playerId, bodyAcceleration: zero,
        primitiveMotions: runner.bodyPose.primitiveMotions.map(p => ({ role: p.role, offsetVelocity: zero, offsetAcceleration: zero })) })) };
    const contacts = f.track(openSqliteBattedWorldContactStore(f.path, flights, { readAcceptedModel: id => id === model.sourceId ? model : null,
      readAcceptedContact: id => id === source.sourceId ? source : null }));
    // A same-connection trigger cannot mutate the source-owned runner during acceptance.
    const bindingRow = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get(runner.playerId)!;
    f.db.exec(`CREATE TRIGGER tamper_runner AFTER INSERT ON batted_world_contacts BEGIN
      UPDATE official_participant_bindings SET binding_json='{}' WHERE player_id='away-1'; END;`);
    expect(() => contacts.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get(runner.playerId)).toEqual(bindingRow);
    f.db.exec('DROP TRIGGER tamper_runner');
    const saved = contacts.accept(source.sourceId);
    expect(saved.actors).toHaveLength(55); expect(new Set(saved.actors.map(a => a.playerId)).size).toBe(11);
    expect(saved.result).toMatchObject({ kind: 'contact', contacts: [{ kind: 'actor', playerId: runner.playerId, role: 'body' }] });
    if (saved.result.kind !== 'contact') throw new Error('fixture requires moving runner-body collision');
    expect(saved.result.tick).toBeGreaterThan(at); expect(saved.result.tick).toBeLessThanOrEqual(hitTick);
    const frozen = saved.actors.map(a => a.playerId === runner.playerId ? { ...a, primitive: { ...a.primitive, startVelocity: zero, acceleration: zero } } : a);
    expect(deriveFirstBattedWorldContact({ flight: flight.flight, parameters, throughTick: through, actors: frozen, surfaces: [] }).kind).toBe('airborne');
    const cut = { kind: 'owned_runner_contact_v1' as const, physicalPitchSourceId: action.sourceId,
      worldContactSourceId: source.sourceId, playerId: runner.playerId };
    const actual = actualPlayerKinematicsEvidenceFromSqlite(f.db).readOriginalContact(cut);
    expect(actual.at.tick).toBe(saved.result.tick); expect(actual.physicalPrefix.participants).toHaveLength(11);
    expect(actual.roles).toHaveLength(5); expect(actual.origin.kind).toBe('pre_pitch_runner_controller');
    expect(actual.authority.runnerSourceId).toBe(runner.sourceId);
    const selfReader = f.track(openSqliteActualPlayerKinematicsReader(f.path));
    expect(selfReader.readOriginalContact(cut)).toEqual(actual);
    const touch = { sourceId: 'unsupported-runner-touch', sourceVersion: 'fixture-v1', worldContactSourceId: source.sourceId };
    const touches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, { readAcceptedTouch: id => id === touch.sourceId ? touch : null }));
    expect(() => touches.accept(touch.sourceId)).toThrow(/unsupported original pre-pitch runner consumer/);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_first_fielder_touches').get()).toEqual({ n: 0 });
    expect(saved.timeline).toEqual(physical.result.pitch.resolution.timeline);
    expect(f.official.getMatch('game-1')!.matchState).toEqual(originalMatch);
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(actor.officialRevision);
    x.actions.clear();
    const reopenedPitches = f.track(openSqlitePhysicalPitchProgressStore(f.path, { ...x.sources, runtime: f.stores }));
    expect(reopenedPitches.readAcceptedPitch(action.sourceId)).toEqual(physical);
    const reopened = f.track(openSqliteBattedWorldContactStore(f.path, flights));
    expect(reopened.read(source.sourceId)).toEqual(saved); expect(reopened.accept(source.sourceId)).toEqual(saved);
    const row = f.db.prepare('SELECT snapshot_json,snapshot_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(action.sourceId)!;
    const tampered = JSON.parse(row.snapshot_json as string); tampered.frame.prePitchRunner.canonical.position.x += 1;
    f.db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(actorJson(tampered), actorHash(tampered), action.sourceId);
    expect(() => reopened.read(source.sourceId)).toThrow();
    f.db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(row.snapshot_json, row.snapshot_hash, action.sourceId);
    expect(reopened.read(source.sourceId)).toEqual(saved);
  } finally { f.close(); }
}, 180_000);
