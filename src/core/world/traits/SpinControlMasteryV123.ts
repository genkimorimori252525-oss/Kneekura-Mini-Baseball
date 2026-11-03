import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import {assessDevelopmentPracticeExposure,type DevelopmentPracticeBundle,type DevelopmentPracticeEpisode} from '../development/DevelopmentPracticeExposure';
import type {TraitScope} from './TraitTypes';
import {SPIN_TECHNIQUES_V123,SPIN_CONTROL_VARIANT_FAMILY_V123,type SpinTechniqueV123} from './SpinTechniqueV123';
export {SPIN_TECHNIQUES_V123,SPIN_CONTROL_VARIANT_FAMILY_V123,type SpinTechniqueV123} from './SpinTechniqueV123';
export type SpinMasteryPolicyV123=Readonly<{policyId:string;version:string;availableAtDay:number;minimumEffectiveExposure:number;
 minimumDistinctPracticeDays:number;minimumDistinctiveness:number}>;
type Ref=Readonly<{sourceId:string;sourceVersion:string}>;
export type SpinTechniqueQualificationV123=Readonly<{technique:SpinTechniqueV123;sourceId:string;sourceVersion:string;sourceEffectIdentity:string;
 acceptedAtDay:number;episode:DevelopmentPracticeEpisode;bundle:DevelopmentPracticeBundle;distinctiveness:number;repertoireRef:Ref;
 calibration:Ref&Readonly<{status:'MODEL_VERIFIED'|'UNVERIFIED'}>}>;
export type SpinMasteryProjectionInputV123=Readonly<{scope:TraitScope;atDay:number;policy:SpinMasteryPolicyV123;proofs:readonly SpinTechniqueQualificationV123[]}>;
const fields=(v:unknown,n:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===n.length&&n.every(k=>Object.hasOwn(v,k));
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=200;
const day=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const unit=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1;
const ref=(v:Ref)=>fields(v,['sourceId','sourceVersion'])&&Object.values(v).every(text);
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}

/** Qualification/Projection only. A raw episode and explicit calibration are
 * NOT Native admission; a Native consumer must re-read the original practice
 * and development owners. No result, ability or motion is changed here. */
