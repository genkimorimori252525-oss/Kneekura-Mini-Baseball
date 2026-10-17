import { expect,it } from 'vitest';
import { createPlayerWorkloadRecovery,advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import { initialJointWorkloadViewInput,projectInitialJointWorkload,type AcceptedInitialJointWorkloadView } from './InitialJointWorkloadProjection';
const ref=<T extends string>(owner:T)=>({owner,sourceId:owner,sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)});
function fixture(previousEffort=0){
  const participants=Array.from({length:10},(_,i)=>{
    const playerId='p'+i,reservedState=createPlayerWorkloadRecovery({careerId:'career',playerId,createdAtDay:1,fatigue:.1,recoveryCapacity:1,
      policy:{policyId:'explicit-test',version:'v1',availableAtDay:1,workloadFatiguePerUnit:.025,travelFatiguePerKm:0,recoveryPerHour:.1}});
    const activity={sourceEventId:'match:'+playerId,sourceVersion:'v1',evidenceId:'old',careerId:'career',playerId,atDay:10,kind:'MATCH' as const,effortUnits:previousEffort};
    const projectedState=advancePlayerWorkloadRecovery(reservedState,0,activity);
    return {playerId,reservedState,activity,projectedState,projectedStateHash:hash(projectedState),totalReference:ref('reserved_pa_total_assessments')};
  });
  const participantReferences=participants.map(p=>({playerId:p.playerId,bindingHash:'a'.repeat(64),personHash:'b'.repeat(64),baselineSourceId:'base:'+p.playerId,revision:0,stateHash:hash(p.reservedState)}));
  const original:SamePaExecutionView={kind:'basis_prepared',source:{sourceId:'view',sourceVersion:'v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:ref('same_pa_enrollments'),prefixReference:ref('reserved_pa_work_prefixes'),participantTotalReferences:[]},
    lineage:{enrollmentReference:ref('same_pa_enrollments'),actorReference:ref('physical_plate_appearance_actors'),careerId:'career',gameId:'game',playId:1,firstPhysicalPitchSourceId:'pitch',participantReferences},
    coverageHash:'c'.repeat(64),assessmentSetHash:'d'.repeat(64),participants};
  const source:AcceptedInitialJointWorkloadView={sourceId:'new-total',sourceVersion:'v1',capability:'initial_joint_cumulative_workload_view_v1',executionReference:ref('pa_initial_joint_v1_executions'),coverageHash:'e'.repeat(64),
    assessment:{basis:'EXPLICIT_SYNTHETIC_PREFIX_ASSESSMENT_V1',availableAtDay:10,assessmentSourceId:'explicit-synthetic',assessmentVersion:'v1',calibrationSourceId:'synthetic-calibration',calibrationVersion:'v1'},
    participantTotals:participantReferences.map((p,i)=>({participantReference:p,effortUnits:i===0?2:i===1?3:previousEffort}))};
  return {source,basis:{original,coverageHash:source.coverageHash,gameDay:10,activePlayerIds:['p0','p1']}};
}
it('projects real nonempty cumulative work from reserved states exactly once, not from prior projections',()=>{
  const f=fixture(1),before=JSON.stringify(f),result=projectInitialJointWorkload(f.source,f.basis);
  expect(result.participants[0].projectedState.fatigue).toBeCloseTo(.15);
  expect(result.participants[1].projectedState.fatigue).toBeCloseTo(.175);
  expect(result.participants.every(p=>p.projectedState.revision===1)).toBe(true);
  expect(result.globalWorkloadCommitted).toBe(false);expect(result.nextMotionAllowed).toBe(false);
  expect(result.workloadTotalAdmitted).toBe(true);expect(JSON.stringify(f)).toBe(before);
});
it('allows explicit zero TOTAL for stationary participants while refusing it for actual active work',()=>{
  const f=fixture();expect(projectInitialJointWorkload(f.source,f.basis).participants[2].effortUnits).toBe(0);
  const s=structuredClone(f.source);Object.assign(s.participantTotals[0],{effortUnits:0});expect(()=>projectInitialJointWorkload(s,f.basis)).toThrow(/empty zero TOTAL/);
});
it('refuses a different physical prefix, foreign participant state and a future assessment',()=>{
  const f=fixture();expect(()=>projectInitialJointWorkload({...f.source,coverageHash:'f'.repeat(64)},f.basis)).toThrow(/coverage/);
  const s=structuredClone(f.source);Object.assign(s.participantTotals[0].participantReference,{stateHash:'f'.repeat(64)});expect(()=>projectInitialJointWorkload(s,f.basis)).toThrow(/reference/);
  expect(()=>projectInitialJointWorkload({...f.source,assessment:{...f.source.assessment,availableAtDay:11}},f.basis)).toThrow(/future assessment/);
});
it('refuses loss, duplication or erasure of cumulative participant work',()=>{
  const f=fixture(1);expect(()=>projectInitialJointWorkload({...f.source,participantTotals:f.source.participantTotals.slice(1)},f.basis)).toThrow();
  const s=structuredClone(f.source);Object.assign(s.participantTotals[2],{effortUnits:0});expect(()=>projectInitialJointWorkload(s,f.basis)).toThrow(/erase/);
  expect(()=>initialJointWorkloadViewInput({...f.source,participantTotals:[...f.source.participantTotals.slice(1),f.source.participantTotals[1]]})).toThrow(/unique/);
});
it('requires explicit provenance and rejects caller physiology, successor authorization or invalid effort',()=>{
  const f=fixture();for(const extra of [{nextMotionAllowed:true},{projectedFatigue:0},{assessment:null}])expect(()=>initialJointWorkloadViewInput({...f.source,...extra})).toThrow();
  const s=structuredClone(f.source);Object.assign(s.participantTotals[0],{effortUnits:NaN});expect(()=>initialJointWorkloadViewInput(s)).toThrow();
});
