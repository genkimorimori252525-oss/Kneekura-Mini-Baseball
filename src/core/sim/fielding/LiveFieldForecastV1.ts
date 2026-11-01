import type { BattedBallInitialState } from '../contact/BatBallContact';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import type { Quaternion } from '../pitching/BaseballOrientation';

export type LiveFieldForecastInputV1=Readonly<{
  observation:BattedBallInitialState;physics:AeroGroundBallPhysicsV1;horizonSeconds?:number;materialOrientationAtObservation?:Quaternion;
}>;
const fields=(v:unknown,keys:readonly string[],optional:readonly string[]=[])=>!!v&&typeof v==='object'&&!Array.isArray(v)
  &&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k));
const magnitude=(v:Readonly<{x:number;y:number;z:number}>)=>Math.hypot(v.x,v.y,v.z);
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('live field forecast: '+message);}

/** Observer hypothesis only: neither a runner looking at a glove nor a distant
 * fielder can resolve material seam phase. Preserve every other physical input.
 * The actual Source and the thrower's executable command keep the full profile. */
export function liveUnobservedSeamPhysicsV113(physics:AeroGroundBallPhysicsV1):AeroGroundBallPhysicsV1{
  if(!physics.air.aerodynamics.seamForce?.coefficientScale)return physics;
  const {seamForce:_unobserved,...aerodynamics}=physics.air.aerodynamics;
  return createAeroGroundBallPhysicsProfile({...physics,air:{...physics.air,aerodynamics}});
}

/** An AI hypothesis rooted in one past sensor observation. This is not the
 * actual ball's Source, a Native basis or access to future world samples.
 * Nine players may share this immutable prediction; a new observation needs a
 * new hypothesis. Without an explicitly observed material phase the seam
 * contribution is averaged out in this prediction, never in the actual ball. */
export function createLiveFieldForecastV1(raw:LiveFieldForecastInputV1){
  const started=performance.now(),input=cloneInert(raw),horizon=input.horizonSeconds??8;
  assert(fields(input,['observation','physics'],['horizonSeconds','materialOrientationAtObservation'])&&fields(input.observation,['tick','position','velocity','spin'])
    &&Number.isFinite(horizon)&&horizon>0&&horizon<=8,'observation and finite horizon up to eight seconds required');
  const authoredProfile=createAeroGroundBallPhysicsProfile(input.physics),unknownPhase=!!authoredProfile.air.aerodynamics.seamForce?.coefficientScale&&input.materialOrientationAtObservation===undefined,
    profile=unknownPhase?liveUnobservedSeamPhysicsV113(authoredProfile):authoredProfile,
    kernel=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',
    initial:{originTick:input.observation.tick,elapsedSeconds:0,ball:input.observation},throughElapsedSeconds:horizon,profile,
    ...(input.materialOrientationAtObservation?{materialOrientationAtStart:input.materialOrientationAtObservation}:{})}),
    buildWallMilliseconds=performance.now()-started;
  type Sample=Readonly<ReturnType<typeof kernel.evaluateAt>['moment']['ball']&{orientation:Quaternion;phase:string}>;
  const exactSamples=new Map<number,Sample>();
  let queries=0,kernelEvaluationCount=0,exactCacheHits=0,sampleWallMilliseconds=0,maximumSampledSpeedMps=magnitude(input.observation.velocity);
  const diagnostics=Object.freeze({basis:'EXPLICIT_SENSOR_PREDICTION_MODEL' as const,actualSourceRead:false as const,
    nativeAuthentication:false as const,observationReanchoredForPrediction:true as const,
    predictionOriginTick:input.observation.tick,horizonSeconds:horizon,kernelBuildCount:1 as const,sourceCellCount:kernel.cells.length,
    maximumPositionSpeedUpperBoundMps:Math.max(0,...kernel.cells.map(c=>c.maximumPositionSpeedMps)),
    ...(unknownPhase?{seamPrediction:'UNOBSERVED_MATERIAL_PHASE_SEAM_AVERAGED' as const}:{}),
    groundContactElapsedSeconds:Object.freeze(kernel.boundaries.filter(b=>b.kind==='ground').map(b=>b.elapsedSeconds)),
    venueReflectionPrediction:'NOT_AVAILABLE_WITHOUT_VENUE_GEOMETRY' as const});
  const sampleAtElapsedSeconds=(seconds:number)=>{
    assert(Number.isFinite(seconds)&&seconds>=0&&seconds<=horizon,'sample outside finite prediction horizon');
    const began=performance.now(),cached=exactSamples.get(seconds);queries++;
    if(cached){exactCacheHits++;sampleWallMilliseconds+=performance.now()-began;return cached;}
    const sample=kernel.evaluateAt(seconds,'outgoing');kernelEvaluationCount++;
    maximumSampledSpeedMps=Math.max(maximumSampledSpeedMps,magnitude(sample.moment.ball.velocity));sampleWallMilliseconds+=performance.now()-began;
    const result=Object.freeze({...sample.moment.ball,orientation:sample.materialOrientation??sample.orientation,phase:sample.phase});
    if(exactSamples.size===256)exactSamples.delete(exactSamples.keys().next().value!);
    exactSamples.set(seconds,result);return result;
  };
  // Wall-clock instrumentation is intentionally separate from deterministic
  // world/decision records. True process CPU counters belong to the host.
  const readPerformance=()=>Object.freeze({kernelBuildCount:1 as const,queries,kernelEvaluationCount,exactCacheHits,cachedSamples:exactSamples.size,buildWallMilliseconds,sampleWallMilliseconds,
    maximumSampledSpeedMps,sourceCellCount:kernel.cells.length,timingBasis:'MONOTONIC_WALL_CLOCK_NOT_PROCESS_CPU' as const});
  return Object.freeze({basis:diagnostics.basis,diagnostics,sampleAtElapsedSeconds,readPerformance});
}