export function projectSpinControlMasteryV123(raw:SpinMasteryProjectionInputV123){
 const input=cloneInert(raw),p=input.policy;
 if(!fields(input,['scope','atDay','policy','proofs'])||!fields(input.scope,['careerId','playerId'])||!Object.values(input.scope).every(text)||!day(input.atDay)
  ||!fields(p,['policyId','version','availableAtDay','minimumEffectiveExposure','minimumDistinctPracticeDays','minimumDistinctiveness'])
  ||![p.policyId,p.version].every(text)||!day(p.availableAtDay)||p.availableAtDay>input.atDay||!Number.isFinite(p.minimumEffectiveExposure)||p.minimumEffectiveExposure<=0
  ||!Number.isSafeInteger(p.minimumDistinctPracticeDays)||p.minimumDistinctPracticeDays<1||!unit(p.minimumDistinctiveness)
  ||!Array.isArray(input.proofs)||input.proofs.length>4)throw Error('invalid explicit spin mastery policy, scope or qualification inventory');
 type Reason='INVALID_EVIDENCE'|'OUT_OF_SCOPE'|'FUTURE_SOURCE'|'UNCONSOLIDATED'|'UNVERIFIED_CALIBRATION'|'INSUFFICIENT_EXPOSURE'|'INSUFFICIENT_DISTINCTIVENESS'|'ALIASED_SOURCE';
 const aliasKeys=(q:SpinTechniqueQualificationV123)=>[
  ['technique',q?.technique],['source',q?.sourceId],['effect',q?.sourceEffectIdentity],['episode',q?.episode?.episodeId],
  ...(Array.isArray(q?.episode?.practiceSourceEventIds)?q.episode.practiceSourceEventIds.map(id=>['practice',id]):[])
 ].filter(([,value])=>text(value)).map(([kind,value])=>JSON.stringify([kind,value])),
  uses=new Map<string,number>();
 for(const q of input.proofs)for(const key of new Set(aliasKeys(q)))uses.set(key,(uses.get(key)??0)+1);
 const rejected:{technique:string|null;sourceId:string|null;reason:Reason}[]=[],qualified:{technique:SpinTechniqueV123;sourceId:string;sourceVersion:string;
  sourceEffectIdentity:string;acceptedAtDay:number;episodeId:string;repertoireRef:Ref;calibrationRef:Ref;effectiveExposure:number;distinctPracticeDays:number}[]=[];
 for(const q of input.proofs){let reason:Reason|null=null;
  if(aliasKeys(q).some(key=>uses.get(key)!>1))reason='ALIASED_SOURCE';
  else if(!fields(q,['technique','sourceId','sourceVersion','sourceEffectIdentity','acceptedAtDay','episode','bundle','distinctiveness','repertoireRef','calibration'])
   ||!SPIN_TECHNIQUES_V123.includes(q.technique)||![q.sourceId,q.sourceVersion,q.sourceEffectIdentity].every(text)||!day(q.acceptedAtDay)
   ||!ref(q.repertoireRef)||!fields(q.calibration,['sourceId','sourceVersion','status'])||![q.calibration.sourceId,q.calibration.sourceVersion].every(text)
   ||!unit(q.distinctiveness)||!q.episode)reason='INVALID_EVIDENCE';
  else if(q.episode.careerId!==input.scope.careerId||q.episode.playerId!==input.scope.playerId)reason='OUT_OF_SCOPE';
  else if(q.acceptedAtDay>input.atDay||q.episode.effectiveDay>q.acceptedAtDay)reason='FUTURE_SOURCE';
  else if(q.episode.stage!=='CONSOLIDATED'||q.episode.domain!=='TECHNICAL')reason='UNCONSOLIDATED';
  else if(q.calibration.status!=='MODEL_VERIFIED')reason='UNVERIFIED_CALIBRATION';
  else if(q.distinctiveness<p.minimumDistinctiveness)reason='INSUFFICIENT_DISTINCTIVENESS';
  if(reason){rejected.push({technique:text(q?.technique)?q.technique:null,sourceId:text(q?.sourceId)?q.sourceId:null,reason});continue;}
  // The existing exposure law owns fatigue, opportunity, coaching and actual
  // episode chronology. An invalid proof is excluded, preserving other kinds.
  let exposure:ReturnType<typeof assessDevelopmentPracticeExposure>;
  try{exposure=assessDevelopmentPracticeExposure(q.episode,q.bundle);}catch{rejected.push({technique:q.technique,sourceId:q.sourceId,reason:'INVALID_EVIDENCE'});continue;}
  if(!exposure.eligible||exposure.effectiveExposure<p.minimumEffectiveExposure||exposure.distinctPracticeDays<p.minimumDistinctPracticeDays){
   rejected.push({technique:q.technique,sourceId:q.sourceId,reason:'INSUFFICIENT_EXPOSURE'});continue;}
  qualified.push({technique:q.technique,sourceId:q.sourceId,sourceVersion:q.sourceVersion,sourceEffectIdentity:q.sourceEffectIdentity,acceptedAtDay:q.acceptedAtDay,
   episodeId:q.episode.episodeId,repertoireRef:q.repertoireRef,calibrationRef:{sourceId:q.calibration.sourceId,sourceVersion:q.calibration.sourceVersion},
   effectiveExposure:exposure.effectiveExposure,distinctPracticeDays:exposure.distinctPracticeDays});
 }
 qualified.sort((a,b)=>SPIN_TECHNIQUES_V123.indexOf(a.technique)-SPIN_TECHNIQUES_V123.indexOf(b.technique));
 const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
 rejected.sort((a,b)=>compare(a.technique??'',b.technique??'')||compare(a.sourceId??'',b.sourceId??''));
 const masteredTechniqueSet=qualified.map(q=>q.technique),effectiveStateId=qualified.length===0?'NONE':qualified.length===1?'BLUE_'+qualified[0].technique:'GOLD';
 return freeze({version:'spin_variant_projection_v123' as const,boundary:'SPIN_MASTERY_PROJECTION_ONLY' as const,nativeAdmission:false as const,
  familyId:SPIN_CONTROL_VARIANT_FAMILY_V123.familyId,scope:input.scope,atDay:input.atDay,policyRef:{policyId:p.policyId,version:p.version},
  effectiveStateId,masteredTechniqueSet,qualified,rejected});
}
export type SpinMasteryProjectionV123=ReturnType<typeof projectSpinControlMasteryV123>;
