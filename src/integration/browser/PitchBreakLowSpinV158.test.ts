import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { PITCH_BREAK_LOW_SPIN_PROTOCOL_V158, createPitchBreakLowSpinCasesV158, analyzePitchBreakLowSpinCasesV158 } from '../../../tools/verification/pitch-break-low-spin-v158';
import { simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { setPitchMovementLevelV92 } from './PitchMovementV92';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import type { LiveMeasuredClipV1, LivePitchInputV1 } from './LivePitchV1';
import type { SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle, rotateVectorByQuaternion } from '../../core/sim/pitching/BaseballOrientation';
import type { Vec3 } from '../../core/model/geometry';

const norm = (value:Vec3) => Math.hypot(value.x, value.y, value.z),
  dot = (one:Vec3, two:Vec3) => one.x * two.x + one.y * two.y + one.z * two.z,
  angle = (one:Vec3, two:Vec3) => Math.acos(Math.max(-1, Math.min(1, dot(one, two) / (norm(one) * norm(two))))),
  frozenTree = (value:unknown):boolean => value === null || typeof value !== 'object' || Object.isFrozen(value) && Object.values(value).every(frozenTree);
type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]:Mutable<T[Key]> } : T;
const mutableCopy = (source:SourceFreeBallDescriptorV2) => structuredClone(source) as Mutable<SourceFreeBallDescriptorV2>;
let descriptor:SourceFreeBallDescriptorV2, original:SourceFreeBallDescriptorV2, generated:ReturnType<typeof createPitchBreakLowSpinCasesV158>;
beforeAll(() => {
  // Reuse the V156 public curve/level4/seed3 release. No selected successful flight or measured empirical curve is imported.
  const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[],
    base:LivePitchInputV1 = { originTick:1_000_000, seed:3,
      batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R', timingStdSeconds:0, aimStdMeters:0 },
      pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:0, heightMeters:1.9, moundPosition:LIVE_MATCH_MOUND_SURFACE_V1 },
      measuredClips:clips, batting:'take', pitchType:'curve', location:'zone', physics:LIVE_MATCH_PHYSICS_V1 },
    preset = createPitchSnapshotFromPresetV78({ presetId:'curve', pitchId:'public-feasibility-curve', physical:base.pitcher }),
    pitch = setPitchMovementLevelV92({ pitch:preset, level:4 }),
    observed = simulatePitcherWorkbenchV77({ pitch:{ ...base, pitchId:pitch.pitchId,
      pitcher:{ ...base.pitcher, pitchRepertoireV78:{ version:'pitch_repertoire_v78', pitches:[pitch] } } } });
  descriptor = structuredClone(observed.pitch.diagnostics.sourceDescriptor);original = structuredClone(descriptor);
  generated = createPitchBreakLowSpinCasesV158(descriptor);
});

