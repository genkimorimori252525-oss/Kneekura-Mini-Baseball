import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../../src/core/sim/pitching/BaseballOrientation';
import * as lowSpin from './pitch-break-low-spin-v158';
import { createPitchBreakKireLevelsCasesV162, PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162 } from './pitch-break-kire-levels-v162';
import { PITCH_BREAK_KIRE_PHASE_CALIBRATION_PROTOCOL_V163, createPitchBreakKirePhaseCalibrationCasesV163,
  measurePitchBreakKirePhaseCalibrationCaseV163, analyzePitchBreakKirePhaseCalibrationV163 } from './pitch-break-kire-phase-calibration-v163';

// Saved public reference and pure factories only. These tests never simulate a flight.
const reference = JSON.parse(readFileSync(new URL('../../docs/verification/realism-debug-20261027/pitch-break-low-spin-v158-01/measurement-reference.json', import.meta.url), 'utf8')) as lowSpin.PitchBreakLowSpinReferenceV158;
const phases = Array.from({ length:17 }, (_, index) => -20 + 2.5 * index);
const id = (spin:number, phase:number) => `spin-${spin}_gyro-30_phase-${phase}`;
const comparison = (spin:number, phase:number, p50:number|null, late20:number|null, amount=.5):lowSpin.PitchBreakLowSpinComparisonV158 => ({
  id:id(spin, phase), factors:{ spinScale:spin, gyroDegrees:30, materialPhaseDegrees:phase },
  commonTime:{ status:'CLASSIFIED', amountMeters:amount, direction:{ x:1, y:0 }, p50Fraction:p50, late20Fraction:late20 },
  samePlane:{ status:'CLASSIFIED', amountMeters:amount, direction:{ x:1, y:0 } },
});
const weak = (phase:number, p50:number|null=.25, late20:number|null=.25, amount=.5) => comparison(.04, phase, p50, late20, amount);
const anchors = () => [comparison(.08, 45, .375, .375), comparison(.02, 0, .5, .5)];
const analyze = (input:lowSpin.PitchBreakLowSpinComparisonV158[]) => {
  const before = structuredClone(input), result = analyzePitchBreakKirePhaseCalibrationV163(input);
  expect(input).toStrictEqual(before);return result;
};
afterEach(() => vi.restoreAllMocks());

it('fixes the seventeen weak phases plus two anchors and exposes their reusable IDs and roles', () => {
  const before = structuredClone(reference), generated = createPitchBreakKirePhaseCalibrationCasesV163(reference.sourceDescriptor);
  expect(generated.cases).toHaveLength(19);expect(new Set(generated.cases.map(item => item.id)).size).toBe(19);
  expect(generated.cases.slice(0, 17).map(item => item.factors)).toStrictEqual(phases.map(materialPhaseDegrees => ({
    spinScale:.04, gyroDegrees:30, materialPhaseDegrees,
  })));
  expect(generated.cases.slice(17).map(item => item.id)).toStrictEqual([id(.08, 45), id(.02, 0)]);
  expect(generated.reusableCaseIds).toStrictEqual([id(.04, 0), id(.08, 45), id(.02, 0)]);
  expect(generated.roles).toStrictEqual({ weakCaseIds:phases.map(phase => id(.04, phase)), weakZeroCaseId:id(.04, 0),
    middleCaseId:id(.08, 45), strongCaseId:id(.02, 0) });
  expect(generated.clock.nominalIntegrationStepTicks).toBe(5000);expect(generated.clock.commonEffectiveIntegrationStepTicks).toBe(5000);
  expect(generated.clock.originalEffectiveIntegrationStepTicks).toBe(1083);expect(reference).toStrictEqual(before);
});

it('preserves each of the three reusable V162 cases in its entire property shape on either nominal clock', () => {
  for (const factor of [1, 2] as const) {
    const v162 = createPitchBreakKireLevelsCasesV162(reference.sourceDescriptor, factor),
      v163 = createPitchBreakKirePhaseCalibrationCasesV163(reference.sourceDescriptor, factor);
    for (const reusableId of v163.reusableCaseIds) {
      const expected = v162.cases.find(item => item.id === reusableId)!, actual = v163.cases.find(item => item.id === reusableId)!;
      expect(actual).toStrictEqual(expected);expect(Object.keys(actual)).toStrictEqual(Object.keys(expected));
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    }
  }
});

