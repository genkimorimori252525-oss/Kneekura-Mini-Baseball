import { expect, it } from 'vitest';
import { quantizeEventTick } from '../ExactEventTime';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { createSourceBallWorldMotionSessionV1, type SourceBallWorldMotionInputV1 } from './SourceBallWorldMotionV1';
import type { BattedBallBasePrism } from './BattedBallBaseContact';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const material = { restitution: .5, tangentialDamping: .1, spinDamping: .2 };
const originTick = 700_000, start = .0132456789, tps = 1_000_000;
const tick = (elapsed: number) => originTick + elapsed * tps;

// Explicit small synthetic scene; no Native permission or baseball ruling.
const scene = (position = v(0, 1, 0), velocity = v(6, 0, 0)): SourceBallWorldMotionInputV1 => {
  const sourceCurve: SourceFreeBallDescriptorV2 = {
    kind: 'aero_ground_continuous_source_kernel_v2', throughElapsedSeconds: .25,
    initial: { originTick, elapsedSeconds: start, ball: { tick: quantizeEventTick(originTick, start, tps),
      position, velocity, spin: v(0, 0, 5) } },
    profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 2000,
      gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
      ground: { ticksPerSecond: tps, radiusM: .0366, inertiaRatio: .378, gravityMps2: 9.81,
        restingVerticalSpeedMps: .15, material: { restitution: .4, slidingFriction: .25,
          rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
  };
  const actor = { playerId: 'fielder', primitive: { role: 'body' as const, radius: .2,
    startTick: originTick, endTick: tick(.25), ticksPerSecond: tps,
    startCenter: v(10, 1, 10), startVelocity: v(.5, 0, 0), acceleration: v() } };
  return { version: 'source_ball_world_motion_v1',
    response: { world: { parameters: DEFAULT_BALL_FLIGHT_PARAMETERS, actors: [actor], surfaces: [], sourceCurve },
      actors: [{ playerId: actor.playerId, profile: { role: 'body', material } }], surfaces: [] },
    cursor: { moment: sourceCurve.initial, sourceCurve, sourceSide: 'incoming', previousContacts: [] },
    materialOrientationAtSourceBasis: { x: 0, y: 0, z: 0, w: 1 }, heldBats: [], baseGeometry: null };
};
const prism = (x: number): BattedBallBasePrism => ({
  region: { center: { x, z: 0 }, halfSize: { x: .1, z: .2 }, rotationRadians: 0 }, bottomY: 0, topY: .5,
});
const baseScene = (): SourceBallWorldMotionInputV1 => ({ ...scene(v(0, .25, 0)), baseGeometry: {
  bases: { home: prism(50), first: prism(.6), second: prism(60), third: prism(70) },
  materials: { home: material, first: material, second: material, third: material },
} });
const command = (at: number, acceleration = v()) => ({ availableAtElapsedSeconds: at, throughTick: tick(.25),
  commands: [{ playerId: 'fielder', role: 'body' as const, acceleration }] });

it('reflects from the actual first base solid and continues through the certified departure', () => {
  const input = baseScene(), session = createSourceBallWorldMotionSessionV1(input);
  const hit = session.advance(tick(.15));
  expect(hit.kind).toBe('world');
  if (hit.kind !== 'world') throw new Error('expected base boundary');
  expect(hit.observed).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'base', baseId: 'first' }] });
  expect(hit.response.kind).toBe('rebound');
  expect(hit.state.cursor.moment.originTick).toBe(originTick);
  expect(hit.state.cursor.moment.ball.velocity.x).toBeLessThan(0);
  expect(hit.state.cursor.sourceCurve!.initial).toEqual(hit.state.cursor.moment);
  expect(hit.state.orientation).toEqual(createSourceFreeBallKernel(input.cursor.sourceCurve!)
    .evaluateAt(hit.state.cursor.moment.elapsedSeconds, 'incoming').orientation);
  const next = session.advance(tick(.15));
  expect(next.kind).toBe('world');
  expect(session.snapshot().cursor.moment.elapsedSeconds).toBe(.15);
  expect(session.snapshot().cursor.moment.ball.position.x).toBeLessThan(hit.state.cursor.moment.ball.position.x);
  expect(session.snapshot().nativeAdmission).toBe(false);
});

