import assert from 'node:assert/strict';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { openSqliteBattedBallFlightStore } from './SqliteBattedBallFlightStore';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';

export const legacyBattedSetupGeometryFixture = () => {
  const x = physicalPlateAppearanceActorFixture(), f = x.f;
  try {
    x.actors.accept(x.source.sourceId); x.close();
    const current = f.official.getMatch('game-1')!;
    x.accepted.set('legacy-next-batter', { sourceId: 'legacy-next-batter', sourceVersion: 'fixture-v1', gameId: 'game-1',
      playerId: 'away-2', activationApplicationId: 'application-1' });
    const actor = x.actors.accept('legacy-next-batter'); assert.equal(actor.origin.actualLiveReadiness, undefined);
    const { initialWorldSourceId: _initial, ...base } = continuousPitchAction(f, 0, current.nextWorld!.tick) as AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
    const request = { ...base.request, workloadRevision: 1 };
    const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...request,
      timeline: createCanonicalPlateAppearanceTimeline(current.matchState, current.nextWorld!.tick), effortPolicySourceId: f.effort.sourceId,
      delivery: { ...request.delivery, playId: current.matchState.playId, pitchIndex: 0 } });
    const startTick = preview.pitch.trajectory.start.tick + 590_000, ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
    const action: AcceptedPhysicalPitchActionSource = { ...base, sourceId: 'legacy-next-swing', activationApplicationId: 'application-1',
      request: { ...request, batter: { action: { kind: 'swing', swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
        stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
          linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } } } } };
    x.actions.set(action.sourceId, action); const pitch = x.pitches.accept(action.sourceId, 0);
    assert.equal(pitch.result.pitch.resolution.timeline.status.kind, 'batted_ball_pending');
    const source = { sourceId: 'legacy-next-flight', sourceVersion: 'fixture-v1', physicalPitchSourceId: action.sourceId,
      previousFlightSourceId: null, searchDurationTicks: 0, execution: { venueId: String(f.db.prepare("SELECT venue_id FROM official_fixtures WHERE game_id='game-1'").get()!.venue_id), availableAtDay: 1,
        field: createFairTerritoryWedge({ homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } }),
        ballFlightParameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 } } };
    const flights = f.track(openSqliteBattedBallFlightStore(f.path, x.pitches, { readAcceptedFlight: id => id === source.sourceId ? source : null }));
    const flight = flights.accept(source.sourceId);
    return { f, flight };
  } catch (error) { f.close(); throw error; }
};
