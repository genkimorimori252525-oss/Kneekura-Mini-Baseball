import { expect, it } from 'vitest';
import { proveFiniteFieldActorClearanceV1 } from './FiniteFieldActorClearanceV1';
import type { BallWorldMotionActor } from '../ball/BallWorldContinuation';
import type { SourceBallWorldMotionInputV1 } from '../ball/SourceBallWorldMotionV1';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../ball/BallFlight';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../contact/RigidBatBallContact';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const originTick = 2_000_000, elapsedSeconds = .125, ticksPerSecond = 1_000_000;
const soleSupport = { kind: 'compliant_stationary_sole_v1' as const, maximumCompressionMeters: .002 };
const actor = (playerId: string, position = v(0, 1, 0), velocity = v(), role: BallWorldMotionActor['primitive']['role'] = 'body'): BallWorldMotionActor => ({
  playerId, startElapsedSeconds: elapsedSeconds, primitive: { role, radius: .1, startTick: originTick,
    endTick: originTick + 2 * ticksPerSecond, ticksPerSecond, startCenter: position, startVelocity: velocity, acceleration: v() },
});
// Geometry-only synthetic root: this proof neither evaluates a ball Source nor grants execution.
const root = (actors: readonly BallWorldMotionActor[]): SourceBallWorldMotionInputV1 => ({
  version: 'source_ball_world_motion_v1', response: { world: { parameters: DEFAULT_BALL_FLIGHT_PARAMETERS, actors, surfaces: [] },
    actors: [], surfaces: [] },
  cursor: { moment: { originTick, elapsedSeconds, ball: { tick: originTick + elapsedSeconds * ticksPerSecond,
    position: v(20, 1, 20), velocity: v(), spin: v() } }, previousContacts: [] },
  materialOrientationAtSourceBasis: { x: 0, y: 0, z: 0, w: 1 }, heldBats: [], baseGeometry: null,
});
const withBat = (r: SourceBallWorldMotionInputV1): SourceBallWorldMotionInputV1 => ({ ...r, heldBats: [{
  equipmentId: 'retained-bat', holderPlayerId: 'holder', ball: REALISTIC_BASEBALL_RIGID_BODY,
  bat: { pose: { grip: v(0, 1, 0), tip: v(0, 1, 1) }, centerOfMassVelocity: v(), angularVelocity: v(),
    physical: { massKg: .9, centerOfMassT: .6, transverseMomentOfInertiaKgM2: .05, axialMomentOfInertiaKgM2: .0004,
      radiusProfile: { knots: [{ t: 0, radiusM: .015 }, { t: 1, radiusM: .03 }] } } },
}] });
const prove = (r: SourceBallWorldMotionInputV1, durationSeconds = 1, footGroundSupport = soleSupport) => proveFiniteFieldActorClearanceV1({
  actors: r.response.world.actors, root: r, durationSeconds, footGroundSupport,
});

it('refuses a crossing wholly between clear endpoints even when the full-interval midpoint is clear', () => {
  const one = actor('moving', v(-1, 1, 0), v(4, 0, 0)), two = actor('stationary');
  // At t=0, .5, 1 the centers are 1, 1, 3 meters apart; collision is at t=.25.
  expect(() => prove(root([one, two]))).toThrow(/uncertified continuous/);
});

it('proves separated passing trajectories without changing their input positions or clocks', () => {
  const r = root([actor('one', v(-1, 1, 0), v(2, 0, 0)), actor('two', v(1, 1, 2), v(-2, 0, 0))]);
  const before = JSON.stringify(r), result = prove(r);
  expect(result).toMatchObject({ kind: 'finite_field_actor_clearance_v1', durationSeconds: 1, actorCount: 2,
    continuousClearanceProven: true, positionsOrClockCorrected: false });
  expect(result.proofIntervals).toBeGreaterThan(0);
  expect(JSON.stringify(r)).toBe(before);
});

it('rejects another player crossing the retained tapered bat while allowing the reconstructed grasp hand', () => {
  const grasp = actor('holder', v(0, 1, 0), v(), 'tag_hand');
  const colliding = withBat(root([grasp, actor('crossing', v(-1, 1, .5), v(4, 0, 0))]));
  expect(() => prove(colliding)).toThrow(/uncertified continuous/);
  const clear = withBat(root([grasp, actor('passing', v(-1, 1, 2), v(2, 0, 0))]));
  expect(prove(clear)).toMatchObject({ heldBatCount: 1, continuousClearanceProven: true });
});

it('does not exempt the holder body from its own bat, or another player from its grasp hand', () => {
  const body = withBat(root([actor('holder', v(0, 1, .5))]));
  expect(() => prove(body)).toThrow(/uncertified continuous/);
  const otherHand = withBat(root([actor('other', v(0, 1, .5), v(), 'tag_hand')]));
  expect(() => prove(otherHand)).toThrow(/uncertified continuous/);
});

it('allows intended same-player anatomical proxy overlap and static foot contact with the floor', () => {
  const r = root([actor('one', v(0, 1, 0)), actor('one', v(0, 1, 0), v(), 'glove'),
    actor('one', v(0, .1, 0), v(), 'left_foot')]);
  expect(prove(r).continuousClearanceProven).toBe(true);
  expect(() => prove(root([actor('one', v(0, .09, 0))]))).toThrow(/ground coverage/);
  expect(() => prove(root([actor('one', v(0, 1, 0), v(0, -.1, 0))]))).toThrow(/ground coverage/);
});

