import type { PendingPreference,TraitEntry,TraitPolicy,TraitPortfolio,TraitResult,TraitState,TraitEvaluation } from './TraitTypes';
import { TRAIT_REGISTRY_VERSION } from './TraitFamilies';
import { greenCandidate } from './GreenPreference';
import { attempt,obj,family,fail,readEvaluation,readScope,readTime,readPolicy,integer,list,oneOf,same,stateId,timeAfter,unique,order,qualifiesMastery } from './TraitValidation';
function pending(input:unknown,familyId:string,path:string):PendingPreference|null{
  if(input===null)return null;const r=obj(input,['stateId','sinceDay','observations'],path),f=family(familyId,path),id=stateId(r.stateId,f,path+'.stateId');
  if(id===null)fail('INCONSISTENT_STATE',path);return{stateId:id,sinceDay:integer(r.sinceDay,path+'.sinceDay'),observations:integer(r.observations,path+'.observations',1)};
}
function proofScope(e:TraitEvaluation,last:TraitEvaluation):void{
  if(e.familyId!==last.familyId||!same(e.scope,last.scope)||!same(e.policyRef,last.policyRef)
    ||e.source.sourceKey!==last.source.sourceKey||e.expectedRevision>last.expectedRevision)
    fail('INCONSISTENT_STATE','entry.proof');
  if(e.expectedRevision===last.expectedRevision){if(!same(e,last))fail('INCONSISTENT_STATE','entry.proof');return;}
  if(!timeAfter(last.time,e.time)||e.evaluationId===last.evaluationId||e.source.episodeId===last.source.episodeId
    ||e.source.evidenceRevision>=last.source.evidenceRevision||e.source.sourceRevision>last.source.sourceRevision
    ||((e.source.sourceRevision===last.source.sourceRevision)!==(e.source.sourceSnapshotId===last.source.sourceSnapshotId)))
    fail('INCONSISTENT_STATE','entry.proof');
}
function readEntry(input:unknown,policy:TraitPolicy,path:string):TraitEntry{
  const r=obj(input,['familyId','effectiveStateId','lastEvaluation','masteryProof','pending','preferenceProof','changesThisSeason'],path),f=family(r.familyId,path+'.familyId');
  const last=readEvaluation(r.lastEvaluation,path+'.lastEvaluation'),id=stateId(r.effectiveStateId,f,path+'.effectiveStateId');
  const mastery=r.masteryProof===null?null:readEvaluation(r.masteryProof,path+'.masteryProof');
  const pend=pending(r.pending,f.familyId,path+'.pending');
  let pref:TraitEntry['preferenceProof']=null;
  if(r.preferenceProof!==null){const p=obj(r.preferenceProof,['stateId','sinceDay','observations','fromStateId','evaluation'],path+'.preferenceProof');
    const part=pending({stateId:p.stateId,sinceDay:p.sinceDay,observations:p.observations},f.familyId,path+'.preferenceProof')!;
    const from=stateId(p.fromStateId,f,path+'.preferenceProof.fromStateId');if(from===null)fail('INCONSISTENT_STATE',path+'.preferenceProof');
    pref={...part,fromStateId:from,evaluation:readEvaluation(p.evaluation,path+'.preferenceProof.evaluation')};}
  const count=integer(r.changesThisSeason,path+'.changesThisSeason');
  if(last.familyId!==f.familyId)fail('INCONSISTENT_STATE',path+'.familyId');
  if(f.lifecycleClass==='GRADED_DYNAMIC'){
    if(last.assessment.kind!=='CURRENT_SOURCE'||last.assessment.stateId!==id||mastery!==null||pend!==null||pref!==null||count!==0)fail('INCONSISTENT_STATE',path);
  }else if(f.lifecycleClass==='LEARNED_MASTERY_PERSISTENT'){
    if(pend!==null||pref!==null||count!==0||(id===null)!==(mastery===null))fail('INCONSISTENT_STATE',path);
    if(mastery){proofScope(mastery,last);if(!qualifiesMastery(mastery,policy)||mastery.assessment.kind!=='LEARNED_TECHNIQUE'||mastery.assessment.stateId!==id)fail('INCONSISTENT_STATE',path+'.masteryProof');}
    if(qualifiesMastery(last,policy)&&last.assessment.kind==='LEARNED_TECHNIQUE'
      &&f.stateIds.indexOf(last.assessment.stateId!)>f.stateIds.indexOf(id!))fail('INCONSISTENT_STATE',path+'.effectiveStateId');
  }else{
    const p=policy.green.find(x=>x.familyId===f.familyId);if(!p)fail('MISSING_FAMILY_POLICY',f.familyId);
    if(id===null||mastery!==null||(id!==f.neutralStateId&&pref===null))fail('INCONSISTENT_STATE',path);
    if(pref){proofScope(pref.evaluation,last);if(pref.stateId!==id||pref.fromStateId===id||pref.observations!==p.minimumObservations
      ||pref.evaluation.time.day-pref.sinceDay<p.minimumDays
      ||pref.observations>pref.evaluation.expectedRevision+1
      ||greenCandidate(pref.fromStateId,pref.evaluation.assessment,p)!==id)fail('INCONSISTENT_STATE',path+'.preferenceProof');}
    const candidate=greenCandidate(id,last.assessment,p);
    if(pend&&(pend.stateId!==candidate||pend.sinceDay>last.time.day||pend.observations>p.minimumObservations
      ||pend.observations>last.expectedRevision+1
      ||(pref&&(pend.sinceDay<pref.evaluation.time.day||pend.observations>last.expectedRevision-pref.evaluation.expectedRevision))
      ||(pend.observations===p.minimumObservations&&last.time.day-pend.sinceDay>=p.minimumDays)))fail('INCONSISTENT_STATE',path+'.pending');
    if(pref===null&&count!==0)fail('INCONSISTENT_STATE',path+'.changesThisSeason');
    if(candidate!==null&&pend===null)fail('INCONSISTENT_STATE',path+'.pending');
  }
  return{familyId:f.familyId,effectiveStateId:id,lastEvaluation:last,masteryProof:mastery,pending:pend,preferenceProof:pref,changesThisSeason:count};
}
export function readState(input:unknown):TraitState{
  const r=obj(input,['schemaVersion','registryVersion','scope','policy','revision','time','entries'],'state');
  oneOf(r.schemaVersion,[1],'state.schemaVersion');oneOf(r.registryVersion,[TRAIT_REGISTRY_VERSION],'state.registryVersion');
  const scope=readScope(r.scope,'state.scope'),policy=readPolicy(r.policy,'state.policy'),revision=integer(r.revision,'state.revision');
  const time=r.time===null?null:readTime(r.time,'state.time'),entries=list(r.entries,(v,p)=>readEntry(v,policy,p),'state.entries');
  unique(entries,x=>x.familyId,'state.entries');
  if(revision===0){if(time!==null||entries.length)fail('INCONSISTENT_STATE','state.revision');}
  else{if(time===null||!entries.length||entries.length>revision)fail('INCONSISTENT_STATE','state.time');
    let latest=false;const sources=new Set<string>();
    const evaluations=new Map<string,TraitEvaluation>(),revisions=new Map<number,TraitEvaluation>(),episodes=new Map<string,TraitEvaluation>();
    for(const e of entries){const last=e.lastEvaluation;
      if(!same(scope,last.scope)||last.policyRef.policyId!==policy.policyId||last.policyRef.version!==policy.version
        ||last.expectedRevision>=revision||last.time.season>time.season||(!same(time,last.time)&&!timeAfter(time,last.time))
        ||e.changesThisSeason>revision)fail('INCONSISTENT_STATE','state.entries');
      if(e.preferenceProof){const current=e.preferenceProof.evaluation.time.season===time.season;
        if((current&&e.changesThisSeason===0)||(!current&&e.changesThisSeason!==0))fail('INCONSISTENT_STATE','state.entries.changesThisSeason');}
      for(const known of [last,e.masteryProof,e.preferenceProof?.evaluation])if(known){
        const episode=JSON.stringify([known.familyId,known.source.episodeId]);
        for(const found of [evaluations.get(known.evaluationId),revisions.get(known.expectedRevision),episodes.get(episode)])
          if(found&&!same(found,known))fail('INCONSISTENT_STATE','state.entries.history');
        evaluations.set(known.evaluationId,known);revisions.set(known.expectedRevision,known);episodes.set(episode,known);
      }
      if(same(time,last.time)&&last.expectedRevision===revision-1)latest=true;
      if(e.masteryProof){const key=e.masteryProof.source.sourceKey;if(sources.has(key))fail('DUPLICATE_SOURCE_MASTERY','state.entries');sources.add(key);}
    }
    const chronological=[...revisions.values()].sort((a,b)=>a.expectedRevision-b.expectedRevision);
    for(let i=1;i<chronological.length;i++)if(!timeAfter(chronological[i]!.time,chronological[i-1]!.time))
      fail('INCONSISTENT_STATE','state.entries.history');
    if(!latest)fail('INCONSISTENT_STATE','state.time');
  }
  return{schemaVersion:1,registryVersion:TRAIT_REGISTRY_VERSION,scope,policy,revision,time,entries:entries.sort((a,b)=>order(a.familyId,b.familyId))};
}
export const createTraitState=(input:unknown):TraitResult<TraitState>=>attempt(()=>{
  const r=obj(input,['scope','policy'],'creation');return{schemaVersion:1,registryVersion:TRAIT_REGISTRY_VERSION,
    scope:readScope(r.scope,'creation.scope'),policy:readPolicy(r.policy,'creation.policy'),revision:0,time:null,entries:[]};
});
export const restoreTraitState=(input:unknown):TraitResult<TraitState>=>attempt(()=>readState(input));
export const getTraitPortfolio=(input:unknown):TraitResult<TraitPortfolio>=>attempt(()=>{
  const s=readState(input);return{boundary:'TRAIT_LIFECYCLE_ONLY',scope:s.scope,revision:s.revision,
    families:s.entries.filter(e=>e.effectiveStateId!==null).map(e=>{const f=family(e.familyId,'portfolio');return{
      familyId:f.familyId,lifecycleClass:f.lifecycleClass,stateId:e.effectiveStateId!,sourceRoute:f.sourceRoute,source:e.lastEvaluation.source};})};
});
