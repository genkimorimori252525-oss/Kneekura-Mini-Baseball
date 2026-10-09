import { afterAll, beforeAll, expect, it } from 'vitest';
import * as owner from './SqliteSamePlateAppearanceDispatchStore';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { rawCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
let f: ReturnType<typeof directNativeDispatchFixture>;
beforeAll(() => { f = directNativeDispatchFixture(); }, 120_000);
afterAll(() => f?.close());
const calculator = () => {
  const fn = (owner as unknown as { readSamePaFirstPitchCalculation?: (path: string, request: unknown) => any }).readSamePaFirstPitchCalculation;
  expect(fn, 'DIRECT_NATIVE_PITCH_CALCULATION_MISSING').toBeTypeOf('function'); return fn!;
};
it('NP01 real Native accepted action and calibration calculate projected pitch with no physical or workload write', () => {
  const calculate = calculator(), before = rawCensus(f.db), original = hash(f.acceptedAction), result = calculate(f.path, f.request);
  expect(result.kind).toBe('native_calculation_only'); expect(result.route).toBe('pitch_delivery');
  expect(result.frame.member).toEqual(f.pitchCalibration.source.member);
  expect(result.frame.reservedActualState.revision).toBe(1); expect(result.frame.projectedExecutionState.revision).toBe(2);
  expect(result.frame.projectedExecutionState.fatigue).toBeCloseTo(0.2);
  expect(result.calculation.trajectory.start.velocity.z).toBeCloseTo(-27); expect(result.calculation.trajectory.start.spin.y).toBeCloseTo(95);
  expect(result.calculation.resolution.kind).toBe('recorded'); expect(hash(f.acceptedAction)).toBe(original);
  expect(f.x.f.workload.readHead('career-a', 'p2')!.revision).toBe(1);
  expect(() => f.x.f.workload.selectAtRevision('career-a', 'p2', 2)).toThrow();
  expect(calculate(f.path, f.request)).toEqual(result); expect(rawCensus(f.db)).toEqual(before);
});
it('NP02 Native calculation rejects an absent or changed accepted calibration without using prospective derivation', () => {
  const calculate = calculator(), row = f.db.prepare('SELECT * FROM pa_dispatch_v1_execution_calibrations WHERE source_id=?').get(f.pitchCalibration.source.sourceId)!;
  f.db.prepare('DELETE FROM pa_dispatch_v1_execution_calibrations WHERE source_id=?').run(f.pitchCalibration.source.sourceId);
  try { expect(() => calculate(f.path, f.request)).toThrow(/accepted calibration|missing/); }
  finally { f.db.prepare(`INSERT INTO pa_dispatch_v1_execution_calibrations VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row)); }
  const before = rawCensus(f.db);
  expect(() => calculate(f.path, { ...f.request, calibrationReference: { ...f.request.calibrationReference, snapshotHash: hash('foreign') } })).toThrow();
  expect(() => calculate(f.path, { ...f.request, actor: f.actor })).toThrow(/input|fields/);
  expect(rawCensus(f.db)).toEqual(before); expect(calculate(f.path, f.request).frame.projectedExecutionState.revision).toBe(2);
});