it('rejects incompatible actor clocks, expired coverage and unsupported vertical acceleration', () => {
  const a = actor('one'), r = root([a]);
  const invalid = [{ ...a, startElapsedSeconds: elapsedSeconds + .001 },
    { ...a, primitive: { ...a.primitive, startTick: originTick + 1 } },
    { ...a, primitive: { ...a.primitive, endTick: originTick + 1_000_000 } },
    { ...a, primitive: { ...a.primitive, acceleration: v(0, -1, 0) } }];
  invalid.forEach(changed => expect(() => proveFiniteFieldActorClearanceV1({ actors: [changed], root: r, durationSeconds: 1, footGroundSupport: soleSupport })).toThrow(/ground coverage/));
  for (const durationSeconds of [0, -1, Infinity, NaN])
    expect(() => proveFiniteFieldActorClearanceV1({ actors: [a], root: r, durationSeconds, footGroundSupport: soleSupport })).toThrow();
});

const compressedFoot = (y = .06999999999999995): BallWorldMotionActor => {
  const a = actor('supported-player', v(0, y, 0), v(), 'left_foot');
  return { ...a, primitive: { ...a.primitive, radius: .07 } };
};

it('preserves an explicitly calibrated stationary sole compression without changing its coordinates or clock', () => {
  const foot = compressedFoot(), r = root([foot]), before = JSON.stringify(r), gap = foot.primitive.startCenter.y - foot.primitive.radius;
  expect(gap).toBeLessThan(0);
  expect(() => prove(r, 1, { ...soleSupport, maximumCompressionMeters: 0 })).toThrow(/sole\/ground coverage/);
  const certificate = prove(r);
  expect(certificate.supportedFeet).toEqual([{ playerId: foot.playerId, role: 'left_foot', signedGroundGapMeters: gap,
    maximumCompressionMeters: soleSupport.maximumCompressionMeters }]);
  expect(certificate.footGroundSupport).toEqual(soleSupport);
  expect(certificate.positionsOrClockCorrected).toBe(false);
  expect(JSON.stringify(r)).toBe(before);
  expect(prove(root([compressedFoot(.07)]), 1, { ...soleSupport, maximumCompressionMeters: 0 }).supportedFeet[0].signedGroundGapMeters).toBe(0);
});

it('rejects excessive sole compression, support as large as the foot radius, and non-foot penetration', () => {
  expect(() => prove(root([compressedFoot(.066)]))).toThrow(/sole\/ground coverage/);
  expect(() => prove(root([compressedFoot()]), 1, { ...soleSupport, maximumCompressionMeters: .07 })).toThrow(/sole\/ground coverage/);
  const foot = compressedFoot(), body = { ...foot, primitive: { ...foot.primitive, role: 'body' as const } };
  expect(() => prove(root([body]))).toThrow(/ground coverage/);
});

it('rejects a new sole height or vertical motion even within the calibrated compression range', () => {
  const foot = compressedFoot(), r = root([foot]);
  const invalid = [{ ...foot, primitive: { ...foot.primitive, startCenter: v(0, .07, 0) } },
    { ...foot, primitive: { ...foot.primitive, startVelocity: v(0, .001, 0) } },
    { ...foot, primitive: { ...foot.primitive, acceleration: v(0, .001, 0) } }];
  invalid.forEach(changed => expect(() => proveFiniteFieldActorClearanceV1({ actors: [changed], root: r,
    durationSeconds: 1, footGroundSupport: soleSupport })).toThrow(/ground coverage/));
});

it('requires an explicit physical support model even for an otherwise clear scene', () => {
  const r = root([actor('one')]), input = { actors: r.response.world.actors, root: r, durationSeconds: 1 };
  expect(() => proveFiniteFieldActorClearanceV1(input as never)).toThrow(/explicit foot support/);
  for (const footGroundSupport of [{ ...soleSupport, kind: 'implicit_numeric_epsilon' },
    { ...soleSupport, maximumCompressionMeters: -1 }, { ...soleSupport, maximumCompressionMeters: NaN }])
    expect(() => proveFiniteFieldActorClearanceV1({ ...input, footGroundSupport } as never)).toThrow();
});

it('checks supplied wall and rotated base geometry against the whole actor path', () => {
  const moving = actor('one', v(-1, 1, 0), v(4, 0, 0)), r = root([moving]);
  const wall = { surfaceId: 'solid-wall', start: { x: 0, z: -1 }, end: { x: 0, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  expect(() => prove({ ...r, response: { ...r.response, world: { ...r.response.world, surfaces: [wall] } } })).toThrow(/uncertified continuous/);
  const material = { restitution: .3, tangentialDamping: .2, spinDamping: .1 };
  const prism = (x: number) => ({ region: { center: { x, z: 0 }, halfSize: { x: .1, z: .2 }, rotationRadians: .3 }, bottomY: 0, topY: 1.1 });
  expect(() => prove({ ...r, baseGeometry: { bases: { home: prism(20), first: prism(0), second: prism(30), third: prism(40) },
    materials: { home: material, first: material, second: material, third: material } } })).toThrow(/uncertified continuous/);
});

it('refuses unsupported moving equipment and equipment with venue geometry instead of omitting them', () => {
  const r = withBat(root([actor('one', v(4, 1, 0))])), b = r.heldBats[0];
  expect(() => prove({ ...r, heldBats: [{ ...b, bat: { ...b.bat, centerOfMassVelocity: v(1, 0, 0) } }] })).toThrow(/moving equipment/);
  const wall = { surfaceId: 'far-wall', start: { x: 10, z: -1 }, end: { x: 10, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  expect(() => prove({ ...r, response: { ...r.response, world: { ...r.response.world, surfaces: [wall] } } })).toThrow(/equipment\/venue/);
});
