import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';

export type TimedPitchState = Readonly<{ elapsedSeconds:number;position:Vec3;velocity:Vec3;
  phase:'airborne'|'sliding'|'rolling'|'resting';counterfactualGroundIgnored?:boolean }>;
type XY = Readonly<{x:number;y:number}>;
type ReadonlyObservation<T> = T extends readonly (infer Item)[] ? readonly ReadonlyObservation<Item>[] :
  T extends object ? {readonly [Key in keyof T]:ReadonlyObservation<T[Key]>} : T;
type Status = 'CLASSIFIED'|'SMALL_FINAL_DISPLACEMENT'|'NON_MONOTONIC_PROJECTION'|'UNCLASSIFIED';
type ProjectionBracket = Readonly<{fromElapsedSeconds:number;throughElapsedSeconds:number;fromProjectionMeters:number;throughProjectionMeters:number}>;
type PercentTime = Readonly<{elapsedSeconds:number;targetProjectionMeters:number;bracket:ProjectionBracket}>;
const PROJECTION_TOLERANCE_METERS = 1e-10, SMALL_FINAL_XY_METERS = 1e-6;
const fields = (value:unknown, keys:readonly string[], optional:readonly string[] = []) => !!value && typeof value === 'object' && !Array.isArray(value) &&
  keys.every(key=>Object.hasOwn(value,key)) && Object.keys(value).every(key=>keys.includes(key)||optional.includes(key));
const vector = (value:Vec3) => fields(value,['x','y','z']) && Object.values(value).every(Number.isFinite);
const norm = (value:Vec3) => Math.hypot(value.x,value.y,value.z);
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw Error('pitch break timing: '+message);}
function finite(value:number):number {assert(Number.isFinite(value),'derived observation must remain finite');return value;}
function difference(one:Vec3,two:Vec3):Vec3 {
  const result={x:one.x-two.x,y:one.y-two.y,z:one.z-two.z};assert(vector(result),'derived vector must remain finite');return result;
}
function acceleration(one:TimedPitchState,two:TimedPitchState):Vec3 {
  const delta=difference(two.velocity,one.velocity),seconds=two.elapsedSeconds-one.elapsedSeconds;
  return {x:finite(delta.x/seconds),y:finite(delta.y/seconds),z:finite(delta.z/seconds)};
}
function frozen<T>(value:T):ReadonlyObservation<T> {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(frozen);Object.freeze(value);}return value as ReadonlyObservation<T>;
}
function validateRows(rows:readonly TimedPitchState[]) {
  assert(Array.isArray(rows)&&rows.length>=2,'at least two observed states required');
  rows.forEach((row,index)=>{
    assert(fields(row,['elapsedSeconds','position','velocity','phase'],['counterfactualGroundIgnored'])&&
      Number.isFinite(row.elapsedSeconds)&&row.elapsedSeconds>=0&&vector(row.position)&&vector(row.velocity)&&
      ['airborne','sliding','rolling','resting'].includes(row.phase)&&
      (!Object.hasOwn(row,'counterfactualGroundIgnored')||typeof row.counterfactualGroundIgnored==='boolean')&&
      (index===0?row.elapsedSeconds===0:row.elapsedSeconds>rows[index-1].elapsedSeconds),'invalid observed state or elapsed clock');
  });
}

/** Pure common-time observation. Interpolated displacement thresholds and
 * velocity-difference averages are numerical reporting conventions, not a
 * force law, a measured pitch skill or proof of a physically realizable model. */
