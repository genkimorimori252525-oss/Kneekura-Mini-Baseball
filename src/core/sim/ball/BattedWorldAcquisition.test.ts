import { expect, it } from 'vitest';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import { deriveBattedWorldAcquisition } from './BattedWorldAcquisition';
import { quantizeEventTick } from '../ExactEventTime';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const p = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.1 };
const material = { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 };
const original = (gloveSpeed = 0, gloveZ = 1.2, power = 725): BattedBallContactResponseInput => {
  const contact = { tick: 0, ballCenter: v(0, 1, 0), point: v(0, 1, 0), batPoint: v(0, 1, 0),
    normal: v(0, 0, 1), segmentT: 0.5, exitVelocity: v(0, 0, 10), exitSpin: v(0, 0, 0) };
  return { world: { flight: createBattedBallFlightEvidence({ contact, parameters: p, searchDurationTicks: 1_000_000 }), parameters: p,
    throughTick: 1_000_000, actors: [{ playerId: 'acquirer', primitive: { role: 'glove', radius: 0.1, startTick: 0, endTick: 1_000_000,
      ticksPerSecond: p.ticksPerSecond, startCenter: v(0, 1, gloveZ), startVelocity: v(0, 0, gloveSpeed), acceleration: v(0, 0, 0) } }], surfaces: [] },
    actors: [{ playerId: 'acquirer', profile: { role: 'glove', pocketCenterOffset: v(0, 0, -0.2), bodyStability: 1,
      parameters: { ticksPerSecond: p.ticksPerSecond, ballMassKg: 0.145, ballRadiusMeters: 0.1, pocketRadiusMeters: 0.3,
        centerRetentionCapacityJ: 1000, captureDissipationPowerW: power, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } } }], surfaces: [] };
};
it('owns an uninterrupted original glove capture and dissipates its actual contact energy', () => {
  const result = deriveBattedWorldAcquisition({ response: original(), throughTicks: [] });
  expect(result.kind).toBe('secured');
  expect(result.acquirerPlayerId).toBe('acquirer');
  expect(result.contactMoment.elapsedSeconds).toBeCloseTo(0.1, 12);
  expect(result.candidateSecureTick).toBe(110_000);
  expect(result.transport.remainingEnergyJ).toBe(0);
  expect(result.transport.initialEnergyJ).toBeCloseTo(7.25, 12);
  expect(result.transport.contactOffset.z).toBeCloseTo(-0.2, 12);
  if (result.kind !== 'secured') throw new Error('secured fixture');
  expect(result.secureTick).toBe(110_000);
  expect(result.moment.ball.position).toEqual(result.contactMoment.ball.position);
  expect(result.moment.ball.velocity).toEqual(v(0, 0, 0));
  expect(result).not.toHaveProperty('out'); expect(result).not.toHaveProperty('playEnd');
});
it('moves the constrained ball with the original glove while preserving the actual contact offset', () => {
  const result = deriveBattedWorldAcquisition({ response: original(2), throughTicks: [] });
  expect(result.kind).toBe('secured');
  if (result.kind !== 'secured') throw new Error('secured fixture');
  expect(result.contactMoment.ball.position.z).toBeCloseTo(1.25, 12);
  expect(result.moment.ball.position.z).toBeCloseTo(1.2628, 12);
  expect(result.moment.ball.velocity).toEqual(v(0, 0, 2));
  expect(result.secureTick).toBe(131_400);
});
it('quantizes the true continuous root plus settling time once without rewriting the archived retention tick', () => {
  const result = deriveBattedWorldAcquisition({ response: original(0, 1.200000004, 720), throughTicks: [] });
  expect(result.kind).toBe('secured');
  if (result.kind !== 'secured') throw new Error('secured fixture');
  expect(result.secureTick).toBe(quantizeEventTick(0, result.contactMoment.elapsedSeconds + 7.25 / 720, p.ticksPerSecond));
  expect(result.archivedCandidateSecureTick).toBe(result.secureTick + 1);
});
it('searches a finite surface over the capture interval instead of accepting the candidate as possession', () => {
  const input = original(2);
  const wall = { surfaceId: 'capture-wall', start: { x: -1, z: 1.36 }, end: { x: 1, z: 1.36 }, minimumHeight: 0, maximumHeight: 2 };
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, surfaces: [wall] },
    surfaces: [{ surfaceId: wall.surfaceId, material }] }, throughTicks: [] });
  expect(result.kind).toBe('interrupted');
  if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.world.kind).toBe('boundary');
  expect(result.world.contacts).toContainEqual(expect.objectContaining({ kind: 'surface', surfaceId: wall.surfaceId }));
  expect(result.transport.remainingEnergyJ).toBeGreaterThan(0);
  expect(result).not.toHaveProperty('ballAfterDrop');
});
it.each(['acquirer', 'rival'])('checks %s body primitives as well as its glove during capture', (playerId) => {
  const input = original(2);
  const body = { playerId, primitive: { ...input.world.actors[0].primitive, role: 'body' as const,
    startCenter: v(0, 1, 2.75), startVelocity: v(0, 0, -10) } };
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, actors: [...input.world.actors, body] },
    actors: [...input.actors, { playerId, profile: { role: 'body', material } }] }, throughTicks: [] });
  expect(result.kind).toBe('interrupted');
  if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.world.contacts).toContainEqual(expect.objectContaining({ kind: 'actor', playerId, role: 'body' }));
});
it('requires complete original actor coverage until the derived secure deadline', () => {
  const input = original(0, 1.2, 1);
  expect(() => deriveBattedWorldAcquisition({ response: input, throughTicks: [] })).toThrow(/coverage/);
});
it('does not manufacture acquisition from an unresolved or ordinary flight prefix', () => {
  const input = original();
  expect(() => deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, actors: [] }, actors: [] }, throughTicks: [] })).toThrow(/candidate/);
});
it('owns a later glove candidate from the actual rebound prefix rather than the original bat flight', () => {
  const input = original(0, -0.4);
  const body = { playerId: 'first-touch', primitive: { ...input.world.actors[0].primitive, role: 'body' as const, startCenter: v(0, 1, 0.6) } };
  const glove = input.actors[0].profile;
  if (glove.role !== 'glove') throw new Error('glove fixture');
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, actors: [body, ...input.world.actors] },
    actors: [{ playerId: body.playerId, profile: { role: 'body', material } }, { ...input.actors[0], profile: { ...glove, pocketCenterOffset: v(0, 0, 0.2) } }] },
    throughTicks: [1_000_000] });
  expect(result.kind).toBe('secured');
  expect(result.contactMoment.elapsedSeconds).toBeCloseTo(0.16, 12);
  expect(result.transport.initialEnergyJ).toBeCloseTo(1.8125, 12);
  if (result.kind !== 'secured') throw new Error('secured fixture');
  expect(result.secureTick).toBe(162_500);
});
it('preserves a competitor at the same recorded tick even just after the continuous secure deadline', () => {
  const input = original(2, 1.2, 720);
  const wall = { surfaceId: 'same-tick-wall', start: { x: -1, z: 1.3628892 }, end: { x: 1, z: 1.3628892 }, minimumHeight: 0, maximumHeight: 2 };
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, surfaces: [wall] },
    surfaces: [{ surfaceId: wall.surfaceId, material }] }, throughTicks: [] });
  expect(result.kind).toBe('interrupted');
  if (result.kind !== 'interrupted') throw new Error('same-tick fixture');
  expect(result.reason).toBe('same_tick_competition');
  expect(result.world.moment.ball.tick).toBe(result.candidateSecureTick);
  expect(result.transport.remainingEnergyJ).toBe(0);
  expect(result).not.toHaveProperty('secureTick');
});
it('searches actual descending ground contact during retained glove transport', () => {
  const input = original(2, 1.2, 4000);
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, actors: [{ ...input.world.actors[0],
    primitive: { ...input.world.actors[0].primitive, startCenter: v(0, 7.25, 1.2), startVelocity: v(0, -50, 2) } }] } }, throughTicks: [] });
  expect(result.kind).toBe('interrupted');
  if (result.kind !== 'interrupted') throw new Error('ground fixture');
  expect(result.world.contacts).toContainEqual(expect.objectContaining({ kind: 'ground' }));
  expect(result.world.moment.ball.position.y).toBeCloseTo(p.ballRadius, 12);
});
it('allows zero-energy retention to secure at actual contact without a fixed delay', () => {
  const input = original(0, 0.2), contact = { ...input.world.flight.contact, exitVelocity: v(0, 0, 0) };
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world,
    flight: createBattedBallFlightEvidence({ contact, parameters: p, searchDurationTicks: 1_000_000 }) } }, throughTicks: [] });
  expect(result.kind).toBe('secured');
  if (result.kind !== 'secured') throw new Error('zero-energy fixture');
  expect(result.secureTick).toBe(0); expect(result.transport.initialEnergyJ).toBe(0);
});
it('dissipates original spin energy in the effective capture system as well as translational energy', () => {
  const input = original(), contact = { ...input.world.flight.contact, exitSpin: v(0, 0, 100) };
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world,
    flight: createBattedBallFlightEvidence({ contact, parameters: p, searchDurationTicks: 1_000_000 }) } }, throughTicks: [] });
  expect(result.kind).toBe('secured');
  if (result.kind !== 'secured') throw new Error('spin fixture');
  expect(result.retention.diagnostics.rotationalEnergyJ).toBeCloseTo(2.9, 12);
  expect(result.transport.initialEnergyJ).toBeCloseTo(10.15, 12);
  expect(result.secureTick).toBe(114_000); expect(result.moment.ball.spin).toEqual(v(0, 0, 0));
});
it('uses the glove constraint over a long capture interval instead of restoring free gravity', () => {
  const input = original(0, 1.2, 7.25), parameters = { ...p, gravityY: -10 };
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, parameters,
    flight: createBattedBallFlightEvidence({ contact: input.world.flight.contact, parameters, searchDurationTicks: 1_000_000 }),
    actors: [{ ...input.world.actors[0], primitive: { ...input.world.actors[0].primitive, endTick: 3_000_000 } }] } }, throughTicks: [] });
  expect(result.kind).toBe('secured');
  if (result.kind !== 'secured') throw new Error('constraint fixture');
  expect(result.moment.ball.position).toEqual(result.contactMoment.ball.position);
  expect(result.secureTick).toBeGreaterThan(1_000_000);
});
it('keeps exact original integer clock ownership at a large match tick', () => {
  const input = original(), origin = 2 ** 52;
  const contact = { ...input.world.flight.contact, tick: origin };
  const result = deriveBattedWorldAcquisition({ response: { ...input, world: { ...input.world, throughTick: origin + 1_000_000,
    flight: createBattedBallFlightEvidence({ contact, parameters: p, searchDurationTicks: 1_000_000 }),
    actors: input.world.actors.map((actor) => ({ ...actor, primitive: { ...actor.primitive, startTick: origin, endTick: origin + 1_000_000 } })) } }, throughTicks: [] });
  expect(result.kind).toBe('secured');
  if (result.kind !== 'secured') throw new Error('large-clock fixture');
  expect(result.contactMoment.originTick).toBe(origin); expect(result.secureTick).toBe(origin + 110_000);
  expect(result.contactMoment.elapsedSeconds).toBeCloseTo(0.1, 12);
});
it('rejects positive retention energy when its settling interval underflows to zero', () => {
  const input = original(0, 1.2, 1e308), profile = input.actors[0].profile;
  if (profile.role !== 'glove') throw new Error('glove fixture');
  const response = { ...input, actors: [{ ...input.actors[0], profile: { ...profile,
    parameters: { ...profile.parameters, ballMassKg: 1e-310 } } }] };
  expect(() => deriveBattedWorldAcquisition({ response, throughTicks: [] })).toThrow(/precision/);
});
