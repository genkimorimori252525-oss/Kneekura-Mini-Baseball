import type { TraitResult,TraitIssueCode,TraitPolicy,TraitEvaluation,TraitAssessment,TraitScope,TraitTime,TraitFamily } from './TraitTypes';
import { findTraitFamily } from './TraitFamilies';
class InvalidTrait extends Error { constructor(readonly code:TraitIssueCode,readonly path:string){super(code+': '+path);} }
export function fail(code:TraitIssueCode,path:string):never{throw new InvalidTrait(code,path);}
/** Used only for freshly parsed inert objects; never freeze caller-owned state. */
export function freeze<T>(value:T):T {if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function attempt<T>(work:()=>T):TraitResult<T>{try{return Object.freeze({ok:true,value:freeze(work())});}
  catch(e){if(!(e instanceof InvalidTrait))throw e;return Object.freeze({ok:false,reason:Object.freeze({code:e.code,path:e.path})});}}
export function record(input:unknown,path:string):Record<string,unknown>{
  if(input===null||typeof input!=='object'||Array.isArray(input))fail('INVALID_INPUT',path);
  const proto=Object.getPrototypeOf(input);if(proto!==Object.prototype&&proto!==null)fail('INVALID_INPUT',path);
  for(const k of Reflect.ownKeys(input)){const d=Object.getOwnPropertyDescriptor(input,k)!;
    if(typeof k!=='string'||!d.enumerable||!('value'in d))fail('INVALID_INPUT',path);}
  return input as Record<string,unknown>;
}
export function obj(input:unknown,keys:readonly string[],path:string):Record<string,unknown>{const r=record(input,path);
  if(Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))fail('INVALID_INPUT',path);return r;}
export function text(input:unknown,path:string):string{if(typeof input!=='string'||!input.trim())fail('INVALID_INPUT',path);return input;}
export function integer(input:unknown,path:string,minimum=0):number{if(typeof input!=='number'||!Number.isSafeInteger(input)||input<minimum)fail('INVALID_INPUT',path);return input===0?0:input;}
export function fraction(input:unknown,path:string):number{if(typeof input!=='number'||!Number.isFinite(input)||input<0||input>1)fail('INVALID_INPUT',path);return input===0?0:input;}
export function bool(input:unknown,path:string):boolean{if(typeof input!=='boolean')fail('INVALID_INPUT',path);return input;}
export function oneOf<const T extends readonly(string|number)[]>(input:unknown,values:T,path:string):T[number]{
  if(!values.includes(input as T[number]))fail('INVALID_INPUT',path);return input as T[number];}
export function list<T>(input:unknown,read:(v:unknown,p:string)=>T,path:string):T[]{
  if(!Array.isArray(input)||Reflect.ownKeys(input).length!==input.length+1)fail('INVALID_INPUT',path);
  const out:T[]=[];for(let i=0;i<input.length;i++){const d=Object.getOwnPropertyDescriptor(input,String(i));
    if(!d||!('value'in d)||!d.enumerable)fail('INVALID_INPUT',path);out.push(read(d.value,path+'['+i+']'));}return out;}