it('generates all sixty-four controls on one reference clock, preserves the release/profile and isolates half-step refinement', () => {
  const step = resolveAerodynamicIntegrationStepTicksV1(descriptor.initial.ball.spin, descriptor.profile.air),
    expected = new Set<string>(), key = (factors:typeof generated.cases[number]['factors']) =>
      [factors.spinScale, factors.gyroDegrees, factors.materialPhaseDegrees].join('|');
  for (const scale of [.02, .1, .3, 1]) for (const gyro of [0, 30, 60, 85]) for (const phase of [0, 90, 180, 270])
    expected.add([scale, gyro, phase].join('|'));
  expect(generated.cases).toHaveLength(64);expect(new Set(generated.cases.map(item => item.id)).size).toBe(64);
  expect(new Set(generated.cases.map(item => key(item.factors)))).toStrictEqual(expected);
  expect(generated.clock).toStrictEqual({ ticksPerSecond:descriptor.profile.air.ticksPerSecond,
    originalNominalStepTicks:descriptor.profile.air.integrationStepTicks, commonIntegrationStepTicks:step });
  const half = createPitchBreakLowSpinCasesV158(descriptor, 2), halfStep = Math.max(1, Math.floor(step / 2)),
    originalCases = new Map(generated.cases.map(item => [key(item.factors), item] as const));
  expect(half.cases).toHaveLength(64);expect(half.clock.commonIntegrationStepTicks).toBe(halfStep);
  for (const matrix of [generated, half]) for (const item of matrix.cases) {
    const source = item.descriptor;
    expect(source.kind).toBe(descriptor.kind);expect(source.throughElapsedSeconds).toBe(descriptor.throughElapsedSeconds);
    expect(source.initial.originTick).toBe(descriptor.initial.originTick);expect(source.initial.elapsedSeconds).toBe(descriptor.initial.elapsedSeconds);
    expect(source.initial.ball.tick).toBe(descriptor.initial.ball.tick);
    expect(source.initial.ball.position).toStrictEqual(descriptor.initial.ball.position);
    expect(source.initial.ball.velocity).toStrictEqual(descriptor.initial.ball.velocity);
    expect(source.profile).toStrictEqual({ ...descriptor.profile, air:{ ...descriptor.profile.air, integrationStepTicks:matrix.clock.commonIntegrationStepTicks } });
    expect(norm(source.initial.ball.spin)).toBeCloseTo(norm(descriptor.initial.ball.spin) * item.factors.spinScale, 12);
    expect(resolveAerodynamicIntegrationStepTicksV1(source.initial.ball.spin, source.profile.air)).toBe(matrix.clock.commonIntegrationStepTicks);
    if (matrix === half) {
      const unrefined = originalCases.get(key(item.factors))!.descriptor;
      expect(source).toStrictEqual({ ...unrefined, profile:{ ...unrefined.profile, air:{ ...unrefined.profile.air, integrationStepTicks:halfStep } } });
    }
  }
  expect(descriptor).toStrictEqual(original);
});

it('defines gyro from the air-perpendicular spin plane and applies each world material phase by left multiplication', () => {
  // A nonidentity saved basis exposes a mistaken body-right multiplication; no new physical trial is run.
  const source = { ...structuredClone(descriptor), materialOrientationAtStart:quaternionFromAxisAngle({ x:0, y:1, z:0 }, .7) },
    before = structuredClone(source), cases = createPitchBreakLowSpinCasesV158(source).cases,
    velocity = source.initial.ball.velocity, wind = source.profile.air.aerodynamics.windVelocityMps,
    relative = { x:velocity.x - wind.x, y:velocity.y - wind.y, z:velocity.z - wind.z },
    airUnit = { x:relative.x / norm(relative), y:relative.y / norm(relative), z:relative.z / norm(relative) },
    projection = dot(source.initial.ball.spin, airUnit), perpendicular = { x:source.initial.ball.spin.x - airUnit.x * projection,
      y:source.initial.ball.spin.y - airUnit.y * projection, z:source.initial.ball.spin.z - airUnit.z * projection };
  for (const item of cases) {
    const spin = item.descriptor.initial.ball.spin, factors = item.factors, orientation = item.descriptor.materialOrientationAtStart!;
    expect(angle(spin, relative)).toBeCloseTo((90 - factors.gyroDegrees) * Math.PI / 180, 12);
    expect(dot(spin, perpendicular)).toBeGreaterThan(0);
    expect(dot(spin, airUnit) / norm(spin)).toBeCloseTo(Math.sin(factors.gyroDegrees * Math.PI / 180), 12);
    if (factors.materialPhaseDegrees === 0) expect(orientation).toStrictEqual(source.materialOrientationAtStart);
    else {
      const expected = normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(spin, factors.materialPhaseDegrees * Math.PI / 180), source.materialOrientationAtStart));
      expect(Math.hypot(orientation.w, orientation.x, orientation.y, orientation.z)).toBeCloseTo(1, 12);
      for (const basis of [{ x:1, y:0, z:0 }, { x:0, y:1, z:0 }, { x:0, y:0, z:1 }]) {
        const actual = rotateVectorByQuaternion(basis, orientation), wanted = rotateVectorByQuaternion(basis, expected);
        for (const axis of ['x', 'y', 'z'] as const) expect(actual[axis]).toBeCloseTo(wanted[axis], 12);
      }
    }
  }
  expect(source).toStrictEqual(before);
});

