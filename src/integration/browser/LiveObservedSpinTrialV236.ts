import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { forecastObservedPitchV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import type { BatterObservedForecastSnapshotV222 } from '../../core/decision/batting/BatterObservedRegionExperienceV222';
import { SPIN_TECHNIQUES_V123,type SpinTechniqueV123 } from '../../core/world/traits/SpinTechniqueV123';

type Clip=Readonly<{id:string;sourceSha256:string;bats:'R'|'L'}>;
export type LiveObservedSpinTrialRequestV236=Readonly<{version:'live_observed_spin_trial_v236';subjectId:string;technique:SpinTechniqueV123;clip:Clip;
 domain:Readonly<{plateZ:number;contactDepthZ:number;coordinateSystem:'LIVE_WORLD_METERS_V1'}>;delta:Readonly<{x:number;y:number}>}>;
const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&v.trim()===v;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const same=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)
 &&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
export function validateLiveObservedSpinTrialRequestV236(raw:unknown):LiveObservedSpinTrialRequestV236 {
 const s=cloneInert(raw) as LiveObservedSpinTrialRequestV236;
 if(!fields(s,['version','subjectId','technique','clip','domain','delta'])||s.version!=='live_observed_spin_trial_v236'||!id(s.subjectId)||!SPIN_TECHNIQUES_V123.includes(s.technique)
  ||!fields(s.clip,['id','sourceSha256','bats'])||!id(s.clip.id)||typeof s.clip.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(s.clip.sourceSha256)||!['R','L'].includes(s.clip.bats)
  ||!fields(s.domain,['plateZ','contactDepthZ','coordinateSystem'])||s.domain.coordinateSystem!=='LIVE_WORLD_METERS_V1'||!finite(s.domain.plateZ)||!finite(s.domain.contactDepthZ)
  ||!fields(s.delta,['x','y'])||!finite(s.delta.x)||!finite(s.delta.y))throw Error('live observed spin trial v236: invalid explicit trial');
 return freeze(s);
}
/** Own delivered samples only; extrapolation is not a Native qualification. */
export function resolveLiveObservedSpinTrialV236(input:Readonly<{request:LiveObservedSpinTrialRequestV236;snapshot:BatterObservedForecastSnapshotV222|null;clip:Clip;swingOffered:boolean;battingMode:'balanced'|'contact'|'power'|'take'|'bunt'}>) {
 const request=validateLiveObservedSpinTrialRequestV236(input.request),base={version:'live_observed_spin_trial_result_v236' as const,subjectId:request.subjectId,identityAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,
  technique:request.technique,clip:request.clip,earnedQualification:false as const,humanCalibration:'NOT_MEASURED' as const,delta:request.delta};
 const none=(reason:'NO_SWING'|'MISSING_DELIVERED_FORECAST'|'DOMAIN_MISMATCH'|'CLIP_MISMATCH'|'NO_FORWARD_CROSSING')=>freeze({...base,status:'NO_TARGET' as const,reason});
 if(!input.swingOffered||input.battingMode==='take'||input.battingMode==='bunt')return none('NO_SWING');
 if(!same(request.clip,input.clip))return none('CLIP_MISMATCH');if(!input.snapshot)return none('MISSING_DELIVERED_FORECAST');
 const snapshot=cloneInert(input.snapshot);if(snapshot.planeZ!==request.domain.plateZ)return none('DOMAIN_MISMATCH');
 const common={originTick:snapshot.originTick,ticksPerSecond:snapshot.ticksPerSecond,cutoffTick:snapshot.cutoffTick,maximumAfterReleaseSeconds:snapshot.maximumAfterReleaseSeconds,observations:snapshot.observations};
 const plate=forecastObservedPitchV151({...common,planeZ:snapshot.planeZ});if(!same(plate,snapshot.forecast)||!same(plate.usedObservationIds,snapshot.observations.map(o=>o.observationId)))throw Error('live observed spin trial v236: frozen forecast differs');
 if(plate.status!=='PREDICTED'||!plate.prediction)return none('MISSING_DELIVERED_FORECAST');
 const contact=forecastObservedPitchV151({...common,planeZ:request.domain.contactDepthZ});if(contact.status!=='PREDICTED'||!contact.prediction)return none('NO_FORWARD_CROSSING');
 const plateTick=snapshot.originTick+Math.round(plate.prediction.arrivalAfterReleaseSeconds*snapshot.ticksPerSecond),contactTick=snapshot.originTick+Math.round(contact.prediction.arrivalAfterReleaseSeconds*snapshot.ticksPerSecond);
 if(!Number.isSafeInteger(plateTick)||!Number.isSafeInteger(contactTick)||plateTick<=snapshot.cutoffTick||contactTick<=snapshot.cutoffTick)return none('NO_FORWARD_CROSSING');
 const translate=(p:typeof plate.prediction.position)=>({x:p.x+request.delta.x,y:p.y+request.delta.y,z:p.z});
 const aimedPlate=translate(plate.prediction.position),aimedContact=translate(contact.prediction.position);
 if(![aimedPlate.x,aimedPlate.y,aimedContact.x,aimedContact.y].every(Number.isFinite))throw Error('live observed spin trial v236: translation overflow');
 return freeze({...base,status:'APPLIED' as const,reason:'EXPLICIT_UNCALIBRATED_TRIAL' as const,cutoffTick:snapshot.cutoffTick,observationIds:[...plate.usedObservationIds],
  observedSamples:snapshot.observations,plateTick,contactTick,platePosition:plate.prediction.position,contactPosition:contact.prediction.position,aimedPlate,aimedContact,
  contactArrivalAfterReleaseSeconds:contact.prediction.arrivalAfterReleaseSeconds,accelerationBasis:snapshot.observations.length===2?'TWO_SAMPLE_ZERO_ASSUMED' as const:'THREE_SAMPLE_ESTIMATED' as const});
}