export function observePitchBreakTiming(raw:Readonly<{actual:readonly TimedPitchState[];baseline:readonly TimedPitchState[];
  planeZ:number;comparisonBasis:string;groundEvents?:Readonly<{actual:readonly number[];baseline:readonly number[]}>}>) {
  const input=cloneInert(raw);
  assert(fields(input,['actual','baseline','planeZ','comparisonBasis'],['groundEvents'])&&Number.isFinite(input.planeZ)&&
    typeof input.comparisonBasis==='string'&&input.comparisonBasis.length>0&&input.comparisonBasis.trim()===input.comparisonBasis,
  'finite plane and explicit comparison basis required');
  validateRows(input.actual);validateRows(input.baseline);
  const groundEvents=input.groundEvents??{actual:[],baseline:[]},through=input.actual.at(-1)!.elapsedSeconds;
  assert(fields(groundEvents,['actual','baseline'])&&Object.values(groundEvents).every(events=>Array.isArray(events)&&events.every((time,index)=>
    Number.isFinite(time)&&time>=0&&time<=through&&(index===0||time>events[index-1]))),'invalid ground event history');
  assert(input.actual.length===input.baseline.length&&input.actual.every((row,index)=>row.elapsedSeconds===input.baseline[index].elapsedSeconds),
    'actual and baseline require the same elapsed time observations');
  assert((['x','y','z'] as const).every(axis=>input.actual[0].position[axis]===input.baseline[0].position[axis]&&
    input.actual[0].velocity[axis]===input.baseline[0].velocity[axis]),'release position and velocity must match exactly');
  const rows=input.actual.map((actual,index)=>({elapsedSeconds:actual.elapsedSeconds,actual,baseline:input.baseline[index],
      deltaXYZ:difference(actual.position,input.baseline[index].position)})),last=rows.at(-1)!,
    finalNorm=finite(Math.hypot(last.deltaXYZ.x,last.deltaXYZ.y)),
    direction:XY|null=finalNorm>0?{x:last.deltaXYZ.x/finalNorm,y:last.deltaXYZ.y/finalNorm}:null,
    project=(value:XY):number|null=>direction===null?null:finite(value.x*direction.x+value.y*direction.y),
    observations=rows.map(row=>({...row,projectedXYMeters:project(row.deltaXYZ)})),
    nonmonotonic=direction!==null&&observations.some((row,index)=>row.projectedXYMeters! < -PROJECTION_TOLERANCE_METERS ||
      index>0&&row.projectedXYMeters! < observations[index-1].projectedXYMeters!-PROJECTION_TOLERANCE_METERS),
    actualGroundObserved=groundEvents.actual.length>0||input.actual.some(row=>row.phase!=='airborne'),
    baselineGroundObserved=groundEvents.baseline.length>0||input.baseline.some(row=>row.phase!=='airborne'),
    actualMarkedCounterfactual=input.actual.some(row=>row.counterfactualGroundIgnored===true),
    baselineVirtualAirOnly=!baselineGroundObserved&&input.baseline.some(row=>row.counterfactualGroundIgnored===true),
    status:Status=actualGroundObserved||baselineGroundObserved||actualMarkedCounterfactual?'UNCLASSIFIED':
      finalNorm<SMALL_FINAL_XY_METERS?'SMALL_FINAL_DISPLACEMENT':nonmonotonic?'NON_MONOTONIC_PROJECTION':'CLASSIFIED';
  function percent(fraction:number):PercentTime|null {
    if(status!=='CLASSIFIED')return null;
    const targetProjectionMeters=finalNorm*fraction,index=observations.findIndex(row=>row.projectedXYMeters!>=targetProjectionMeters);
    assert(index>0,'percent threshold must lie inside observed intervals');
    const one=observations[index-1],two=observations[index],fromProjectionMeters=one.projectedXYMeters!,throughProjectionMeters=two.projectedXYMeters!,
      ratio=(targetProjectionMeters-fromProjectionMeters)/(throughProjectionMeters-fromProjectionMeters);
    return {elapsedSeconds:finite(one.elapsedSeconds+(two.elapsedSeconds-one.elapsedSeconds)*ratio),targetProjectionMeters,
      bracket:{fromElapsedSeconds:one.elapsedSeconds,throughElapsedSeconds:two.elapsedSeconds,fromProjectionMeters,throughProjectionMeters}};
  }
  const lateFrom=last.elapsedSeconds*.8,index=observations.findIndex(row=>row.elapsedSeconds>=lateFrom),one=observations[index-1],two=observations[index],
    ratio=(lateFrom-one.elapsedSeconds)/(two.elapsedSeconds-one.elapsedSeconds),
    startXY={x:one.deltaXYZ.x*(1-ratio)+two.deltaXYZ.x*ratio,y:one.deltaXYZ.y*(1-ratio)+two.deltaXYZ.y*ratio},
    lateDelta={x:finite(last.deltaXYZ.x-startXY.x),y:finite(last.deltaXYZ.y-startXY.y)},projectedIncrementMeters=project(lateDelta),
    intervalAverageAcceleration=input.actual.slice(1).map((row,index)=>{
      const actual=acceleration(input.actual[index],row),baseline=acceleration(input.baseline[index],input.baseline[index+1]);
      return {fromElapsedSeconds:input.actual[index].elapsedSeconds,throughElapsedSeconds:row.elapsedSeconds,actual,baseline,delta:difference(actual,baseline)};
    }),releaseSpeed=finite(norm(input.actual[0].velocity)),finalSpeed=finite(norm(input.actual.at(-1)!.velocity)),speedLoss=finite(releaseSpeed-finalSpeed);
  return frozen({version:'pitch_break_timing_v1' as const,status,comparisonBasis:input.comparisonBasis,planeZ:input.planeZ,
    units:{time:'s',position:'m',velocity:'m/s',intervalAverageAcceleration:'m/s^2',ratio:'dimensionless'},
    timeAlignment:'COMMON_ELAPSED_TIME' as const,raw:observations,finalDeltaXYZ:last.deltaXYZ,
    finalXY:{normMeters:finalNorm,direction},finalZDeltaMeters:last.deltaXYZ.z,percentTimes:{p10:percent(.1),p50:percent(.5),p90:percent(.9)},
    late20Percent:{fromElapsedSeconds:lateFrom,throughElapsedSeconds:last.elapsedSeconds,deltaXY:lateDelta,
      xyIncrementMeters:finite(Math.hypot(lateDelta.x,lateDelta.y)),projectedIncrementMeters,
      projectedFraction:status==='CLASSIFIED'?finite(projectedIncrementMeters!/finalNorm):null,
      startBracket:{fromElapsedSeconds:one.elapsedSeconds,throughElapsedSeconds:two.elapsedSeconds,
        fromDeltaXY:{x:one.deltaXYZ.x,y:one.deltaXYZ.y},throughDeltaXY:{x:two.deltaXYZ.x,y:two.deltaXYZ.y}}},
    intervalAverageAcceleration,actualSpeedLoss:{releaseSpeedMps:releaseSpeed,finalSpeedMps:finalSpeed,lossMps:speedLoss,
      lossFraction:releaseSpeed>0?finite(speedLoss/releaseSpeed):null},
    groundClassification:{actualGroundObserved,baselineGroundObserved,actualMarkedCounterfactual,baselineVirtualAirOnly,
      actualGroundEventSeconds:groundEvents.actual,baselineGroundEventSeconds:groundEvents.baseline,
      groundIgnored:baselineVirtualAirOnly,samePhysicalBallClaim:false as const},
    numericalConventions:{smallFinalXYMeters:SMALL_FINAL_XY_METERS,projectionToleranceMeters:PROJECTION_TOLERANCE_METERS,
      thresholdInterpolation:'LINEAR_BETWEEN_OBSERVATIONS',releaseComparison:'EXACT_POSITION_AND_VELOCITY',lateWindowFraction:.2,
      accelerationMeaning:'VELOCITY_DIFFERENCE_OVER_OBSERVATION_INTERVAL_NOT_INSTANTANEOUS_FORCE'}});
}
export type PitchBreakTimingObservation = ReturnType<typeof observePitchBreakTiming>;
