import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createFreeBaseballTrajectory } from './FreeBaseballTrajectory';
import { createAeroGroundBallPhysicsProfile, createAeroGroundBattedBallFlightEvidence,
  createVersionedFreeBallTrajectory, type AeroGroundBallPhysicsV1 } from './VersionedBattedBallPhysics';

const profile = (): AeroGroundBallPhysicsV1 => ({ kind: 'aero_ground_v1',
  air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
  ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378,
    restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } });
const ball = { tick: 123_456, position: { x: 0, y: 1, z: 0 }, velocity: { x: 12, y: 3, z: 6 }, spin: { x: 0, y: 12, z: -50 } };

it('retains explicit physical values as a detached, deeply immutable profile with no implicit material', () => {
  const raw = profile(), actual = createAeroGroundBallPhysicsProfile(raw);
  expect(actual).toEqual(raw);
  expect(actual).not.toBe(raw);
  expect(Object.isFrozen(actual.ground.material)).toBe(true);
  expect(Object.isFrozen(actual.air.aerodynamics.coefficientProfile!.spinKnots[0])).toBe(true);
  expect(() => createAeroGroundBallPhysicsProfile({ ...raw, ground: { ...raw.ground, material: undefined } })).toThrow();
});

it('reuses precisely the Core Aero/ground path, including incoming ground spin and subsequent rolling', () => {
  const p = profile(), endTick = ball.tick + 8_000_000;
  const actual = createVersionedFreeBallTrajectory(ball, endTick, p);
  const original = createFreeBaseballTrajectory({ initialBall: ball, throughTick: endTick, aerodynamics: p.air, ground: p.ground });
  const ticks = [ball.tick, ball.tick + 500_123, ball.tick + 2_000_000, endTick];
  expect(actual.observe(ticks)).toEqual(original.observe(ticks));
  expect(actual.groundContacts).toEqual(original.groundContacts);
  const first = actual.groundContacts[0];
  expect(first.incoming.spin).not.toEqual(ball.spin);
  expect(first.outgoing.spin).not.toEqual(first.incoming.spin);
});

it('uses coupled spin friction for a physically sliding floor state before no-slip rolling', () => {
  const p = profile(), initial = { ...ball, position: { ...ball.position, y: p.ground.radiusM },
    velocity: { x: 6, y: 0, z: 0 }, spin: { x: 0, y: 12, z: 0 } };
  const trajectory = createVersionedFreeBallTrajectory(initial, initial.tick + 3_000_000, p);
  expect(trajectory.samples[0].phase).toBe('sliding');
  expect(trajectory.samples.some(s => s.phase === 'rolling')).toBe(true);
  const end = trajectory.samples.at(-1)!.ball;
  expect(end.spin.z).toBeCloseTo(-end.velocity.x / p.ground.radiusM, 8);
});

it('derives evidence only from actual contact velocity/spin and the incoming physical floor contact', () => {
  const contact = { tick: ball.tick, ballCenter: ball.position, exitVelocity: ball.velocity, exitSpin: ball.spin,
    point: ball.position, batPoint: ball.position, normal: { x: 0, y: 1, z: 0 }, segmentT: 0.72 };
  const p = profile(), horizon = 2_000_000;
  const trajectory = createVersionedFreeBallTrajectory(ball, ball.tick + horizon, p);
  const flight = createAeroGroundBattedBallFlightEvidence(contact, horizon, p);
  expect(flight.initialBall).toEqual(ball);
  expect(flight.firstGroundContact).toEqual({ tick: trajectory.groundContacts[0].incoming.tick,
    state: trajectory.groundContacts[0].incoming });
  expect(flight.firstGroundContact!.state.velocity.y).toBeLessThan(0);
  expect(flight).not.toHaveProperty('officialResult');
});

it('rejects mismatched geometry/clock, nonfinite or unknown values and accessors without invoking them', () => {
  const p = profile();
  for (const raw of [
    { ...p, kind: 'unknown_v1' }, { ...p, result: 'home_run' },
    { ...p, ground: { ...p.ground, radiusM: 0.04 } },
    { ...p, ground: { ...p.ground, ticksPerSecond: 1 } },
    { ...p, air: { ...p.air, gravityY: NaN } },
    { ...p, air: { ...p.air, aerodynamics: { ...p.air.aerodynamics, power: 999 } } },
  ]) expect(() => createAeroGroundBallPhysicsProfile(raw)).toThrow();
  let calls = 0;
  const accessor = { ...p };
  Object.defineProperty(accessor, 'air', { enumerable: true, get() { calls++; return p.air; } });
  expect(() => createAeroGroundBallPhysicsProfile(accessor)).toThrow('accessors');
  expect(calls).toBe(0);
});

it('preserves common source-clock samples across longer horizon and observation cadence', () => {
  const p = profile(), short = createVersionedFreeBallTrajectory(ball, ball.tick + 1_000_000, p);
  const longer = createVersionedFreeBallTrajectory(ball, ball.tick + 2_000_000, p);
  const ticks = [ball.tick, ball.tick + 101_111, ball.tick + 777_777, ball.tick + 1_000_000];
  expect(short.observe(ticks)).toEqual(longer.observe(ticks));
  expect(longer.observe(ticks)).toEqual(ticks.map(tick => longer.observe([tick])[0]));
});
