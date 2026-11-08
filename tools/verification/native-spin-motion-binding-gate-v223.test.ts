import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseDebugRecord } from './live-debug-record.mjs';
import { compareRetainedSpinMotorV223, inspectNativeSpinMotionBindingV223 } from './native-spin-motion-binding-gate-v223';
const path='docs/verification/realism-debug-20261027/native-spin-neutral-v193-recovery-01/actual-recovered-native-records.lossless.json';
it('V223-P01 compares retained NO target with TOP as a pure counterfactual without manufacturing motor evidence',()=>{
 const records=parseDebugRecord(readFileSync(path,'utf8')) as Parameters<typeof compareRetainedSpinMotorV223>[0];
 const before=JSON.stringify(records.input),result=compareRetainedSpinMotorV223(records);
 expect(JSON.stringify(records.input)).toBe(before);
 expect(result.nativeTopAdmissionProven).toBe(false);expect(result.originalMotionEvidence).toBe('MOTION_EVIDENCE_NOT_EXPOSED');
 expect(result.neutral.spinMotorPlanV123?.selectedIntent).toBe('NO_SPIN_TARGET');
 expect(result.top.spinMotorPlanV123?.declaredIntent).toBe('TOPSPIN');
 expect(result.qualificationComparison).toBe('DISTINCT');
 expect(result.motorOutcome).toBe('NO_MOTOR_DISTINCTION');expect(result.planMotionEqual).toBe(true);expect(result.commitmentEqual).toBe(true);
});
it('V223-P02 refuses to transform a retained original input or neutral intent silently',()=>{
 const records=parseDebugRecord(readFileSync(path,'utf8')) as Parameters<typeof compareRetainedSpinMotorV223>[0];
 const invalid=structuredClone(records),calculation=invalid.commitment.calculation;
 if(calculation.algorithm!=='batting-spin-execution-calculation-v123')throw Error('expected spin calculation');
 (calculation.spinContext.intent as {technique:string}).technique='BACKSPIN';
 expect(()=>compareRetainedSpinMotorV223(invalid)).toThrow(/original neutral/);
});

it('V223-I00 imports the Native gate without opening a database',()=>{expect(inspectNativeSpinMotionBindingV223).toBeTypeOf('function')});