it('rotates only weak material phase by world-left multiplication and keeps the zero quaternion and saved PV unchanged', () => {
  const descriptor = { ...reference.sourceDescriptor, materialOrientationAtStart:quaternionFromAxisAngle({ x:0, y:1, z:0 }, .7) },
    before = structuredClone(descriptor), generated = createPitchBreakKirePhaseCalibrationCasesV163(descriptor),
    zero = generated.cases.find(item => item.id === id(.04, 0))!, q = zero.descriptor.materialOrientationAtStart!;
  for (const item of generated.cases.slice(0, 17)) {
    const angle = item.factors.materialPhaseDegrees;
    expect(item.descriptor).toStrictEqual({ ...zero.descriptor, materialOrientationAtStart:angle === 0 ? q :
      normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(zero.descriptor.initial.ball.spin, angle * Math.PI / 180), q)) });
    expect(item.descriptor.initial.ball.position).toStrictEqual(descriptor.initial.ball.position);
    expect(item.descriptor.initial.ball.velocity).toStrictEqual(descriptor.initial.ball.velocity);
    expect(item.descriptor.profile).toStrictEqual(descriptor.profile);
  }
  expect(q).toStrictEqual(descriptor.materialOrientationAtStart);expect(descriptor).toStrictEqual(before);
  expect(Object.isFrozen(descriptor)).toBe(false);expect(Object.isFrozen(zero.descriptor.initial.ball)).toBe(true);
});

it('isolates 2500 tick refinement and retains unchanged primary screen thresholds', () => {
  const descriptor = reference.sourceDescriptor, nominal = createPitchBreakKirePhaseCalibrationCasesV163(descriptor),
    half = createPitchBreakKirePhaseCalibrationCasesV163(descriptor, 2);
  expect(half.clock.nominalIntegrationStepTicks).toBe(2500);expect(half.clock.commonEffectiveIntegrationStepTicks).toBe(2500);
  for (const [index, item] of half.cases.entries()) {
    expect(item.descriptor).toStrictEqual({ ...nominal.cases[index].descriptor,
      profile:{ ...descriptor.profile, air:{ ...descriptor.profile.air, integrationStepTicks:2500 } } });
    expect(item.effectiveIntegrationStepTicks).toBe(resolveAerodynamicIntegrationStepTicksV1(item.descriptor.initial.ball.spin, item.descriptor.profile.air));
  }
  for (const key of ['maximumAbsoluteAmountDifferenceMeters', 'maximumRelativeAmountDifference', 'maximumDirectionDifferenceDegrees',
    'largeAmountMinimumMeters', 'minimumP50FractionDifference', 'minimumLate20FractionDifference'] as const)
    expect(PITCH_BREAK_KIRE_PHASE_CALIBRATION_PROTOCOL_V163[key]).toBe(PITCH_BREAK_KIRE_LEVELS_PROTOCOL_V162[key]);
});

it('delegates measurement to the V158 generic metadata API without simulating a flight in this test', () => {
  const item = createPitchBreakKirePhaseCalibrationCasesV163(reference.sourceDescriptor).cases[0], sentinel = Error('measurement delegation'),
    spy = vi.spyOn(lowSpin, 'measurePitchBreakLowSpinCaseV158').mockImplementation(() => { throw sentinel; });
  expect(() => measurePitchBreakKirePhaseCalibrationCaseV163(reference, item, 640)).toThrow(sentinel);
  expect(spy).toHaveBeenCalledOnce();expect(spy).toHaveBeenCalledWith(reference, item, 640);
});

it('retains all seventeen fixed-role trials and reuses the V162 all-pair and all-triple primary analysis', () => {
  const input = [...phases.map(phase => weak(phase)), ...anchors()], result = analyze(input);
  expect(result.pairs).toHaveLength(171);expect(result.triples).toHaveLength(969);expect(result.calibrationTrials).toHaveLength(17);
  expect(result.calibrationTrials.map(item => item.phaseDegrees)).toStrictEqual(phases);
  expect(result.summary.calibrationTrialCount).toBe(17);expect(result.summary.qualifiedCalibrationCount).toBe(17);
  expect(result.summary.qualifiedCalibrations).toHaveLength(17);expect(result.summary.selectedCalibration!.phaseDegrees).toBe(0);
  expect(result.calibrationTrials.every(item => item.qualified && item.primaryQualified && item.roleOrderMatched)).toBe(true);
  expect(result.summary.selectedCalibration!.orderedCaseIds).toStrictEqual([id(.04, 0), id(.08, 45), id(.02, 0)]);
});

