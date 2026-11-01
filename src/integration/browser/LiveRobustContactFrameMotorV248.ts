import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SPIN_TECHNIQUES_V123,type SpinTechniqueV123 } from '../../core/world/traits/SpinTechniqueV123';
import type { LiveSpinMotorV239,LiveSpinOpportunityV239 } from './LiveSpinMotorPracticeV239';
type Clip=LiveSpinMotorV239['clip'];type Domain=LiveSpinMotorV239['domain'];
type Thresholds=Readonly<{minimumComponent:number;minimumImprovement:number}>;
export type LiveRobustContactFrameMotorV248=Readonly<{version:'live_robust_contact_frame_motor_v248';motorId:string;motorVersion:string;subjectId:string;technique:SpinTechniqueV123;clip:Clip;domain:Domain;policy:'finite_sigma_v247';thresholds:Thresholds;maximumEvaluations:number;maximumSearchSamples:number;provenance:LiveSpinMotorV239['provenance'];trainingOpportunities:readonly LiveSpinOpportunityV239[]}>;
export type LiveObservedRobustContactFrameTrialV248=Readonly<{version:'live_observed_robust_contact_frame_trial_v248';subjectId:string;technique:SpinTechniqueV123;clip:Clip;domain:Domain;policy:'finite_sigma_v247';thresholds:Thresholds;maximumEvaluations:number;maximumSearchSamples:number}>;
const fields=(v:unknown,k:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&v.trim()===v;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const same=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
const validClip=(c:Clip)=>fields(c,['id','sourceSha256','bats'])&&text(c.id)&&hash(c.sourceSha256)&&['R','L'].includes(c.bats);
const validDomain=(d:Domain)=>fields(d,['plateZ','coordinateSystem'])&&finite(d.plateZ)&&d.coordinateSystem==='LIVE_WORLD_METERS_V1';
const validThresholds=(t:Thresholds)=>fields(t,['minimumComponent','minimumImprovement'])&&finite(t.minimumComponent)&&t.minimumComponent>0&&finite(t.minimumImprovement)&&t.minimumImprovement>0;
const validOpportunity=(o:LiveSpinOpportunityV239)=>fields(o,['configurationBinding','pitchOrdinal','pitchFingerprint'])&&hash(o.configurationBinding)&&Number.isSafeInteger(o.pitchOrdinal)&&o.pitchOrdinal>0&&hash(o.pitchFingerprint);
const key=(o:LiveSpinOpportunityV239)=>JSON.stringify([o.configurationBinding,o.pitchOrdinal]);
export function validateLiveRobustContactFrameMotorV248(raw:unknown):LiveRobustContactFrameMotorV248 {
 const m=cloneInert(raw) as LiveRobustContactFrameMotorV248;
 if(!fields(m,['version','motorId','motorVersion','subjectId','technique','clip','domain','policy','thresholds','maximumEvaluations','maximumSearchSamples','provenance','trainingOpportunities'])||m.version!=='live_robust_contact_frame_motor_v248'||![m.motorId,m.motorVersion,m.subjectId].every(text)||!SPIN_TECHNIQUES_V123.includes(m.technique)||!validClip(m.clip)||!validDomain(m.domain)||m.policy!=='finite_sigma_v247'||!validThresholds(m.thresholds)||!Number.isSafeInteger(m.maximumEvaluations)||m.maximumEvaluations<0||!Number.isSafeInteger(m.maximumSearchSamples)||m.maximumSearchSamples<0||!fields(m.provenance,['kind','sourceId','sourceVersion','humanCalibration'])||m.provenance.kind!=='EXPLICIT_DIAGNOSTIC_UNCALIBRATED'||![m.provenance.sourceId,m.provenance.sourceVersion].every(text)||m.provenance.humanCalibration!=='NOT_MEASURED'||!Array.isArray(m.trainingOpportunities)||!m.trainingOpportunities.every(validOpportunity)||new Set(m.trainingOpportunities.map(key)).size!==m.trainingOpportunities.length)throw Error('live robust contact frame motor v248: invalid fixed motor');
 return freeze(m);
}
export function validateLiveObservedRobustContactFrameTrialV248(raw:unknown):LiveObservedRobustContactFrameTrialV248 {
 const r=cloneInert(raw) as LiveObservedRobustContactFrameTrialV248;
 if(!fields(r,['version','subjectId','technique','clip','domain','policy','thresholds','maximumEvaluations','maximumSearchSamples'])||r.version!=='live_observed_robust_contact_frame_trial_v248'||!text(r.subjectId)||!SPIN_TECHNIQUES_V123.includes(r.technique)||!validClip(r.clip)||!validDomain(r.domain)||r.policy!=='finite_sigma_v247'||!validThresholds(r.thresholds)||!Number.isSafeInteger(r.maximumEvaluations)||r.maximumEvaluations<0||!Number.isSafeInteger(r.maximumSearchSamples)||r.maximumSearchSamples<0)throw Error('live robust contact frame motor v248: invalid explicit trial');return freeze(r);
}
/** Finite synthetic-sigma policy; no earned qualification or human calibration. */
export function resolveLiveRobustContactFrameMotorPracticeV248(raw:Readonly<{mode:'PRACTICE_EXPLICIT'|'EARNED';subjectId:string;technique:SpinTechniqueV123;clip:Clip;domain:Domain;motors:readonly LiveRobustContactFrameMotorV248[]}>) {
 const x=cloneInert(raw);if(!fields(x,['mode','subjectId','technique','clip','domain','motors'])||!['PRACTICE_EXPLICIT','EARNED'].includes(x.mode)||!text(x.subjectId)||!SPIN_TECHNIQUES_V123.includes(x.technique)||!validClip(x.clip)||!validDomain(x.domain)||!Array.isArray(x.motors))throw Error('live robust contact frame motor v248: invalid selection');
 const seen=new Map<string,LiveRobustContactFrameMotorV248>();for(const m of x.motors.map(validateLiveRobustContactFrameMotorV248)){const old=seen.get(m.motorId);if(old&&!same(old,m))throw Error('live robust contact frame motor v248: motor identity conflict');seen.set(m.motorId,m)}
 const none=(reason:'EARNED_NOT_AUTHENTICATED'|'NO_MATCH'|'AMBIGUOUS_MATCH')=>freeze({status:'NO_TARGET' as const,reason,earnedQualification:false as const});
 if(x.mode==='EARNED')return none('EARNED_NOT_AUTHENTICATED');const matches=[...seen.values()].filter(m=>m.subjectId===x.subjectId&&m.technique===x.technique&&same(m.clip,x.clip)&&same(m.domain,x.domain));
 if(matches.length!==1)return none(matches.length?'AMBIGUOUS_MATCH':'NO_MATCH');const m=matches[0];
 const request:LiveObservedRobustContactFrameTrialV248={version:'live_observed_robust_contact_frame_trial_v248',subjectId:m.subjectId,technique:m.technique,clip:m.clip,domain:m.domain,policy:m.policy,thresholds:m.thresholds,maximumEvaluations:m.maximumEvaluations,maximumSearchSamples:m.maximumSearchSamples};
 return freeze({status:'READY_PRACTICE' as const,motor:m,request,earnedQualification:false as const,humanCalibration:'NOT_MEASURED' as const});
}
