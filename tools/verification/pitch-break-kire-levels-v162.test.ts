import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../../src/core/sim/pitching/BaseballOrientation';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../../src/core/sim/ball/SourceFreeBallKernel';
import { PITCH_BREAK_LOW_SPIN_PROTOCOL_V158, type PitchBreakLowSpinComparisonV158, type PitchBreakLowSpinReferenceV158 } from './pitch-break-low-spin-v158';
import { PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162, createPitchBreakKireLevelsCasesV162, measurePitchBreakKireLevelCaseV162,
  analyzePitchBreakKireLevelsV162 } from './pitch-break-kire-levels-v162';

// Public saved V158 release/reference only. This does not regenerate the old matrix or author a new release.
const reference = JSON.parse(readFileSync(new URL('../../docs/verification/realism-debug-20261027/pitch-break-low-spin-v158-01/measurement-reference.json', import.meta.url), 'utf8')) as PitchBreakLowSpinReferenceV158;
const norm = (v:{x:number;y:number;z:number}) => Math.hypot(v.x, v.y, v.z);
const comparison = (id:string, p50Fraction:number|null=.25, late20Fraction:number|null=.25, amount=.5):PitchBreakLowSpinComparisonV158 => ({
  id, factors:{ spinScale:.04, gyroDegrees:30, materialPhaseDegrees:45 },
  commonTime:{ status:'CLASSIFIED', amountMeters:amount, direction:{ x:1, y:0 }, p50Fraction, late20Fraction },
  samePlane:{ status:'CLASSIFIED', amountMeters:amount, direction:{ x:1, y:0 } },
});
const analyze = (input:PitchBreakLowSpinComparisonV158[]) => {
  const before = structuredClone(input), result = analyzePitchBreakKireLevelsV162(input);
  expect(input).toStrictEqual(before);return result;
};
const oneTriple = (input:PitchBreakLowSpinComparisonV158[]) => {
  const result = analyze(input);expect(result.triples).toHaveLength(1);return result.triples[0];
};
const ordered = () => [comparison('weak', .25, .25), comparison('middle', .375, .375), comparison('strong', .5, .5)];

it('fixes all forty predeclared inputs, nominal 5000 ticks, saved release PV/reference and unchanged V158 protocol', () => {
  const before = structuredClone(reference), oldProtocol = structuredClone(PITCH_BREAK_LOW_SPIN_PROTOCOL_V158),
    generated = createPitchBreakKireLevelsCasesV162(reference.sourceDescriptor), expected = new Set<string>();
  for (const spin of [.02, .04, .06, .08, .1]) for (const phase of [0, 45, 90, 135, 180, 225, 270, 315])
    expected.add(`${spin}|30|${phase}`);
  expect(generated.cases).toHaveLength(40);expect(new Set(generated.cases.map(item => item.id)).size).toBe(40);
  expect(new Set(generated.cases.map(({ factors:f }) => `${f.spinScale}|${f.gyroDegrees}|${f.materialPhaseDegrees}`))).toStrictEqual(expected);
  expect(generated.clock.originalEffectiveIntegrationStepTicks).toBe(1083);
  expect(generated.clock.originalNominalStepTicks).toBe(5000);expect(generated.clock.nominalIntegrationStepTicks).toBe(5000);
  expect(generated.clock.commonEffectiveIntegrationStepTicks).toBe(5000);expect(generated.clock.allCasesUseNominalStep).toBe(true);
  for (const item of generated.cases) {
    const source = item.descriptor, original = reference.sourceDescriptor;
    expect(source.initial).toStrictEqual({ ...original.initial, ball:{ ...original.initial.ball, spin:source.initial.ball.spin } });
    expect(source.profile).toStrictEqual(original.profile);expect(source.throughElapsedSeconds).toBe(original.throughElapsedSeconds);
    expect(norm(source.initial.ball.spin)).toBeCloseTo(norm(original.initial.ball.spin) * item.factors.spinScale, 12);
    expect(item.effectiveIntegrationStepTicks).toBe(resolveAerodynamicIntegrationStepTicksV1(source.initial.ball.spin, source.profile.air));
    expect(Object.isFrozen(item.descriptor.initial.ball)).toBe(true);
  }
  expect(reference).toStrictEqual(before);expect(Object.isFrozen(reference.sourceDescriptor.initial.ball)).toBe(false);
  expect(PITCH_BREAK_LOW_SPIN_PROTOCOL_V158).toStrictEqual(oldProtocol);
  expect(PITCH_BREAK_LOW_SPIN_PROTOCOL_V158.spinScales).toStrictEqual([.02, .1, .3, 1]);
  for (const key of ['maximumAbsoluteAmountDifferenceMeters', 'maximumRelativeAmountDifference', 'maximumDirectionDifferenceDegrees',
    'largeAmountMinimumMeters', 'minimumP50FractionDifference', 'minimumLate20FractionDifference'] as const)
    expect(PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162[key]).toBe(PITCH_BREAK_LOW_SPIN_PROTOCOL_V158[key]);
});

