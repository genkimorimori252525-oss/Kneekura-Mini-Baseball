import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import { deriveBattedWorldMotion } from './BattedWorldMotion';
import { deriveBattedWorldMotionAcquisition } from './BattedWorldAcquisition';
import { quantizeEventTick } from '../ExactEventTime';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const fixture = (originTick = 0) => {
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.1 }, elapsedSeconds = 0.1000000004;
  const contact = { tick: originTick, ballCenter: v(0, 1, 0), point: v(0, 1, 0), batPoint: v(0, 1, 0), normal: v(0, 0, 1),
    segmentT: 0.5, exitVelocity: v(0, 0, 10), exitSpin: v(0, 0, 0) };
  const actors = [{ playerId: 'acquirer', primitive: { role: 'glove' as const, radius: 0.1, startTick: originTick,
    endTick: originTick + 1_000_000, ticksPerSecond: parameters.ticksPerSecond, startCenter: v(0, 1, 1.2),
    startVelocity: v(0, 0, 2), acceleration: v(0, 0, 0) } }];
  const response: BattedBallContactResponseInput = { world: { flight: createBattedBallFlightEvidence({ contact, parameters,
    searchDurationTicks: 1_000_000 }), parameters, throughTick: originTick + 1_000_000, actors, surfaces: [] },
    actors: [{ playerId: 'acquirer', profile: { role: 'glove', pocketCenterOffset: v(0, 0, -0.2), bodyStability: 1,
      parameters: { ticksPerSecond: parameters.ticksPerSecond, ballMassKg: 0.145, ballRadiusMeters: 0.1, pocketRadiusMeters: 0.3,
        centerRetentionCapacityJ: 1000, captureDissipationPowerW: 725, failedContactRestitution: 0.5,
        failedTangentialDamping: 0, failedSpinDamping: 0 } } }], surfaces: [] };
  const input = { response, actors, cursor: { moment: { originTick, elapsedSeconds,
    ball: { tick: originTick + 100_001, position: v(0, 1, 0), velocity: v(0, 0, 10), spin: v(0, 0, 0) } }, previousContacts: [] },
    carrierPlayerId: null, availableAtTick: originTick, throughTick: originTick + 1_000_000,
    commands: [{ playerId: 'acquirer', role: 'glove' as const, acceleration: v(0, 0, 2) }] };
  return { response, input };
};
it('acquires from the actual later fractional motion contact and carries from its true secure basis', () => {
  const { response, input } = fixture(), motion = deriveBattedWorldMotion(input);
  expect(motion.response.kind).toBe('capture_candidate');
  const result = deriveBattedWorldMotionAcquisition({ response, motion });
  expect(result.kind).toBe('secured');
  if (result.kind !== 'secured' || motion.world.kind !== 'boundary') throw new Error('secured fixture');
  const contact = motion.world.contacts[0];
  if (contact.kind !== 'actor') throw new Error('glove fixture');
  expect(result.contactMoment).toEqual(motion.world.moment);
  expect(result.contactMoment.elapsedSeconds).toBeGreaterThan(0.25);
  const dt = result.moment.elapsedSeconds - result.contactMoment.elapsedSeconds;
  expect(result.moment.ball.position.z).toBeCloseTo(result.contactMoment.ball.position.z + contact.velocity.z * dt + dt * dt, 12);
  expect(result.moment.ball.velocity.z).toBeCloseTo(contact.velocity.z + 2 * dt, 12);
  expect(result.secureTick).toBe(quantizeEventTick(0, result.moment.elapsedSeconds, response.world.parameters.ticksPerSecond));
  const carry = deriveBattedWorldMotion({ ...input, actors: motion.actors, cursor: { moment: result.moment,
    previousContacts: [{ kind: 'actor', playerId: result.acquirerPlayerId, role: 'glove' }] }, carrierPlayerId: result.acquirerPlayerId });
  expect(carry.response.kind).toBe('carried');
  expect(result.transport.contactOffset.z).toBeCloseTo(-0.2, 12);
  expect(response.world.actors[0].primitive.startCenter.z).toBe(1.2);
});
it('keeps geometry identical at a large original tick', () => {
  const small = fixture(), large = fixture(2 ** 52);
  const a = deriveBattedWorldMotionAcquisition({ response: small.response, motion: deriveBattedWorldMotion(small.input) });
  const b = deriveBattedWorldMotionAcquisition({ response: large.response, motion: deriveBattedWorldMotion(large.input) });
  expect(b.contactMoment.ball.position).toEqual(a.contactMoment.ball.position);
  expect(b.transport).toEqual(a.transport);
});
it('requires accepted actor coverage through actual settling rather than extending its earlier motion horizon', () => {
  const { response, input } = fixture(), motion = deriveBattedWorldMotion(input);
  expect(() => deriveBattedWorldMotionAcquisition({ response, motion: { ...motion,
    actors: motion.actors.map((actor) => ({ ...actor, primitive: { ...actor.primitive, endTick: motion.world.moment.ball.tick } })) } })).toThrow(/coverage/);
});
it('does not adopt an ordinary motion cursor or an already carried ball as another acquisition', () => {
  const { response, input } = fixture();
  const moving = deriveBattedWorldMotion({ ...input, throughTick: 200_000 });
  expect(() => deriveBattedWorldMotionAcquisition({ response, motion: moving })).toThrow(/candidate/);
  const candidate = deriveBattedWorldMotion(input);
  expect(() => deriveBattedWorldMotionAcquisition({ response, motion: { ...candidate, carrierPlayerId: 'acquirer' } })).toThrow(/candidate/);
});
it('searches all World surfaces during later capture instead of accepting a local retention candidate', () => {
  const { response, input } = fixture(), candidate = deriveBattedWorldMotion(input), at = candidate.world.moment.ball.position.z;
  const wall = { surfaceId: 'wall', start: { x: -1, z: at + 0.105 }, end: { x: 1, z: at + 0.105 }, minimumHeight: 0, maximumHeight: 2 };
  const result = deriveBattedWorldMotionAcquisition({ response: { ...response, world: { ...response.world, surfaces: [wall] } }, motion: candidate });
  expect(result.kind).toBe('interrupted');
  if (result.kind !== 'interrupted') throw new Error('interrupted fixture');
  expect(result.world.contacts).toContainEqual(expect.objectContaining({ kind: 'surface', surfaceId: 'wall' }));
  expect(result).not.toHaveProperty('secureTick'); expect(result).not.toHaveProperty('ballAfterDrop');
});
