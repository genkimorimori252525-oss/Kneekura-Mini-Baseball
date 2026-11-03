import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { calculateBaseballAerodynamics } from './BaseballAerodynamics';
import { resolveBaseballAerodynamicCoefficients } from './BaseballAerodynamicCoefficientProfile';
import { createAeroGroundBallPhysicsProfile, type AeroGroundBallPhysicsV1 } from './VersionedBattedBallPhysics';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';

it('is bit-for-bit equal to the pinned v97 Core for authored coefficients, force and fractional RK4 samples', () => {
  const bytes = readFileSync('../../outputs/ばせぼーるlv97_TBD_vs_LAD_投球手と球種方向の連動版.html');
  expect(createHash('sha256').update(bytes).digest('hex'))
    .toBe('252b7a9808b1d234e1d26777a8b781905f56a05f236864d8388d494843b9caa6');
  const core = [...bytes.toString('utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('var KneekuraNativeMatchCore ='))!;
  const marker = 'return __toCommonJS(browser_exports);';
  expect(core.split(marker)).toHaveLength(2);
  // Test-only access to existing closure functions. The original calculations
  // and authored physical parameters are unchanged; no product file is edited.
  const realm = vm.createContext({ structuredClone, performance });
  vm.runInContext(core.replace(marker, `return { physics: LIVE_MATCH_PHYSICS_V1,
    coefficients: resolveBaseballAerodynamicCoefficients, force: calculateBaseballAerodynamics,
    sample: sampleAerodynamicPitchStateAtElapsedSeconds };`), realm);
  const raw = structuredClone(vm.runInContext('KneekuraNativeMatchCore.physics', realm)) as AeroGroundBallPhysicsV1;
  const owned = createAeroGroundBallPhysicsProfile(raw), coefficients = owned.air.aerodynamics.coefficientProfile!;
  const adjacent = (n: number) => [Math.max(0, n - 1e-12), n, n + 1e-12];
  const pairs = [0, .001, .063, .173, .42, 1,
    ...coefficients.spinKnots.flatMap(k => adjacent(k.spinFactor)),
    ...adjacent(coefficients.reynoldsCorrectionFullThroughSpinFactor),
    ...adjacent(coefficients.reynoldsCorrectionZeroAtSpinFactor)]
    .flatMap(spinFactor => [0, 140123.456, 900000,
      ...coefficients.reynoldsKnots.flatMap(k => adjacent(k.reynoldsNumber))]
      .map(reynoldsNumber => ({ spinFactor, reynoldsNumber })));
  realm.inputJson = JSON.stringify(pairs);
  const referenceCoefficients = structuredClone(vm.runInContext(`JSON.parse(inputJson).map(row =>
    KneekuraNativeMatchCore.coefficients(KneekuraNativeMatchCore.physics.air.aerodynamics.coefficientProfile,
      row.reynoldsNumber, row.spinFactor))`, realm));
  expect(pairs.map(row => resolveBaseballAerodynamicCoefficients(coefficients, row.reynoldsNumber, row.spinFactor)))
    .toStrictEqual(referenceCoefficients);
  const ball = { tick: 1234567, position: { x: .17, y: 2.1, z: 17.8 },
    velocity: { x: -1.7, y: 2.3, z: -42 }, spin: { x: -230, y: 15, z: 10 } };
  const cases = [0, .00000035, .000001, .005, .017123456, .121234567].map(t => ({ ball, t }));
  realm.inputJson = JSON.stringify(cases);
  const referenceSamples = structuredClone(vm.runInContext(`JSON.parse(inputJson).map(row => ({
    force: KneekuraNativeMatchCore.force(row.ball.velocity, row.ball.spin, KneekuraNativeMatchCore.physics.air.aerodynamics),
    state: KneekuraNativeMatchCore.sample(row.ball, row.t, KneekuraNativeMatchCore.physics.air)
  }))`, realm));
  expect(cases.map(row => ({ force: calculateBaseballAerodynamics(row.ball.velocity, row.ball.spin, owned.air.aerodynamics),
    state: sampleAerodynamicPitchStateAtElapsedSeconds(row.ball, row.t, owned.air) }))).toStrictEqual(referenceSamples);
}, 30000);
