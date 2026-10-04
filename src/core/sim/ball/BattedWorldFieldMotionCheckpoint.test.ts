import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { createBattedWorldFieldGeometry, deriveBattedWorldFieldMotionCheckpoint, advanceBattedWorldFieldMotionCheckpoint } from './BattedWorldFieldMotion';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import { quantizeEventTick } from '../ExactEventTime';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.5 };
const fixture = (elapsedSeconds = 0) => {
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.125 };
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 1 });
  const geometry = createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: 0, z: 0 },
    firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } }, bases: {
    home: base(0, 0), first: base(3, 0), second: base(3, 3), third: base(0, 3) } },
    baseModels: { home: { bottomY: 0, material }, first: { bottomY: 0, material }, second: { bottomY: 0, material }, third: { bottomY: 0, material } } });
  const contact = { tick: 0, ballCenter: v(1, 0.5), point: v(1, 0.5), batPoint: v(1, 0.5), normal: v(1),
    segmentT: 0.5, exitVelocity: v(1), exitSpin: v(0, 0, 2) };
  const actors = [{ playerId: 'defender', primitive: { role: 'body' as const, radius: 0.125, startTick: 0, endTick: 5_000_000,
    ticksPerSecond: parameters.ticksPerSecond, startCenter: v(20, 0.5, 20), startVelocity: v(0.2, 0.1, 0.3), acceleration: v(0.1, 0.2, 0.3) } }];
  const flight = createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 5_000_000 });
  const response: BattedBallContactResponseInput = { world: { flight, parameters, throughTick: 5_000_000, actors, surfaces: [] },
    actors: [{ playerId: 'defender', profile: { role: 'body', material } }], surfaces: [] };
  const cursor = { moment: { originTick: 0, elapsedSeconds, ball: { ...flight.initialBall,
    tick: quantizeEventTick(0, elapsedSeconds, parameters.ticksPerSecond), position: v(1 + elapsedSeconds, 0.5) } }, previousContacts: [] };
  return { response, geometry, actors, cursor, carrierPlayerId: null, availableAtTick: 0, coverageThroughTick: 5_000_000,
    checkpointThroughTick: 500_000, commands: [{ playerId: 'defender', role: 'body' as const, acceleration: v(0.4, 0.5, 0.6) }] };
};
const retained = (input: ReturnType<typeof fixture>, field: ReturnType<typeof deriveBattedWorldFieldMotionCheckpoint>, checkpointThroughTick: number) => ({
  response: input.response, geometry: input.geometry, actors: field.motion.actors, cursor: field.motion.cursor!, carrierPlayerId: field.motion.carrierPlayerId, checkpointThroughTick,
});
it('adopts longer explicit command coverage while executing only the requested contact-free checkpoint', () => {
  const input = fixture(), result = deriveBattedWorldFieldMotionCheckpoint(input);
  expect(result.motion.world.kind).toBe('moving');
  expect(result.motion.world.moment.elapsedSeconds).toBe(0.5);
  expect(result.motion.actors[0].primitive.endTick).toBe(5_000_000);
  expect(result.baseContacts).toEqual([]);
});
it('retains exact anchored actor curves through repeated checkpoints without renewed coverage or cumulative actor drift', () => {
  const input = fixture(0.1234567), first = deriveBattedWorldFieldMotionCheckpoint(input);
  const second = advanceBattedWorldFieldMotionCheckpoint(retained(input, first, 700_000));
  const third = advanceBattedWorldFieldMotionCheckpoint(retained(input, second, 1_000_000));
  const once = deriveBattedWorldFieldMotionCheckpoint({ ...input, checkpointThroughTick: 1_000_000 });
  expect(third.motion.actors).toEqual(first.motion.actors);
  expect(third.motion.actors).toEqual(once.motion.actors);
  expect(third.motion.world).toEqual(once.motion.world);
  expect(first.motion.actors[0].startElapsedSeconds).toBe(input.cursor.moment.elapsedSeconds);
});
it('stops at the first actual bag contact before the proposed checkpoint without executing future coverage', () => {
  const input = fixture(), result = deriveBattedWorldFieldMotionCheckpoint({ ...input, checkpointThroughTick: 3_000_000 });
  expect(result.motion.world.kind).toBe('boundary');
  expect(result.motion.world.moment.elapsedSeconds).toBe(1.625);
  expect(result.baseContacts).toMatchObject([{ baseId: 'first' }]);
  expect(result.motion.actors[0].primitive.endTick).toBe(input.coverageThroughTick);
  const continued = advanceBattedWorldFieldMotionCheckpoint(retained(input, result, 2_000_000));
  expect(continued.baseContacts).toEqual([]);
  expect(continued.motion.actors).toEqual(result.motion.actors);
});
it('checks exact fractional availability, exhausted original coverage and checkpoint ordering rather than rounded ball ticks', () => {
  const input = fixture(0.5000000000000001);
  expect(input.cursor.moment.ball.tick).toBe(500_000);
  expect(() => deriveBattedWorldFieldMotionCheckpoint({ ...input, actors: input.actors.map((a) => ({ ...a, primitive: { ...a.primitive, endTick: 500_000 } })) })).toThrow();
  expect(() => deriveBattedWorldFieldMotionCheckpoint({ ...fixture(0.4999999), availableAtTick: 500_000 })).toThrow();
  expect(() => deriveBattedWorldFieldMotionCheckpoint({ ...fixture(), checkpointThroughTick: 5_000_001 })).toThrow();
  expect(() => deriveBattedWorldFieldMotionCheckpoint({ ...input, checkpointThroughTick: 500_000 })).toThrow();
});
it('rejects replacement commands or extended coverage on retained-only checkpoints and incomplete or duplicate new commands', () => {
  const input = fixture(), first = deriveBattedWorldFieldMotionCheckpoint(input), next = retained(input, first, 1_000_000);
  expect(() => advanceBattedWorldFieldMotionCheckpoint({ ...next, commands: input.commands } as typeof next)).toThrow();
  expect(() => advanceBattedWorldFieldMotionCheckpoint({ ...next, coverageThroughTick: 6_000_000 } as typeof next)).toThrow();
  expect(() => advanceBattedWorldFieldMotionCheckpoint({ ...next, checkpointThroughTick: 5_000_001 })).toThrow();
  expect(() => deriveBattedWorldFieldMotionCheckpoint({ ...input, commands: [] })).toThrow();
  expect(() => deriveBattedWorldFieldMotionCheckpoint({ ...input, commands: [...input.commands, ...input.commands] })).toThrow();
});
it('accepts a real fractional-to-integer advance even when old and new moments share their quantized tick', () => {
  const input = fixture(0.4999999), first = deriveBattedWorldFieldMotionCheckpoint({ ...input, coverageThroughTick: 500_000 });
  expect(first.motion.world.moment.elapsedSeconds).toBe(0.5);
  const retainedResult = advanceBattedWorldFieldMotionCheckpoint({ response: input.response, geometry: input.geometry,
    actors: input.actors, cursor: input.cursor, carrierPlayerId: null, checkpointThroughTick: 500_000 });
  expect(retainedResult.motion.world.moment.elapsedSeconds).toBe(0.5);
});
it('rejects zero-progress requests and exhausted retained coverage while accepting the last covered endpoint', () => {
  const input = fixture(0.5);
  expect(() => deriveBattedWorldFieldMotionCheckpoint(input)).toThrow(/checkpoint/);
  const first = deriveBattedWorldFieldMotionCheckpoint({ ...fixture(), coverageThroughTick: 1_000_000 });
  const end = advanceBattedWorldFieldMotionCheckpoint(retained(input, first, 1_000_000));
  expect(end.motion.world.moment.elapsedSeconds).toBe(1);
  expect(() => advanceBattedWorldFieldMotionCheckpoint(retained(input, end, 1_000_000))).toThrow(/checkpoint|exhausted/);
});
it('owns the exact requested contact-free integer endpoint despite start-plus-duration roundoff', () => {
  const result = deriveBattedWorldFieldMotionCheckpoint({ ...fixture(0.0000004), checkpointThroughTick: 5 });
  expect(result.motion.world.moment.elapsedSeconds).toBe(0.000005);
  expect(result.motion.cursor!.moment).toEqual(result.motion.world.moment);
});
it('samples a retained carrying glove at the current exact time rather than using its original start velocity', () => {
  const input = fixture(), actor = { ...input.actors[0], primitive: { ...input.actors[0].primitive, role: 'glove' as const,
    startCenter: v(1, 0.5), startVelocity: v(1), acceleration: v(0.25) } };
  const profile = { role: 'glove' as const, pocketCenterOffset: v(), bodyStability: 1,
    parameters: { ticksPerSecond: 1_000_000, ballRadiusMeters: 0.125, ballMassKg: 0.145, pocketRadiusMeters: 0.2,
      centerRetentionCapacityJ: 10, captureDissipationPowerW: 100, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } };
  const response = { ...input.response, world: { ...input.response.world, actors: [actor] }, actors: [{ playerId: actor.playerId, profile }] };
  const raw = { response, geometry: input.geometry, actors: [actor], cursor: input.cursor, carrierPlayerId: actor.playerId,
    checkpointThroughTick: 500_000 };
  const first = advanceBattedWorldFieldMotionCheckpoint(raw);
  const next = advanceBattedWorldFieldMotionCheckpoint({ ...raw, cursor: first.motion.cursor!, checkpointThroughTick: 1_000_000 });
  expect(next.motion.response.kind).toBe('carried');
  expect(next.motion.world.moment.ball.position.x).toBe(2.125);
  expect(next.motion.world.moment.ball.velocity.x).toBe(1.25);
  expect(next.motion.actors).toEqual([actor]);
  const competing = advanceBattedWorldFieldMotionCheckpoint({ ...raw, cursor: next.motion.cursor!, checkpointThroughTick: 3_000_000 });
  expect(competing.motion.response).toEqual({ kind: 'unresolved', reason: 'carried_contact', cursor: null });
  expect(competing.baseContacts[0].baseId).toBe('first');
});
it('preserves same-time actual contact and horizon-edge contact instead of turning either into contact-free progress', () => {
  const input = fixture(), atEdge = deriveBattedWorldFieldMotionCheckpoint({ ...input, coverageThroughTick: 1_625_000, checkpointThroughTick: 1_625_000 });
  expect(atEdge.motion.world.kind).toBe('boundary');
  expect(atEdge.baseContacts).toHaveLength(1);
  const same = deriveBattedWorldFieldMotionCheckpoint({ ...input, cursor: { ...input.cursor, moment: { ...input.cursor.moment,
    ball: { ...input.cursor.moment.ball, position: v(3, 0.5) } } } });
  expect(same.motion.world.kind).toBe('boundary');
  expect(same.motion.world.moment.elapsedSeconds).toBe(0);
  expect(same.motion.cursor).toBeNull();
});
