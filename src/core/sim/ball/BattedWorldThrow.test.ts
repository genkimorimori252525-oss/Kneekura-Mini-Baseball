import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { deriveBattedWorldThrow } from './BattedWorldThrow';
import { deriveBattedWorldMotionAcquisition } from './BattedWorldAcquisition';
import { createDefensiveRatings } from '../../model/DefensiveRatings';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const fixture = (originTick = 0) => {
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.05 };
  const contact = { tick: originTick, ballCenter: v(0, 1, 0), point: v(0, 1, 0), batPoint: v(0, 1, 0), normal: v(0, 0, 1),
    segmentT: 0.5, exitVelocity: v(1, 0, 0), exitSpin: v(0, 0, 1) };
  const actors = ['carrier', 'receiver'].map((playerId) => ({ playerId, primitive: { role: 'glove' as const,
    radius: 0.05, startTick: originTick, endTick: originTick + 1_000_000, ticksPerSecond: parameters.ticksPerSecond,
    startCenter: playerId === 'carrier' ? v(0, 1, 0) : v(-10, 1, 0),
    startVelocity: playerId === 'carrier' ? v(1, 0, 0) : v(0, 0, 0), acceleration: v(0, 0, 0) } }));
  const profile = { role: 'glove' as const, pocketCenterOffset: v(0, 0, 0), bodyStability: 1,
    parameters: { ticksPerSecond: parameters.ticksPerSecond, ballMassKg: 0.145, ballRadiusMeters: 0.05, pocketRadiusMeters: 0.3,
      centerRetentionCapacityJ: 1000, captureDissipationPowerW: 1000, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } };
  const response: BattedBallContactResponseInput = { world: { flight: createBattedBallFlightEvidence({ contact, parameters,
    searchDurationTicks: 1_000_000 }), parameters, throughTick: originTick + 1_000_000, actors, surfaces: [] },
    actors: actors.map(({ playerId }) => ({ playerId, profile })), surfaces: [] };
  return { response, actors, carrierPlayerId: 'carrier', receiverPlayerId: 'receiver',
    cursor: { moment: { originTick, elapsedSeconds: 0.1, ball: { tick: originTick + 100_000, position: v(0, 1, 0), velocity: v(1, 0, 0), spin: v(0, 0, 1) } },
      previousContacts: [{ kind: 'actor' as const, playerId: 'carrier', role: 'glove' as const }] },
    availableAtTick: originTick + 100_000, throughTick: originTick + 500_000,
    commands: actors.map(({ playerId }) => ({ playerId, role: 'glove' as const, acceleration: v(0, 0, 0) })),
    ratings: createDefensiveRatings({ positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
      firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
      armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 }),
    transferParameters: { minimumTransferDelayTicks: 100_000, maximumTransferDelayTicks: 100_000, fixedGripOffsetTicks: 0 },
    throwCalibration: { minimumReleaseSpeedMps: 5, maximumReleaseSpeedMps: 5, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 },
    seed: { matchSeed: 42, playId: 1, streamKey: 'accepted-throw' } };
};
it('releases from the actual offset ball after carried transfer and advances free World motion', () => {
  const input = fixture(), result = deriveBattedWorldThrow(input);
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('released fixture');
  expect(result.transfer.throwReadyTick).toBe(200_000); expect(result.launch.origin).toEqual(v(0.1, 1, 0));
  expect(result.launch.intendedTarget).toEqual(v(-10, 1, 0)); expect(result.motion.carrierPlayerId).toBeNull();
  expect(result.motion.cursor?.moment.ball.position.x).toBeCloseTo(-1.4, 12);
  expect(result.motion.cursor?.moment.ball.spin).toEqual(input.cursor.moment.ball.spin);
  expect(input.cursor.moment.ball.position).toEqual(v(0, 1, 0)); expect(result).not.toHaveProperty('out');
});
it('supports zero transfer delay and preserves continuous geometry at a large exact clock', () => {
  const input = fixture(), zero = { minimumTransferDelayTicks: 0, maximumTransferDelayTicks: 0, fixedGripOffsetTicks: 0 };
  const small = deriveBattedWorldThrow({ ...input, transferParameters: zero }), large = deriveBattedWorldThrow({ ...fixture(2 ** 52), transferParameters: zero });
  expect(small.kind).toBe('released'); expect(large.kind).toBe('released');
  if (small.kind !== 'released' || large.kind !== 'released') throw new Error('released fixture');
  expect(small.launch.origin).toEqual(v(0, 1, 0)); expect(large.launch.origin).toEqual(small.launch.origin);
  expect(large.motion.cursor?.moment.ball.position).toEqual(small.motion.cursor?.moment.ball.position);
  expect(large.launch.releaseTick).toBe(2 ** 52 + 100_000);
});
it('checks a carried panel interruption before manufacturing a launch', () => {
  const input = fixture(), wall = { surfaceId: 'wall', start: { x: 0.1, z: -1 }, end: { x: 0.1, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
  const result = deriveBattedWorldThrow({ ...input, response: { ...input.response, world: { ...input.response.world, surfaces: [wall] },
    surfaces: [{ surfaceId: 'wall', material: { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 } }] } });
  expect(result.kind).toBe('interrupted'); expect(result).not.toHaveProperty('launch'); expect(result.motion.cursor).toBeNull();
  expect(result.motion.world.moment.elapsedSeconds).toBeCloseTo(0.15, 12);
});
it('uses new accepted acceleration during transfer and samples the receiver at the actual release', () => {
  const input = fixture(), actors = input.actors.map((actor) => actor.playerId !== 'receiver' ? actor : { ...actor,
    primitive: { ...actor.primitive, startVelocity: v(0, 0, 1) } });
  const result = deriveBattedWorldThrow({ ...input, actors, commands: input.commands.map((command) => command.playerId !== 'carrier' ? command
    : { ...command, acceleration: v(4, 0, 0) }) });
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('released fixture');
  expect(result.launch.origin.x).toBeCloseTo(0.12, 12); expect(result.launch.intendedTarget.z).toBeCloseTo(0.2, 12);
});
it('keeps a fractional secure moment distinct from the recorded release basis', () => {
  const input = fixture(), elapsedSeconds = 0.1000000004;
  const changed = { ...input, cursor: { ...input.cursor, moment: { ...input.cursor.moment, elapsedSeconds,
    ball: { ...input.cursor.moment.ball, tick: 100_001 } } }, transferParameters: { minimumTransferDelayTicks: 0, maximumTransferDelayTicks: 0, fixedGripOffsetTicks: 0 } };
  const result = deriveBattedWorldThrow(changed);
  expect(result.kind).toBe('released'); if (result.kind !== 'released') throw new Error('released fixture');
  expect(result.launch.origin.x).toBeCloseTo(0.0000009996, 14); expect(result.releaseCursor.moment.elapsedSeconds).toBe(0.100001);
});
it('leaves receiver contact as a candidate and requires actual acquisition before possession', () => {
  const input = fixture(), result = deriveBattedWorldThrow({ ...input, throughTick: 5_000_000 });
  expect(result.kind).toBe('released'); expect(result.motion.response.kind).toBe('capture_candidate'); expect(result.motion.cursor).toBeNull();
  const acquired = deriveBattedWorldMotionAcquisition({ response: input.response, motion: result.motion });
  expect(acquired.kind).toBe('secured'); expect(acquired.acquirerPlayerId).toBe('receiver');
  expect(acquired.contactMoment.elapsedSeconds).toBeCloseTo(2.2, 12);
});
it('queries another actual actor before the intended receiver after release', () => {
  const input = fixture(), body = { playerId: 'interceptor', primitive: { ...input.actors[0].primitive, role: 'body' as const,
    startCenter: v(-0.5, 1, 0), startVelocity: v(0, 0, 0) } };
  const result = deriveBattedWorldThrow({ ...input, actors: [...input.actors, body], commands: [...input.commands,
    { playerId: 'interceptor', role: 'body', acceleration: v(0, 0, 0) }], response: { ...input.response,
      actors: [...input.response.actors, { playerId: 'interceptor', profile: { role: 'body', material: { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 } } }] } });
  expect(result.kind).toBe('released'); expect(result.motion.world.kind).toBe('boundary'); expect(result.motion.response.kind).toBe('rebound');
  expect(result.motion.cursor?.moment.ball.velocity.x).toBeCloseTo(2.5, 12);
});
it.each(['carrier', 'receiver', 'future', 'horizon'] as const)('rejects invalid %s throw intent or actual state', (kind) => {
  const input = fixture(), changed = kind === 'carrier' ? { ...input, carrierPlayerId: null } : kind === 'receiver' ? { ...input, receiverPlayerId: 'missing' }
    : kind === 'future' ? { ...input, availableAtTick: 100_001 } : { ...input, throughTick: 150_000 };
  expect(() => deriveBattedWorldThrow(changed as typeof input)).toThrow();
});
