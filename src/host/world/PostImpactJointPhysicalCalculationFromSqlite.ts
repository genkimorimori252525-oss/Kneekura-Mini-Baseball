import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { queryPostImpactBatBodyWorldV1 } from '../../core/sim/pitch/PostImpactBatBodyWorldV1';
import { actorFreeze as freeze,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields } from './SamePlateAppearanceWorkPrefix';
import { readInitialJointPostImpactBasisFromSqlite,type InitialJointWorkloadViewReference } from './SqliteInitialJointWorkloadViewStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

export type PostImpactJointPhysicalCalculationRequestV1=Readonly<{workloadViewReference:InitialJointWorkloadViewReference;throughTick:number}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('post-impact joint physical calculation: '+message);}
/** Conditional geometric/physical calculation. Uses ORIGINAL accepted SI
 * ceilings, not a fabricated fatigue response or immediate neural policy.
 * Those and a fresh execution right remain explicit adoption requirements. */
export function calculatePostImpactJointPhysicalFromSqlite(db:DatabaseSync,raw:PostImpactJointPhysicalCalculationRequestV1){
  const r=cloneInert(raw);assert(fields(r,['workloadViewReference','throughTick'])&&Number.isSafeInteger(r.throughTick),'invalid request');
  const {workload,execution}=readInitialJointPostImpactBasisFromSqlite(db,r.workloadViewReference),world=execution.calculation.input;
  const input={version:'post_impact_bat_body_world_v1' as const,throughTick:r.throughTick,control:{version:'post_impact_bat_body_control_v1' as const,
    world,recoveryEndTick:world.batterControl.bat.throughTick,maximumSweetSpotSpeedMps:world.batterControl.bat.maximumSweetSpotSpeedMps,
    maximumBodySpeedMps:world.batterControl.body.maximumSpeedMps}};
  const result=queryPostImpactBatBodyWorldV1(input);
  if(result.kind!=='unresolved')assert(json(result.descriptor.initial.ball.position)===json(execution.executedThroughMoment.ball.position)
    &&result.descriptor.initial.elapsedSeconds===execution.executedThroughMoment.elapsedSeconds
    &&result.descriptor.initial.originTick===execution.executedThroughMoment.originTick,'actual impulse position/clock changed');
  return freeze({kind:'post_impact_joint_physical_calculation_v1' as const,request:r,lineage:execution.lineage,
    originalExecutionReference:workload.source.executionReference,workloadCoverageHash:workload.coverageHash,
    projectedParticipants:workload.participants.map(p=>({playerId:p.playerId,projectedState:p.projectedState,projectedStateHash:p.projectedStateHash})),
    input,result,originalCeilingsOnly:true as const,requiresAcceptedRecoveryPolicy:true as const,requiresCapabilityRecalibration:true as const,
    physicalExecutionRightRequired:true as const,physicalExecutionAdmitted:false as const,motionIssued:false as const});
}
export function readPostImpactJointPhysicalCalculation(path:string,request:PostImpactJointPhysicalCalculationRequestV1){
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
  try{db.exec('PRAGMA query_only=1; BEGIN');const result=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>calculatePostImpactJointPhysicalFromSqlite(db,request)));db.exec('COMMIT');return result;}
  finally{db.close();}
}
