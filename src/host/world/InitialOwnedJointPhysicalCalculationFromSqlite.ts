import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { queryControlledBatBodyPitchWorldV1 } from '../../core/sim/pitch/ControlledBatBodyPitchWorldV1';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { actorFreeze as freeze,actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { prepareInitialOwnedJointControlFromSqlite,readHistoricalInitialOwnedJointControlFromSqlite,type InitialOwnedJointControlRequestV1 } from './InitialOwnedJointControlPreparationFromSqlite';
import { readMeasuredBattingBodyReferenceFromSqlite } from './SqliteMeasuredBattingBodyReferenceStore';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

export type InitialOwnedJointPhysicalCalculationRequestV1=Readonly<{controls:InitialOwnedJointControlRequestV1;throughTick:number}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint physical calculation: '+message);}

/** Conditional calculation on OWNED original inputs only. Same production
 * wood-contact policy as the existing physical episode; caller cannot inject
 * equipment, coefficient, contact point, ball future or desired outcome. This
 * does not consume a forward right or write a physical/canonical event. */
export function calculateInitialOwnedJointPhysicalFromSqlite(db:DatabaseSync,raw:InitialOwnedJointPhysicalCalculationRequestV1){
  return calculate(db,raw,true);
}
/** Recompute immutable executed evidence only; no current-cut authorization. */
export function calculateHistoricalInitialOwnedJointPhysicalFromSqlite(db:DatabaseSync,raw:InitialOwnedJointPhysicalCalculationRequestV1){
  return calculate(db,raw,false);
}
function calculate(db:DatabaseSync,raw:InitialOwnedJointPhysicalCalculationRequestV1,current:boolean){
  const r=cloneInert(raw);
  assert(fields(r,['controls','throughTick'])&&Number.isSafeInteger(r.throughTick),'invalid request');
  const joint=(current?prepareInitialOwnedJointControlFromSqlite:readHistoricalInitialOwnedJointControlFromSqlite)(db,r.controls);
  assert(r.throughTick>joint.evaluatedAtTick&&r.throughTick<=joint.throughTick,'new calculation must advance the current cut within all leases');
  const body=readMeasuredBattingBodyReferenceFromSqlite(db,r.controls.batter.bodyControlReference),model=playerBattingModelEvidenceFromSqlite(db).read(body.modelReference.sourceId);
  assert(model&&json(reference('world_player_batting_models',model))===json(body.modelReference),'original equipment model differs');
  const input={version:'controlled_bat_body_pitch_world_v1' as const,pitch:{...joint.physicalContext,throughTick:r.throughTick},
    pitcherRenewal:joint.pitcherHandHold.request,batterPlayerId:joint.batterPlayerId,batterControl:joint.batterControl,
    maximumGloveReachM:model.bodyMaterialization.reach.maximumGloveReachMeters,batPhysical:model.equipment.values.batPhysical,
    ball:model.equipment.values.ball,contactResponse:NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1};
  const result=queryControlledBatBodyPitchWorldV1(input);
  const moment=result.kind==='bat_contact'||result.kind==='actor_contact'?result.moment
    :result.kind==='scene_result'&&result.physical.kind!=='unresolved'?result.physical.moment:null;
  assert(!moment||moment.originTick+moment.elapsedSeconds*1e6>joint.evaluatedAtTick,'new controls changed already observed history');
  return freeze({kind:'initial_owned_joint_physical_calculation_v1' as const,request:r,lineage:joint.lineage,
    evaluatedAtTick:joint.evaluatedAtTick,equipmentReference:{sourceId:model.equipment.sourceId,sourceVersion:model.equipment.sourceVersion,sourceHash:hash(model.equipment)},
    contactPolicy:{profileId:input.contactResponse.profileId,version:input.contactResponse.version,evidenceIds:input.contactResponse.evidenceIds},
    input,result,conditionalOnControlExecution:true as const,physicalExecutionRightRequired:true as const,
    motionIssued:false as const,physicalExecutionAdmitted:false as const,workloadTotalAdmitted:false as const});
}

export function readInitialOwnedJointPhysicalCalculation(path:string,request:InitialOwnedJointPhysicalCalculationRequestV1){
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
  try{db.exec('PRAGMA query_only=1; BEGIN');const value=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>calculateInitialOwnedJointPhysicalFromSqlite(db,request)));db.exec('COMMIT');return value;}
  finally{db.close();}
}