it('resolves a real floor impact once and continues on the same original Source lattice', () => {
  const input = scene(v(0, .1, 0), v(3, -1, 0)), source = input.cursor.sourceCurve!;
  const kernel = createSourceFreeBallKernel(source), session = createSourceBallWorldMotionSessionV1(input);
  const hit = session.advance(tick(.1));
  expect(hit.kind).toBe('world');
  if (hit.kind !== 'world') throw new Error('expected floor boundary');
  expect(hit.response.kind).toBe('ground');
  expect(hit.observed).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'ground' }] });
  expect(hit.state.cursor.moment).toEqual(kernel.evaluateAt(hit.state.cursor.moment.elapsedSeconds, 'outgoing').moment);
  expect(hit.state.cursor.moment.ball.velocity.y).toBeGreaterThan(0);
  expect(hit.state.cursor.sourceCurve).toEqual(source);
  const next = session.advance(tick(.1));
  expect(next.kind).toBe('world');
  expect(session.snapshot().cursor.moment).toEqual(kernel.evaluateAt(.1).moment);
  expect(session.snapshot().cursor.sourceCurve).toEqual(source);
});

it('stops at a glove capture candidate without admitting custody or further commands', () => {
  const input = scene(), body = input.response.world.actors[0];
  const root: SourceBallWorldMotionInputV1 = { ...input, response: { ...input.response,
    world: { ...input.response.world, actors: [{ ...body, primitive: { ...body.primitive,
      role: 'glove', startCenter: v(.6, .98, 0), startVelocity: v(), radius: .08 } }] },
    actors: [{ playerId: body.playerId, profile: { role: 'glove', pocketCenterOffset: v(), bodyStability: 1,
      parameters: { ticksPerSecond: tps, ballMassKg: .145, ballRadiusMeters: .0366, pocketRadiusMeters: .2,
        centerRetentionCapacityJ: 20, captureDissipationPowerW: 1000,
        failedContactRestitution: .5, failedTangentialDamping: .1, failedSpinDamping: .2 } } }] } };
  const session = createSourceBallWorldMotionSessionV1(root), hit = session.advance(tick(.15));
  expect(hit.kind).toBe('world');
  if (hit.kind !== 'world') throw new Error('expected glove boundary');
  expect(hit.response.kind).toBe('capture_candidate');
  expect(hit.state.stopped).toBe(true);
  expect(hit.state.nativeAdmission).toBe(false);
  expect(hit.state.cursor.sourceCurve).toEqual(root.cursor.sourceCurve);
  const stopped = session.snapshot();
  expect(() => session.advance(tick(.2))).toThrow(/stopped/);
  expect(() => session.adoptMotion({ ...command(stopped.cursor.moment.elapsedSeconds),
    commands: [{ playerId: body.playerId, role: 'glove', acceleration: v() }] })).toThrow(/stopped/);
  expect(session.snapshot()).toEqual(stopped);
  expect(hit).not.toHaveProperty('custody');
});

it('rejects replacing actor geometry until the original impulse departure finishes, atomically', () => {
  const session = createSourceBallWorldMotionSessionV1(baseScene());
  const hit = session.advance(tick(.15));
  expect(hit.kind).toBe('world');
  const before = session.snapshot();
  expect(before.cursor.moment.elapsedSeconds).toBeLessThan(.15);
  expect(() => session.adoptMotion(command(before.cursor.moment.elapsedSeconds, v(2, 0, 0))))
    .toThrow(/departure/);
  expect(session.snapshot()).toEqual(before);
  session.advance(tick(.15));
  expect(() => session.adoptMotion(command(.15, v(2, 0, 0)))).not.toThrow();
});

it('preserves actual actor position and velocity across observation checkpoints and new acceleration commands', () => {
  const input = scene(), session = createSourceBallWorldMotionSessionV1(input);
  const original = input.response.world.actors[0].primitive;
  session.adoptMotion(command(start, v(2, 0, 0)));
  const first = session.snapshot().actors[0];
  expect(first.primitive.startCenter.x).toBe(original.startCenter.x + original.startVelocity.x * start);
  session.advance(tick(.03)); session.advance(tick(.05));
  const dt = .05 - start;
  session.adoptMotion(command(.05, v(-1, 0, 0)));
  const second = session.snapshot().actors[0];
  expect(second.startElapsedSeconds).toBe(.05);
  expect(second.primitive.startCenter.x).toBe(first.primitive.startCenter.x + first.primitive.startVelocity.x * dt + .5 * 2 * dt * dt);
  expect(second.primitive.startVelocity.x).toBe(first.primitive.startVelocity.x + 2 * dt);
  session.advance(tick(.08));
  session.adoptMotion(command(.08));
  const third = session.snapshot().actors[0], dt2 = .08 - .05;
  expect(third.primitive.startCenter.x).toBe(second.primitive.startCenter.x + second.primitive.startVelocity.x * dt2 + .5 * -1 * dt2 * dt2);
  expect(third.primitive.startVelocity.x).toBe(second.primitive.startVelocity.x - dt2);
  expect(session.snapshot().cursor.moment).toEqual(createSourceFreeBallKernel(input.cursor.sourceCurve!).evaluateAt(.08).moment);
  expect(session.snapshot().cursor.sourceCurve).toEqual(input.cursor.sourceCurve);
});