it('freezes owned data only and rejects absent saved controls, zero spin, parallel or antiparallel spin planes', () => {
  expect(frozenTree(PITCH_BREAK_LOW_SPIN_PROTOCOL_V158)).toBe(true);expect(frozenTree(generated)).toBe(true);
  expect(Object.isFrozen(descriptor)).toBe(false);expect(Object.isFrozen(descriptor.initial.ball.position)).toBe(false);
  const missingMaterial = mutableCopy(descriptor), missingSeam = mutableCopy(descriptor), missingDecay = mutableCopy(descriptor),
    zeroSpin = mutableCopy(descriptor), parallel = mutableCopy(descriptor), antiparallel = mutableCopy(descriptor),
    velocity = descriptor.initial.ball.velocity, wind = descriptor.profile.air.aerodynamics.windVelocityMps,
    relative = { x:velocity.x - wind.x, y:velocity.y - wind.y, z:velocity.z - wind.z };
  delete missingMaterial.materialOrientationAtStart;delete missingSeam.profile.air.aerodynamics.seamForce;delete missingDecay.profile.air.aerodynamics.spinDecay;
  zeroSpin.initial.ball.spin = { x:0, y:0, z:0 };parallel.initial.ball.spin = relative;
  antiparallel.initial.ball.spin = { x:-relative.x, y:-relative.y, z:-relative.z };
  for (const invalid of [missingMaterial, missingSeam, missingDecay, zeroSpin, parallel, antiparallel]) {
    const before = structuredClone(invalid);expect(() => createPitchBreakLowSpinCasesV158(invalid)).toThrow();expect(invalid).toStrictEqual(before);
  }
  expect(descriptor).toStrictEqual(original);
});

// These are synthetic observation summaries for a pure predicate, not generated or empirical ball trajectories.
type Comparison = Parameters<typeof analyzePitchBreakLowSpinCasesV158>[0][number];
const comparison = (id:string, commonAmount:number, planeAmount=commonAmount, p50Fraction=.25, late20Fraction=.25):Comparison => ({
  id, factors:{ spinScale:.02, gyroDegrees:0, materialPhaseDegrees:id === 'a' ? 0 : 90 },
  commonTime:{ status:'CLASSIFIED', amountMeters:commonAmount, direction:{ x:1, y:0 }, p50Fraction, late20Fraction },
  samePlane:{ status:'CLASSIFIED', amountMeters:planeAmount, direction:{ x:1, y:0 } },
});
function analyzePair(a:Comparison, b:Comparison) {
  const input = [a, b], before = structuredClone(input), result = analyzePitchBreakLowSpinCasesV158(input);
  expect(input).toStrictEqual(before);expect(result.pairs).toHaveLength(1);return result.pairs[0];
}

it('requires both absolute and relative amount limits in both bases instead of a maximum-of-floor tolerance', () => {
  const small = analyzePair(comparison('a', .01), comparison('b', .011, .011, .5)),
    large = analyzePair(comparison('a', 1), comparison('b', 1.03, 1.03, .5));
  expect(small.eligible).toBe(true);expect(small.absoluteAmountMatched).toBe(true);expect(small.relativeAmountMatched).toBe(false);
  expect(small.commonTimeRelativeAmountDifference).toBeCloseTo(.001 / .0105, 12);
  expect(small.samePlaneRelativeAmountDifference).toBeCloseTo(.001 / .0105, 12);
  expect(large.eligible).toBe(true);expect(large.absoluteAmountMatched).toBe(false);expect(large.relativeAmountMatched).toBe(true);
  expect(large.commonTimeRelativeAmountDifference).toBeCloseTo(.03 / 1.015, 12);
  for (const pair of [small, large]) { expect(pair.matchedAmountAndDirection).toBe(false);expect(pair.timeShapeCandidate).toBe(false); }
  for (const pair of [analyzePair(comparison('a', .5, .01), comparison('b', .51, .011, .5)),
    analyzePair(comparison('a', .01, .5), comparison('b', .011, .51, .5))]) {
    expect(pair.absoluteAmountMatched).toBe(true);expect(pair.relativeAmountMatched).toBe(false);expect(pair.timeShapeCandidate).toBe(false);
  }
});

