import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { deriveBattedWorldMotion } from './BattedWorldMotion';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.1 };
const material = { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 };
const fixture = (elapsedSeconds = 0.1000000004, originTick = 0) => {
  const contact = { tick: originTick, ballCenter: v(0, 1, 0), point: v(0, 1, 0), batPoint: v(0, 1, 0), normal: v(0, 0, 1),
    segmentT: 0.5, exitVelocity: v(0, 0, 1), exitSpin: v(0, 0, 0) };
  const actors = [{ playerId: 'defender', primitive: { role: 'body' as const, radius: 0.1, startTick: originTick,
    endTick: originTick + 1_000_000, ticksPerSecond: parameters.ticksPerSecond, startCenter: v(10, 1, 10),
    startVelocity: v(2, 0, 0), acceleration: v(0, 0, 0) } }];
  const response: BattedBallContactResponseInput = { world: { flight: createBattedBallFlightEvidence({ contact, parameters,
    searchDurationTicks: 1_000_000 }), parameters, throughTick: originTick + 1_000_000, actors, surfaces: [] },
    actors: [{ playerId: 'defender', profile: { role: 'body', material } }], surfaces: [] };
  return { response, actors, cursor: { moment: { originTick, elapsedSeconds,
    ball: { tick: originTick + Math.ceil(elapsedSeconds * parameters.ticksPerSecond), position: v(0, 1, 0), velocity: v(0, 0, 1), spin: v(0, 0, 0) } }, previousContacts: [] },
    carrierPlayerId: null, availableAtTick: originTick, throughTick: originTick + 200_000,
    commands: [{ playerId: 'defender', role: 'body' as const, acceleration: v(4, 0, 0) }] };
};
it('rebases actual actor center/velocity at a fractional moment and extends accepted future coverage', () => {
  const input = fixture(), result = deriveBattedWorldMotion({ ...input, throughTick: 2_000_000 });
  expect(result.actors[0].primitive.startCenter.x).toBeCloseTo(10.2000000008, 12);
  expect(result.actors[0].primitive.startVelocity).toEqual(v(2, 0, 0));
  expect(result.actors[0].startElapsedSeconds).toBe(input.cursor.moment.elapsedSeconds);
  expect(result.actors[0].primitive.endTick).toBe(2_000_000);
  expect(result.response.kind).toBe('moving'); expect(result.cursor?.moment.ball.position.z).toBeCloseTo(1.8999999996, 12);
  expect(result).not.toHaveProperty('playEnd'); expect(input.actors[0].primitive.startCenter.x).toBe(10);
});
it('continues a later handoff from the previous actual continuous actor basis without applying the new acceleration in the past', () => {
  const first = deriveBattedWorldMotion(fixture());
  if (!first.cursor) throw new Error('moving fixture');
  const second = deriveBattedWorldMotion({ ...fixture(), actors: first.actors, cursor: first.cursor, throughTick: 300_000,
    commands: [{ playerId: 'defender', role: 'body', acceleration: v(-2, 0, 0) }] });
  expect(second.actors[0].primitive.startCenter.x).toBeCloseTo(10.41999999984, 12);
  expect(second.actors[0].primitive.startVelocity.x).toBeCloseTo(2.3999999984, 12);
  expect(first.actors[0].primitive.acceleration).toEqual(v(4, 0, 0));
});
it('retains identical geometry at a large exact original tick', () => {
  const small = deriveBattedWorldMotion(fixture()), large = deriveBattedWorldMotion(fixture(0.1000000004, 2 ** 52));
  expect(large.actors[0].primitive.startCenter).toEqual(small.actors[0].primitive.startCenter);
  expect(large.cursor?.moment.ball.position).toEqual(small.cursor?.moment.ball.position);
  expect(large.cursor?.moment.ball.tick).toBe(2 ** 52 + 200_000);
});
it.each(['missing', 'duplicate', 'late', 'past', 'nonfinite'] as const)('rejects %s accepted motion inputs', (kind) => {
  const input = fixture();
  const changed = kind === 'missing' ? { ...input, commands: [] }
    : kind === 'duplicate' ? { ...input, commands: [input.commands[0], input.commands[0]] }
    : kind === 'late' ? { ...input, availableAtTick: input.cursor.moment.ball.tick + 1 }
    : kind === 'past' ? { ...input, throughTick: input.cursor.moment.ball.tick }
    : { ...input, commands: [{ ...input.commands[0], acceleration: v(Infinity, 0, 0) }] };
  expect(() => deriveBattedWorldMotion(changed)).toThrow();
});
it('queries actual body contact after the changed controller and uses the registered response material', () => {
  const input = fixture(0.1), actors = [{ ...input.actors[0], primitive: { ...input.actors[0].primitive,
    startCenter: v(0, 1, 0.25), startVelocity: v(0, 0, 0) } }];
  const result = deriveBattedWorldMotion({ ...input, actors, throughTick: 300_000,
    commands: [{ playerId: 'defender', role: 'body', acceleration: v(0, 0, 0) }] });
  expect(result.world.kind).toBe('boundary'); expect(result.response.kind).toBe('rebound');
  expect(result.cursor?.moment.elapsedSeconds).toBeCloseTo(0.15, 12);
  expect(result.cursor?.moment.ball.velocity.z).toBeCloseTo(-0.5, 12);
});
it('queries a finite panel after the handoff without restoring the original bat flight', () => {
  const input = fixture(0.1), wall = { surfaceId: 'wall', start: { x: -1, z: 0.2 }, end: { x: 1, z: 0.2 }, minimumHeight: 0, maximumHeight: 2 };
  const result = deriveBattedWorldMotion({ ...input, throughTick: 400_000, response: { ...input.response,
    world: { ...input.response.world, surfaces: [wall] }, surfaces: [{ surfaceId: 'wall', material }] } });
  expect(result.response.kind).toBe('rebound'); expect(result.cursor?.moment.elapsedSeconds).toBeCloseTo(0.2, 12);
  expect(result.cursor?.moment.ball.velocity.z).toBeCloseTo(-0.5, 12);
});
it('derives actual ground response after the handoff while leaving original contact history intact', () => {
  const input = fixture(0.1), cursor = { ...input.cursor, moment: { ...input.cursor.moment,
    ball: { ...input.cursor.moment.ball, velocity: v(0, -10, 1) } } };
  const result = deriveBattedWorldMotion({ ...input, cursor, throughTick: 400_000 });
  expect(result.response.kind).toBe('ground'); expect(result.cursor?.moment.elapsedSeconds).toBeCloseTo(0.19, 12);
  expect(result.cursor?.moment.ball.position.y).toBeCloseTo(0.1, 12);
  expect(input.response.world.flight.contact.tick).toBe(0);
});
const carriedFixture = () => {
  const input = fixture(0.1), glove = { playerId: 'defender', primitive: { ...input.actors[0].primitive, role: 'glove' as const,
    startCenter: v(0, 1, 0.2), startVelocity: v(0, 0, 2) } };
  const response: BattedBallContactResponseInput = { ...input.response, actors: [...input.response.actors,
    { playerId: 'defender', profile: { role: 'glove', pocketCenterOffset: v(0, 0, -0.2), bodyStability: 1,
      parameters: { ticksPerSecond: parameters.ticksPerSecond, ballMassKg: 0.145, ballRadiusMeters: 0.1, pocketRadiusMeters: 0.3,
        centerRetentionCapacityJ: 1000, captureDissipationPowerW: 1000, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } } }] };
  return { ...input, response, actors: [...input.actors, glove], carrierPlayerId: 'defender', throughTick: 300_000,
    cursor: { ...input.cursor, moment: { ...input.cursor.moment, ball: { ...input.cursor.moment.ball, position: v(0, 1, 0.2), velocity: v(0, 0, 2) } } },
    commands: [input.commands[0], { playerId: 'defender', role: 'glove' as const, acceleration: v(0, 0, 4) }] };
};
it('moves an already secured carried ball with later glove acceleration and preserves its actual offset', () => {
  const result = deriveBattedWorldMotion(carriedFixture());
  expect(result.response.kind).toBe('carried'); expect(result.cursor?.moment.ball.position.z).toBeCloseTo(0.68, 12);
  expect(result.cursor?.moment.ball.velocity.z).toBeCloseTo(2.8, 12);
  expect(result.actors.find((actor) => actor.primitive.role === 'glove')?.primitive.startCenter.z).toBeCloseTo(0.4, 12);
  expect(result.cursor?.previousContacts).toContainEqual({ kind: 'actor', playerId: 'defender', role: 'glove' });
});
it('preserves a carried finite-panel interruption without manufacturing a free ball or terminal result', () => {
  const input = carriedFixture(), wall = { surfaceId: 'wall', start: { x: -1, z: 0.65 }, end: { x: 1, z: 0.65 }, minimumHeight: 0, maximumHeight: 2 };
  const result = deriveBattedWorldMotion({ ...input, response: { ...input.response,
    world: { ...input.response.world, surfaces: [wall] }, surfaces: [{ surfaceId: 'wall', material }] } });
  expect(result.world.kind).toBe('boundary'); expect(result.response).toEqual({ kind: 'unresolved', reason: 'carried_contact', cursor: null });
  expect(result.cursor).toBeNull(); expect(result).not.toHaveProperty('ballAfterDrop'); expect(result).not.toHaveProperty('playEnd');
});
it('rejects a carried velocity discontinuity rather than snapping the ball to a changed glove', () => {
  const input = carriedFixture();
  expect(() => deriveBattedWorldMotion({ ...input, cursor: { ...input.cursor, moment: { ...input.cursor.moment,
    ball: { ...input.cursor.moment.ball, velocity: v(0, 0, 9) } } } })).toThrow(/carried velocity/);
});
it.each([NaN, -1])('rejects invalid true primitive start offset=%s', (startElapsedSeconds) => {
  const input = fixture();
  expect(() => deriveBattedWorldMotion({ ...input, actors: [{ ...input.actors[0], startElapsedSeconds }] })).toThrow();
});
it('records a new ground tangent during secured carry instead of skipping the real contact', () => {
  const input = carriedFixture(), p = { ...parameters, ballRadius: 0.125 };
  const actors = input.actors.map((actor) => actor.primitive.role !== 'glove' ? actor : { ...actor,
    primitive: { ...actor.primitive, startCenter: v(0.225, 1.325, 0), startVelocity: v(0, -2, 0) } });
  const response = { ...input.response, world: { ...input.response.world, parameters: p,
    flight: createBattedBallFlightEvidence({ contact: input.response.world.flight.contact, parameters: p, searchDurationTicks: 1_000_000 }) } };
  const result = deriveBattedWorldMotion({ ...input, response, actors, throughTick: 2_100_000,
    cursor: { ...input.cursor, moment: { ...input.cursor.moment, ball: { ...input.cursor.moment.ball,
      position: v(0, 1.125, 0), velocity: v(0, -2, 0) } } },
    commands: input.commands.map((command) => command.role !== 'glove' ? command : { ...command, acceleration: v(0, 2, 0) }) });
  expect(result.world.kind).toBe('boundary');
  expect(result.world.moment.elapsedSeconds).toBeCloseTo(1.1, 12);
  expect(result.world.moment.ball.position.y).toBeCloseTo(0.125, 12);
  expect(result.response).toEqual({ kind: 'unresolved', reason: 'carried_contact', cursor: null });
});
