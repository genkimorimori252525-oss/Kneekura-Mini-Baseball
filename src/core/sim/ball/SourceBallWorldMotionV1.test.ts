import { expect, it } from 'vitest';
import { createSourceBallWorldMotionSessionV1, type SourceBallWorldMotionInputV1 } from './SourceBallWorldMotionV1';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../contact/RigidBatBallContact';
import { multiplyQuaternions } from '../pitching/BaseballOrientation';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const material = { restitution: .5, tangentialDamping: .1, spinDamping: .2 };
const fixture = (): SourceBallWorldMotionInputV1 => {
  const d: SourceFreeBallDescriptorV2 = { kind: 'aero_ground_continuous_source_kernel_v2',
    initial: { originTick: 10587305, elapsedSeconds: .46910977857333824,
      ball: { tick: 11056415, position: v(0, 1, 0), velocity: v(20, 1, 0), spin: v(0, 12, -50) } }, throughElapsedSeconds: .8,
    profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1e6, integrationStepTicks: 2000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15,
      material: { restitution: .4, slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } } };
  const actors = [{ playerId: 'batter', primitive: { role: 'tag_hand' as const, radius: .05, startTick: d.initial.originTick,
    endTick: 11387305, ticksPerSecond: 1e6, startCenter: v(0, 1, -2), startVelocity: v(), acceleration: v() } },
    ...Array.from({ length: 9 }, (_, i) => ({ playerId: `defender-${i}`, primitive: { role: 'body' as const, radius: .2,
      startTick: d.initial.originTick, endTick: 11387305, ticksPerSecond: 1e6, startCenter: v(10 + i, 1, 10), startVelocity: v(), acceleration: v() } }))];
  return { version: 'source_ball_world_motion_v1', response: { world: { parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS,
    groundRestitution: .4, groundFriction: .25 }, actors, surfaces: [], sourceCurve: d },
    actors: actors.map(a => ({ playerId: a.playerId, profile: { role: a.primitive.role, material } })), surfaces: [] },
    cursor: { moment: createSourceFreeBallKernel(d).evaluateAt(.546911, 'incoming').moment,
      sourceCurve: d, sourceSide: 'incoming', previousContacts: [] },
    materialOrientationAtSourceBasis: { x: 0, y: Math.sin(.2), z: 0, w: Math.cos(.2) }, heldBats: [], baseGeometry: null };
};
const commands = (input: SourceBallWorldMotionInputV1) => input.response.world.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role,
  acceleration: a.playerId === 'batter' ? v() : v(-2, 0, 0) }));
it('moves nine defenders from the actual recovered offset without inventing a flight root or changing the ball Source', () => {
  const input = fixture(), before = JSON.stringify(input), session = createSourceBallWorldMotionSessionV1(input);
  session.adoptMotion({ availableAtElapsedSeconds: .546911, throughTick: 11237305, commands: commands(input) });
  const result = session.advance(11237305), state = session.snapshot();
  expect(result.kind).toBe('world'); expect(state.cursor.moment.elapsedSeconds).toBe(.65);
  expect(state.cursor.sourceCurve).toEqual(input.cursor.sourceCurve);
  expect(state.cursor.moment).toEqual(createSourceFreeBallKernel(input.cursor.sourceCurve!).evaluateAt(.65).moment);
  expect(state.actors.slice(1).every(a => a.primitive.acceleration.x === -2)).toBe(true);
  expect(state.actors.every(a => a.startElapsedSeconds === .546911)).toBe(true);
  expect(state.nativeAdmission).toBe(false); expect(JSON.stringify(input)).toBe(before);
});
it('keeps identical ball/spin/material phase with different observation partitions and unchanged commands', () => {
  const input = fixture(), full = createSourceBallWorldMotionSessionV1(input), split = createSourceBallWorldMotionSessionV1(input);
  full.advance(11237305); split.advance(11147305); split.advance(11237305);
  expect(split.snapshot()).toEqual(full.snapshot());
  expect(full.snapshot().orientation).toEqual(multiplyQuaternions(createSourceFreeBallKernel(input.cursor.sourceCurve!).evaluateAt(.65).orientation, input.materialOrientationAtSourceBasis));
});
it('refuses partial/duplicate/future controls atomically and cannot silently move a held bat', () => {
  const input = fixture(), session = createSourceBallWorldMotionSessionV1(input), before = session.snapshot();
  for (const c of [commands(input).slice(1), [...commands(input).slice(1), commands(input)[1]]])
    expect(() => session.adoptMotion({ availableAtElapsedSeconds: .546911, throughTick: 11237305, commands: c })).toThrow();
  expect(() => session.adoptMotion({ availableAtElapsedSeconds: .5469110001, throughTick: 11237305, commands: commands(input) })).toThrow();
  expect(session.snapshot()).toEqual(before);
});
const withBat = (): SourceBallWorldMotionInputV1 => ({ ...fixture(), heldBats: [{ equipmentId: 'real-tapered-bat', holderPlayerId: 'batter',
  ball: REALISTIC_BASEBALL_RIGID_BODY, bat: { pose: { grip: v(3, 1, -.4), tip: v(3, 1, .44) },
    centerOfMassVelocity: v(), angularVelocity: v(), physical: { massKg: .9, centerOfMassT: .6,
      transverseMomentOfInertiaKgM2: .05, axialMomentOfInertiaKgM2: .0004,
      radiusProfile: { knots: [{ t: 0, radiusM: .015 }, { t: .6, radiusM: .03 }, { t: 1, radiusM: .032 }] } } } }] });
