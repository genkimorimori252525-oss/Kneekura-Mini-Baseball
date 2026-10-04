import type { Vec3 } from '../../core/model/geometry';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';

export type BattedFixturePitchPhysics = Readonly<{ velocity?: Vec3; spin?: Vec3 }>;

export const battedBallFlightFixture = (path?: string, withActor = true, withContact = true, alignFieldWithInitialBases = false,
  fixtureBinding?: Parameters<typeof physicalPlateAppearanceActorFixture>[1], pitchPhysics?: BattedFixturePitchPhysics) => {
  const base = physicalPlateAppearanceActorFixture(path, fixtureBinding), { f, actors, source, actions, pitches } = base;
  if (withActor) actors.accept(source.sourceId);
  const previewInput = pitchPhysics ? { ...f.input, delivery: { ...f.input.delivery, physics: { ...f.input.delivery.physics, ...pitchPhysics } } } : f.input;
  const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...previewInput, effortPolicySourceId: f.effort.sourceId });
  const startTick = preview.pitch.trajectory.start.tick + 590_000;
  const ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
  const originalAction = continuousPitchAction(f, 0, 0);
  const action = pitchPhysics ? { ...originalAction, request: { ...originalAction.request, delivery: { ...originalAction.request.delivery,
    physics: { ...originalAction.request.delivery.physics, ...pitchPhysics } } } } : originalAction;
  actions.set(action.sourceId, withContact ? { ...action, request: { ...action.request, batter: {
    action: { kind: 'swing', swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
        linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } } } } } : action);
  const physical = pitches.accept(action.sourceId, 0);
  const fixture = f.db.prepare('SELECT venue_id FROM official_fixtures WHERE game_id=?').get('game-1') as { venue_id: string };
  const centers = physical.frame.initialWorld!.source.worldSetup.baseCenters;
  const ray = (point: { x: number; z: number }) => { const length = Math.hypot(point.x, point.z); return { x: point.x / length, z: point.z / length }; };
  const input: AcceptedBattedBallFlight = { sourceId: 'flight-1', sourceVersion: 'fixture-v1', physicalPitchSourceId: action.sourceId,
    previousFlightSourceId: null, searchDurationTicks: 0, execution: { venueId: fixture.venue_id, availableAtDay: 1,
      field: createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: alignFieldWithInitialBases ? ray(centers.first) : { x: Math.SQRT1_2, z: Math.SQRT1_2 },
        thirdBaseLineUnit: alignFieldWithInitialBases ? ray(centers.third) : { x: -Math.SQRT1_2, z: Math.SQRT1_2 } }),
      ballFlightParameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 } } };
  const accepted = new Map<string, AcceptedBattedBallFlight>([[input.sourceId, input]]);
  const flights = f.track(openSqliteBattedBallFlightStore(f.path, pitches, { readAcceptedFlight: (id) => accepted.get(id) ?? null }));
  return { ...base, input, physical, acceptedFlights: accepted, flights };
};
