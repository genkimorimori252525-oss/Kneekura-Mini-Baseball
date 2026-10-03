import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { createBattedWorldFieldGeometry, deriveBattedWorldFieldMotion, deriveInitialBattedWorldFieldMotion, battedWorldBaseSurfaceId } from './BattedWorldFieldMotion';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.5 };
const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.125 };
const geometry = () => {
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 1 });
  return createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: 0, z: 0 },
    firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } }, bases: {
    home: base(0, 0), first: base(3, 0), second: base(3, 3), third: base(0, 3) } },
    baseModels: { home: { bottomY: 0, material }, first: { bottomY: 0, material }, second: { bottomY: 0, material }, third: { bottomY: 0, material } } });
};
const fixture = () => {
  const contact = { tick: 0, ballCenter: v(1, 0.5, 0), point: v(1, 0.5, 0), batPoint: v(1, 0.5, 0), normal: v(1, 0, 0),
    segmentT: 0.5, exitVelocity: v(1, 0, 0), exitSpin: v(0, 0, 2) };
  const actors = [{ playerId: 'defender', primitive: { role: 'body' as const, radius: 0.125, startTick: 0, endTick: 5_000_000,
    ticksPerSecond: parameters.ticksPerSecond, startCenter: v(20, 0.5, 20), startVelocity: v(0, 0, 0), acceleration: v(0, 0, 0) } }];
  const response: BattedBallContactResponseInput = { world: { flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 5_000_000 }),
    parameters, throughTick: 5_000_000, actors, surfaces: [] }, actors: [{ playerId: 'defender', profile: { role: 'body', material } }], surfaces: [] };
  return { response, geometry: geometry(), availableAtTick: 0, throughTick: 5_000_000,
    commands: [{ playerId: 'defender', role: 'body' as const, acceleration: v(0, 0, 0) }] };
};
it('starts at original BatBallContact before an old free-flight forecast can cross a bag', () => {
  const input = fixture(), result = deriveInitialBattedWorldFieldMotion(input);
  expect(result.motion.world).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 1.625 },
    contacts: [{ kind: 'surface', surfaceId: battedWorldBaseSurfaceId('first') }] });
  expect(result.baseContacts).toMatchObject([{ kind: 'base', baseId: 'first' }]);
  expect(result.motion.cursor?.moment.ball.velocity.x).toBe(-0.5);
  expect(result.motion.cursor?.moment.ball.spin.z).toBe(1);
  expect(result.motion.response.kind).toBe('rebound');
  expect(input.response.world.flight.initialBall.position.x).toBe(1);
});
it('continues the actual rebound and actor basis without restoring the original flight', () => {
  const input = fixture(), first = deriveInitialBattedWorldFieldMotion(input);
  if (!first.motion.cursor) throw new Error('expected actual rebound cursor');
  const next = deriveBattedWorldFieldMotion({ ...input, cursor: first.motion.cursor, actors: first.motion.actors, carrierPlayerId: null, throughTick: 3_000_000 });
  expect(next.motion.response.kind).toBe('moving');
  expect(next.motion.cursor?.moment.ball.position.x).toBeCloseTo(1.9375, 12);
  expect(next.baseContacts).toHaveLength(0);
  expect(next).not.toHaveProperty('ruleResult');
});
it('leaves an initial bag overlap unresolved without moving the ball to a desired result', () => {
  const input = fixture(), ball = input.response.world.flight.initialBall;
  const result = deriveBattedWorldFieldMotion({ ...input, cursor: { moment: { originTick: 0, elapsedSeconds: 0,
    ball: { ...ball, position: v(3, 0.5, 0) } }, previousContacts: [] }, actors: input.response.world.actors, carrierPlayerId: null });
  expect(result.motion.response).toMatchObject({ kind: 'unresolved', reason: 'degenerate_normal', cursor: null });
  expect(result.motion.world.moment.ball.position).toEqual(v(3, 0.5, 0));
});
it('does not drop or free-rebound a secured ball whose carrying glove reaches a base', () => {
  const input = fixture(), actor = { ...input.response.world.actors[0], primitive: { ...input.response.world.actors[0].primitive,
    role: 'glove' as const, startCenter: v(1, 0.5, 0), startVelocity: v(1, 0, 0) } };
  const profile = { role: 'glove' as const, pocketCenterOffset: v(0, 0, 0), bodyStability: 1,
    parameters: { ticksPerSecond: 1_000_000, ballRadiusMeters: 0.125, ballMassKg: 0.145, pocketRadiusMeters: 0.2,
      centerRetentionCapacityJ: 10, captureDissipationPowerW: 100, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } };
  const response = { ...input.response, world: { ...input.response.world, actors: [actor] }, actors: [{ playerId: actor.playerId, profile }] };
  const result = deriveBattedWorldFieldMotion({ ...input, response, actors: [actor], carrierPlayerId: actor.playerId,
    cursor: { moment: { originTick: 0, elapsedSeconds: 0, ball: response.world.flight.initialBall }, previousContacts: [] },
    commands: [{ playerId: actor.playerId, role: 'glove', acceleration: v(0, 0, 0) }] });
  expect(result.motion.carrierPlayerId).toBe(actor.playerId);
  expect(result.motion.response).toEqual({ kind: 'unresolved', reason: 'carried_contact', cursor: null });
  expect(result.baseContacts[0].baseId).toBe('first');
  expect(result.motion.world.moment.ball.velocity.x).toBe(1);
});
it('requires explicit original thickness and material for every bag', () => {
  const original = geometry();
  expect(() => createBattedWorldFieldGeometry({ baseGeometry: original.baseGeometry,
    baseModels: { ...original.baseModels, first: { ...original.baseModels.first, bottomY: 1 } } })).toThrow();
  expect(() => createBattedWorldFieldGeometry({ baseGeometry: original.baseGeometry,
    baseModels: { ...original.baseModels, first: { bottomY: 0, material: { ...material, restitution: 2 } } } })).toThrow();
});
it('rejects reused wall/base identity, unknown previous base, incomplete profiles and result injection', () => {
  const input = fixture();
  const wall = { surfaceId: battedWorldBaseSurfaceId('first'), start: { x: 0, z: 0 }, end: { x: 0, z: 5 }, minimumHeight: 0, maximumHeight: 2 };
  expect(() => deriveInitialBattedWorldFieldMotion({ ...input, response: { ...input.response,
    world: { ...input.response.world, surfaces: [wall] }, surfaces: [{ surfaceId: wall.surfaceId, material }] } })).toThrow();
  expect(() => deriveInitialBattedWorldFieldMotion({ ...input, response: { ...input.response, actors: [] } })).toThrow();
  expect(() => deriveInitialBattedWorldFieldMotion({ ...input, afterWorld: input.response.world } as typeof input)).toThrow();
});