it('retains per-case effective Source steps when nominal 5000 is not achievable and isolates half step', () => {
  const original = reference.sourceDescriptor, spin = original.initial.ball.spin,
    faster:SourceFreeBallDescriptorV2 = { ...original, initial:{ ...original.initial, ball:{ ...original.initial.ball,
      spin:{ x:spin.x * 4, y:spin.y * 4, z:spin.z * 4 } } } },
    generated = createPitchBreakKireLevelsCasesV162(faster), half = createPitchBreakKireLevelsCasesV162(original, 2),
    nominal = createPitchBreakKireLevelsCasesV162(original);
  expect(generated.clock.nominalIntegrationStepTicks).toBe(5000);expect(generated.clock.commonEffectiveIntegrationStepTicks).toBeNull();
  expect(generated.clock.allCasesUseNominalStep).toBe(false);
  expect(new Set(generated.cases.map(item => item.effectiveIntegrationStepTicks)).size).toBeGreaterThan(1);
  for (const item of generated.cases) {
    expect(item.descriptor.profile.air.integrationStepTicks).toBe(5000);
    expect(item.effectiveIntegrationStepTicks).toBe(resolveAerodynamicIntegrationStepTicksV1(item.descriptor.initial.ball.spin, item.descriptor.profile.air));
  }
  expect(half.clock.nominalIntegrationStepTicks).toBe(2500);expect(half.clock.commonEffectiveIntegrationStepTicks).toBe(2500);
  half.cases.forEach((item, index) => expect(item.descriptor).toStrictEqual({ ...nominal.cases[index].descriptor,
    profile:{ ...original.profile, air:{ ...original.profile.air, integrationStepTicks:2500 } } }));
});

it('uses the saved relative-air transverse basis and left-multiplies material orientation for all new phases', () => {
  const original = reference.sourceDescriptor, material = quaternionFromAxisAngle({ x:0, y:1, z:0 }, .7),
    descriptor = { ...original, materialOrientationAtStart:material }, before = structuredClone(descriptor),
    wind = original.profile.air.aerodynamics.windVelocityMps, velocity = original.initial.ball.velocity,
    relative = { x:velocity.x - wind.x, y:velocity.y - wind.y, z:velocity.z - wind.z };
  for (const item of createPitchBreakKireLevelsCasesV162(descriptor).cases) {
    const spin = item.descriptor.initial.ball.spin;
    expect((spin.x * relative.x + spin.y * relative.y + spin.z * relative.z) / (norm(spin) * norm(relative))).toBeCloseTo(.5, 12);
    expect(item.descriptor.materialOrientationAtStart).toStrictEqual(item.factors.materialPhaseDegrees === 0 ? material :
      normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(spin, item.factors.materialPhaseDegrees * Math.PI / 180), material)));
  }
  expect(descriptor).toStrictEqual(before);
});

it('retains invalid Source input rejection without changing caller-owned data', () => {
  const descriptor = reference.sourceDescriptor, zero = { ...descriptor, initial:{ ...descriptor.initial,
    ball:{ ...descriptor.initial.ball, spin:{ x:0, y:0, z:0 } } } },
    materialAbsent = { ...descriptor, materialOrientationAtStart:undefined },
    elapsed = { ...descriptor, initial:{ ...descriptor.initial, elapsedSeconds:.01 } };
  for (const invalid of [zero, materialAbsent, elapsed]) {
    const before = structuredClone(invalid);expect(() => createPitchBreakKireLevelsCasesV162(invalid)).toThrow();expect(invalid).toStrictEqual(before);
  }
});

