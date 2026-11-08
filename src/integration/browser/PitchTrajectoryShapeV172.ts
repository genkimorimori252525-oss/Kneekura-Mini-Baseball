import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { observePitchBreakTiming, type TimedPitchState } from './PitchBreakTiming';

type ReadonlyObservation<T> = T extends readonly (infer Item)[] ? readonly ReadonlyObservation<Item>[] :
  T extends object ? { readonly [Key in keyof T]:ReadonlyObservation<T[Key]> } : T;

const axes=['x','y','z'] as const;
function assert(value:unknown,message:string):asserts value {
  if(!value)throw Error('pitch trajectory shape v172: '+message);
}
function finite(value:number):number {
  assert(Number.isFinite(value),'derived observation must remain finite');return value;
}
function vector(value:Vec3):boolean {
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&axes.every(axis=>Number.isFinite(value[axis]));
}
const dot=(one:Vec3,two:Vec3)=>finite(one.x*two.x+one.y*two.y+one.z*two.z);
const cross=(one:Vec3,two:Vec3):Vec3=>({x:finite(one.y*two.z-one.z*two.y),
  y:finite(one.z*two.x-one.x*two.z),z:finite(one.x*two.y-one.y*two.x)});
const length=(value:Vec3)=>finite(Math.hypot(value.x,value.y,value.z));
function unit(value:Vec3):Vec3 {
  const speed=length(value);assert(speed>0,'nonzero direction required');
  return {x:value.x/speed,y:value.y/speed,z:value.z/speed};
}
function frozen<T>(value:T):ReadonlyObservation<T> {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(frozen);Object.freeze(value);
  }
  return value as ReadonlyObservation<T>;
}

/** Read-only net trajectory observation. The private U/V rows and their zero
 * reference are a mathematical coordinate representation, never a world ball,
 * a force law, or a replacement for gravity-relative aerodynamic observations. */
