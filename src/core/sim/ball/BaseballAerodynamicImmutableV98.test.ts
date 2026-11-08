import { expect, it } from 'vitest';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { calculateBaseballAerodynamics, prepareOwnedBaseballAerodynamicsV98,
  REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { prepareOwnedBaseballCoefficientProfileV98, resolveBaseballAerodynamicCoefficients } from './BaseballAerodynamicCoefficientProfile';
import { createAeroGroundBallPhysicsProfile, type AeroGroundBallPhysicsV1 } from './VersionedBattedBallPhysics';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';
import { IDENTITY_QUATERNION, quaternionFromAxisAngle } from '../pitching/BaseballOrientation';

const profile = (): AeroGroundBallPhysicsV1 => cloneInert({ kind: 'aero_ground_v1',
  air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
  ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: .0366, inertiaRatio: .378,
    restingVerticalSpeedMps: .15, material: { restitution: .4, slidingFriction: .25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } });
const velocity = { x: 2, y: -1, z: -38 }, spin = { x: -180, y: 12, z: 7 };

/** Transparent allocation probe, isolated to the synchronous operation. It does
 * not stub validation, change profile data or replace coefficient arithmetic. */
const countArrayMaps = (operation: () => void): number => {
  const original = Array.prototype.map;
  let calls = 0;
  Array.prototype.map = function (this: unknown[], ...args: Parameters<typeof original>) {
    calls++;
    return Reflect.apply(original, this, args);
  } as typeof original;
  try { operation(); } finally { Array.prototype.map = original; }
  return calls;
};

it('does not rebuild static coefficient arrays during repeated owned-profile force evaluations', () => {
  const owned = createAeroGroundBallPhysicsProfile(profile()).air.aerodynamics;
  const expected = calculateBaseballAerodynamics(velocity, spin, owned);
  let result = expected;
  const allocations = countArrayMaps(() => {
    for (let i = 0; i < 16; i++) result = calculateBaseballAerodynamics(velocity, spin, owned);
  });
  expect(result).toStrictEqual(expected);
  expect(allocations).toBe(0);
});

it('retains exactly the raw interpolation at every knot, adjacent value, blend boundary and extrapolation', () => {
  const raw = profile().air.aerodynamics.coefficientProfile!,
    owned = createAeroGroundBallPhysicsProfile(profile()).air.aerodynamics.coefficientProfile!;
  const adjacent = (n: number) => [Math.max(0, n - 1e-12), n, n + 1e-12];
  const spins = [0, 1e-14, .017, .073, .173, .63, 3,
    ...raw.spinKnots.flatMap(k => adjacent(k.spinFactor)),
    ...adjacent(raw.reynoldsCorrectionFullThroughSpinFactor),
    ...adjacent(raw.reynoldsCorrectionZeroAtSpinFactor)];
  const reynolds = [0, 1, 140_123.321, 900_000,
    ...raw.reynoldsKnots.flatMap(k => adjacent(k.reynoldsNumber))];
  for (const re of reynolds) for (const s of spins)
    expect(resolveBaseballAerodynamicCoefficients(owned, re, s))
      .toStrictEqual(resolveBaseballAerodynamicCoefficients(raw, re, s));
});

it('retains exact force and RK4 states for wind, spin decay, seam phase and zero-force branches', () => {
  const q = quaternionFromAxisAngle({ x: 1, y: 2, z: -.5 }, .7);
  for (const density of [0, 1.225]) for (const seam of [undefined, 0, 1]) {
    const base = profile(), raw = { ...base, air: { ...base.air, aerodynamics: {
      ...base.air.aerodynamics, airDensityKgM3: density, windVelocityMps: { x: 3, y: -1, z: 2 },
      ...(seam === undefined ? {} : { seamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: seam } }),
    } } }, owned = createAeroGroundBallPhysicsProfile(raw);
    for (const v of [velocity, raw.air.aerodynamics.windVelocityMps]) for (const s of [spin, { x: 0, y: 0, z: 0 }]) {
      expect(calculateBaseballAerodynamics(v, s, owned.air.aerodynamics, q))
        .toStrictEqual(calculateBaseballAerodynamics(v, s, raw.air.aerodynamics, q));
      const ball = { tick: 123456, position: { x: .2, y: 2, z: 17 }, velocity: v, spin: s };
      for (const t of [0, .00000035, .002, .027123456])
        expect(sampleAerodynamicPitchStateAtElapsedSeconds(ball, t, owned.air, q))
          .toStrictEqual(sampleAerodynamicPitchStateAtElapsedSeconds(ball, t, raw.air, q));
    }
    if (seam === 1) expect(() => calculateBaseballAerodynamics(velocity, spin, owned.air.aerodynamics)).toThrow('material orientation');
  }
});

it('does not treat raw or shallow-frozen profiles, arrays or wind as owned validation results', () => {
  const raw = profile(), aero = raw.air.aerodynamics, coefficients = aero.coefficientProfile!;
  const first = resolveBaseballAerodynamicCoefficients(coefficients, 123456, .14);
  (coefficients.spinKnots[3] as { liftCoefficient: number }).liftCoefficient *= .5;
  expect(resolveBaseballAerodynamicCoefficients(coefficients, 123456, .14)).not.toStrictEqual(first);
  Object.freeze(coefficients);
  Object.freeze(coefficients.spinKnots);
  (coefficients.spinKnots[1] as { spinFactor: number }).spinFactor = -.1;
  expect(() => resolveBaseballAerodynamicCoefficients(coefficients, 123456, .14)).toThrow('strictly increasing');
  const rawAir = profile().air.aerodynamics;
  calculateBaseballAerodynamics(velocity, spin, rawAir);
  Object.freeze(rawAir);
  (rawAir.windVelocityMps as { x: number }).x = NaN;
  expect(() => calculateBaseballAerodynamics(velocity, spin, rawAir)).toThrow('windVelocityMps');
});