it('keeps low-band timing candidates distinct from the large-amount band and supports either declared timing difference', () => {
  for (const [amount, planeAmount, largeAmountBand] of [[.01, .01, false], [.11, .09, false], [.1, .1, true], [.5, .5, true]] as const) {
    const pair = analyzePair(comparison('a', amount, planeAmount), comparison('b', amount, planeAmount, .375));
    expect(pair.eligible).toBe(true);expect(pair.absoluteAmountMatched).toBe(true);expect(pair.relativeAmountMatched).toBe(true);
    expect(pair.directionMatched).toBe(true);expect(pair.matchedAmountAndDirection).toBe(true);
    expect(pair.timeShapeCandidate).toBe(true);expect(pair.largeAmountBand).toBe(largeAmountBand);
  }
  const lateOnly = analyzePair(comparison('a', .5), comparison('b', .5, .5, .25, .375));
  expect(lateOnly.timeShapeCandidate).toBe(true);
  const sameTiming = analyzePair(comparison('a', .5), comparison('b', .5));
  expect(sameTiming.matchedAmountAndDirection).toBe(true);expect(sameTiming.timeShapeCandidate).toBe(false);
});

it('never qualifies missing, sub-threshold, nonmonotonic or unreachable observations and rejects direction mismatch in either basis', () => {
  for (const status of ['UNCLASSIFIED', 'NON_MONOTONIC_PROJECTION', 'SMALL_FINAL_DISPLACEMENT'] as const) {
    const b = comparison('b', .5, .5, .5);
    for (const basis of ['commonTime', 'samePlane'] as const) {
      const rejected:Comparison = { ...b, [basis]:{ ...b[basis], status } }, pair = analyzePair(comparison('a', .5), rejected);
      expect(pair.eligible).toBe(false);expect(pair.matchedAmountAndDirection).toBe(false);expect(pair.timeShapeCandidate).toBe(false);
    }
  }
  const b = comparison('b', .5, .5, .5), noPlane:Comparison = { ...b, samePlane:{ ...b.samePlane, status:'NO_FINITE_PLANE_CROSSING', amountMeters:null, direction:null } },
    missingDirection:Comparison = { ...b, commonTime:{ ...b.commonTime, direction:null } };
  for (const invalid of [noPlane, missingDirection]) {
    const pair = analyzePair(comparison('a', .5), invalid);expect(pair.eligible).toBe(false);expect(pair.timeShapeCandidate).toBe(false);
  }
  const tiny = analyzePair(comparison('a', 1e-8), comparison('b', 1e-8, 1e-8, .5));
  expect(tiny.eligible).toBe(false);expect(tiny.commonTimeRelativeAmountDifference).toBeNull();expect(tiny.samePlaneRelativeAmountDifference).toBeNull();
  const missingTime = analyzePair(comparison('a', .5), { ...b, commonTime:{ ...b.commonTime, p50Fraction:null, late20Fraction:null } });
  expect(missingTime.timeShapeCandidate).toBe(false);
  for (const basis of ['commonTime', 'samePlane'] as const) {
    const pair = analyzePair(comparison('a', .5), { ...b, [basis]:{ ...b[basis], direction:{ x:-1, y:0 } } });
    expect(pair.directionMatched).toBe(false);expect(pair.matchedAmountAndDirection).toBe(false);expect(pair.timeShapeCandidate).toBe(false);
  }
});
