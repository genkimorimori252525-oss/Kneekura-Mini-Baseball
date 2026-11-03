import { expect, it } from 'vitest';
import { assertRetainedSpinTrialV227 } from './native-spin-trial-motor-evidence-v227';
it('V227-G01 accepts retained no-contact trial and rejects changed proof (synthetic stub)',()=>{
 const ref={owner:'pa_physical_v1_resolutions',sourceId:'r',sourceHash:'a',snapshotHash:'b'},commitRef={owner:'pa_physical_v1_commitments',sourceId:'c',sourceHash:'c',snapshotHash:'d'};
 const evidence={resolutionReference:ref,commitmentReference:commitRef,contact:null,trialEvidence:{id:'same'},motorTrace:null,qualifiedTransferProven:false,earnedQualification:false},
  retained={resolutionReference:ref,commitmentReference:commitRef,resolution:{contact:null},commitment:{trialEvidenceV226:{id:'same'},calculation:{algorithm:'batting-observed-spin-aim-trial-v226',observedSpinAimTrialV226:null}}};
 expect(assertRetainedSpinTrialV227(evidence as never,retained as never)).toBe(true);
 expect(()=>assertRetainedSpinTrialV227({...evidence,commitmentReference:{...commitRef,sourceHash:'bad'}} as never,retained as never)).toThrow(/fullref/);
 expect(()=>assertRetainedSpinTrialV227({...evidence,contact:{tick:1}} as never,retained as never)).toThrow(/contact/);
 expect(()=>assertRetainedSpinTrialV227({...evidence,earnedQualification:true} as never,retained as never)).toThrow(/qualification/);
});
