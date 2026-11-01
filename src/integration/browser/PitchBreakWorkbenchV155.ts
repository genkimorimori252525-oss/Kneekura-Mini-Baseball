import type { Vec3 } from '../../core/model/geometry';
import type { Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import type { AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import { observePitchBreakTiming, type TimedPitchState } from './PitchBreakTiming';

type Sample=TimedPitchState&Readonly<{spin:Vec3;orientation:Quaternion;materialOrientation?:Quaternion}>;
type Command=Readonly<{requestedTarget:Vec3;selectedTarget:Vec3;commandedTarget:Vec3;nominalReleaseVelocity:Vec3;
  executedReleaseVelocity:Vec3;inverseCompensationBasis:string;postReleaseExecutionReaimed:false}>;
const magnitude=(v:Vec3)=>Math.hypot(v.x,v.y,v.z),zero=():Vec3=>({x:0,y:0,z:0});
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const angles=(v:Vec3)=>({yawDegrees:Math.atan2(v.x,-v.z)*180/Math.PI,elevationDegrees:Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI});
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

/** Source samplers belong to the existing Workbench. This derives observations
 * only; it never runs a replacement pitch, chooses an ability or writes state. */
export function observePitchBreakWorkbenchV155(input:Readonly<{
  throughElapsedSeconds:number;measurementPlaneZ:number;air:AerodynamicPitchTrajectoryParameters;
  actualSample:(seconds:number)=>Sample|null;baselineSample:(seconds:number)=>Sample|null;
  samePlane:Readonly<{actual:Readonly<{elapsedSeconds:number;position:Vec3}>;
    zeroSpin:Readonly<{elapsedSeconds:number;position:Vec3;groundIgnored:boolean}>}>;
  commandObservation:Command;releaseMode?:'SAME_TARGET'|'FIXED_RELEASE';
  groundEvents?:Readonly<{actual:readonly number[];baseline:readonly number[]}>;
}>) {
  const intervalCount=160,times=Array.from({length:intervalCount+1},(_,i)=>i===intervalCount?input.throughElapsedSeconds:input.throughElapsedSeconds*i/intervalCount),
    actualSamples=times.map(t=>input.actualSample(t)),baselineSamples=times.map(t=>input.baselineSample(t));
  if(actualSamples.some(s=>s===null)||baselineSamples.some(s=>s===null))throw Error('pitch break workbench: missing Source observation');
  const actual=actualSamples as Sample[],baseline=baselineSamples as Sample[],release=actual[0],
    timed=(sample:Sample):TimedPitchState=>({elapsedSeconds:sample.elapsedSeconds,position:sample.position,velocity:sample.velocity,phase:sample.phase,
      ...(sample.counterfactualGroundIgnored===undefined?{}:{counterfactualGroundIgnored:sample.counterfactualGroundIgnored})}),
    observed=actual.map(timed),zeroSpin=baseline.map(timed),
    reference=(gravity:boolean):TimedPitchState[]=>times.map(t=>({elapsedSeconds:t,
      position:t===0?{...release.position}:{x:release.position.x+release.velocity.x*t,
        y:release.position.y+release.velocity.y*t+(gravity?input.air.gravityY*t*t/2:0),z:release.position.z+release.velocity.z*t},
      velocity:t===0?{...release.velocity}:{x:release.velocity.x,y:release.velocity.y+(gravity?input.air.gravityY*t:0),z:release.velocity.z},
      phase:'airborne' as const,counterfactualGroundIgnored:true})),
    force=(sample:Sample)=>{
      if(sample.phase!=='airborne')return null;
      const a=calculateBaseballAerodynamics(sample.velocity,sample.spin,input.air.aerodynamics,sample.materialOrientation??sample.orientation),
        gravityAcceleration={x:0,y:input.air.gravityY,z:0};
      return {dragAcceleration:a.dragAcceleration,liftAcceleration:a.liftAcceleration,seamAcceleration:a.seamAcceleration??zero(),
        totalAirAcceleration:a.totalAcceleration,gravityAcceleration,totalFreeFlightAcceleration:add(a.totalAcceleration,gravityAcceleration)};
    },
    forceSeries=times.map((elapsedSeconds,index)=>({elapsedSeconds,actual:force(actual[index]),zeroSpinOriginalAir:force(baseline[index])})),
    command=input.commandObservation,geometric={x:command.commandedTarget.x-release.position.x,y:command.commandedTarget.y-release.position.y,z:command.commandedTarget.z-release.position.z},
    geometricAngles=angles(geometric),nominalAngles=angles(command.nominalReleaseVelocity);
  return freeze({version:'pitch_break_workbench_v155' as const,sampleCount:times.length,sampleIntervalSeconds:input.throughElapsedSeconds/intervalCount,
    commonTime:{zeroSpinOriginalAir:observePitchBreakTiming({actual:observed,baseline:zeroSpin,planeZ:input.measurementPlaneZ,groundEvents:input.groundEvents??{actual:[],baseline:[]},
        comparisonBasis:'SAME_RELEASE_ZERO_SPIN_ORIGINAL_AIR_AND_SEAMS_COMMON_TIME'}),
      airlessGravity:observePitchBreakTiming({actual:observed,baseline:reference(true),planeZ:input.measurementPlaneZ,
        groundEvents:{actual:input.groundEvents?.actual??[],baseline:[]},
        comparisonBasis:'SAME_RELEASE_AIRLESS_GRAVITY_ONLY_VIRTUAL_AIR_PATH_COMMON_TIME'}),
      releaseTangent:observePitchBreakTiming({actual:observed,baseline:reference(false),planeZ:input.measurementPlaneZ,
        groundEvents:{actual:input.groundEvents?.actual??[],baseline:[]},
        comparisonBasis:'SAME_RELEASE_LINEAR_TANGENT_NO_GRAVITY_NO_AIR_VIRTUAL_PATH_COMMON_TIME'})},
    samePlane:{basis:'EACH_TRAJECTORY_AT_SAME_Z' as const,planeZ:input.measurementPlaneZ,...input.samePlane},forceSeries,
    forceMeaning:'INSTANTANEOUS_EXISTING_SOURCE_AIR_FORCES_PLUS_GRAVITY_AIRBORNE_ONLY' as const,
    releaseCommand:{...command,initialPosition:release.position,initialVelocity:release.velocity,...angles(release.velocity),
      nominalAngles,geometricTargetLineAngles:geometricAngles,
      compensationAnglesDegrees:{yaw:nominalAngles.yawDegrees-geometricAngles.yawDegrees,elevation:nominalAngles.elevationDegrees-geometricAngles.elevationDegrees},
      angleConvention:'WORLD_X_TOWARD_FIRST_BASE_PITCH_TRAVELS_NEGATIVE_Z' as const,
      releaseSpeedMps:magnitude(release.velocity),sameTargetTrial:input.releaseMode!=='FIXED_RELEASE',fixedReleaseCounterfactual:input.releaseMode==='FIXED_RELEASE'},
    observationsChangeExecution:false as const,physicalKickOnsetCalibrated:false as const});
}
