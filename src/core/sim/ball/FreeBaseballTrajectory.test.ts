import { expect, it } from 'vitest';
import { REFERENCE_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { createFreeBaseballTrajectory } from './FreeBaseballTrajectory';
import { advanceBaseballOrientation, IDENTITY_QUATERNION } from '../pitching/BaseballOrientation';

const input = {
  initialBall: { tick: 100_000, position: { x: 0, y: 1, z: 0 },
    velocity: { x: 12, y: 3, z: 6 }, spin: { x: 0, y: 12, z: 0 } },
  throughTick: 8_100_000,
  aerodynamics: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS },
  ground: { radiusM: 0.0366, inertiaRatio: 0.378, gravityMps2: 9.81, ticksPerSecond: 1_000_000,
    restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } },
};

it('continues actual post-impact velocity through aerodynamic flight, rebound and no-slip rolling', () => {
  const trajectory = createFreeBaseballTrajectory(input);
  expect(trajectory.samples[0].ball).toEqual(input.initialBall);
  expect(trajectory.groundContacts.length).toBeGreaterThan(1);
  const first = trajectory.groundContacts[0];
  expect(first.incoming.velocity.y).toBeLessThan(0);
  expect(first.outgoing.velocity.y).toBeGreaterThan(0);
  expect(first.incoming.tick).toBe(first.outgoing.tick);
  expect(trajectory.samples.some(s => s.phase === 'sliding')).toBe(true);
  expect(trajectory.samples.some(s => s.phase === 'rolling')).toBe(true);
  for (const sample of trajectory.samples) expect(sample.ball.position.y).toBeGreaterThanOrEqual(input.ground.radiusM - 1e-12);
  const last = trajectory.samples.at(-1)!;
  expect(last.ball.spin.z).toBeCloseTo(-last.ball.velocity.x / input.ground.radiusM, 8);
});

it('observes one physical path at different frame rates without changing its contacts or terminal state', () => {
  const trajectory = createFreeBaseballTrajectory(input);
  const sparse = [100_000, 1_100_000, 3_100_000, 8_100_000];
  const dense = Array.from({ length: 81 }, (_, i) => 100_000 + i * 100_000);
  const coarse = trajectory.observe(sparse), fine = trajectory.observe(dense);
  expect(coarse).toEqual(sparse.map(tick => fine.find(s => s.tick === tick)));
  expect(trajectory.observe([100_001])[0].ball.tick).toBe(100_001);
});

it('keeps the material orientation continuous through physical spin impulses', () => {
  const trajectory = createFreeBaseballTrajectory(input);
  for (const contact of trajectory.groundContacts) {
    const before = trajectory.observe([contact.incoming.tick - 1])[0];
    const after = trajectory.observe([contact.incoming.tick])[0];
    const distance = Math.hypot(...(['w', 'x', 'y', 'z'] as const).map(k => after.orientation[k] - before.orientation[k]));
    expect(distance).toBeLessThan(0.001);
  }
});

it('rejects mismatched radius/clock, incomplete horizons and unavailable observations', () => {
  expect(() => createFreeBaseballTrajectory({ ...input, ground: { ...input.ground, radiusM: 0.05 } })).toThrow();
  expect(() => createFreeBaseballTrajectory({ ...input, throughTick: Number.MAX_SAFE_INTEGER })).toThrow();
  const trajectory = createFreeBaseballTrajectory(input);
  expect(() => trajectory.observe([input.initialBall.tick - 1])).toThrow();
  expect(() => trajectory.observe([input.initialBall.tick, input.initialBall.tick])).toThrow();
});

it('validates original vertical coordinates and aerodynamic calibration even at zero duration', () => {
  const zero = { ...input, throughTick: input.initialBall.tick };
  expect(() => createFreeBaseballTrajectory({ ...zero, initialBall: { ...zero.initialBall,
    position: { ...zero.initialBall.position, y: NaN } } })).toThrow();
  expect(() => createFreeBaseballTrajectory({ ...zero, initialBall: { ...zero.initialBall,
    velocity: { ...zero.initialBall.velocity, y: NaN } } })).toThrow();
  expect(() => createFreeBaseballTrajectory({ ...zero, aerodynamics: { ...zero.aerodynamics,
    aerodynamics: { ...zero.aerodynamics.aerodynamics, airDensityKgM3: NaN } } })).toThrow();
});

it('detects a ground graze followed by Magnus lift inside one integration cell', () => {
  const graze = { ...input, initialBall: { tick: 0, position: { x: 0, y: input.ground.radiusM + 1e-7, z: 0 },
    velocity: { x: 60, y: -0.002, z: 0 }, spin: { x: 0, y: 0, z: 500 } }, throughTick: 1_000,
    aerodynamics: { ...input.aerodynamics, integrationStepTicks: 1_000 } };
  const result = createFreeBaseballTrajectory(graze);
  expect(result.groundContacts.length).toBeGreaterThan(0);
  for (const s of result.observe([0, 100, 200, 1_000])) expect(s.ball.position.y).toBeGreaterThanOrEqual(input.ground.radiusM);
});

it('splits orientation integration at an actual rolling stop even for a coarse caller lattice', () => {
  const rolling = { ...input, initialBall: { tick: 0, position: { x: 0, y: input.ground.radiusM, z: 0 },
    velocity: { x: 1, y: 0, z: 0 }, spin: { x: 0, y: 0, z: -1 / input.ground.radiusM } }, throughTick: 2_000_000,
    aerodynamics: { ...input.aerodynamics, integrationStepTicks: 2_000_000 } };
  const expected = advanceBaseballOrientation(IDENTITY_QUATERNION, { x: 0, y: 0, z: -0.5 / input.ground.radiusM }, 1);
  const result = createFreeBaseballTrajectory(rolling).samples.at(-1)!;
  for (const axis of ['w', 'x', 'y', 'z'] as const) expect(result.orientation[axis]).toBeCloseTo(expected[axis], 10);
});
