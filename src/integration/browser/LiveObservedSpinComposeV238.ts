import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { forecastObservedPitchV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import type { BatterObservedForecastSnapshotV222 } from '../../core/decision/batting/BatterObservedRegionExperienceV222';
import type { Vec3 } from '../../core/model/geometry';
import { SPIN_TECHNIQUES_V123,type SpinTechniqueV123 } from '../../core/world/traits/SpinTechniqueV123';

type Clip=Readonly<{id:string;sourceSha256:string;bats:'R'|'L'}>;
export type LiveObservedSpinComposeRequestV238=Readonly<{version:'live_observed_spin_compose_trial_v238';subjectId:string;technique:SpinTechniqueV123;clip:Clip;
 domain:Readonly<{plateZ:number;coordinateSystem:'LIVE_WORLD_METERS_V1'}>;delta:Readonly<{x:number;y:number}>}>;
const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&v.trim()===v;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const same=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)
 &&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
export function validateLiveObservedSpinComposeRequestV238(raw:unknown):LiveObservedSpinComposeRequestV238 {
 const s=cloneInert(raw) as LiveObservedSpinComposeRequestV238;
 if(!fields(s,['version','subjectId','technique','clip','domain','delta'])||s.version!=='live_observed_spin_compose_trial_v238'||!id(s.subjectId)||!SPIN_TECHNIQUES_V123.includes(s.technique)
  ||!fields(s.clip,['id','sourceSha256','bats'])||!id(s.clip.id)||typeof s.clip.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(s.clip.sourceSha256)||!['R','L'].includes(s.clip.bats)
  ||!fields(s.domain,['plateZ','coordinateSystem'])||s.domain.coordinateSystem!=='LIVE_WORLD_METERS_V1'||!finite(s.domain.plateZ)
  ||!fields(s.delta,['x','y'])||!finite(s.delta.x)||!finite(s.delta.y))throw Error('live observed spin compose v238: invalid explicit trial');
 return freeze(s);
}
/** Verify the same delivered V151 samples; this does not grant a qualification. */
export function resolveLiveObservedSpinComposeV238(input:Readonly<{request:LiveObservedSpinComposeRequestV238;snapshot:BatterObservedForecastSnapshotV222|null;clip:Clip;decisionTick:number;swingOffered:boolean;battingMode:'balanced'|'contact'|'power'|'take'|'bunt'}>) {
 const request=validateLiveObservedSpinComposeRequestV238(input.request),base={version:'live_observed_spin_compose_result_v238' as const,subjectId:request.subjectId,identityAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,
  technique:request.technique,clip:request.clip,earnedQualification:false as const,humanCalibration:'NOT_MEASURED' as const,requestedDelta:request.delta};
 const none=(reason:'NO_SWING'|'MISSING_DELIVERED_FORECAST'|'DOMAIN_MISMATCH'|'CLIP_MISMATCH'|'NO_FORWARD_CROSSING')=>freeze({...base,status:'NO_TARGET' as const,reason});
 if(!input.swingOffered||input.battingMode==='take'||input.battingMode==='bunt')return none('NO_SWING');
 if(!same(request.clip,input.clip))return none('CLIP_MISMATCH');if(!input.snapshot)return none('MISSING_DELIVERED_FORECAST');
 const snapshot=cloneInert(input.snapshot);if(snapshot.planeZ!==request.domain.plateZ)return none('DOMAIN_MISMATCH');
 if(!Number.isSafeInteger(input.decisionTick)||snapshot.cutoffTick!==input.decisionTick)throw Error('live observed spin compose v238: cutoff differs');
 const forecast=forecastObservedPitchV151({originTick:snapshot.originTick,ticksPerSecond:snapshot.ticksPerSecond,cutoffTick:snapshot.cutoffTick,planeZ:snapshot.planeZ,maximumAfterReleaseSeconds:snapshot.maximumAfterReleaseSeconds,observations:snapshot.observations});
 if(!same(forecast,snapshot.forecast)||!same(forecast.usedObservationIds,snapshot.observations.map(o=>o.observationId)))throw Error('live observed spin compose v238: frozen forecast differs');
 if(forecast.status!=='PREDICTED'||!forecast.prediction)return none('MISSING_DELIVERED_FORECAST');
 const arrivalTick=snapshot.originTick+Math.round(forecast.prediction.arrivalAfterReleaseSeconds*snapshot.ticksPerSecond);
 if(!Number.isSafeInteger(arrivalTick)||arrivalTick<=input.decisionTick)return none('NO_FORWARD_CROSSING');
 return freeze({...base,status:'APPLIED' as const,reason:'EXPLICIT_UNCALIBRATED_TRIAL' as const,cutoffTick:snapshot.cutoffTick,observationIds:[...forecast.usedObservationIds]});
}
/** Called before the existing execution error. Zero/no-target returns the
 * actual original plan object, preserving signed zero and arithmetic path. */
export function composeLiveObservedSpinAimV238(center:Vec3,resolved:ReturnType<typeof resolveLiveObservedSpinComposeV238>) {
 const d=resolved.requestedDelta;if(![center.x,center.y,center.z].every(Number.isFinite))throw Error('live observed spin compose v238: invalid normal center');
 if(resolved.status!=='APPLIED'||d.x===0&&d.y===0)return {center,normalPathRetained:true as const,preErrorDelta:{x:0,y:0}};
 const x=d.x===0?center.x:center.x+d.x,y=d.y===0?center.y:center.y+d.y;if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('live observed spin compose v238: translation overflow');
 return {center:{x,y,z:center.z},normalPathRetained:false as const,preErrorDelta:{x:d.x===0?0:x-center.x,y:d.y===0?0:y-center.y}};
}
