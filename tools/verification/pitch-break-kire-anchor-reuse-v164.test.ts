import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import type { PitchBreakLowSpinComparisonV158, PitchBreakLowSpinReferenceV158 } from './pitch-break-low-spin-v158';
import { createPitchBreakKireLevelsCasesV162 } from './pitch-break-kire-levels-v162';
import * as phaseCalibration from './pitch-break-kire-phase-calibration-v163';
import { createPitchBreakKireAnchorReuseCasesV164, measurePitchBreakKireAnchorReuseCaseV164,
  preflightPitchBreakKireAnchorsV164, analyzePitchBreakKireAnchorReuseV164, PITCH_BREAK_KIRE_ANCHOR_REUSE_PROTOCOL_V164 } from './pitch-break-kire-anchor-reuse-v164';

// Read saved public results. No flight is simulated or rewritten in this test file.
const savedRoot = '../../docs/verification/realism-debug-20261027/';
const read = <T>(path:string):T => JSON.parse(readFileSync(new URL(savedRoot + path, import.meta.url), 'utf8')) as T;
const reference = read<PitchBreakLowSpinReferenceV158>('pitch-break-low-spin-v158-01/measurement-reference.json'),
  v162 = read<PitchBreakLowSpinComparisonV158[]>('pitch-break-kire-levels-v162-01/nominal-comparisons.json'),
  v163 = read<PitchBreakLowSpinComparisonV158[]>('pitch-break-kire-phase-calibration-v163-01/nominal-comparisons.json'),
  middleId = 'spin-0.1_gyro-30_phase-270', oldMiddleId = 'spin-0.08_gyro-30_phase-45', strongId = 'spin-0.02_gyro-30_phase-0',
  weakId = (phase:number) => `spin-0.04_gyro-30_phase-${phase}`,
  actual = [...v163.filter(item => item.id !== oldMiddleId), v162.find(item => item.id === middleId)!];
const synthetic = (phase:number, p50=.25, late20=.25):PitchBreakLowSpinComparisonV158 => ({
  id:weakId(phase), factors:{ spinScale:.04, gyroDegrees:30, materialPhaseDegrees:phase },
  commonTime:{ status:'CLASSIFIED', amountMeters:.5, direction:{ x:1, y:0 }, p50Fraction:p50, late20Fraction:late20 },
  samePlane:{ status:'CLASSIFIED', amountMeters:.5, direction:{ x:1, y:0 } },
});
const anchors = ():PitchBreakLowSpinComparisonV158[] => [
  { ...synthetic(0, .375, .375), id:middleId, factors:{ spinScale:.1, gyroDegrees:30, materialPhaseDegrees:270 } },
  { ...synthetic(0, .5, .5), id:strongId, factors:{ spinScale:.02, gyroDegrees:30, materialPhaseDegrees:0 } },
];
const analyze = (input:PitchBreakLowSpinComparisonV158[]) => {
  const before = structuredClone(input), result = analyzePitchBreakKireAnchorReuseV164(input);expect(input).toStrictEqual(before);return result;
};
afterEach(() => vi.restoreAllMocks());

it('replaces only the middle template and preserves all nineteen case shapes against their exact source factories', () => {
  const before = structuredClone(reference);
  for (const factor of [1, 2] as const) {
    const previous = phaseCalibration.createPitchBreakKirePhaseCalibrationCasesV163(reference.sourceDescriptor, factor),
      original = createPitchBreakKireLevelsCasesV162(reference.sourceDescriptor, factor),
      generated = createPitchBreakKireAnchorReuseCasesV164(reference.sourceDescriptor, factor);
    expect(generated.cases).toHaveLength(19);expect(new Set(generated.reusableCaseIds).size).toBe(19);
    expect(generated.reusableCaseIds).toStrictEqual(generated.cases.map(item => item.id));
    expect(generated.roles).toStrictEqual({ ...previous.roles, middleCaseId:middleId });
    generated.cases.forEach((item, index) => {
      const expected = previous.cases[index].id === oldMiddleId ? original.cases.find(row => row.id === middleId)! : previous.cases[index];
      expect(item).toStrictEqual(expected);expect(JSON.stringify(item)).toBe(JSON.stringify(expected));
    });
    expect(generated.clock.nominalIntegrationStepTicks).toBe(factor === 1 ? 5000 : 2500);
    expect(generated.clock.commonEffectiveIntegrationStepTicks).toBe(generated.clock.nominalIntegrationStepTicks);
  }
  expect(reference).toStrictEqual(before);expect(Object.isFrozen(reference.sourceDescriptor)).toBe(false);
});

it('keeps the V163 primary screen thresholds and fixed phase domain unchanged', () => {
  const previous = phaseCalibration.PITCH_BREAK_KIRE_PHASE_CALIBRATION_PROTOCOL_V163;
  for (const key of ['weakMaterialPhaseDegrees', 'maximumAbsoluteAmountDifferenceMeters', 'maximumRelativeAmountDifference',
    'maximumDirectionDifferenceDegrees', 'largeAmountMinimumMeters', 'minimumP50FractionDifference', 'minimumLate20FractionDifference', 'selectionRule'] as const)
    expect(PITCH_BREAK_KIRE_ANCHOR_REUSE_PROTOCOL_V164[key]).toStrictEqual(previous[key]);
});

it('delegates measurement without simulating a flight', () => {
  const item = createPitchBreakKireAnchorReuseCasesV164(reference.sourceDescriptor).cases[0], sentinel = Error('delegated measurement'),
    spy = vi.spyOn(phaseCalibration, 'measurePitchBreakKirePhaseCalibrationCaseV163').mockImplementation(() => { throw sentinel; });
  expect(() => measurePitchBreakKireAnchorReuseCaseV164(reference, item, 640)).toThrow(sentinel);
  expect(spy).toHaveBeenCalledOnce();expect(spy).toHaveBeenCalledWith(reference, item, 640);
});

