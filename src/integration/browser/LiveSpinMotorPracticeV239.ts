import { validateLiveContactFrameMotorV244,type LiveContactFrameMotorV244 } from './LiveContactFrameMotorV244';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SPIN_TECHNIQUES_V123,type SpinTechniqueV123 } from '../../core/world/traits/SpinTechniqueV123';
import { observeBattedBallSpinV123,type BattedSpinObservationInputV123 } from '../../core/sim/contact/BattedBallSpinObservationV123';
import type { LiveObservedSpinComposeRequestV238 } from './LiveObservedSpinComposeV238';

type Clip=LiveObservedSpinComposeRequestV238['clip'];type Domain=LiveObservedSpinComposeRequestV238['domain'];
export type LiveSpinMotorPracticePolicyV239=Readonly<{version:'live_spin_motor_practice_policy_v239';subjectId:string;motorId:string;motorVersion:string;clip:Clip}>;
export type LiveSpinOpportunityV239=Readonly<{configurationBinding:string;pitchOrdinal:number;pitchFingerprint:string}>;
export type LiveSpinMotorV239=Readonly<{version:'live_spin_xy_motor_v239';motorId:string;motorVersion:string;subjectId:string;technique:SpinTechniqueV123;clip:Clip;domain:Domain;
 delta:Readonly<{x:number;y:number}>;provenance:Readonly<{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED';sourceId:string;sourceVersion:string;humanCalibration:'NOT_MEASURED'}>;trainingOpportunities:readonly LiveSpinOpportunityV239[]}>;
export type LiveSpinPracticeCriterionV239=Readonly<{version:'live_spin_practice_criterion_v239';authority:'EXPLICIT_UNCALIBRATED_PROJECT';minimumIndependentTrials:number;minimumContactFraction:number;minimumDirectionalSpin:number;minimumDirectionalImprovement:number;minimumSuccessFraction:number;miss:'COUNT_FAILURE';noTarget:'COUNT_FAILURE';unresolved:'HOLD'}>;
export type LiveSpinPracticeTrialV239=Readonly<{opportunity:LiveSpinOpportunityV239;motorId:string;motorVersion:string;motorSnapshot:LiveSpinMotorV239;
 outcome:'CONTACT'|'MISS'|'NO_TARGET'|'UNRESOLVED';normal:BattedSpinObservationInputV123|null;actual:BattedSpinObservationInputV123|null;
 direction:Readonly<{requestedDegrees:number|null;normalDegrees:number|null;actualDegrees:number|null}>}>;
export type LiveSpinPracticeCohortV239=Readonly<{version:'live_spin_practice_cohort_v239';scopeId:string;motorId:string;motorVersion:string;motorSnapshot:LiveSpinMotorV239;opportunities:readonly LiveSpinOpportunityV239[]}>;
export type LiveSpinPracticeTrialV244=Omit<LiveSpinPracticeTrialV239,'motorSnapshot'> & Readonly<{motorSnapshot:LiveContactFrameMotorV244}>;
export type LiveSpinPracticeCohortV244=Omit<LiveSpinPracticeCohortV239,'version'|'motorSnapshot'> & Readonly<{version:'live_spin_practice_cohort_v244';motorSnapshot:LiveContactFrameMotorV244}>;
const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&v.trim()===v;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const same=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)
 &&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
const opportunityKey=(o:LiveSpinOpportunityV239)=>JSON.stringify([o.configurationBinding,o.pitchOrdinal]);
function validOpportunity(o:LiveSpinOpportunityV239):boolean{return fields(o,['configurationBinding','pitchOrdinal','pitchFingerprint'])&&hash(o.configurationBinding)&&Number.isSafeInteger(o.pitchOrdinal)&&o.pitchOrdinal>0&&hash(o.pitchFingerprint)}
export function validateLiveSpinMotorPracticePolicyV239(raw:unknown):LiveSpinMotorPracticePolicyV239 {
 const p=cloneInert(raw) as LiveSpinMotorPracticePolicyV239;
 if(!fields(p,['version','subjectId','motorId','motorVersion','clip'])||p.version!=='live_spin_motor_practice_policy_v239'||![p.subjectId,p.motorId,p.motorVersion].every(text)
  ||!fields(p.clip,['id','sourceSha256','bats'])||!text(p.clip.id)||!hash(p.clip.sourceSha256)||!['R','L'].includes(p.clip.bats))throw Error('live spin motor v239: invalid explicit practice policy');return freeze(p);
}
export function validateLiveSpinMotorV239(raw:unknown):LiveSpinMotorV239 {
 const m=cloneInert(raw) as LiveSpinMotorV239;
 if(!fields(m,['version','motorId','motorVersion','subjectId','technique','clip','domain','delta','provenance','trainingOpportunities'])||m.version!=='live_spin_xy_motor_v239'
  ||![m.motorId,m.motorVersion,m.subjectId].every(text)||!SPIN_TECHNIQUES_V123.includes(m.technique)||!fields(m.clip,['id','sourceSha256','bats'])||!text(m.clip.id)||!hash(m.clip.sourceSha256)||!['R','L'].includes(m.clip.bats)
  ||!fields(m.domain,['plateZ','coordinateSystem'])||!finite(m.domain.plateZ)||m.domain.coordinateSystem!=='LIVE_WORLD_METERS_V1'||!fields(m.delta,['x','y'])||!finite(m.delta.x)||!finite(m.delta.y)
  ||!fields(m.provenance,['kind','sourceId','sourceVersion','humanCalibration'])||m.provenance.kind!=='EXPLICIT_DIAGNOSTIC_UNCALIBRATED'||![m.provenance.sourceId,m.provenance.sourceVersion].every(text)||m.provenance.humanCalibration!=='NOT_MEASURED'
  ||!Array.isArray(m.trainingOpportunities)||!m.trainingOpportunities.every(validOpportunity)||new Set(m.trainingOpportunities.map(opportunityKey)).size!==m.trainingOpportunities.length)throw Error('live spin motor v239: invalid fixed motor');
 return freeze(m);
}
/** Local fixed motion only; EARNED is intentionally unavailable here. */
export function resolveLiveSpinMotorPracticeV239(raw:Readonly<{mode:'PRACTICE_EXPLICIT'|'EARNED';subjectId:string;technique:SpinTechniqueV123;clip:Clip;domain:Domain;motors:readonly LiveSpinMotorV239[]}>) {
 const x=cloneInert(raw);if(!fields(x,['mode','subjectId','technique','clip','domain','motors'])||!['PRACTICE_EXPLICIT','EARNED'].includes(x.mode)||!text(x.subjectId)||!SPIN_TECHNIQUES_V123.includes(x.technique)||!fields(x.clip,['id','sourceSha256','bats'])||!text(x.clip.id)||!hash(x.clip.sourceSha256)||!['R','L'].includes(x.clip.bats)
  ||!fields(x.domain,['plateZ','coordinateSystem'])||!finite(x.domain.plateZ)||x.domain.coordinateSystem!=='LIVE_WORLD_METERS_V1'||!Array.isArray(x.motors))throw Error('live spin motor v239: invalid selection');
 const motors=x.motors.map(validateLiveSpinMotorV239),seen=new Map<string,LiveSpinMotorV239>();for(const m of motors){const key=m.motorId,old=seen.get(key);if(old&&!same(old,m))throw Error('live spin motor v239: motor identity conflict');seen.set(key,m)}
 const none=(reason:'EARNED_NOT_AUTHENTICATED'|'NO_MATCH'|'AMBIGUOUS_MATCH')=>freeze({status:'NO_TARGET' as const,reason,earnedQualification:false as const});
 if(x.mode==='EARNED')return none('EARNED_NOT_AUTHENTICATED');const matches=[...seen.values()].filter(m=>m.subjectId===x.subjectId&&m.technique===x.technique&&same(m.clip,x.clip)&&same(m.domain,x.domain));
 if(matches.length!==1)return none(matches.length?'AMBIGUOUS_MATCH':'NO_MATCH');const m=matches[0];
 const request:LiveObservedSpinComposeRequestV238={version:'live_observed_spin_compose_trial_v238',subjectId:m.subjectId,technique:m.technique,clip:m.clip,domain:m.domain,delta:m.delta};
 return freeze({status:'READY_PRACTICE' as const,motor:m,request,earnedQualification:false as const,humanCalibration:'NOT_MEASURED' as const});
}
function validCriterion(c:LiveSpinPracticeCriterionV239):boolean{return fields(c,['version','authority','minimumIndependentTrials','minimumContactFraction','minimumDirectionalSpin','minimumDirectionalImprovement','minimumSuccessFraction','miss','noTarget','unresolved'])&&c.version==='live_spin_practice_criterion_v239'&&c.authority==='EXPLICIT_UNCALIBRATED_PROJECT'&&c.miss==='COUNT_FAILURE'&&c.noTarget==='COUNT_FAILURE'&&c.unresolved==='HOLD'
 &&Number.isSafeInteger(c.minimumIndependentTrials)&&c.minimumIndependentTrials>0&&finite(c.minimumContactFraction)&&c.minimumContactFraction>0&&c.minimumContactFraction<=1
 &&finite(c.minimumDirectionalSpin)&&c.minimumDirectionalSpin>0&&finite(c.minimumDirectionalImprovement)&&c.minimumDirectionalImprovement>0&&finite(c.minimumSuccessFraction)&&c.minimumSuccessFraction>0&&c.minimumSuccessFraction<=1}
export function validateLiveSpinPracticeCriterionV239(raw:unknown):LiveSpinPracticeCriterionV239 {
 const value=cloneInert(raw) as LiveSpinPracticeCriterionV239;if(!validCriterion(value))throw Error('live spin motor v239: invalid criterion');return freeze(value);
}
const directed=(s:ReturnType<typeof observeBattedBallSpinV123>,t:SpinTechniqueV123):number|null=>{if(s.basisStatus!=='DEFINED')return null;
 if(t==='BACKSPIN')return s.backspinSignedRadPerSecond;if(t==='TOPSPIN')return -s.backspinSignedRadPerSecond;
 const slice=s.rightCurvingSpinRadPerSecond*(s.bats==='R'?1:-1);return t==='SLICE'?slice:-slice};
/** Pure evaluation of a caller-declared closed set. No Local or Native Owner is
 * authenticated here; copying a pitch cannot create another opportunity. */
export function evaluateLiveSpinMotorPracticeV239(raw:Readonly<{motor:LiveSpinMotorV239;cohort:LiveSpinPracticeCohortV239;criterion:LiveSpinPracticeCriterionV239|null;trials:readonly LiveSpinPracticeTrialV239[]}>) {
 return evaluatePractice(raw,'live_spin_practice_cohort_v239',validateLiveSpinMotorV239);
}
export function evaluateLiveContactFrameMotorPracticeV244(raw:Readonly<{motor:LiveContactFrameMotorV244;cohort:LiveSpinPracticeCohortV244;criterion:LiveSpinPracticeCriterionV239|null;trials:readonly LiveSpinPracticeTrialV244[]}>) {
 return evaluatePractice(raw,'live_spin_practice_cohort_v244',validateLiveContactFrameMotorV244);
}
function evaluatePractice<M extends LiveSpinMotorV239|LiveContactFrameMotorV244>(raw:Readonly<{motor:M;cohort:Omit<LiveSpinPracticeCohortV239,'version'|'motorSnapshot'> & Readonly<{version:string;motorSnapshot:M}>;criterion:LiveSpinPracticeCriterionV239|null;trials:readonly (Omit<LiveSpinPracticeTrialV239,'motorSnapshot'> & Readonly<{motorSnapshot:M}>)[]}>,cohortVersion:string,validate:(raw:unknown)=>M) {
 const x=cloneInert(raw),motor=validate(x.motor),cohort=x.cohort;
 if(!fields(x,['motor','cohort','criterion','trials'])||!fields(cohort,['version','scopeId','motorId','motorVersion','motorSnapshot','opportunities'])||cohort.version!==cohortVersion
  ||!text(cohort.scopeId)||!text(cohort.motorId)||!text(cohort.motorVersion)||!Array.isArray(cohort.opportunities)||!cohort.opportunities.every(validOpportunity)||!Array.isArray(x.trials))throw Error('live spin motor v239: invalid cohort');
 const observations:Readonly<{opportunity:LiveSpinOpportunityV239;outcome:LiveSpinPracticeTrialV239['outcome'];absoluteDirectionalPositive:boolean|null;improvedDirectional:boolean|null;normalDirectionalSpin:number|null;actualDirectionalSpin:number|null;directionalImprovement:number|null;direction:LiveSpinPracticeTrialV239['direction']}>[]=[];
 const result=(status:'HOLD'|'UNAVAILABLE'|'DIAGNOSTIC_CRITERION_MET',reason:string,contacts=0,successes=0)=>freeze({status,reason,total:cohort.opportunities.length,contacts,successes,contactFraction:cohort.opportunities.length?contacts/cohort.opportunities.length:null,successFraction:cohort.opportunities.length?successes/cohort.opportunities.length:null,observations,trials:x.trials,
  cohortAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,identityAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,matchedNormalAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,
  earnedQualification:false as const,humanCalibration:'NOT_MEASURED' as const});
 if(cohort.motorId!==motor.motorId||cohort.motorVersion!==motor.motorVersion||!same(cohort.motorSnapshot,motor))return result('HOLD','MOTOR_VERSION_PAYLOAD_DIFFERS');
 if(x.criterion===null)return result('HOLD','CRITERION_MISSING');validateLiveSpinPracticeCriterionV239(x.criterion);
 const keys=cohort.opportunities.map(opportunityKey),declared=new Map<string,LiveSpinOpportunityV239>();for(const opportunity of cohort.opportunities){const key=opportunityKey(opportunity),previous=declared.get(key);
  if(previous)return result('HOLD',same(previous,opportunity)?'DUPLICATE_OPPORTUNITY':'OPPORTUNITY_CONFLICT');declared.set(key,opportunity)}
 if(cohort.opportunities.some(o=>motor.trainingOpportunities.some(t=>opportunityKey(t)===opportunityKey(o))))return result('HOLD','TRAINING_REUSE');
 const seen=new Map<string,LiveSpinOpportunityV239>();let contacts=0,successes=0,unresolved=false;
 for(const t of x.trials){if(!fields(t,['opportunity','motorId','motorVersion','motorSnapshot','outcome','normal','actual','direction'])||!validOpportunity(t.opportunity)
  ||!['CONTACT','MISS','NO_TARGET','UNRESOLVED'].includes(t.outcome)||!fields(t.direction,['requestedDegrees','normalDegrees','actualDegrees'])||!Object.values(t.direction).every(v=>v===null||finite(v)))throw Error('live spin motor v239: invalid trial');
  const key=opportunityKey(t.opportunity),expected=cohort.opportunities.find(o=>opportunityKey(o)===key);const prior=seen.get(key);if(prior)return result('HOLD',same(prior,t.opportunity)?'DUPLICATE_OPPORTUNITY':'OPPORTUNITY_CONFLICT',contacts,successes);seen.set(key,t.opportunity);
  if(!expected||!same(expected,t.opportunity))return result('HOLD','OPPORTUNITY_CONFLICT',contacts,successes);
  if(t.motorId!==motor.motorId||t.motorVersion!==motor.motorVersion||!same(t.motorSnapshot,motor))return result('HOLD','MOTOR_VERSION_PAYLOAD_DIFFERS',contacts,successes);
  if(t.outcome!=='CONTACT'&&t.actual!==null||t.outcome==='CONTACT'&&t.actual===null)throw Error('live spin motor v239: contact outcome differs');
  let actual:number|null=null,normal:number|null=null;if(t.normal){if(t.normal.bats!==motor.clip.bats)throw Error('live spin motor v239: normal handedness differs');normal=directed(observeBattedBallSpinV123(t.normal),motor.technique)}
  if(t.actual){if(t.actual.bats!==motor.clip.bats)throw Error('live spin motor v239: actual handedness differs');actual=directed(observeBattedBallSpinV123(t.actual),motor.technique);contacts++}
  const improvement=actual===null||normal===null?null:actual-normal;if(improvement!==null&&!Number.isFinite(improvement))throw Error('live spin motor v239: directional comparison overflow');
  const positive=actual===null?null:actual>=x.criterion.minimumDirectionalSpin,improved=improvement===null?null:improvement>=x.criterion.minimumDirectionalImprovement;
  if(t.outcome==='UNRESOLVED'||t.outcome==='CONTACT'&&(positive===null||improved===null))unresolved=true;if(positive&&improved)successes++;
  observations.push({opportunity:t.opportunity,outcome:t.outcome,absoluteDirectionalPositive:positive,improvedDirectional:improved,normalDirectionalSpin:normal,actualDirectionalSpin:actual,directionalImprovement:improvement,direction:t.direction});
 }
 if(seen.size!==keys.length)return result('HOLD','COHORT_INCOMPLETE',contacts,successes);if(unresolved)return result('HOLD','UNRESOLVED',contacts,successes);
 if(keys.length<x.criterion.minimumIndependentTrials)return result('UNAVAILABLE','INSUFFICIENT_INDEPENDENT_TRIALS',contacts,successes);
 if(contacts/keys.length<x.criterion.minimumContactFraction||successes/keys.length<x.criterion.minimumSuccessFraction)return result('UNAVAILABLE','CRITERION_NOT_MET',contacts,successes);
 return result('DIAGNOSTIC_CRITERION_MET','PROJECT_CRITERION_MET_NOT_CALIBRATED',contacts,successes);
}
