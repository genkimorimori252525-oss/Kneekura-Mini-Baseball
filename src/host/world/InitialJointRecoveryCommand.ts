import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaHash as digest,samePaReferenceValid as ref } from './SamePlateAppearanceWorkPrefix';
import type { InitialJointWorkloadViewReference } from './SqliteInitialJointWorkloadViewStore';

export type AcceptedInitialJointRecoveryCommand=Readonly<{
  sourceId:string;sourceVersion:string;capability:'owned_initial_joint_recovery_execution_v1';workloadViewReference:InitialJointWorkloadViewReference;recoveryEndTick:number;
  recoveryModel:Readonly<{modelId:'c1_post_impact_reference_pose_rest_v1';feedback:'ZERO_DELAY_KINEMATIC_TEST_MODEL';basis:'EXPLICIT_SYNTHETIC_IMPACT_RECOVERY_V1';
    availableAtDay:number;assessmentSourceId:string;assessmentVersion:string}>;
  capabilityResponse:Readonly<{playerId:string;personHash:string;projectedStateHash:string;calibrationSourceId:string;calibrationVersion:string;availableAtDay:number;
    fatigueSamples:readonly Readonly<{fatigue:number;maximumSweetSpotSpeedMps:number;maximumBodySpeedMps:number}>[]}>;
}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint recovery command: '+message);}
export function initialJointRecoveryCommandInput(raw:unknown,id?:string):AcceptedInitialJointRecoveryCommand{
  const s=cloneInert(raw) as AcceptedInitialJointRecoveryCommand;
  assert(fields(s,['sourceId','sourceVersion','capability','workloadViewReference','recoveryEndTick','recoveryModel','capabilityResponse'])&&text(s.sourceId)&&text(s.sourceVersion)
    &&(id===undefined||s.sourceId===id)&&s.capability==='owned_initial_joint_recovery_execution_v1'&&ref(s.workloadViewReference,'pa_joint_workload_v1_views')
    &&Number.isSafeInteger(s.recoveryEndTick)&&s.recoveryEndTick>0,'invalid identity, parent or finite interval');
  const m=s.recoveryModel;assert(fields(m,['modelId','feedback','basis','availableAtDay','assessmentSourceId','assessmentVersion'])&&m.modelId==='c1_post_impact_reference_pose_rest_v1'
    &&m.feedback==='ZERO_DELAY_KINEMATIC_TEST_MODEL'&&m.basis==='EXPLICIT_SYNTHETIC_IMPACT_RECOVERY_V1'&&Number.isSafeInteger(m.availableAtDay)&&m.availableAtDay>=0
    &&text(m.assessmentSourceId)&&text(m.assessmentVersion),'explicit supported recovery model required; measured/neural policy is not supplied by this test model');
  const c=s.capabilityResponse;assert(fields(c,['playerId','personHash','projectedStateHash','calibrationSourceId','calibrationVersion','availableAtDay','fatigueSamples'])
    &&text(c.playerId)&&digest(c.personHash)&&digest(c.projectedStateHash)&&text(c.calibrationSourceId)&&text(c.calibrationVersion)&&Number.isSafeInteger(c.availableAtDay)&&c.availableAtDay>=0
    &&Array.isArray(c.fatigueSamples)&&c.fatigueSamples.length>=2&&c.fatigueSamples.length<=32,'explicit person/state SI response required');
  assert(c.fatigueSamples.every((p,i)=>fields(p,['fatigue','maximumSweetSpotSpeedMps','maximumBodySpeedMps'])&&typeof p.fatigue==='number'&&Number.isFinite(p.fatigue)&&p.fatigue>=0&&p.fatigue<=1
    &&typeof p.maximumSweetSpotSpeedMps==='number'&&Number.isFinite(p.maximumSweetSpotSpeedMps)&&p.maximumSweetSpotSpeedMps>0
    &&typeof p.maximumBodySpeedMps==='number'&&Number.isFinite(p.maximumBodySpeedMps)&&p.maximumBodySpeedMps>0
    &&(i===0||p.fatigue>c.fatigueSamples[i-1].fatigue&&p.maximumSweetSpotSpeedMps<=c.fatigueSamples[i-1].maximumSweetSpotSpeedMps&&p.maximumBodySpeedMps<=c.fatigueSamples[i-1].maximumBodySpeedMps))
    &&c.fatigueSamples[0].fatigue===0&&c.fatigueSamples.at(-1)!.fatigue===1,'complete monotonic SI fatigue response required');
  return freeze(s);
}
/** Accepted SI samples only; no rating/league multiplier or implicit fallback. */
export function initialJointRecoveryCapabilityAt(source:AcceptedInitialJointRecoveryCommand,fatigue:number){
  const s=initialJointRecoveryCommandInput(source),knots=s.capabilityResponse.fatigueSamples;
  assert(Number.isFinite(fatigue)&&fatigue>=0&&fatigue<=1,'invalid projected fatigue');
  let i=0;while(i<knots.length-2&&fatigue>knots[i+1].fatigue)i++;
  const x=knots[i],y=knots[i+1],u=(fatigue-x.fatigue)/(y.fatigue-x.fatigue);
  return freeze({maximumSweetSpotSpeedMps:x.maximumSweetSpotSpeedMps+(y.maximumSweetSpotSpeedMps-x.maximumSweetSpotSpeedMps)*u,
    maximumBodySpeedMps:x.maximumBodySpeedMps+(y.maximumBodySpeedMps-x.maximumBodySpeedMps)*u});
}
