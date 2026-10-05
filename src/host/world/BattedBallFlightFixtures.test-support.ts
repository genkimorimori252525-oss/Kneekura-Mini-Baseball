import type { AcceptedOriginalBattingIntent } from './OriginalBattingIntent';
import type { Vec3 } from '../../core/model/geometry';
import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight } from './SqliteBattedBallFlightStore';

export type BattedFixturePitchPhysics = Readonly<{ velocity?: Vec3; spin?: Vec3 }>;
export type BattedFixtureOriginalContact = Readonly<{
  attempt?: AcceptedOriginalBattingIntent['attempt']; precedingTakenPitches?: 0 | 2;
}>;

export const battedBallFlightFixture = (path?: string, withActor = true, withContact = true, alignFieldWithInitialBases = false,
  fixtureBinding?: Parameters<typeof physicalPlateAppearanceActorFixture>[1], pitchPhysics?: BattedFixturePitchPhysics,
  profile?: Parameters<typeof physicalPlateAppearanceActorFixture>[2], originalContact?: BattedFixtureOriginalContact) => {
  const base = physicalPlateAppearanceActorFixture(path, fixtureBinding, profile), { f, actors, source, actions, pitches } = base;
  if (withActor) actors.accept(source.sourceId);
  let timeline = f.input.timeline, pitchIndex = 0, readyAtUs = 0;
  if (originalContact?.precedingTakenPitches === 2) {
    if (!withActor || !withContact) throw new Error('original two-strike contact requires its accepted actor and swing');
    const first = base.pitch(0, 0);
    const second = base.pitch(1, first.result.pitch.resolution.timeline.lastEventTick);
    timeline = second.result.pitch.resolution.timeline; pitchIndex = 2; readyAtUs = timeline.lastEventTick;
    if (timeline.status.kind !== 'active' || timeline.status.count.strikes !== 2) throw new Error('original taken pitches did not reach two strikes');
  }
  const previewInput = { ...f.input, timeline, delivery: { ...f.input.delivery, pitchIndex, readyAtUs,
    physics: { ...f.input.delivery.physics, ...pitchPhysics } } };
  const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(f.stores, { ...previewInput, effortPolicySourceId: f.effort.sourceId });
  const startTick = preview.pitch.trajectory.start.tick + 590_000;
  const ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
  const originalAction = continuousPitchAction(f, pitchIndex, readyAtUs);
  const action = pitchPhysics ? { ...originalAction, request: { ...originalAction.request, delivery: { ...originalAction.request.delivery,
    physics: { ...originalAction.request.delivery.physics, ...pitchPhysics } } } } : originalAction;
  const contactAction = withContact ? { ...action, request: { ...action.request, batter: {
    action: { kind: 'swing' as const, swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
        linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } } } } } : action;
  actions.set(action.sourceId, originalContact?.attempt === undefined ? contactAction : { ...contactAction,
    battingIntent: { version: 'original_batting_intent_v1', actorSourceId: source.sourceId, attempt: originalContact.attempt } });
  const physical = pitches.accept(action.sourceId, pitchIndex);
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