it('delegates actual Source measurement at saved Tref and keeps the analytic gravity baseline distinct', () => {
  const item = createPitchBreakKireLevelsCasesV162(reference.sourceDescriptor).cases[1], before = structuredClone(reference),
    measured = measurePitchBreakKireLevelCaseV162(reference, item, 160), kernel = createSourceFreeBallKernel(item.descriptor),
    observation = measured.observation, timing = observation.timingAtReference, initial = item.descriptor.initial.ball;
  expect(measured.descriptor).toStrictEqual(item.descriptor);expect(measured.effectiveIntegrationStepTicks).toBe(item.effectiveIntegrationStepTicks);
  expect(observation.referenceElapsedSeconds).toBe(reference.referenceElapsedSeconds);expect(observation.sourceSamples).toHaveLength(161);
  for (const index of [0, 80, 160]) {
    const sample = observation.sourceSamples[index], actual = kernel.evaluateAt(sample.elapsedSeconds);
    expect(sample.position).toStrictEqual(actual.moment.ball.position);expect(sample.velocity).toStrictEqual(actual.moment.ball.velocity);
    expect(sample.phase).toBe(actual.phase);expect(timing.raw[index].actual.position).toStrictEqual(actual.moment.ball.position);
    expect(timing.raw[index].baseline.position.y).toBe(initial.position.y + initial.velocity.y * sample.elapsedSeconds +
      item.descriptor.profile.air.gravityY * sample.elapsedSeconds ** 2 / 2);
  }
  expect(timing.groundClassification.actualGroundEventSeconds).toStrictEqual(kernel.boundaries
    .filter(row => row.kind === 'ground' && row.elapsedSeconds <= reference.referenceElapsedSeconds).map(row => row.elapsedSeconds));
  expect(measured.comparison.commonTime.status).toBe(timing.status);
  if (timing.status !== 'CLASSIFIED') {
    expect(measured.comparison.commonTime.p50Fraction).toBeNull();expect(measured.comparison.commonTime.late20Fraction).toBeNull();
  }
  expect(reference).toStrictEqual(before);
}, 60_000);

it('enumerates all 780 pairs and 9880 distinct triples without mutating the forty observation records', () => {
  const input = Array.from({ length:40 }, (_, i) => comparison(`case-${i}`, .2 + i / 100, .2 + i / 100)), result = analyze(input);
  expect(result.pairs).toHaveLength(780);expect(result.triples).toHaveLength(9880);
  expect(new Set(result.triples.map(item => JSON.stringify(item.caseIds))).size).toBe(9880);
  expect(result.summary.caseCount).toBe(40);expect(result.summary.pairCount).toBe(780);expect(result.summary.tripleCount).toBe(9880);
  expect(result.triples.every(item => typeof item.qualified === 'boolean' && Array.isArray(item.reasons))).toBe(true);
});

it('orders strength by increasing late20 and p50 regardless of input order, and separates small amount candidates', () => {
  const input = ordered(), triple = oneTriple([input[2], input[0], input[1]]);
  expect(triple.caseIds).toStrictEqual(['strong', 'weak', 'middle']);expect(triple.orderedCaseIds).toStrictEqual(['weak', 'middle', 'strong']);
  expect(triple.nearAmountAndDirection).toBe(true);expect(triple.strictlyIncreasingLate20AndP50).toBe(true);
  expect(triple.adjacentTimeShapeCandidate).toBe(true);expect(triple.qualified).toBe(true);expect(triple.reasons).toStrictEqual([]);
  const small = analyze(ordered().map(item => ({ ...item, commonTime:{ ...item.commonTime, amountMeters:.01 },
    samePlane:{ ...item.samePlane, amountMeters:.01 } })));
  expect(small.triples[0].qualified).toBe(true);expect(small.triples[0].largeAmountBand).toBe(false);
  expect(small.summary.qualifiedTripleCount).toBe(1);expect(small.summary.largeAmountQualifiedTripleCount).toBe(0);
});

