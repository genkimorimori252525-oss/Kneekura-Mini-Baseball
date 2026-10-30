import { expect,it } from 'vitest';
import { initialJointRecoveryCommandInput,initialJointRecoveryCapabilityAt,type AcceptedInitialJointRecoveryCommand } from './InitialJointRecoveryCommand';
const fixture=():AcceptedInitialJointRecoveryCommand=>({sourceId:'recovery',sourceVersion:'test-v1',capability:'owned_initial_joint_recovery_execution_v1',
  workloadViewReference:{owner:'pa_joint_workload_v1_views',sourceId:'view',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)},recoveryEndTick:1100000,
  recoveryModel:{modelId:'c1_post_impact_reference_pose_rest_v1',feedback:'ZERO_DELAY_KINEMATIC_TEST_MODEL',basis:'EXPLICIT_SYNTHETIC_IMPACT_RECOVERY_V1',availableAtDay:1,assessmentSourceId:'test-only-model',assessmentVersion:'v1'},
  capabilityResponse:{playerId:'batter',personHash:'c'.repeat(64),projectedStateHash:'d'.repeat(64),calibrationSourceId:'test-only-SI',calibrationVersion:'v1',availableAtDay:1,
    fatigueSamples:[{fatigue:0,maximumSweetSpotSpeedMps:50,maximumBodySpeedMps:5},{fatigue:1,maximumSweetSpotSpeedMps:40,maximumBodySpeedMps:4}]}});
it('uses explicit SI response at the projected fatigue and retains the test-model provenance',()=>{
  const s=fixture();expect(initialJointRecoveryCapabilityAt(s,.075)).toEqual({maximumSweetSpotSpeedMps:49.25,maximumBodySpeedMps:4.925});
  expect(initialJointRecoveryCapabilityAt(s,0).maximumSweetSpotSpeedMps).toBe(50);expect(initialJointRecoveryCapabilityAt(s,1).maximumBodySpeedMps).toBe(4);
  expect(initialJointRecoveryCommandInput(s)).toEqual(s);expect(()=>initialJointRecoveryCapabilityAt(s,1.1)).toThrow();
});
it('refuses caller impulse, missing source provenance or a fabricated measured recovery model',()=>{
  const s=fixture();expect(()=>initialJointRecoveryCommandInput({...s,impulse:{}})).toThrow();
  expect(()=>initialJointRecoveryCommandInput({...s,recoveryModel:{...s.recoveryModel,basis:'MEASURED'}})).toThrow();
  expect(()=>initialJointRecoveryCommandInput({...s,capabilityResponse:{...s.capabilityResponse,calibrationSourceId:''}})).toThrow();
});
it('refuses incomplete, duplicate or fatigue-increasing capabilities rather than silently filling samples',()=>{
  const s=fixture(),c=s.capabilityResponse;
  for(const samples of [[c.fatigueSamples[0]],[c.fatigueSamples[0],c.fatigueSamples[0]],
    [{...c.fatigueSamples[0],fatigue:.1},c.fatigueSamples[1]],[c.fatigueSamples[0],{...c.fatigueSamples[1],maximumBodySpeedMps:6}]])
    expect(()=>initialJointRecoveryCommandInput({...s,capabilityResponse:{...c,fatigueSamples:samples}})).toThrow();
});
it('rejects altered person/state reference shapes, foreign parent and nonfinite ceilings',()=>{
  const s=fixture();expect(()=>initialJointRecoveryCommandInput({...s,workloadViewReference:{...s.workloadViewReference,owner:'pa_initial_joint_v1_executions'}})).toThrow();
  expect(()=>initialJointRecoveryCommandInput({...s,capabilityResponse:{...s.capabilityResponse,projectedStateHash:'wrong'}})).toThrow();
  expect(()=>initialJointRecoveryCommandInput({...s,capabilityResponse:{...s.capabilityResponse,fatigueSamples:[s.capabilityResponse.fatigueSamples[0],{...s.capabilityResponse.fatigueSamples[1],maximumSweetSpotSpeedMps:Infinity}]}})).toThrow();
});