it('retains the full tapered bat, finds its intervening impact and stops without a fabricated rebound', () => {
  const input = withBat(), session = createSourceBallWorldMotionSessionV1(input), result = session.advance(11237305);
  expect(result.kind).toBe('equipment_boundary');
  if (result.kind !== 'equipment_boundary') throw new Error(JSON.stringify(result));
  expect(result.contact.equipmentId).toBe('real-tapered-bat'); expect(result.state.stopped).toBe(true);
  expect(result.state.cursor.moment.elapsedSeconds).toBeGreaterThan(.546911);
  expect(result.state.cursor.moment.elapsedSeconds).toBeLessThan(.65);
  expect(result.state.cursor.sourceCurve).toEqual(input.cursor.sourceCurve);
  expect(() => session.advance(11247305)).toThrow(/stopped/);
});
it('refuses a moving held palm and keeps the previous command intact', () => {
  const input = withBat(), session = createSourceBallWorldMotionSessionV1(input), before = session.snapshot();
  const c = commands(input).map(x => x.playerId === 'batter' ? { ...x, acceleration: v(1, 0, 0) } : x);
  expect(() => session.adoptMotion({ availableAtElapsedSeconds: .546911, throughTick: 11237305, commands: c })).toThrow(/equipment controller/);
  expect(session.snapshot()).toEqual(before);
});
it('stops at the real first actor and carries physical restitution and material phase into the next Source', () => {
  const input = fixture(), target = { playerId: 'batter', primitive: { ...input.response.world.actors[0].primitive, startCenter: v(3, 1, 0), radius: .15 } };
  const root = { ...input, response: { ...input.response, world: { ...input.response.world, actors: [target, ...input.response.world.actors.slice(1)] } } };
  const session = createSourceBallWorldMotionSessionV1(root), result = session.advance(11237305);
  expect(result.kind).toBe('world'); if (result.kind !== 'world') throw new Error('unexpected unresolved');
  expect(result.response.kind).toBe('rebound'); expect(result.state.cursor.moment.ball.velocity.x).toBeLessThan(0);
  expect(result.state.cursor.sourceCurve!.initial.elapsedSeconds).toBe(result.observed.moment.elapsedSeconds);
  const phase = result.state.orientation; session.advance(11237305);
  expect(session.snapshot().cursor.moment.elapsedSeconds).toBe(.65); expect(phase).not.toEqual(session.snapshot().orientation);
});
it('refuses changed ball clocks, expired actors and unbound Source profiles', () => {
  const input = fixture();
  expect(() => createSourceBallWorldMotionSessionV1({ ...input, cursor: { ...input.cursor, moment: { ...input.cursor.moment, originTick: 11056415 } } })).toThrow();
  const short = { ...input.response.world.actors[0], primitive: { ...input.response.world.actors[0].primitive, endTick: 11134215 } };
  expect(() => createSourceBallWorldMotionSessionV1({ ...input, response: { ...input.response, world: { ...input.response.world, actors: [short, ...input.response.world.actors.slice(1)] } } })).toThrow(/coverage/);
  expect(() => createSourceBallWorldMotionSessionV1({ ...input, materialOrientationAtSourceBasis: { x: 0, y: 0, z: 0, w: 2 } })).toThrow(/orientation/);
});
