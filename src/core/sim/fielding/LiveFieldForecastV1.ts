import type { BattedBallInitialState } from '../contact/BatBallContact';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';

export type LiveFieldForecastInputV1=Readonly<{
  observation:BattedBallInitialState;physics:AeroGroundBallPhysicsV1;horizonSeconds?:number;
}>;
const fields=(v:unknown,keys:readonly string[],optional:readonly string[]=[])=>!!v&&typeof v==='object'&&!Array.isArray(v)
  &&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k));
const magnitude=(v:Readonly<{x:number;y:number;z:number}>)=>Math.hypot(v.x,v.y,v.z);
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('live field forecast: '+message);}

/** An AI hypothesis rooted in one past sensor observation. This is not the
 * actual ball's Source, a Native basis or access to future world samples.
 * Nine players may share this immutable prediction; a new observation needs a
 * new hypothesis. Material orientation starts at identity because it was not
 * measured in this observation and does not affect the seam-averaged model. */
export function createLiveFieldForecastV1(raw:LiveFieldForecastInputV1){
  const started=performance.now(),input=cloneInert(raw),horizon=input.horizonSeconds??8;
  assert(fields(input,['observation','physics'],['horizonSeconds'])&&fields(input.observation,['tick','position','velocity','spin'])
    &&Number.isFinite(horizon)&&horizon>0&&horizon<=8,'observation and finite horizon up to eight seconds required');
  const profile=createAeroGroundBallPhysicsProfile(input.physics),kernel=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',
    initial:{originTick:input.observation.tick,elapsedSeconds:0,ball:input.observation},throughElapsedSeconds:horizon,profile}),
    buildWallMilliseconds=performance.now()-started;
  let queries=0,sampleWallMilliseconds=0,maximumSampledSpeedMps=magnitude(input.observation.velocity);
  const diagnostics=Object.freeze({basis:'EXPLICIT_SENSOR_PREDICTION_MODEL' as const,actualSourceRead:false as const,
    nativeAuthentication:false as const,observationReanchoredForPrediction:true as const,
    predictionOriginTick:input.observation.tick,horizonSeconds:horizon,kernelBuildCount:1 as const,sourceCellCount:kernel.cells.length,
    maximumPositionSpeedUpperBoundMps:Math.max(0,...kernel.cells.map(c=>c.maximumPositionSpeedMps)),
    groundContactElapsedSeconds:Object.freeze(kernel.boundaries.filter(b=>b.kind==='ground').map(b=>b.elapsedSeconds)),
    venueReflectionPrediction:'NOT_AVAILABLE_WITHOUT_VENUE_GEOMETRY' as const});
  const sampleAtElapsedSeconds=(seconds:number)=>{
    assert(Number.isFinite(seconds)&&seconds>=0&&seconds<=horizon,'sample outside finite prediction horizon');
    const began=performance.now(),sample=kernel.evaluateAt(seconds,'outgoing');queries++;
    maximumSampledSpeedMps=Math.max(maximumSampledSpeedMps,magnitude(sample.moment.ball.velocity));sampleWallMilliseconds+=performance.now()-began;
    return Object.freeze({...sample.moment.ball,orientation:sample.orientation,phase:sample.phase});
  };
  // Wall-clock instrumentation is intentionally separate from deterministic
  // world/decision records. True process CPU counters belong to the host.
  const readPerformance=()=>Object.freeze({kernelBuildCount:1 as const,queries,buildWallMilliseconds,sampleWallMilliseconds,
    maximumSampledSpeedMps,sourceCellCount:kernel.cells.length,timingBasis:'MONOTONIC_WALL_CLOCK_NOT_PROCESS_CPU' as const});
  return Object.freeze({basis:diagnostics.basis,diagnostics,sampleAtElapsedSeconds,readPerformance});
}