it('keeps same-ID profiles independent and detaches owned coefficients from later raw edits', () => {
  const a = profile(), b = profile();
  (b.air.aerodynamics.coefficientProfile!.spinKnots[3] as { liftCoefficient: number }).liftCoefficient = .5;
  const ownedA = createAeroGroundBallPhysicsProfile(a), ownedB = createAeroGroundBallPhysicsProfile(b),
    before = calculateBaseballAerodynamics(velocity, spin, ownedA.air.aerodynamics);
  expect(calculateBaseballAerodynamics(velocity, spin, ownedB.air.aerodynamics)).not.toStrictEqual(before);
  (a.air.aerodynamics.coefficientProfile!.spinKnots[2] as { liftCoefficient: number }).liftCoefficient = NaN;
  expect(calculateBaseballAerodynamics(velocity, spin, ownedA.air.aerodynamics)).toStrictEqual(before);
  expect(() => createAeroGroundBallPhysicsProfile(a)).toThrow();
  expect(() => resolveBaseballAerodynamicCoefficients(ownedA.air.aerodynamics.coefficientProfile!, NaN, .1)).toThrow('finite');
  expect(() => resolveBaseballAerodynamicCoefficients(ownedA.air.aerodynamics.coefficientProfile!, 100000, -.1)).toThrow('non-negative');
});

it('retains descriptor-safe boundary validation even on frozen objects and nested accessors', () => {
  let calls = 0;
  const raw = profile(), coefficients = { ...raw.air.aerodynamics.coefficientProfile! };
  Object.defineProperty(coefficients, 'spinKnots', { enumerable: true, get() { calls++; return raw.air.aerodynamics.coefficientProfile!.spinKnots; } });
  Object.freeze(coefficients);
  const withAccessor = { ...raw, air: { ...raw.air, aerodynamics: { ...raw.air.aerodynamics, coefficientProfile: coefficients } } };
  Object.freeze(withAccessor);
  expect(() => createAeroGroundBallPhysicsProfile(withAccessor)).toThrow('accessors');
  expect(calls).toBe(0);
  const owned = createAeroGroundBallPhysicsProfile(profile());
  let windReads = 0;
  const external = { ...owned.air.aerodynamics };
  Object.defineProperty(external, 'windVelocityMps', { enumerable: true, get() { windReads++; return { x: NaN, y: 0, z: 0 }; } });
  Object.freeze(external);
  expect(() => calculateBaseballAerodynamics(velocity, spin, external, IDENTITY_QUATERNION)).toThrow('windVelocityMps');
  expect(windReads).toBeGreaterThan(0);
});

it('registers only deeply frozen inert data and rejects accessors without invoking them', () => {
  const raw = profile().air.aerodynamics, coefficients = raw.coefficientProfile!;
  expect(() => prepareOwnedBaseballCoefficientProfileV98(coefficients)).toThrow('deeply frozen inert');
  Object.freeze(coefficients);
  Object.freeze(coefficients.spinKnots);
  Object.freeze(coefficients.reynoldsKnots);
  expect(() => prepareOwnedBaseballCoefficientProfileV98(coefficients)).toThrow('deeply frozen inert');
  Object.freeze(raw);
  expect(() => prepareOwnedBaseballAerodynamicsV98(raw)).toThrow('deeply frozen inert');
  let reads = 0;
  const accessor = { ...profile().air.aerodynamics };
  Object.defineProperty(accessor, 'windVelocityMps', { enumerable: true, get() { reads++; return { x: 0, y: 0, z: 0 }; } });
  Object.freeze(accessor);
  expect(() => prepareOwnedBaseballAerodynamicsV98(accessor)).toThrow('deeply frozen inert');
  expect(reads).toBe(0);
});

it('does not infer ownership just from a frozen input and still checks invalid immutable data before registration', () => {
  const freeze = <T>(value: T): T => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const externallyFrozen = freeze(profile().air.aerodynamics), expected = calculateBaseballAerodynamics(velocity, spin, externallyFrozen);
  let result = expected;
  expect(countArrayMaps(() => { result = calculateBaseballAerodynamics(velocity, spin, externallyFrozen); })).toBeGreaterThan(0);
  expect(result).toStrictEqual(expected);
  const invalid = profile().air.aerodynamics;
  (invalid.coefficientProfile!.spinKnots[2] as { spinFactor: number }).spinFactor = -.5;
  freeze(invalid);
  expect(() => prepareOwnedBaseballAerodynamicsV98(invalid)).toThrow('strictly increasing');
  expect(() => calculateBaseballAerodynamics(velocity, spin, invalid)).toThrow('strictly increasing');
  const inherited = Object.create(externallyFrozen);
  Object.freeze(inherited);
  expect(() => prepareOwnedBaseballAerodynamicsV98(inherited)).toThrow('deeply frozen inert');
});