export function unique<T>(items:readonly T[],key:(v:T)=>string,path:string):void{if(new Set(items.map(key)).size!==items.length)fail('INCONSISTENT_STATE',path);}
export const order=(a:string,b:string):number=>a<b?-1:a>b?1:0;
export function same(a:unknown,b:unknown):boolean{if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));}
export function family(input:unknown,path:string):TraitFamily{const id=text(input,path),f=findTraitFamily(id);if(!f)fail('UNKNOWN_FAMILY',path);return f;}
export function readScope(input:unknown,path:string):TraitScope{const r=obj(input,['careerId','playerId'],path);return{careerId:text(r.careerId,path+'.careerId'),playerId:text(r.playerId,path+'.playerId')};}
export function readTime(input:unknown,path:string):TraitTime{const r=obj(input,['season','day','sequence'],path);return{season:integer(r.season,path+'.season'),day:integer(r.day,path+'.day'),sequence:integer(r.sequence,path+'.sequence')};}
export function timeAfter(a:TraitTime,b:TraitTime):boolean{return a.season>=b.season&&(a.day>b.day||(a.day===b.day&&a.sequence>b.sequence));}
export function stateId(input:unknown,f:TraitFamily,path:string):string|null{if(input===null)return null;const id=text(input,path);if(!f.stateIds.includes(id))fail('UNSUPPORTED_STATE',path);return id;}
export function readPolicy(input:unknown,path:string):TraitPolicy{
  const r=obj(input,['policyId','version','learned','green'],path);
  const learned=list(r.learned,(v,p)=>{const x=obj(v,['familyId','tiers'],p),f=family(x.familyId,p+'.familyId');
    if(f.lifecycleClass!=='LEARNED_MASTERY_PERSISTENT')fail('INVALID_INPUT',p+'.familyId');
    const tiers=list(x.tiers,(v,t)=>{const y=obj(v,['stateId','minimumRepetitions','minimumPracticeDays','minimumDistinctiveness'],t);
      const id=stateId(y.stateId,f,t+'.stateId');if(id===null)fail('INVALID_INPUT',t+'.stateId');
      const distinct=fraction(y.minimumDistinctiveness,t+'.minimumDistinctiveness');if(distinct===0)fail('INVALID_INPUT',t+'.minimumDistinctiveness');
      return{stateId:id,minimumRepetitions:integer(y.minimumRepetitions,t+'.minimumRepetitions',2),
        minimumPracticeDays:integer(y.minimumPracticeDays,t+'.minimumPracticeDays',1),minimumDistinctiveness:distinct};},p+'.tiers');
    if(tiers.length!==f.stateIds.length||tiers.some((v,i)=>v.stateId!==f.stateIds[i]))fail('INVALID_INPUT',p+'.tiers');
    for(let i=1;i<tiers.length;i++){const a=tiers[i-1]!,b=tiers[i]!;
      if(b.minimumRepetitions<a.minimumRepetitions||b.minimumPracticeDays<a.minimumPracticeDays||b.minimumDistinctiveness<a.minimumDistinctiveness)fail('INVALID_INPUT',p+'.tiers');}
    return{familyId:f.familyId,tiers};},path+'.learned');
  const green=list(r.green,(v,p)=>{const x=obj(v,['familyId','enterThreshold','leaveThreshold','minimumObservations','minimumDays'],p),f=family(x.familyId,p+'.familyId');
    if(f.lifecycleClass!=='GREEN_SLOW_PREFERENCE')fail('INVALID_INPUT',p+'.familyId');
    const enter=fraction(x.enterThreshold,p+'.enterThreshold'),leave=fraction(x.leaveThreshold,p+'.leaveThreshold');
    if(enter<=leave)fail('INVALID_INPUT',p+'.enterThreshold');return{familyId:f.familyId,enterThreshold:enter,leaveThreshold:leave,
      minimumObservations:integer(x.minimumObservations,p+'.minimumObservations',2),minimumDays:integer(x.minimumDays,p+'.minimumDays',1)};},path+'.green');
  unique(learned,x=>x.familyId,path+'.learned');unique(green,x=>x.familyId,path+'.green');
  return{policyId:text(r.policyId,path+'.policyId'),version:text(r.version,path+'.version'),
    learned:learned.sort((a,b)=>order(a.familyId,b.familyId)),green:green.sort((a,b)=>order(a.familyId,b.familyId))};
}
export function readEvaluation(input:unknown,path:string):TraitEvaluation{
  const r=obj(input,['scope','policyRef','evaluationId','expectedRevision','time','familyId','source','assessment'],path),f=family(r.familyId,path+'.familyId');
  const ref=obj(r.policyRef,['policyId','version'],path+'.policyRef');
  const s=obj(r.source,['sourceKey','sourceRevision','sourceSnapshotId','evidenceRevision','episodeId','eventIds','changeKind'],path+'.source');
  const eventIds=list(s.eventIds,text,path+'.source.eventIds');if(!eventIds.length)fail('INVALID_INPUT',path+'.source.eventIds');unique(eventIds,x=>x,path+'.source.eventIds');
  const a=record(r.assessment,path+'.assessment');let assessment:TraitAssessment;
  if(f.lifecycleClass==='GRADED_DYNAMIC'){
    const x=obj(a,['kind','stateId'],path+'.assessment');oneOf(x.kind,['CURRENT_SOURCE'],path+'.assessment.kind');
    assessment={kind:'CURRENT_SOURCE',stateId:stateId(x.stateId,f,path+'.assessment.stateId')};
  }else if(f.lifecycleClass==='LEARNED_MASTERY_PERSISTENT'){
    const x=obj(a,['kind','stateId','stage','relevantRepetitions','practiceDays','distinctiveness'],path+'.assessment');oneOf(x.kind,['LEARNED_TECHNIQUE'],path+'.assessment.kind');
    assessment={kind:'LEARNED_TECHNIQUE',stateId:stateId(x.stateId,f,path+'.assessment.stateId'),
      stage:oneOf(x.stage,['CATALYST','HYPOTHESIS','REPETITION','CONSOLIDATED'],path+'.assessment.stage'),
      relevantRepetitions:integer(x.relevantRepetitions,path+'.assessment.relevantRepetitions'),practiceDays:integer(x.practiceDays,path+'.assessment.practiceDays'),
      distinctiveness:fraction(x.distinctiveness,path+'.assessment.distinctiveness')};
  }else{
    const x=obj(a,['kind','support','behavior','internalized'],path+'.assessment');oneOf(x.kind,['SLOW_PREFERENCE'],path+'.assessment.kind');
    const support=list(x.support,(v,p)=>{const y=obj(v,['stateId','value'],p),id=stateId(y.stateId,f,p+'.stateId');if(id===null)fail('INVALID_INPUT',p+'.stateId');return{stateId:id,value:fraction(y.value,p+'.value')};},path+'.assessment.support');
    unique(support,x=>x.stateId,path+'.assessment.support');if(support.length!==f.stateIds.length)fail('INVALID_INPUT',path+'.assessment.support');
    assessment={kind:'SLOW_PREFERENCE',support:support.sort((a,b)=>order(a.stateId,b.stateId)),
      behavior:oneOf(x.behavior,['VOLUNTARY','ACCEPTED','MANAGER_COMMAND'],path+'.assessment.behavior'),internalized:bool(x.internalized,path+'.assessment.internalized')};
  }
  return{scope:readScope(r.scope,path+'.scope'),policyRef:{policyId:text(ref.policyId,path+'.policyRef.policyId'),version:text(ref.version,path+'.policyRef.version')},
    evaluationId:text(r.evaluationId,path+'.evaluationId'),expectedRevision:integer(r.expectedRevision,path+'.expectedRevision'),time:readTime(r.time,path+'.time'),familyId:f.familyId,
    source:{sourceKey:text(s.sourceKey,path+'.source.sourceKey'),sourceRevision:integer(s.sourceRevision,path+'.source.sourceRevision'),sourceSnapshotId:text(s.sourceSnapshotId,path+'.source.sourceSnapshotId'),
      evidenceRevision:integer(s.evidenceRevision,path+'.source.evidenceRevision'),episodeId:text(s.episodeId,path+'.source.episodeId'),eventIds,
      changeKind:oneOf(s.changeKind,['RECOGNITION','DEVELOPMENT','BOTH'],path+'.source.changeKind')},assessment};
}
export function qualifiesMastery(e:TraitEvaluation,policy:TraitPolicy):boolean{
  const p=policy.learned.find(x=>x.familyId===e.familyId);if(!p)fail('MISSING_FAMILY_POLICY',e.familyId);
  const a=e.assessment;if(a.kind!=='LEARNED_TECHNIQUE'||a.stateId===null||a.stage!=='CONSOLIDATED')return false;
  const r=p.tiers.find(x=>x.stateId===a.stateId)!;
  return a.relevantRepetitions>=r.minimumRepetitions&&a.practiceDays>=r.minimumPracticeDays&&a.distinctiveness>=r.minimumDistinctiveness;
}