it('detects the old saved middle-strong amount mismatch before any calibration trial is considered', () => {
  const oldMiddle = v163.find(item => item.id === oldMiddleId)!, strong = v163.find(item => item.id === strongId)!,
    before = structuredClone([oldMiddle, strong]), preflight = preflightPitchBreakKireAnchorsV164(oldMiddle, strong);
  expect(preflight.eligible).toBe(true);expect(preflight.commonTimeRelativeAmountDifference).toBeGreaterThan(.05);
  expect(preflight.matchedAmountAndDirection).toBe(false);expect(preflight.feasible).toBe(false);
  expect(preflight.reasons).toContain('ANCHOR_AMOUNT_OR_DIRECTION_NOT_MATCHED');expect([oldMiddle, strong]).toStrictEqual(before);
});

it('accepts the saved replacement anchor and identifies all seventeen saved trials without a new flight', () => {
  const result = analyze(actual);
  expect(result.anchorPreflight.eligible).toBe(true);expect(result.anchorPreflight.matchedAmountAndDirection).toBe(true);
  expect(result.anchorPreflight.timeShapeCandidate).toBe(true);expect(result.anchorPreflight.strictlyIncreasingLate20AndP50).toBe(true);
  expect(result.anchorPreflight.feasible).toBe(true);expect(result.anchorPreflight.reasons).toStrictEqual([]);
  expect(result.pairs).toHaveLength(171);expect(result.triples).toHaveLength(969);expect(result.calibrationTrials).toHaveLength(17);
  expect(result.summary.qualifiedCalibrationCount).toBe(3);
  expect(result.summary.qualifiedCalibrations.map(item => item.phaseDegrees)).toStrictEqual([-5, -7.5, -10]);
  expect(result.summary.selectedCalibration!.phaseDegrees).toBe(-5);
  expect(new Set(result.additionalMeasurementCaseIds)).toStrictEqual(new Set([weakId(-5), weakId(-7.5), weakId(-10), middleId, strongId]));
});

it('returns no calibration selection or measurement targets when fixed anchors fail any required condition', () => {
  const fixed = anchors(), invalid = [
    { ...fixed[0], commonTime:{ ...fixed[0].commonTime, amountMeters:.54 } },
    { ...fixed[0], samePlane:{ ...fixed[0].samePlane, direction:{ x:-1, y:0 } } },
    { ...fixed[0], commonTime:{ ...fixed[0].commonTime, p50Fraction:.49, late20Fraction:.49 } },
    { ...fixed[0], commonTime:{ ...fixed[0].commonTime, p50Fraction:.7 } },
    { ...fixed[0], commonTime:{ ...fixed[0].commonTime, status:'UNCLASSIFIED' as const } },
  ];
  for (const middle of invalid) {
    const result = analyze([synthetic(-5), middle, fixed[1]]);
    expect(result.anchorPreflight.feasible).toBe(false);expect(result.anchorPreflight.reasons.length).toBeGreaterThan(0);
    expect(result.calibrationTrials).toHaveLength(1);expect(result.calibrationTrials[0].qualified).toBe(false);
    expect(result.summary.qualifiedCalibrationCount).toBe(0);expect(result.summary.qualifiedCalibrations).toStrictEqual([]);
    expect(result.summary.selectedCalibration).toBeNull();expect(result.additionalMeasurementCaseIds).toStrictEqual([]);
  }
});

it('keeps strict weak-middle-strong role order separate from global triple qualification', () => {
  const result = analyze([synthetic(-5, .7, .7), ...anchors()]);
  expect(result.anchorPreflight.feasible).toBe(true);expect(result.summary.qualifiedTripleCount).toBe(1);
  expect(result.calibrationTrials[0].primaryQualified).toBe(true);expect(result.calibrationTrials[0].roleOrderMatched).toBe(false);
  expect(result.summary.qualifiedCalibrationCount).toBe(0);expect(result.additionalMeasurementCaseIds).toStrictEqual([]);
});

it('uses minimum absolute phase then smaller signed phase independent of input order', () => {
  const result = analyze([synthetic(10), synthetic(5), ...anchors(), synthetic(-5)]),
    reversed = analyze([synthetic(-5), ...anchors(), synthetic(5), synthetic(10)]);
  expect(result.summary.selectedCalibration!.phaseDegrees).toBe(-5);
  expect(reversed.summary.selectedCalibration).toStrictEqual(result.summary.selectedCalibration);
  expect(analyze([synthetic(-5), synthetic(0), ...anchors()]).summary.selectedCalibration!.phaseDegrees).toBe(0);
});

it('supports anchor-only subsets and rejects missing, duplicate, old-middle or unprescribed cases', () => {
  const result = analyze(anchors());expect(result.calibrationTrials).toStrictEqual([]);expect(result.anchorPreflight.feasible).toBe(true);
  expect(result.summary.selectedCalibration).toBeNull();expect(result.additionalMeasurementCaseIds).toStrictEqual([]);
  expect(() => analyzePitchBreakKireAnchorReuseV164([synthetic(0), anchors()[0]])).toThrow(/fixed middle and strong/);
  expect(() => analyzePitchBreakKireAnchorReuseV164([synthetic(0), synthetic(0), ...anchors()])).toThrow(/unique/);
  expect(() => analyzePitchBreakKireAnchorReuseV164([synthetic(22.5), ...anchors()])).toThrow(/predeclared/);
  expect(() => analyzePitchBreakKireAnchorReuseV164([...anchors(), v163.find(item => item.id === oldMiddleId)!])).toThrow(/predeclared/);
});
