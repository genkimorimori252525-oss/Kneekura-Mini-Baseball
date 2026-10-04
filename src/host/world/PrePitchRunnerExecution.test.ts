import { expect, it } from 'vitest';
import { buildPrePitchRunnerController, prePitchRunnerExecutionInput, prePitchRunnerContactPrimitives } from './PrePitchRunnerExecution';
import { buildRouteFollowingController, sampleRouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';

import { input, canonical, shapes } from './PrePitchRunnerFixtures.test-support';
const zero = { x: 0, y: 0, z: 0 };

it('reuses the canonical runner controller and evolves all five relative primitives from the original frame through bat contact', () => {
  const source = input(), controller = buildPrePitchRunnerController(source, canonical);
  const existing = buildRouteFollowingController({ canonical, startMotion: source.startMotion, route: source.route,
    intent: source.intent, parameters: source.parameters, endTick: source.coverageThroughTick });
  expect(controller).toEqual(existing);
  expect(sampleRouteFollowingController(controller, canonical, 3_000_000).position).toEqual({ x: 14, z: 5 });
  const actors = prePitchRunnerContactPrimitives(source, canonical, controller, shapes(), 0.3, 3_000_000, 4_000_000, 1_000_000);
  expect(actors).toHaveLength(5);
  for (const [i, a] of actors.entries()) {
    expect(a.playerId).toBe('runner');
    expect(a.primitive.startCenter).toEqual({ x: 15.2 + i, y: 1.3, z: 5 });
    expect(a.primitive.startVelocity).toEqual({ x: 5, y: 0, z: 0 });
    expect(a.primitive.acceleration).toEqual({ x: 2.4, y: 0, z: 0 });
  }
});

it.each(['route', 'start_position', 'start_velocity', 'slide', 'route_exhaustion', 'extra_input', 'missing_role', 'future_intent'])
('rejects unsupported or unowned %s before producing a controller', (kind) => {
  const source = structuredClone(input()) as any;
  if (kind === 'route') source.route.segments = [{ kind: 'arc', center: { x: 10, z: 5 }, radiusMeters: 1, startAngleRadians: 0, sweepRadians: 1 }];
  if (kind === 'start_position') source.route.segments[0].start.x += 1;
  if (kind === 'start_velocity') source.startMotion.speedMps = 1;
  if (kind === 'slide') source.intent.kind = 'slide';
  if (kind === 'route_exhaustion') source.route.segments[0].end.x = 11;
  if (kind === 'extra_input') source.result = 'safe';
  if (kind === 'missing_role') source.bodyPose.primitiveMotions.pop();
  if (kind === 'future_intent') source.intent.issuedTick = canonical.tick + 1;
  expect(() => buildPrePitchRunnerController(source, canonical)).toThrow();
});

it('does not flatten an existing reaction or speed boundary into one accelerated contact interval', () => {
  const source = { ...input(), startMotion: { ...input().startMotion, driveDirection: 0 as const },
    parameters: { ...input().parameters, reactionDelayTicks: 500_000, topSpeedMps: 1 } };
  const controller = buildPrePitchRunnerController(source, canonical);
  expect(controller.trajectory.segments).toHaveLength(3);
  expect(() => prePitchRunnerContactPrimitives(source, canonical, controller, shapes(), 0.3, 1_400_000, 1_600_000, 1_000_000)).toThrow(/boundary/);
  expect(() => prePitchRunnerContactPrimitives(source, canonical, controller, shapes(), 0.3, 1_800_000, 2_200_000, 1_000_000)).toThrow(/boundary/);
  const actors = prePitchRunnerContactPrimitives(source, canonical, controller, shapes(), 0.3, 2_100_000, 2_200_000, 1_000_000);
  expect(actors[0].primitive.acceleration).toEqual({ x: 0.4, y: 0, z: 0 });
});

it('requires exact body pose/model agreement and does not silently exceed coverage or clock scale', () => {
  const source = input(), controller = buildPrePitchRunnerController(source, canonical);
  expect(() => prePitchRunnerContactPrimitives(source, canonical, controller, shapes(), 0.4, 3_000_000, 4_000_000, 1_000_000)).toThrow();
  expect(() => prePitchRunnerContactPrimitives(source, canonical, controller, shapes().map((p, i) => i ? p : { ...p, offset: zero }), 0.3, 3_000_000, 4_000_000, 1_000_000)).toThrow();
  expect(() => prePitchRunnerContactPrimitives(source, canonical, controller, shapes(), 0.3, 3_000_000, 4_000_001, 1_000_000)).toThrow();
  expect(() => prePitchRunnerContactPrimitives(source, canonical, controller, shapes(), 0.3, 3_000_000, 4_000_000, 1000)).toThrow();
  expect(prePitchRunnerExecutionInput(source)).toEqual(source);
});

it('changes the actual accelerated-sphere collision when the owned runner keeps moving after bat contact', async () => {
  const { createBattedBallFlightEvidence } = await import('../../core/sim/ball/BattedBallFlightEvidence');
  const { deriveFirstBattedWorldContact } = await import('../../core/sim/ball/BattedBallWorldContacts');
  const { DEFAULT_BALL_FLIGHT_PARAMETERS } = await import('../../core/sim/ball/BallFlight');
  const source = { ...input(), bodyPose: { ...input().bodyPose, primitiveMotions: input().bodyPose.primitiveMotions.map(p => ({ ...p,
    startOffset: { x: 0, y: p.role === 'body' ? 1 : 100, z: 0 }, offsetVelocity: zero, offsetAcceleration: zero })) } };
  const controller = buildPrePitchRunnerController(source, canonical), at = 3_000_000, through = 3_500_000;
  const actors = prePitchRunnerContactPrimitives(source, canonical, controller,
    source.bodyPose.primitiveMotions.map(p => ({ role: p.role, radius: 0.1, offset: p.startOffset })), 0.3, at, through, 1_000_000);
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0 };
  const point = { x: 16, y: 1.3, z: 5 };
  const flight = createBattedBallFlightEvidence({ parameters, searchDurationTicks: through - at, contact: { tick: at,
    ballCenter: point, point, batPoint: point, normal: { x: 1, y: 0, z: 0 }, segmentT: 0.5, exitVelocity: zero, exitSpin: zero } });
  const result = deriveFirstBattedWorldContact({ flight, parameters, throughTick: through, actors, surfaces: [] });
  expect(result).toMatchObject({ kind: 'contact', contacts: [{ kind: 'actor', playerId: 'runner', role: 'body' }] });
  if (result.kind !== 'contact') throw new Error('moving body must contact');
  expect(result.tick).toBeGreaterThan(at); expect(result.tick).toBeLessThan(through);
  const frozen = actors.map(a => ({ ...a, primitive: { ...a.primitive, startVelocity: zero, acceleration: zero } }));
  expect(deriveFirstBattedWorldContact({ flight, parameters, throughTick: through, actors: frozen, surfaces: [] }).kind).toBe('airborne');
});


it('stops at the existing braking-to-rest boundary instead of carrying deceleration past zero', () => {
  const source = { ...input(), startMotion: { ...input().startMotion, speedMps: 2 }, intent: { kind: 'hold' as const, issuedTick: canonical.tick } };
  const moving = { ...canonical, velocity: { x: 2, z: 0 } }, controller = buildPrePitchRunnerController(source, moving);
  expect(controller.trajectory.segments).toHaveLength(2);
  expect(() => prePitchRunnerContactPrimitives(source, moving, controller, shapes(), 0.3, 1_500_000, 1_800_000, 1_000_000)).toThrow(/boundary/);
  const stopped = prePitchRunnerContactPrimitives(source, moving, controller, shapes(), 0.3, 1_800_000, 2_000_000, 1_000_000);
  expect(stopped[0].primitive.acceleration.x).toBe(0.4);
  expect(stopped[0].primitive.startVelocity.x).toBeCloseTo(0.2 + 0.4 * 0.8);
});