it('requires the declared weak-middle-strong order even when another order passes the primary screen', () => {
  const result = analyze([weak(-2.5, .7, .7), ...anchors()]), trial = result.calibrationTrials[0];
  expect(result.summary.qualifiedTripleCount).toBe(1);expect(trial.primaryQualified).toBe(true);expect(trial.roleOrderMatched).toBe(false);
  expect(trial.qualified).toBe(false);expect(trial.reasons).toContain('PRIMARY_ORDER_DOES_NOT_MATCH_WEAK_MIDDLE_STRONG');
  expect(result.summary.qualifiedCalibrationCount).toBe(0);expect(result.summary.selectedCalibration).toBeNull();
});

it('preserves all-pair near-amount limits including the nonadjacent weak-strong pair', () => {
  const fixed = anchors(), result = analyze([weak(2.5, .25, .25, .53),
    { ...fixed[0], commonTime:{ ...fixed[0].commonTime, amountMeters:.515 }, samePlane:{ ...fixed[0].samePlane, amountMeters:.515 } }, fixed[1]]);
  expect(result.pairs.filter(item => item.matchedAmountAndDirection)).toHaveLength(2);
  expect(result.calibrationTrials[0].primaryQualified).toBe(false);expect(result.calibrationTrials[0].qualified).toBe(false);
  expect(result.summary.selectedCalibration).toBeNull();
});

it('retains failed trials for null, zero, nonmonotonic, direction and adjacent timing failures', () => {
  const base = weak(2.5), invalid = [weak(2.5, null), weak(2.5, .25, null), weak(2.5, .25, .25, 0),
    weak(2.5, .38, .2), weak(2.5, .36, .36), { ...base, commonTime:{ ...base.commonTime, status:'NON_MONOTONIC_PROJECTION' as const } },
    { ...base, samePlane:{ ...base.samePlane, direction:{ x:-1, y:0 } } }];
  for (const item of invalid) {
    const result = analyze([item, ...anchors()]), trial = result.calibrationTrials[0];
    expect(result.calibrationTrials).toHaveLength(1);expect(trial.qualified).toBe(false);expect(trial.reasons.length).toBeGreaterThan(0);
    expect(result.summary.qualifiedCalibrationCount).toBe(0);
  }
});

it('selects the smallest absolute qualified phase, then the smaller signed phase independently of input order', () => {
  const first = analyze([weak(10), ...anchors(), weak(5), weak(-5)]), reversed = analyze([weak(-5), weak(5), ...anchors(), weak(10)]);
  expect(first.calibrationTrials.map(item => item.phaseDegrees)).toStrictEqual([-5, 5, 10]);
  expect(first.summary.selectedCalibration!.phaseDegrees).toBe(-5);
  expect(reversed.summary.selectedCalibration).toStrictEqual(first.summary.selectedCalibration);
  const zero = analyze([weak(5), weak(0), ...anchors(), weak(-5)]);
  expect(zero.summary.selectedCalibration!.phaseDegrees).toBe(0);
});

it('supports anchor-only refinement subsets and rejects missing anchors, duplicate or unprescribed input roles', () => {
  const empty = analyze(anchors());expect(empty.calibrationTrials).toStrictEqual([]);expect(empty.summary.qualifiedCalibrationCount).toBe(0);
  expect(empty.summary.selectedCalibration).toBeNull();
  expect(() => analyzePitchBreakKirePhaseCalibrationV163([weak(0), anchors()[0]])).toThrow(/fixed middle and strong/);
  expect(() => analyzePitchBreakKirePhaseCalibrationV163([weak(0), weak(0), ...anchors()])).toThrow(/unique/);
  expect(() => analyzePitchBreakKirePhaseCalibrationV163([weak(22.5), ...anchors()])).toThrow(/predeclared/);
  expect(() => analyzePitchBreakKirePhaseCalibrationV163([{ ...weak(0), factors:{ ...weak(0).factors, spinScale:.06 } }, ...anchors()])).toThrow(/predeclared/);
});
