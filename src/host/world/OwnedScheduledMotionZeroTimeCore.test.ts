import { expect, it } from 'vitest';
import * as support from './OwnedScheduledMotionZeroTime.test-support';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { deriveBallWorldFieldContinuation, type BallWorldMoment, type BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { respondToBattedWorldBoundary } from '../../core/sim/ball/BattedWorldContinuation';
import { prepareBattedWorldPiecewiseFieldAcquisition, deriveBattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { geometry } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import type { BallFlightParameters } from '../../core/sim/ball/BallFlight';

type Tangent = (initial: BallWorldMoment, parameters: BallFlightParameters, ground: boolean) => {
  anchor: BallWorldMoment; contactElapsedSeconds: number; actor: BallWorldMotionActor;
};

it.each([false, true])('reconstructs original-source zero-energy tangent geometry with grounded=%s', ground => {
  expect(support).toHaveProperty('ownedZeroTimeTangentSource');
  const tangent = Reflect.get(support, 'ownedZeroTimeTangentSource') as Tangent;
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRestitution: 0, groundRollingDecelerationMps2: 4 };
  const v = (x: number, y: number, z: number) => ({ x, y, z });
  const contact = { tick: 10_000, ballCenter: v(0.35, 1.1, 0.7), point: v(0.35, 1.1, 0.7), batPoint: v(0.35, 1.1, 0.7), normal: v(0, 0, 1),
    segmentT: 0.5, exitVelocity: v(0, 0, 10), exitSpin: v(0, 0, 0) };
  const flight = createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 0 });
  const initial = { originTick: contact.tick, elapsedSeconds: 0, ball: flight.initialBall }, bytes = JSON.stringify(initial);
  const source = tangent(initial, parameters, ground), throughTick = source.actor.primitive.endTick;
  expect(source.actor.primitive.radius).toBeGreaterThan(0.01); expect(source.actor.primitive.radius).toBeLessThan(0.1);
  if (ground) { expect(source.anchor.elapsedSeconds).toBeGreaterThan(0); expect(source.anchor.ball.velocity).toEqual(v(0, 0, 0)); }
  const result = deriveBallWorldFieldContinuation({ moment: source.anchor, throughTick, parameters, actors: [source.actor], surfaces: [], previousContacts: [], bases: geometry(1000).bases, previousBaseContacts: [] });
  const world = result.kind === 'boundary' ? { ...result, contacts: result.contacts.filter(c => c.kind !== 'base') } : result;
  expect(world.kind).toBe('boundary');
  expect(world.moment.elapsedSeconds).toBe(source.contactElapsedSeconds);
  if (world.kind !== 'boundary' || world.contacts[0].kind !== 'actor') throw new Error('tangent boundary');
  expect(world.contacts).toHaveLength(1); expect(world.contacts[0].velocity).toEqual(world.moment.ball.velocity);
  const profile = { role: 'glove' as const, pocketCenterOffset: v(0, 0, -0.08), bodyStability: 1,
    parameters: { ticksPerSecond: parameters.ticksPerSecond, ballMassKg: 0.145, ballRadiusMeters: parameters.ballRadius,
      pocketRadiusMeters: 0.2, centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1000,
      failedContactRestitution: 0.5, failedTangentialDamping: 0.25, failedSpinDamping: 0.2 } };
  const response = { world: { flight, parameters, throughTick, actors: [source.actor], surfaces: [] }, actors: [{ playerId: source.actor.playerId, profile }], surfaces: [] };
  const answer = respondToBattedWorldBoundary(response, { moment: source.anchor, previousContacts: [] }, world);
  expect(answer.kind).toBe('capture_candidate');
  const field = { motion: { actors: [source.actor], carrierPlayerId: null, world, response: answer, cursor: answer.cursor }, baseContacts: [] };
  const plan = prepareBattedWorldPiecewiseFieldAcquisition({ response, geometry: geometry(1000), field });
  expect(plan.initialEnergyJ).toBe(0); expect(plan.secureElapsedSeconds).toBe(source.contactElapsedSeconds);
  expect(plan.fenceElapsedSeconds).toBe(source.contactElapsedSeconds);
  const progress = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps: [{ throughElapsedSeconds: source.contactElapsedSeconds, actors: { kind: 'retained' } }] });
  expect(progress.kind).toBe('secured'); expect(JSON.stringify(initial)).toBe(bytes);
});

it('exports the Native zero-time fixture required by the preserved consumer test', () => {
  expect(support).toHaveProperty('ownedZeroTimeChainFixture');
  expect(typeof Reflect.get(support, 'ownedZeroTimeChainFixture')).toBe('function');
});
