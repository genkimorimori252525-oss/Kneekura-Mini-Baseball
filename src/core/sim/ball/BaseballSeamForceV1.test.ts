import { describe, expect, it } from 'vitest';
import { calculateBaseballAerodynamics, REFERENCE_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { advanceAerodynamicPitchState, sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';
import { IDENTITY_QUATERNION, multiplyQuaternions, quaternionFromAxisAngle, rotateVectorByQuaternion } from '../pitching/BaseballOrientation';
import { createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { boundSourceRk4PositionSpeed } from './SourceFreeBallSpeedBound';
import { createFreeBaseballTrajectory } from './FreeBaseballTrajectory';
import { baseballSeamPointV1, validateBaseballMaterialOrientationV1 } from './BaseballSeamForceV1';

const seamForce = { version: 'baseball_seam_force_v1' as const, coefficientScale: 1 };
const q = quaternionFromAxisAngle({ x: 1, y: 2, z: 3 }, .8);
const air = { ...REFERENCE_BASEBALL_AERODYNAMICS, seamForce };
const velocity = { x: 11, y: 3, z: -29 }, zero = { x: 0, y: 0, z: 0 };
const dot = (a: typeof zero, b: typeof zero) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: typeof zero) => Math.hypot(a.x, a.y, a.z);
const params = { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: air };
const ball = { tick: 10, position: { x: 0, y: 3, z: 18 }, velocity, spin: { x: 1, y: 3, z: .4 } };
const profile = { kind: 'aero_ground_v1' as const, air: params, ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81,
  radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4, slidingFriction: .25,
    rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } };

describe('v78 optional material seam force', () => {
  it('adds bounded transverse force to a nonspinning asymmetric ball and requires explicit material phase', () => {
    const state = calculateBaseballAerodynamics(velocity, zero, air, q);
    expect(state.seamAcceleration).toBeDefined();
    expect(norm(state.seamAcceleration!)).toBeGreaterThan(.01);
    expect(Math.abs(dot(state.seamAcceleration!, velocity))).toBeLessThan(1e-9);
    expect(state.seamCoefficientUsed).toBeLessThanOrEqual(.25);
    expect(() => calculateBaseballAerodynamics(velocity, zero, air)).toThrow('material orientation');
  });
  it('rotates with the entire physical frame and is invariant to the quaternion sign', () => {
    const turn = quaternionFromAxisAngle({ x: -.4, y: 1, z: .6 }, 1.2), base = calculateBaseballAerodynamics(velocity, zero, air, q);
    expect(base.seamAcceleration).toBeDefined();
    const rotated = calculateBaseballAerodynamics(rotateVectorByQuaternion(velocity, turn), zero, air, multiplyQuaternions(turn, q));
    const expected = rotateVectorByQuaternion(base.seamAcceleration!, turn);
    for (const k of ['x', 'y', 'z'] as const) expect(rotated.seamAcceleration![k]).toBeCloseTo(expected[k], 10);
    expect(calculateBaseballAerodynamics(velocity, zero, air, { w: -q.w, x: -q.x, y: -q.y, z: -q.z }).seamAcceleration).toEqual(base.seamAcceleration);
  });
  it('preserves legacy shape and arithmetic when omitted or explicitly zero', () => {
    const old = calculateBaseballAerodynamics(velocity, zero, REFERENCE_BASEBALL_AERODYNAMICS);
    expect(old).not.toHaveProperty('seamAcceleration');
    expect(calculateBaseballAerodynamics(velocity, zero, { ...air, seamForce: { ...seamForce, coefficientScale: 0 } })).toEqual(old);
    const legacyParams = { ...params, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS };
    expect(advanceAerodynamicPitchState(ball, 20_000, legacyParams)).not.toHaveProperty('materialOrientation');
    expect(advanceAerodynamicPitchState(ball, 20_000, { ...params, aerodynamics: { ...air, seamForce: { ...seamForce, coefficientScale: 0 } } })).toEqual(advanceAerodynamicPitchState(ball, 20_000, legacyParams));
  });
  it('carries integrated material phase through Source cells, truncation, reversal and a new impulse basis', () => {
    const descriptor = { kind: 'aero_ground_continuous_source_kernel_v2' as const, initial: { originTick: 10, elapsedSeconds: 0, ball },
      throughElapsedSeconds: .2, profile, materialOrientationAtStart: q };
    const kernel = createSourceFreeBallKernel(descriptor), at = kernel.evaluateAt(.08), repeated = kernel.evaluateAt(.08);
    expect(at.materialOrientation).toEqual(repeated.materialOrientation);
    expect(at.materialOrientation).not.toEqual(q);
    expect(createSourceFreeBallKernel({ ...descriptor, throughElapsedSeconds: .1 }).evaluateAt(.08)).toEqual(at);
    const changed = { ...at.moment.ball, spin: { x: -3, y: 1, z: 4 } }, next = createSourceFreeBallKernel({ ...descriptor,
      initial: { ...at.moment, ball: changed }, materialOrientationAtStart: at.materialOrientation, throughElapsedSeconds: .12 });
    expect(next.evaluateAt(.08).materialOrientation).toEqual(at.materialOrientation);
    expect(next.evaluateAt(.1).materialOrientation).not.toEqual(at.materialOrientation);
    const direct = sampleAerodynamicPitchStateAtElapsedSeconds(ball, .002, params, q);
    expect(kernel.evaluateAt(.002).materialOrientation).toEqual(direct.materialOrientation);
    const { materialOrientationAtStart: _phase, ...missingPhase } = descriptor;
    expect(() => createSourceFreeBallKernel(missingPhase)).toThrow('material orientation');
  });
  it('rejects malformed force parameters even on a zero-length trajectory', () => {
    for (const invalid of [{ version: 'other', coefficientScale: 1 }, { ...seamForce, coefficientScale: NaN }, { ...seamForce, coefficientScale: -1 },
      { ...seamForce, coefficientScale: 2.1 }, { ...seamForce, unwanted: 1 }]) {
      expect(() => calculateBaseballAerodynamics(zero, zero, { ...air, seamForce: invalid } as never, IDENTITY_QUATERNION)).toThrow();
    }
    expect(() => advanceAerodynamicPitchState(ball, 0, params)).toThrow('material orientation');
    expect(() => sampleAerodynamicPitchStateAtElapsedSeconds(ball, 0, params)).toThrow('material orientation');
    let calls = 0;
    const getter = { x: 0, y: 0, z: 0 };
    Object.defineProperty(getter, 'w', { enumerable: true, get() { calls++; return 1; } });
    expect(() => validateBaseballMaterialOrientationV1(getter)).toThrow();
    expect(calls).toBe(0);
    expect(() => validateBaseballMaterialOrientationV1({ ...q, [Symbol('hidden')]: 1 })).toThrow();
  });
  it('uses the same closed unit seam curve, air-relative speed squared and no spin cutoff', () => {
    for (const t of [0, .7, 1.9, 4.3, 2 * Math.PI]) expect(norm(baseballSeamPointV1(t))).toBeCloseTo(1, 14);
    const base = calculateBaseballAerodynamics(velocity, zero, air, q), wind = { x: 4, y: -2, z: 1 },
      shifted = calculateBaseballAerodynamics({ x: velocity.x + wind.x, y: velocity.y + wind.y, z: velocity.z + wind.z }, zero, { ...air, windVelocityMps: wind }, q),
      twice = calculateBaseballAerodynamics({ x: velocity.x * 2, y: velocity.y * 2, z: velocity.z * 2 }, zero, air, q),
      fast = calculateBaseballAerodynamics(velocity, { x: 300, y: 500, z: 100 }, air, q);
    expect(shifted.seamAcceleration).toEqual(base.seamAcceleration);
    expect(fast.seamAcceleration).toEqual(base.seamAcceleration);
    for (const k of ['x', 'y', 'z'] as const) expect(twice.seamAcceleration![k]).toBeCloseTo(base.seamAcceleration![k] * 4, 12);
    for (let i = 0; i < 30; i++) {
      const phase = quaternionFromAxisAngle({ x: 1, y: .2, z: -.7 }, i * .17), current = calculateBaseballAerodynamics(velocity, zero,
        { ...air, seamForce: { ...seamForce, coefficientScale: 2 } }, phase);
      expect(current.seamCoefficientUsed).toBeLessThanOrEqual(.5);
      expect(dot(current.totalAcceleration, velocity)).toBeLessThan(0);
    }
  });
  it('converges with the RK4 stage phase, keeps energy dissipative, and bounds the dense source speed', () => {
    const initial = { ...ball, spin: { x: 160, y: -140, z: 80 } }, parameters = { ...params, integrationStepTicks: 250 },
      refined = { ...parameters, integrationStepTicks: 125 }, coarse = sampleAerodynamicPitchStateAtElapsedSeconds(initial, .03, parameters, q),
      fine = sampleAerodynamicPitchStateAtElapsedSeconds(initial, .03, refined, q);
    expect(norm({ x: coarse.position.x - fine.position.x, y: coarse.position.y - fine.position.y, z: coarse.position.z - fine.position.z })).toBeLessThan(1e-7);
    const energy = (s: typeof ball) => dot(s.velocity, s.velocity) / 2 - params.gravityY * s.position.y;
    expect(energy(coarse)).toBeLessThan(energy(initial));
    const bound = boundSourceRk4PositionSpeed(initial, .00025, parameters);
    for (let i = 1; i < 12; i++) {
      const t = .00025 * i / 12, h = 1e-9, before = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t - h, parameters, q),
        after = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t + h, parameters, q);
      expect(norm({ x: (after.position.x - before.position.x) / (2 * h), y: (after.position.y - before.position.y) / (2 * h),
        z: (after.position.z - before.position.z) / (2 * h) })).toBeLessThanOrEqual(bound + 1e-4);
    }
    const trajectory = createFreeBaseballTrajectory({ initialBall: initial, throughTick: initial.tick + 30_000,
      aerodynamics: parameters, ground: profile.ground, orientationAtStart: q });
    const observed = trajectory.observe([initial.tick + 30_000])[0];
    for (const k of ['x', 'y', 'z'] as const) expect(observed.ball.position[k]).toBeCloseTo(coarse.position[k], 10);
    for (const k of ['w', 'x', 'y', 'z'] as const) expect(observed.orientation[k]).toBeCloseTo(coarse.materialOrientation![k], 12);
  });
  it('limits every seam Source cell to a quarter-radian using the shared Aero step without altering the header', () => {
    const initial = { ...ball, spin: { x: 900, y: 500, z: -200 } }, parameters = { ...params, integrationStepTicks: 5_000 },
      descriptor = { kind: 'aero_ground_continuous_source_kernel_v2' as const, initial: { originTick: 10, elapsedSeconds: 0, ball: initial },
        throughElapsedSeconds: .02, profile: { ...profile, air: parameters }, materialOrientationAtStart: q },
      kernel = createSourceFreeBallKernel(descriptor), direct = sampleAerodynamicPitchStateAtElapsedSeconds(initial, .02, parameters, q),
      fine = sampleAerodynamicPitchStateAtElapsedSeconds(initial, .02, { ...parameters, integrationStepTicks: 100 }, q);
    expect(kernel.descriptor.profile.air.integrationStepTicks).toBe(5_000);
    for (const cell of kernel.cells) expect((cell.throughElapsedSeconds - cell.fromElapsedSeconds) * norm(initial.spin)).toBeLessThanOrEqual(.25 + 1e-12);
    for (const k of ['x', 'y', 'z'] as const) {
      expect(kernel.evaluateAt(.02).moment.ball.position[k]).toBeCloseTo(direct.position[k], 10);
      expect(direct.position[k]).toBeCloseTo(fine.position[k], 7);
    }
  });
  it('preserves material phase through a floor impulse and later rolling/resting boundaries', () => {
    const initial = { ...ball, position: { x: 0, y: .05, z: 0 }, velocity: { x: 2, y: -2, z: -1 } },
      kernel = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
        initial: { originTick: 10, elapsedSeconds: 0, ball: initial }, throughElapsedSeconds: 2, profile, materialOrientationAtStart: q }),
      floor = kernel.boundaries.find(b => b.kind === 'ground')!;
    expect(floor).toBeDefined();
    expect(kernel.evaluateAt(floor.elapsedSeconds, 'outgoing').materialOrientation).toEqual(kernel.evaluateAt(floor.elapsedSeconds, 'incoming').materialOrientation);
    expect(kernel.evaluateAt(2).materialOrientation).toBeDefined();
    expect(kernel.evaluateAt(2).moment.ball.position.y).toBeGreaterThanOrEqual(profile.ground.radiusM);
  });
  it('changes transverse force smoothly with seam phase in two orthogonal slow-rotation presentations', () => {
    // Qualitative seam dependence/sign reversal only; this does not fit measured 2S/4S curves.
    for (const axis of [{ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }]) {
      const samples = Array.from({ length: 129 }, (_, i) => calculateBaseballAerodynamics({ x: 30, y: 0, z: 0 }, zero, air,
        quaternionFromAxisAngle(axis, i / 128 * 2 * Math.PI)).seamAcceleration!);
      const projection = axis.z ? samples.map(a => a.y) : samples.map(a => a.z);
      expect(Math.max(...projection)).toBeGreaterThan(.01);
      expect(Math.min(...projection)).toBeLessThan(-.01);
      expect(norm({ x: samples[0].x - samples[128].x, y: samples[0].y - samples[128].y, z: samples[0].z - samples[128].z })).toBeLessThan(1e-12);
      for (let i = 1; i < samples.length; i++) expect(norm({ x: samples[i].x - samples[i - 1].x,
        y: samples[i].y - samples[i - 1].y, z: samples[i].z - samples[i - 1].z })).toBeLessThan(1);
    }
  });
});
