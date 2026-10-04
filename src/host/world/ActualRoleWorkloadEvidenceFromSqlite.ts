import type { DatabaseSync } from 'node:sqlite';
import { actualLivePlayClosureEvidenceFromSqlite, assertActualLiveClosureStage } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualRoleWorkloadAssessmentInput as input, deriveActualRoleWorkloadActivity, type AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import { prepareActualRoleWorkloadSettlement } from './ActualRoleWorkloadSettlementPlan';
import { readActualRoleWorkloadState, actualRoleTableInstalled as installed } from './ActualRoleWorkloadState';
import { assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { actualRoleWorkloadIdentityRow as identity, actualRoleWorkloadScopeRows as scopeRows } from './ActualRoleWorkloadMetadata';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayId as id } from './ActualLivePlayScope';
type Db=Pick<DatabaseSync,'prepare'>;
export const actualRoleWorkloadContextFromSqlite=(db:Db,closureSourceId:string)=>{
  if(!id(closureSourceId) || !installed(db,'actual_live_play_closures')) throw new Error('actual role workload closure missing');
  const closure=actualLivePlayClosureEvidenceFromSqlite(db).read(closureSourceId);
  if(!closure) throw new Error('actual role workload closure missing');
  const p=closure.proposal;
  if(json(p.physicalEndReference)!==json(p.controllerReset.physicalEndReference)) throw new Error('actual role workload physical end differs');
  const actors=[...p.actors].sort((a,b)=>a.binding.playerId < b.binding.playerId ? -1 : a.binding.playerId > b.binding.playerId ? 1 : 0);
  if(!actors.length || actors.some(a=>a.binding.careerId!==actors[0].binding.careerId || a.binding.gameId!==p.gameId || a.binding.gameDay!==actors[0].binding.gameDay)) throw new Error('actual role workload original participants differ');
  return freeze({closure,p,actors,reference:{closureSourceId,closureApplicationId:p.application.applicationId,closureProposalHash:hash(p),
    careerId:actors[0].binding.careerId,gameId:p.gameId,playId:p.playId,gameDay:actors[0].binding.gameDay,
    physicalEndReference:p.physicalEndReference,wholeHistoryReference:p.wholeHistoryReference}});
};
export type ActualRoleWorkloadContext=ReturnType<typeof actualRoleWorkloadContextFromSqlite>;
export const deriveActualRoleWorkloadAssessment=(context:ActualRoleWorkloadContext,raw:AcceptedActualRoleWorkloadAssessment)=>{
  const source=input(raw,raw.sourceId), ref=context.reference;
  const actor=context.actors.find(a=>a.binding.playerId===source.participantReference.playerId);
  if(source.closureSourceId!==ref.closureSourceId || !actor || json(source.physicalEndReference)!==json(ref.physicalEndReference)
    || json(source.wholeHistoryReference)!==json(ref.wholeHistoryReference)
    || source.participantReference.bindingHash!==hash(actor.binding) || source.participantReference.personHash!==hash(actor.person)) throw new Error('actual role workload original physical/participant reference differs');
  const scope={careerId:ref.careerId,gameId:ref.gameId,playId:ref.playId,playerId:actor.binding.playerId};
  return freeze({source,...scope,actor,activity:deriveActualRoleWorkloadActivity(source,{...scope,gameDay:ref.gameDay})});
};
export type DurableActualRoleWorkloadAssessment=ReturnType<typeof deriveActualRoleWorkloadAssessment>;
const assessmentRows=(db:Db,c:ActualRoleWorkloadContext)=>{
  if(!installed(db,'actual_role_workload_assessments')) return [];
  return scopeRows(db,'actual_role_workload_assessments',{closureSourceId:c.reference.closureSourceId,careerId:c.reference.careerId,
    gameId:c.reference.gameId,playId:c.reference.playId,physicalEndSourceId:c.reference.physicalEndReference.sourceId});
};
export const readActualRoleAssessments=(db:Db,c:ActualRoleWorkloadContext)=>{
  const values=assessmentRows(db,c).map(row=>{
    const owned=identity(db,'actual_role_workload_assessments',String(row.source_id));
    if(!owned) throw new Error('actual role workload assessment missing');
    const value=deriveActualRoleWorkloadAssessment(c,input(JSON.parse(String(row.source_json)),String(row.source_id)));
    assertNoLegacyPitchWorkloadCharge(db,value);
    if(row.source_id!==value.source.sourceId || row.closure_source_id!==c.reference.closureSourceId || row.career_id!==value.careerId
      || row.game_id!==value.gameId || row.play_id!==value.playId || row.player_id!==value.playerId
      || row.source_json!==json(value.source) || row.source_hash!==hash(value.source) || row.snapshot_json!==json(value) || row.snapshot_hash!==hash(value)) throw new Error('actual role workload assessment archive differs');
    return value;
  });
  if(new Set(values.map(v=>v.playerId)).size!==values.length) throw new Error('actual role workload canonical charge alias differs');
  return values;
};
const actorRefs=(c:ActualRoleWorkloadContext)=>c.actors.map(a=>({playerId:a.binding.playerId,personId:a.person.personId,clubId:a.binding.clubId}));
const assessmentRefs=(values:readonly DurableActualRoleWorkloadAssessment[])=>values.map(v=>({assessmentSourceId:v.source.sourceId,playerId:v.playerId,activity:v.activity}));
export const prepareActualRoleWorkloadPlan=(db:Db,c:ActualRoleWorkloadContext)=>{
  assertActualLiveClosureStage(db,c.p,true);
  const assessments=readActualRoleAssessments(db,c), states=c.actors.map(a=>readActualRoleWorkloadState(db,a.binding.careerId,a.binding.playerId,undefined,a.binding.personLinkSourceId)).filter(v=>v!==null);
  const prepared=prepareActualRoleWorkloadSettlement(actorRefs(c),assessmentRefs(assessments),states);
  return prepared.kind==='pending' ? freeze({...c.reference,...prepared}) : freeze({...c.reference,...prepared,
    assessmentHashes:assessments.map(a=>({sourceId:a.source.sourceId,hash:hash(a)})).sort((a,b)=>a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0)});
};
export type ActualRoleFrozenWorkloadPlan=Extract<ReturnType<typeof prepareActualRoleWorkloadPlan>,{kind:'frozen'}>;
/** Complete means every required immutable state effect exists. There is no fatigue threshold. */
export const actualRoleWorkloadEvidenceFromSqlite=(db:Db)=>({
  readSettlement(closureSourceId:string){
    const c=actualRoleWorkloadContextFromSqlite(db,closureSourceId);
    const row=installed(db,'actual_role_workload_settlements') ? identity(db,'actual_role_workload_settlements',closureSourceId):null;
    if(!row){
      const pending=prepareActualRoleWorkloadPlan(db,c);
      if(pending.kind==='pending') return pending;
      return freeze({...c.reference,kind:'pending' as const,missingAssessments:[] as string[],missingBaselines:[] as string[],reason:'settlement_not_frozen' as const});
    }
    const saved=JSON.parse(String(row.plan_json)) as ActualRoleFrozenWorkloadPlan;
    const assessments=readActualRoleAssessments(db,c);
    const states=c.actors.map(a=>{
      const original=saved.participants?.find(p=>p.playerId===a.binding.playerId);
      if(!original) throw new Error('actual role workload frozen participant missing');
      const state=readActualRoleWorkloadState(db,a.binding.careerId,a.binding.playerId,original.before.revision,a.binding.personLinkSourceId);
      if(!state || json(state)!==json(original.before)) throw new Error('actual role workload frozen BEFORE differs');
      return state;
    });
    const prepared=prepareActualRoleWorkloadSettlement(actorRefs(c),assessmentRefs(assessments),states);
    if(prepared.kind!=='frozen') throw new Error('actual role workload frozen assessment set missing');
    const plan=freeze({...c.reference,...prepared,assessmentHashes:assessments.map(a=>({sourceId:a.source.sourceId,hash:hash(a)})).sort((a,b)=>a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0)});
    const peers=scopeRows(db,'actual_role_workload_settlements',{closureSourceId,careerId:c.reference.careerId,gameId:c.reference.gameId,playId:c.reference.playId,physicalEndSourceId:c.reference.physicalEndReference.sourceId});
    if(peers.length!==1 || peers[0].closure_source_id!==closureSourceId || row.career_id!==c.reference.careerId || row.game_id!==c.reference.gameId
      || row.play_id!==c.reference.playId || row.plan_json!==json(plan) || row.plan_hash!==hash(plan)) throw new Error('actual role workload frozen plan differs');
    assertActualLiveClosureStage(db,c.p,true);
    const participants=plan.participants.map(p=>{
      const rows=db.prepare(`SELECT * FROM world_player_workload_activities WHERE source_id=$id OR ${claim('source_json',['sourceEventId'],'$id')}`).all({id:p.activity.sourceEventId});
      if(rows.length>1) throw new Error('actual role workload activity ownership differs');
      const a=rows[0];
      if(a){
        if(a.source_id!==p.activity.sourceEventId || a.career_id!==plan.careerId || a.player_id!==p.playerId || a.before_revision!==p.before.revision
          || a.after_revision!==p.after.revision || a.source_json!==json(p.activity) || a.before_json!==json(p.before) || a.after_json!==json(p.after)
          || json(readActualRoleWorkloadState(db,plan.careerId,p.playerId,p.after.revision))!==json(p.after)) throw new Error('actual role workload applied BEFORE/AFTER differs');
      }
      return {...p,applied:!!a};
    });
    return freeze({...plan,kind:participants.every(p=>p.applied)?'complete' as const:'applying' as const,participants});
  }
});
