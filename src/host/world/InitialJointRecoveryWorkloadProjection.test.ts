import { expect,it } from 'vitest';
import { createPlayerWorkloadRecovery,advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import { initialJointCumulativeWorkloadAssessmentInput,projectInitialJointCumulativeWorkload,projectInitialJointWorkload,type AcceptedInitialJointWorkloadView } from './InitialJointWorkloadProjection';
import { initialJointRecoveryWorkloadViewInput,projectInitialJointRecoveryWorkload,type AcceptedInitialJointRecoveryWorkloadView } from './InitialJointRecoveryWorkloadProjection';
const ref=<T extends string>(owner:T)=>({owner,sourceId:owner,sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)});
function fixture(){
  const participants=Array.from({length:10},(_,i)=>{
    const playerId='p'+i,reservedState=createPlayerWorkloadRecovery({careerId:'career',playerId,createdAtDay:1,fatigue:.1,recoveryCapacity:1,
      policy:{policyId:'explicit-synthetic-test',version:'v1',availableAtDay:1,workloadFatiguePerUnit:.025,travelFatiguePerKm:0,recoveryPerHour:.1}});
    const activity={sourceEventId:'match:'+playerId,sourceVersion:'v1',evidenceId:'reserved',careerId:'career',playerId,atDay:10,kind:'MATCH' as const,effortUnits:0},
      projectedState=advancePlayerWorkloadRecovery(reservedState,0,activity);
    return {playerId,reservedState,activity,projectedState,projectedStateHash:hash(projectedState),totalReference:ref('reserved_pa_total_assessments')};
  });
  const participantReferences=participants.map(p=>({playerId:p.playerId,bindingHash:'a'.repeat(64),personHash:'b'.repeat(64),baselineSourceId:'base:'+p.playerId,revision:0,stateHash:hash(p.reservedState)}));
  const original:SamePaExecutionView={kind:'basis_prepared',source:{sourceId:'view',sourceVersion:'v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:ref('same_pa_enrollments'),prefixReference:ref('reserved_pa_work_prefixes'),participantTotalReferences:[]},
    lineage:{enrollmentReference:ref('same_pa_enrollments'),actorReference:ref('physical_plate_appearance_actors'),careerId:'career',gameId:'game',playId:1,firstPhysicalPitchSourceId:'pitch',participantReferences},
    coverageHash:'c'.repeat(64),assessmentSetHash:'d'.repeat(64),participants};
  const assessment={basis:'EXPLICIT_SYNTHETIC_PREFIX_ASSESSMENT_V1' as const,availableAtDay:10,assessmentSourceId:'test-prefix-assessment',assessmentVersion:'v1',calibrationSourceId:'explicit-synthetic-calibration',calibrationVersion:'v1'},
    participantTotals=participantReferences.map((p,i)=>({participantReference:p,effortUnits:i===0?.75:i===1?1.25:0}));
  const old:AcceptedInitialJointWorkloadView={sourceId:'contact-total',sourceVersion:'v1',capability:'initial_joint_cumulative_workload_view_v1',executionReference:ref('pa_initial_joint_v1_executions'),coverageHash:'e'.repeat(64),assessment,participantTotals};
  const previous=projectInitialJointWorkload(old,{original,coverageHash:old.coverageHash,gameDay:10,activePlayerIds:['p0','p1']});
  const source:AcceptedInitialJointRecoveryWorkloadView={sourceId:'recovery-total',sourceVersion:'v1',capability:'initial_joint_recovery_cumulative_workload_view_v1',
    recoveryReference:ref('pa_joint_recovery_v1_executions'),coverageHash:'f'.repeat(64),assessment,participantTotals:participantTotals.map((p,i)=>({...p,effortUnits:i===0?.8:p.effortUnits}))};
  return {source,basis:{original,previous,coverageHash:source.coverageHash,gameDay:10,activePlayerIds:['p0','p1'],advancedPlayerIds:['p0']}};
}
it('reassesses the full original-to-recovery TOTAL once, preserving identity and explicit stationary zeroes',()=>{
  const f=fixture(),before=JSON.stringify(f),v=projectInitialJointRecoveryWorkload(f.source,f.basis);
  expect(v.participants[0].projectedState.fatigue).toBeCloseTo(.12);expect(v.participants[1].projectedState.fatigue).toBeCloseTo(.13125);
  expect(v.participants.every(p=>p.projectedState.revision===1)).toBe(true);expect(v.participants[2].effortUnits).toBe(0);
  expect(v.participants[0].activity.evidenceId).toBe('recovery-total');expect(v.globalWorkloadCommitted).toBe(false);expect(v.nextMotionAllowed).toBe(false);
  expect(JSON.stringify(f)).toBe(before);
});
it('requires increased cumulative work for the actual moving recovery participant',()=>{
  const f=fixture(),s=structuredClone(f.source);Object.assign(s.participantTotals[0],{effortUnits:.75});
  expect(()=>projectInitialJointRecoveryWorkload(s,f.basis)).toThrow(/increased cumulative TOTAL/);
  Object.assign(s.participantTotals[0],{effortUnits:.74});expect(()=>projectInitialJointRecoveryWorkload(s,f.basis)).toThrow(/erase previous TOTAL/);
});
it('cannot erase another participant earlier workload or omit a participant',()=>{
  const f=fixture(),s=structuredClone(f.source);Object.assign(s.participantTotals[1],{effortUnits:1.24});
  expect(()=>projectInitialJointRecoveryWorkload(s,f.basis)).toThrow(/erase previous TOTAL/);
  expect(()=>projectInitialJointRecoveryWorkload({...f.source,participantTotals:f.source.participantTotals.slice(1)},f.basis)).toThrow();
});
it('rejects changed coverage, future calibration and foreign person/state references',()=>{
  const f=fixture();expect(()=>projectInitialJointRecoveryWorkload({...f.source,coverageHash:'a'.repeat(64)},f.basis)).toThrow(/coverage/);
  expect(()=>projectInitialJointRecoveryWorkload({...f.source,assessment:{...f.source.assessment,availableAtDay:11}},f.basis)).toThrow(/future assessment/);
  const s=structuredClone(f.source);Object.assign(s.participantTotals[0].participantReference,{personHash:'e'.repeat(64)});
  expect(()=>projectInitialJointRecoveryWorkload(s,f.basis)).toThrow(/identity/);
});
it('rejects wrong previous reservation, previous population and invented active recovery participants',()=>{
  const f=fixture(),p=structuredClone(f.basis.previous);Object.assign(p.participants[0].reservedState,{fatigue:.9});
  expect(()=>projectInitialJointRecoveryWorkload(f.source,{...f.basis,previous:p})).toThrow(/reservation/);
  expect(()=>projectInitialJointRecoveryWorkload(f.source,{...f.basis,previous:{...f.basis.previous,participants:f.basis.previous.participants.slice(1)}})).toThrow(/extent/);
  expect(()=>projectInitialJointRecoveryWorkload(f.source,{...f.basis,advancedPlayerIds:['p2']})).toThrow(/actual recovery participants/);
});
it('rejects malformed owned Source, duplicate TOTAL, caller fatigue and implied new actuation',()=>{
  const f=fixture();for(const extra of [{nextMotionAllowed:true},{projectedFatigue:0},{assessment:null},{recoveryReference:ref('pa_initial_joint_v1_executions')}])
    expect(()=>initialJointRecoveryWorkloadViewInput({...f.source,...extra})).toThrow();
  expect(()=>initialJointRecoveryWorkloadViewInput({...f.source,participantTotals:[...f.source.participantTotals.slice(1),f.source.participantTotals[1]]})).toThrow(/unique/);
  const s=structuredClone(f.source);Object.assign(s.participantTotals[0],{effortUnits:Infinity});expect(()=>initialJointRecoveryWorkloadViewInput(s)).toThrow();
});
it('shares only owner-independent TOTAL projection and never accepts execution references into that grammar',()=>{
  const f=fixture(),s=f.source,common={sourceId:s.sourceId,coverageHash:s.coverageHash,assessment:s.assessment,participantTotals:s.participantTotals};
  expect(projectInitialJointRecoveryWorkload(s,f.basis)).toEqual(projectInitialJointCumulativeWorkload(common,f.basis));
  expect(()=>initialJointCumulativeWorkloadAssessmentInput({...common,executionReference:ref('pa_initial_joint_v1_executions')})).toThrow();
  expect(()=>initialJointCumulativeWorkloadAssessmentInput({...common,recoveryReference:s.recoveryReference})).toThrow();
});
