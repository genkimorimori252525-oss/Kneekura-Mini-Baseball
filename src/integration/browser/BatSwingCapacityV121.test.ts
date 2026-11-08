import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { deriveBatSwingInertiaV121, evaluateBatSwingCapacityV121, validateBatSwingCapacityTargetV121,
  type BatSwingCapacityInputV121 } from './BatSwingCapacityV121';

const fixture = (): BatSwingCapacityInputV121 => ({ maximumSweetSpotSpeedMps: 40,
  bat: { lengthM: .86, massKg: .9, sweetSpotT: .82 }, model: {
    modelId: 'GENERIC_BAT_INERTIA_CALIBRATION_V121', baselineBat: { lengthM: .86, massKg: .9, sweetSpotT: .82 },
    calibration: { calibrationId: 'synthetic-contract-test', source: 'Synthetic response; not empirical player calibration',
      inertiaExponent: .4, minimumInertiaRatio: .25, maximumInertiaRatio: 4 } } });

it('does not reinterpret the equipped bat or the old maximum as an implicit calibration', () => {
  const { model, ...legacy } = fixture(), before = structuredClone(legacy);
  expect(evaluateBatSwingCapacityV121(legacy)).toMatchObject({ status: 'UNAVAILABLE', effectiveMaxSweetSpotSpeedMps: null,
    reason: 'MISSING_EXPLICIT_BASELINE_CALIBRATION' });
  expect(legacy).toEqual(before);
});

it('uses only explicit response coefficients and preserves provenance, baseline, and stronger source differences', () => {
  const input = fixture(), before = structuredClone(input);
  expect(evaluateBatSwingCapacityV121(input)).toMatchObject({ status: 'ESTIMATED', effectiveMaxSweetSpotSpeedMps: 40,
    calibrationId: input.model!.calibration.calibrationId, calibrationSource: input.model!.calibration.source, inertiaRatio: 1 });
  const heavy = { ...input, bat: { ...input.bat, massKg: 1.8 } }, light = { ...input, bat: { ...input.bat, massKg: .45 } };
  expect(evaluateBatSwingCapacityV121(heavy).effectiveMaxSweetSpotSpeedMps).toBeCloseTo(40 * 2 ** -.4);
  expect(evaluateBatSwingCapacityV121(light).effectiveMaxSweetSpotSpeedMps).toBeCloseTo(40 * .5 ** -.4);
  expect(evaluateBatSwingCapacityV121({ ...heavy, maximumSweetSpotSpeedMps: 60 }).effectiveMaxSweetSpotSpeedMps!)
    .toBeGreaterThan(evaluateBatSwingCapacityV121(input).effectiveMaxSweetSpotSpeedMps!);
  expect(input).toEqual(before);
});

it('uses the same actual shape inertia and lever arm for length and sweet spot changes', () => {
  const input = fixture(), longer = { ...input, bat: { ...input.bat, lengthM: 1.03, sweetSpotT: .75 } };
  const ratio = deriveBatSwingInertiaV121(longer.bat).knobMomentOfInertiaKgM2
    / deriveBatSwingInertiaV121(input.bat).knobMomentOfInertiaKgM2;
  expect(evaluateBatSwingCapacityV121(longer).effectiveMaxSweetSpotSpeedMps)
    .toBeCloseTo(40 * (1.03 * .75) / (.86 * .82) * ratio ** -.4);
});

it('refuses extrapolation outside the explicitly declared calibration domain', () => {
  const input = fixture();
  expect(evaluateBatSwingCapacityV121({ ...input, bat: { ...input.bat, massKg: 4.5 } })).toMatchObject({
    status: 'UNAVAILABLE', reason: 'OUTSIDE_CALIBRATION_RANGE', effectiveMaxSweetSpotSpeedMps: null });
});

it('reports an explicit adjustment proposal without mutating the target or making unknown capacity a ceiling', () => {
  const input = fixture(), capacity = evaluateBatSwingCapacityV121(input);
  expect(validateBatSwingCapacityTargetV121(capacity, 42)).toMatchObject({ valid: false, proposedTargetSweetSpotSpeedMps: 40 });
  expect(validateBatSwingCapacityTargetV121(capacity, 20)).toMatchObject({ valid: true, proposedTargetSweetSpotSpeedMps: null });
  expect(validateBatSwingCapacityTargetV121(evaluateBatSwingCapacityV121({ ...input, model: undefined }), 42).valid).toBe(true);
});

it('rejects malformed calibration, invalid geometry and executable data without invoking a getter', () => {
  const input = fixture();
  expect(() => evaluateBatSwingCapacityV121({ ...input, model: { ...input.model!, calibration: { ...input.model!.calibration, source: '' } } })).toThrow(/provenance/);
  expect(() => evaluateBatSwingCapacityV121({ ...input, model: { ...input.model!, calibration: { ...input.model!.calibration, inertiaExponent: 0 } } })).toThrow(/response/);
  expect(() => evaluateBatSwingCapacityV121({ ...input, bat: { ...input.bat, massKg: NaN } })).toThrow();
  let reads = 0;
  const active = { ...input }; Object.defineProperty(active, 'model', { enumerable: true, get() { reads++; return input.model; } });
  expect(() => evaluateBatSwingCapacityV121(active)).toThrow(/accessor/); expect(reads).toBe(0);
});

it('shows the read-only MAX beneath weight and refreshes canonical changes, pending input and missing references', () => {
  const input = fixture(), physical = { batMassKg: input.bat.massKg, batLengthM: input.bat.lengthM,
    sweetSpotT: input.bat.sweetSpotT, maximumSweetSpotSpeedMps: input.maximumSweetSpotSpeedMps,
    batSwingCapacityV121: input.model, targetSweetSpotSpeedMps: 30 };
  const nodes: Record<string, any> = { 'swing-bat-mass': { value: '.9', validity: { valid: true } },
    'swing-bat-length': { value: '86', validity: { valid: true } }, 'live-roster-player': { value: 'a' },
    'swing-bat-mass-g': { after: (node: any) => { nodes[node.id] = node; } } };
  const listeners = new Map<string, () => void>();
  const context: any = { document: { getElementById: (id: string) => nodes[id], createElement: () => ({ style: {}, dataset: {}, setAttribute() {} }),
    addEventListener: (event: string, handler: () => void) => listeners.set(event, handler) }, queueMicrotask: (run: () => void) => run(),
    KneekuraBaseballWorkbench: { evaluateBatSwingCapacityV121: (raw: any) => evaluateBatSwingCapacityV121(JSON.parse(JSON.stringify(raw))), validateBatSwingCapacityTargetV121 },
    baseballMaker: { getLiveRoster: () => ({ entries: [{ playerId: 'a', physical }] }), getRecoveryStateV82: () => ({ pendingFields: [] }) } };
  vm.runInNewContext(readFileSync('docs/demos/baseball-maker-bat-capacity-v121.js', 'utf8'), context);
  const line = nodes['swing-bat-capacity-v121']; expect(line.textContent).toContain('40.0 m/s');
  physical.batMassKg = 1.8; nodes['swing-bat-mass'].value = '1.8'; listeners.get('kneekura:maker-roster-change')!();
  expect(line.textContent).toContain('30.3 m/s');
  nodes['swing-bat-mass'].value = ''; listeners.get('input')!(); expect(line.textContent).toContain('入力未確定');
  nodes['swing-bat-mass'].value = '1.8'; physical.batSwingCapacityV121 = undefined;
  context.KneekuraBatCapacityMakerV121.refresh(); expect(line.textContent).toContain('基準バット・校正参照が未設定');
});
