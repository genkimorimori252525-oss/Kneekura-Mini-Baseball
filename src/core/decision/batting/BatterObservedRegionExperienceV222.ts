import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { forecastObservedPitchV151, type ObservedPitchPositionV151 } from './ObservedPitchForecastV151';
import { recallBatterObservedMemoryV151, validateBatterObservedEvidenceV151, type BatterObservedEvidenceV151, type BatterObservedMemoryV151 } from './BatterObservedMemoryV151';

export type BatterObservedRegionExperiencePolicyV222 = Readonly<{version:'batter_observed_region_experience_policy_v222';sourceId:string}>;
export const AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222:BatterObservedRegionExperiencePolicyV222 = Object.freeze({version:'batter_observed_region_experience_policy_v222',sourceId:'authored-observed-region-experience-v222'});
type Forecast = ReturnType<typeof forecastObservedPitchV151>;
export type BatterObservedForecastSnapshotV222 = Readonly<{originTick:number;ticksPerSecond:number;cutoffTick:number;planeZ:number;maximumAfterReleaseSeconds:number;
  observations:readonly ObservedPitchPositionV151[];forecast:Forecast}>;
export type BatterObservedRegionEvidenceV222 = Readonly<{version:'batter_observed_region_evidence_v222';evidenceId:string;observerPlayerId:string;pitcherId:string;pitchOrdinal:number;
  originTick:number;ticksPerSecond:number;cutoffTick:number;planeZ:number;coordinateUnit:'METERS';maximumAfterReleaseSeconds:number;
  samples:readonly ObservedPitchPositionV151[];rawForecast:Forecast;accelerationBasis:'TWO_SAMPLE_ZERO_ASSUMED'|'THREE_SAMPLE_ESTIMATED';
  familyId:null;confidence:null;familyRecognized:false;humanCalibration:'NOT_MEASURED'}>;
const equal=(a:unknown,b:unknown):boolean=>{
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const left=Object.keys(a),right=Object.keys(b);return left.length===right.length&&left.every(key=>Object.hasOwn(b,key)
  &&equal((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
};
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
function assert(v:unknown,m:string):asserts v {if(!v)throw Error('batter observed region experience v222: '+m)}
export function validateObservedRegionPolicyV222(raw:unknown):BatterObservedRegionExperiencePolicyV222 {
 const p=cloneInert(raw) as BatterObservedRegionExperiencePolicyV222;
 assert(p&&Object.keys(p).sort().join('|')==='sourceId|version'&&p.version==='batter_observed_region_experience_policy_v222'
  &&typeof p.sourceId==='string'&&p.sourceId.length>0&&p.sourceId.length<=200&&p.sourceId.trim()===p.sourceId,'invalid policy');return freeze(p);
}
export function createRegionSnapshotV222(raw:BatterObservedForecastSnapshotV222 & Readonly<{evidence:BatterObservedEvidenceV151}>):BatterObservedRegionEvidenceV222 {
 const {evidence,...snapshot}=cloneInert(raw), e=validateBatterObservedEvidenceV151(evidence), forecast=forecastObservedPitchV151({originTick:snapshot.originTick,
  ticksPerSecond:snapshot.ticksPerSecond,cutoffTick:snapshot.cutoffTick,planeZ:snapshot.planeZ,maximumAfterReleaseSeconds:snapshot.maximumAfterReleaseSeconds,observations:snapshot.observations});
 assert(equal(forecast,snapshot.forecast)&&forecast.status==='PREDICTED'&&forecast.prediction!==null,'forecast differs from frozen observations');
 const samples=forecast.usedObservationIds.map(id=>snapshot.observations.find(o=>o.observationId===id)!);
 assert(samples.length>=2&&samples.length<=3&&equal(samples,snapshot.observations)&&samples.every(Boolean)&&equal(forecast.usedObservationIds,e.sourceObservationIds)&&e.observedTick===forecast.observedThroughTick
  &&e.availableTick===forecast.cutoffTick&&equal(e.position,forecast.prediction.position)&&e.arrivalAfterReleaseSeconds===forecast.prediction.arrivalAfterReleaseSeconds,
  'evidence differs from raw forecast');
 return freeze({version:'batter_observed_region_evidence_v222',evidenceId:e.evidenceId,observerPlayerId:e.observerPlayerId,pitcherId:e.pitcherId,pitchOrdinal:e.pitchOrdinal,
  originTick:snapshot.originTick,ticksPerSecond:snapshot.ticksPerSecond,cutoffTick:snapshot.cutoffTick,planeZ:snapshot.planeZ,coordinateUnit:'METERS',
  maximumAfterReleaseSeconds:snapshot.maximumAfterReleaseSeconds,samples,rawForecast:forecast,
  accelerationBasis:samples.length===2?'TWO_SAMPLE_ZERO_ASSUMED':'THREE_SAMPLE_ESTIMATED',familyId:null,confidence:null,familyRecognized:false,humanCalibration:'NOT_MEASURED'});
}
export function validateRegionEvidenceV222(raw:unknown,evidence:BatterObservedEvidenceV151):BatterObservedRegionEvidenceV222 {
 const s=cloneInert(raw) as BatterObservedRegionEvidenceV222;
 assert(s&&s.version==='batter_observed_region_evidence_v222'&&s.coordinateUnit==='METERS'&&s.familyId===null&&s.confidence===null
  &&s.familyRecognized===false&&s.humanCalibration==='NOT_MEASURED','invalid sidecar');
 const built=createRegionSnapshotV222({evidence,originTick:s.originTick,ticksPerSecond:s.ticksPerSecond,cutoffTick:s.cutoffTick,
  planeZ:s.planeZ,maximumAfterReleaseSeconds:s.maximumAfterReleaseSeconds,observations:s.samples,forecast:s.rawForecast});
 assert(equal(s,built),'sidecar fields or binding differ');return built;
}
export function recallObservedRegionV222(memory:BatterObservedMemoryV151,input:Readonly<{atTick:number;draw:number;priorWeight:number}>) {
 const selected=recallBatterObservedMemoryV151(memory,input);if(!selected)return null;
 const entry=memory.entries.find(e=>e.evidenceId===selected.evidenceId)!;
 const members=entry.regionId===null?[entry]:memory.entries.filter(e=>e.availableTick<=input.atTick&&e.regionId===entry.regionId);
 const mean=(values:readonly number[])=>values.reduce((a,b)=>a+b,0)/values.length;
 return freeze({version:'batter_observed_region_recall_v222' as const,selectedEvidenceId:entry.evidenceId,regionId:entry.regionId,
  memberEvidenceIds:members.map(e=>e.evidenceId),position:{x:mean(members.map(e=>e.position.x)),y:mean(members.map(e=>e.position.y)),z:mean(members.map(e=>e.position.z))},
  arrivalAfterReleaseSeconds:mean(members.map(e=>e.arrivalAfterReleaseSeconds)),familyRecognized:false as const,humanCalibration:'NOT_MEASURED' as const});
}