export function observePitchTrajectoryShapeV172(raw:Readonly<{
  sourceSamples:readonly TimedPitchState[];referenceElapsedSeconds:number;
}>) {
  const input=cloneInert(raw);
  assert(input&&typeof input==='object'&&!Array.isArray(input)&&
    Object.keys(input).every(key=>key==='sourceSamples'||key==='referenceElapsedSeconds')&&
    Number.isFinite(input.referenceElapsedSeconds)&&input.referenceElapsedSeconds>0&&
    Array.isArray(input.sourceSamples)&&input.sourceSamples.length>=2,'finite positive reference and source samples required');
  const sourceSamples=input.sourceSamples;
  sourceSamples.forEach((row,index)=>{
    assert(row&&typeof row==='object'&&!Array.isArray(row)&&Number.isFinite(row.elapsedSeconds)&&
      vector(row.position)&&vector(row.velocity)&&['airborne','sliding','rolling','resting'].includes(row.phase)&&
      (!Object.hasOwn(row,'counterfactualGroundIgnored')||typeof row.counterfactualGroundIgnored==='boolean')&&
      (index===0?row.elapsedSeconds===0:row.elapsedSeconds>sourceSamples[index-1].elapsedSeconds),
    'release elapsed zero, finite states and increasing source clock required');
  });
  assert(sourceSamples.at(-1)!.elapsedSeconds===input.referenceElapsedSeconds,'last source sample must equal the reference time exactly');
  const initial=sourceSamples[0],origin={...initial.position},initialVelocity={...initial.velocity},unitTangent=unit(initialVelocity),
    leastAlignedAxis:Vec3=Math.abs(unitTangent.x)<=Math.abs(unitTangent.y)&&Math.abs(unitTangent.x)<=Math.abs(unitTangent.z)?{x:1,y:0,z:0}:
      Math.abs(unitTangent.y)<=Math.abs(unitTangent.z)?{x:0,y:1,z:0}:{x:0,y:0,z:1},
    normalU=unit(cross(unitTangent,leastAlignedAxis)),normalV=unit(cross(unitTangent,normalU)),
    projectNormal=(value:Vec3):Vec3=>{
      const along=dot(value,unitTangent);
      return {x:finite(value.x-unitTangent.x*along),y:finite(value.y-unitTangent.y*along),z:finite(value.z-unitTangent.z*along)};
    },
    observations=sourceSamples.map(row=>{
      const t=row.elapsedSeconds,normalDisplacementWorld=projectNormal({
        x:finite(row.position.x-origin.x-initialVelocity.x*t),
        y:finite(row.position.y-origin.y-initialVelocity.y*t),
        z:finite(row.position.z-origin.z-initialVelocity.z*t)}),
        normalVelocity=projectNormal({x:finite(row.velocity.x-initialVelocity.x),y:finite(row.velocity.y-initialVelocity.y),
          z:finite(row.velocity.z-initialVelocity.z)}),speedMps=length(row.velocity),currentDirection=speedMps>0?unit(row.velocity):null,
        velocityDirectionChangeRadians=currentDirection===null?null:finite(Math.atan2(length(cross(unitTangent,currentDirection)),dot(unitTangent,currentDirection)));
      return {elapsedSeconds:t,normalDisplacementWorld,normalCoordinates:{u:dot(normalDisplacementWorld,normalU),v:dot(normalDisplacementWorld,normalV)},
        normalVelocityCoordinates:{u:dot(normalVelocity,normalU),v:dot(normalVelocity,normalV)},speedMps,velocityDirectionChangeRadians};
    }),
    // These zero-anchored vectors are analysis coordinates. No physical state
    // or Source input is created or replaced by this representation.
    actual:TimedPitchState[]=observations.map((row,index)=>({elapsedSeconds:row.elapsedSeconds,
      position:{x:row.normalCoordinates.u,y:row.normalCoordinates.v,z:0},
      velocity:{x:row.normalVelocityCoordinates.u,y:row.normalVelocityCoordinates.v,z:0},phase:sourceSamples[index].phase,
      ...(Object.hasOwn(sourceSamples[index],'counterfactualGroundIgnored')?{counterfactualGroundIgnored:sourceSamples[index].counterfactualGroundIgnored!}:{})})),
    baseline:TimedPitchState[]=sourceSamples.map(row=>({elapsedSeconds:row.elapsedSeconds,position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},
      phase:'airborne',counterfactualGroundIgnored:true})),
    comparisonBasis='INITIAL_TANGENT_NORMAL_PLANE_V172' as const,
    coordinateTiming=observePitchBreakTiming({actual,baseline,planeZ:0,comparisonBasis}),
    percentTimes=coordinateTiming.percentTimes;
  return frozen({version:'pitch_trajectory_shape_v172' as const,status:coordinateTiming.status,comparisonBasis,
    referenceElapsedSeconds:input.referenceElapsedSeconds,frame:{origin,initialVelocity,unitTangent,normalU,normalV},
    timing:{percentTimes,transitionIntervalSeconds:percentTimes.p10!==null&&percentTimes.p90!==null?
      finite(percentTimes.p90.elapsedSeconds-percentTimes.p10.elapsedSeconds):null,
      late20Percent:{...coordinateTiming.late20Percent,coordinateBasis:'NORMAL_U_V' as const},
      finalNormalDisplacementMeters:coordinateTiming.finalXY.normMeters,
      numericalConventions:{smallFinalNormalDisplacementMeters:coordinateTiming.numericalConventions.smallFinalXYMeters,
        projectionToleranceMeters:coordinateTiming.numericalConventions.projectionToleranceMeters,
        thresholdInterpolation:coordinateTiming.numericalConventions.thresholdInterpolation,
        lateWindowFraction:coordinateTiming.numericalConventions.lateWindowFraction,
        percentTimesMeaning:'FINAL_PROJECTED_NORMAL_DISPLACEMENT_FRACTIONS_NOT_FORCE_OR_VISIBILITY_ONSET' as const}},
    raw:observations.map((row,index)=>({...row,projectedNormalMeters:coordinateTiming.raw[index].projectedXYMeters})),
    groundClassification:{...coordinateTiming.groundClassification,classificationBasis:'SUPPLIED_SOURCE_PHASES_ONLY' as const},
    metadata:{projection:'P0=(I-unitTangent*unitTangent^T); normal=P0*(r-r0-v0*t)' as const,
      referenceMeaning:'ANALYSIS_COORDINATES_NOT_A_WORLD_BALL' as const,coordinateRepresentation:'PRIVATE_ORTHONORMAL_U_V_WITH_ZERO_BASELINE_AND_PLANE_Z_ZERO' as const,
      worldSpeedAndDirection:'REPORTED_FROM_ORIGINAL_SOURCE_VELOCITY_NOT_PRIVATE_COORDINATE_VELOCITY' as const,
      directionAngle:'ATAN2_UNIT_VELOCITY_CROSS_NORM_AND_DOT_NULL_WHEN_CURRENT_SPEED_ZERO' as const,
      hiddenGroundEvents:'NOT_INFERRED' as const,gravityRelativeObservation:'NOT_REPLACED' as const},
    authority:{readOnly:true as const,physicalSourceModified:false as const,skillAdmission:false as const,nativeAdmission:false as const}});
}
export type PitchTrajectoryShapeObservationV172=ReturnType<typeof observePitchTrajectoryShapeV172>;
