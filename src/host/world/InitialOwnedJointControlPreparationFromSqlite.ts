import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields } from './SamePlateAppearanceWorkPrefix';
import { prepareInitialCoupledMeasuredBatControlFromSqlite,readHistoricalInitialCoupledMeasuredBatControlFromSqlite,type InitialCoupledMeasuredBatControlRequestV1 } from './InitialMeasuredBatControlFromSqlite';
import { readInitialPitchHandHoldControlFromSqlite,type InitialPitchHandHoldReference } from './SqliteInitialPitchHandHoldStore';
import { readMeasuredBattingBodyReferenceFromSqlite } from './SqliteMeasuredBattingBodyReferenceStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

export type InitialOwnedJointControlRequestV1=Readonly<{
  batter:InitialCoupledMeasuredBatControlRequestV1;pitcherHandHoldReference:InitialPitchHandHoldReference;
}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint control preparation: '+message);}

/** Current original decision/World and BOTH owned command dependencies.
 * This is the seam for the forward physical owner; neither a command right,
 * a fatigue/TOTAL receipt nor a physical ball advancement is issued here. */
export function prepareInitialOwnedJointControlFromSqlite(db:DatabaseSync,raw:InitialOwnedJointControlRequestV1){
  return jointParameters(db,raw,true);
}
/** Historical command reconstruction confers no present execution authority. */
export function readHistoricalInitialOwnedJointControlFromSqlite(db:DatabaseSync,raw:InitialOwnedJointControlRequestV1){
  return jointParameters(db,raw,false);
}
function jointParameters(db:DatabaseSync,raw:InitialOwnedJointControlRequestV1,current:boolean){
  const r=cloneInert(raw);assert(fields(r,['batter','pitcherHandHoldReference']),'invalid request');
  const batter=(current?prepareInitialCoupledMeasuredBatControlFromSqlite:readHistoricalInitialCoupledMeasuredBatControlFromSqlite)(db,r.batter),pitcher=readInitialPitchHandHoldControlFromSqlite(db,r.pitcherHandHoldReference);
  const body=readMeasuredBattingBodyReferenceFromSqlite(db,r.batter.bodyControlReference),hold=pitcher.hold,c=pitcher.original.control;
  assert(json(batter.lineage)===json(hold.lineage)&&json(r.batter.decisionReference)===json(hold.source.operationReference),'commands do not share the original decision/world');
  assert(batter.control.bat.throughTick<=hold.request.throughTick&&batter.control.bat.throughTick>hold.request.fromTick
    &&hold.request.fromTick===c.anchors.followThroughEndTick&&batter.evaluatedAtTick===hold.issuedAtTick,'joint interval or issuance clock differs');
  const throughTick=batter.control.bat.throughTick;
  return freeze({kind:'initial_owned_joint_control_preparation_v1' as const,request:r,lineage:batter.lineage,
    evaluatedAtTick:batter.evaluatedAtTick,throughTick,batterPlayerId:body.playerId,pitcherPlayerId:hold.pitcherPlayerId,
    batterControl:batter.control,batterCertificate:batter.certificate,pitcherHandHold:hold,
    // Extend coverage explicitly from the SAME original Source root. Never
    // reanchor the integrator at an observed/partitioned ball sample.
    physicalContext:{...c,descriptor:{...c.descriptor,throughElapsedSeconds:(throughTick-c.descriptor.initial.originTick)/1e6}},
    bodyReferenceOwned:true as const,pitcherSuccessorCommandOwned:true as const,allDeclaredControlLeasesCoverThroughTick:true as const,
    physicalExecutionRightRequired:true as const,workloadTotalAdmitted:false as const,
    motionIssued:false as const,physicalExecutionAdmitted:false as const,fullWorldAdvanceAllowed:false as const});
}

export function readInitialOwnedJointControlPreparation(path:string,request:InitialOwnedJointControlRequestV1){
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
  try{db.exec('PRAGMA query_only=1; BEGIN');const result=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>prepareInitialOwnedJointControlFromSqlite(db,request)));db.exec('COMMIT');return result;}
  finally{db.close();}
}
