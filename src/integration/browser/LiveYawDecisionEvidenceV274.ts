import {encodeLiveSpinPracticeProofV239} from './LiveSpinPracticeProofV239';
import type {planObservedYawContactFrameV255} from '../../core/decision/batting/ObservedYawContactFrameV255';
type Plan=ReturnType<typeof planObservedYawContactFrameV255>;
type Flag='PASS'|'FAIL'|'UNKNOWN'|'NOT_EVALUATED';
const allowedReasons=new Set(['NOMINAL_CENTER_OUTSIDE_2CM','CONTACT_CENTER_OUTSIDE_2CM','BELOW_MINIMUM_COMPONENT','BELOW_MINIMUM_IMPROVEMENT','ELIGIBLE','NO_CLOSING_RESPONSE','MISSING_AUTHORED_HELD_PREPARATION','TICK_OUTSIDE_MOTION','NONFINITE_DISTANCE','FLIGHT_FRAME_UNDEFINED','NONFINITE_IMPROVEMENT']);
const limitKeys=new Set(['maximumSweetSpotSpeedMps','maximumGripAccelerationMps2','maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2']);
function reasonCategory(reason:unknown):string{if(typeof reason!=='string')return 'UNKNOWN';if(allowedReasons.has(reason))return reason;for(const prefix of ['EXPLICIT_LIMIT:','MISSING_CERTIFICATE:'])if(reason.startsWith(prefix)&&limitKeys.has(reason.slice(prefix.length)))return reason;return 'OTHER_OR_UNRESOLVED'}
/** Allowlisted, bounded status only; never exposes candidate coordinates, yaw or raw input. */
export function summarizeYawDecisionV274(plan:Plan,thresholds:Readonly<{minimumComponent:number;minimumImprovement:number}>){
 try{
  if(!Array.isArray(plan.candidates)||plan.candidates.length>17)return {status:'UNKNOWN' as const,reason:'CANDIDATE_COUNT',candidates:[]};
  const normal='normalComponent' in plan&&typeof plan.normalComponent==='number'&&Number.isFinite(plan.normalComponent)?plan.normalComponent:null;
  const candidates=plan.candidates.map((candidate,index)=>{
   const c=candidate as {status?:unknown;reason?:unknown;reference?:unknown;prediction?:{status?:unknown}|null;bounds?:{status?:unknown}|null;component?:unknown;improvement?:unknown};
   const reason=reasonCategory(c.reason),hasReference=c.reference!==null&&c.reference!==undefined,hasPrediction=c.prediction!==null&&c.prediction!==undefined,prediction=c.prediction?.status;
   const nominalCenter:Flag=!hasReference?'NOT_EVALUATED':reason==='NOMINAL_CENTER_OUTSIDE_2CM'?'FAIL':hasPrediction?'PASS':'UNKNOWN';
   const contactPrediction=prediction==='FOUND'?'FOUND':prediction==='REJECTED'?'REJECTED':prediction==='UNRESOLVED'?'UNRESOLVED':hasPrediction?'UNKNOWN':'NOT_EVALUATED';
   const contactCenter:Flag=prediction!=='FOUND'?'NOT_EVALUATED':reason==='CONTACT_CENTER_OUTSIDE_2CM'?'FAIL':c.bounds?.status==='WITHIN'?'PASS':'UNKNOWN';
   const component=typeof c.component==='number'&&Number.isFinite(c.component)?c.component:null,improvement=typeof c.improvement==='number'&&Number.isFinite(c.improvement)?c.improvement:null;
   const minimumComponent:Flag=component===null?'NOT_EVALUATED':component>=thresholds.minimumComponent?'PASS':'FAIL',minimumImprovement:Flag=component===null||improvement===null||normal===null?'NOT_EVALUATED':improvement>=thresholds.minimumImprovement?'PASS':'FAIL';
   return {index,status:c.status==='EVALUATED'||c.status==='REJECTED'||c.status==='UNRESOLVED'?c.status:'UNKNOWN',reason,nominalCenter,contactPrediction,contactCenter,minimumComponent,minimumImprovement};
  });return {status:'RECORDED' as const,plannerStatus:['PLANNED','NO_TARGET','UNRESOLVED','HOLD'].includes(plan.status)?plan.status:'UNKNOWN',candidates};
 }catch{return {status:'UNKNOWN' as const,reason:'SUMMARY_FAILURE',candidates:[]}}
}
/** Hash-only evidence; failure is UNKNOWN and cannot alter planner or Core control. */
export function hashYawDecisionInputV274(input:unknown):Promise<Readonly<{status:'PASS';sha256:string}|{status:'UNKNOWN';reason:string}>>{
 try{const encoded=encodeLiveSpinPracticeProofV239(input);if(encoded.length>16_000_000)return Promise.resolve({status:'UNKNOWN',reason:'INPUT_ENCODING_LIMIT'});if(!globalThis.crypto?.subtle)return Promise.resolve({status:'UNKNOWN',reason:'CRYPTO_UNAVAILABLE'});const bytes=new TextEncoder().encode(encoded);if(bytes.byteLength>16_000_000)return Promise.resolve({status:'UNKNOWN',reason:'INPUT_BYTE_LIMIT'});return globalThis.crypto.subtle.digest('SHA-256',bytes).then(bytes=>({status:'PASS' as const,sha256:Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')}),()=>({status:'UNKNOWN' as const,reason:'HASH_FAILURE'}))}catch{return Promise.resolve({status:'UNKNOWN',reason:'ENCODING_FAILURE'})}
}