it('requires near amount/direction in the nonadjacent pair as well as both adjacent pairs and both bases', () => {
  const input = [comparison('a', .25, .25, .5), comparison('b', .375, .375, .515), comparison('c', .5, .5, .53)], result = analyze(input);
  expect(result.pairs.filter(pair => pair.matchedAmountAndDirection)).toHaveLength(2);
  expect(result.triples[0].nearAmountAndDirection).toBe(false);expect(result.triples[0].qualified).toBe(false);
  for (const basis of ['commonTime', 'samePlane'] as const) {
    const cases = ordered();cases[2] = { ...cases[2], [basis]:{ ...cases[2][basis], direction:{ x:-1, y:0 } } };
    expect(oneTriple(cases).qualified).toBe(false);
  }
});

it('reuses the V158 adjacent timing OR screen with strict same-direction ranks', () => {
  expect(oneTriple([comparison('a', 0, .25), comparison('b', .05, .26), comparison('c', .1, .27)]).qualified).toBe(true);
  expect(oneTriple([comparison('a', .25, .25), comparison('b', .375, .26), comparison('c', .5, .27)]).qualified).toBe(true);
  expect(oneTriple([comparison('a', .25, .25), comparison('b', .26, .375), comparison('c', .27, .5)]).qualified).toBe(true);
  expect(oneTriple([comparison('a', .25, .25), comparison('b', .26, .26), comparison('c', .5, .5)]).qualified).toBe(false);
  const reversedP50 = oneTriple([comparison('a', .5, .25), comparison('b', .375, .375), comparison('c', .25, .5)]);
  expect(reversedP50.adjacentTimeShapeCandidate).toBe(true);expect(reversedP50.strictlyIncreasingLate20AndP50).toBe(false);expect(reversedP50.qualified).toBe(false);
  for (const cases of [[comparison('a', .25, .25), comparison('b', .375, .375), comparison('c', .3, .5)],
    [comparison('a', .25, .25), comparison('b', .25, .375), comparison('c', .5, .5)],
    [comparison('a', .25, .25), comparison('b', .375, .25), comparison('c', .5, .5)]])
    expect(oneTriple(cases).qualified).toBe(false);
});

it('preserves zero, unavailable timing, unclassified, nonmonotonic and missing plane observations as failed triples', () => {
  const invalid = [comparison('bad', .5, .5, 0), comparison('bad', null, .5), comparison('bad', .5, null),
    ...(['UNCLASSIFIED', 'NON_MONOTONIC_PROJECTION', 'SMALL_FINAL_DISPLACEMENT'] as const).map(status => {
      const item = comparison('bad', .5, .5);return { ...item, commonTime:{ ...item.commonTime, status } };
    }), { ...comparison('bad', .5, .5), samePlane:{ status:'NO_FINITE_PLANE_CROSSING' as const, amountMeters:null, direction:null } }];
  for (const item of invalid) {
    const triple = oneTriple([comparison('a'), comparison('b', .375, .375), item]);
    expect(triple.qualified).toBe(false);expect(triple.reasons.length).toBeGreaterThan(0);
    if (item.commonTime.p50Fraction === null || item.commonTime.late20Fraction === null) expect(triple.orderedCaseIds).toBeNull();
  }
});

it('rejects duplicate IDs and returns zero combinations without inventing candidates', () => {
  expect(() => analyzePitchBreakKireLevelsV162([comparison('same'), comparison('same')])).toThrow(/unique/);
  for (const item of [comparison('bad', Infinity, .5), comparison('bad', .5, NaN)])
    expect(() => analyzePitchBreakKireLevelsV162([comparison('a'), comparison('b', .375, .375), item])).toThrow(/finite/);
  const none = analyze([]);expect(none.pairs).toStrictEqual([]);expect(none.triples).toStrictEqual([]);expect(none.summary.qualifiedTripleCount).toBe(0);
  const two = analyze(ordered().slice(0, 2));expect(two.pairs).toHaveLength(1);expect(two.triples).toStrictEqual([]);
});
