import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';

export const battedBallFlightFixture = (path?: string, withActor = true, withContact = true) => {
  const base = physicalPlateAppearanceActorFixture(path), { f, actors, source, actions, pitches } = base;
  if (withActor) actors.accept(source.sourceId);
  const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, effortPolicySourceId: f.effort.sourceId });
  const startTick = preview.pitch.trajectory.start.tick + 590_000;
  const ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
  const action = continuousPitchAction(f, 0, 0);
  actions.set(action.sourceId, withContact ? { ...action, request: { ...action.request, batter: {
    action: { kind: 'swing', swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
        linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } } } } } : action);
  const physical = pitches.accept(action.sourceId, 0);
  const fixture = f.db.prepare('SELECT venue_id FROM official_fixtures WHERE game_id=?').get('game-1') as { venue_id: string };
  const input: AcceptedBattedBallFlight = { sourceId: 'flight-1', sourceVersion: 'fixture-v1', physicalPitchSourceId: action.sourceId,
    previousFlightSourceId: null, searchDurationTicks: 0, execution: { venueId: fixture.venue_id, availableAtDay: 1,
      field: createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
        thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } }),
      ballFlightParameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 } } };
  const accepted = new Map<string, AcceptedBattedBallFlight>([[input.sourceId, input]]);
  const flights = f.track(openSqliteBattedBallFlightStore(f.path, pitches, { readAcceptedFlight: (id) => accepted.get(id) ?? null }));
  return { ...base, input, physical, acceptedFlights: accepted, flights };
};
