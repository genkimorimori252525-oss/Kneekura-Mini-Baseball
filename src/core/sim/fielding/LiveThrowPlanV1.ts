import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';

export type LiveThrowPlanInputV1=Readonly<{
  releasePosition:Vec3;bodyVelocity:Vec3;maximumThrowSpeedMps:number;spin:Vec3;physics:AeroGroundBallPhysicsV1;
  target:Vec3;maximumFlightSeconds?:number;
}>;
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a:Vec3,n:number):Vec3=>({x:a.x*n,y:a.y*n,z:a.z*n});
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const values=(v:Vec3)=>[v.x,v.y,v.z];
const vector=(a:readonly number[]):Vec3=>({x:a[0],y:a[1],z:a[2]});
const matvec=(a:readonly (readonly number[])[],v:readonly number[])=>a.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,i)=>s+x*b[i],0);
const fields=(a:unknown,required:readonly string[],optional:readonly string[]=[])=>!!a&&typeof a==='object'&&!Array.isArray(a)
  &&required.every(k=>Object.hasOwn(a,k))&&Object.keys(a).every(k=>required.includes(k)||optional.includes(k));
const finiteVec=(v:Vec3)=>fields(v,['x','y','z'])&&values(v).every(Number.isFinite);
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('live throw plan: '+message);}

/** A command solve for the thrower's own intended motion, not a query of the
 * actual future ball. Speed is bounded relative to body velocity. Targets,
 * catch events and game results are never corrected or guaranteed. */
export function planLiveThrowV1(raw:LiveThrowPlanInputV1){
  const started=performance.now(),input=cloneInert(raw),maximumFlightSeconds=input.maximumFlightSeconds??4;
  assert(fields(input,['releasePosition','bodyVelocity','maximumThrowSpeedMps','spin','physics','target'],['maximumFlightSeconds'])
    &&[input.releasePosition,input.bodyVelocity,input.spin,input.target].every(finiteVec)
    &&Number.isFinite(input.maximumThrowSpeedMps)&&input.maximumThrowSpeedMps>0&&input.maximumThrowSpeedMps<=120
    &&Number.isFinite(maximumFlightSeconds)&&maximumFlightSeconds>=.05&&maximumFlightSeconds<=8,'finite throw command, target and SI speed required');
  const physics=createAeroGroundBallPhysicsProfile(input.physics),tolerance=.02,
    initial=(velocity:Vec3)=>({tick:0,position:input.releasePosition,velocity,spin:input.spin});
  assert(input.releasePosition.y>=physics.ground.radiusM&&input.target.y>=physics.ground.radiusM,'airborne throw endpoints must be above the physical floor');
  let candidateCount=0,solverEvaluationCount=0,shootingIntegrationStepUpperBound=0,verificationKernelBuilds=0,completedWallMilliseconds=0;
  const performanceCounters=()=>Object.freeze({wallMilliseconds:completedWallMilliseconds,candidateCount,solverEvaluationCount,shootingIntegrationStepUpperBound,
    verificationKernelBuilds,timingBasis:'MONOTONIC_WALL_CLOCK_NOT_PROCESS_CPU' as const});
  const diagnostics=()=>Object.freeze({basis:'EXPLICIT_AERO_THROW_COMMAND_PREDICTION_V1' as const,actualSourceRead:false as const,
    nativeAuthentication:false as const,candidateCount,solverEvaluationCount,shootingIntegrationStepUpperBound,verificationKernelBuilds,
    speedCapBasis:'RELEASE_VELOCITY_RELATIVE_TO_THROWER_BODY' as const,targetToleranceMeters:tolerance,
    maximumFlightSeconds,maximumThrowSpeedMps:input.maximumThrowSpeedMps});
  const delta=sub(input.target,input.releasePosition),directDistance=norm(delta),
    firstTime=Math.max(.05,directDistance/(input.maximumThrowSpeedMps+norm(input.bodyVelocity)));
  const candidates:number[]=[];
  for(let t=firstTime; t<maximumFlightSeconds&&candidates.length<18; t=Math.max(t+.035,t*1.16))candidates.push(t);
  if(candidates.at(-1)!==maximumFlightSeconds)candidates.push(maximumFlightSeconds);
  let bestRejectedError=Infinity,bestRejectedRelativeSpeed=Infinity;
  for(const seconds of candidates){
    candidateCount++;
    let velocity={x:delta.x/seconds,y:delta.y/seconds-physics.air.gravityY*seconds/2,z:delta.z/seconds},
      inverse=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>i===j?1/seconds:0)),
      previous:{velocity:Vec3;position:Vec3}|null=null;
    for(let iteration=0;iteration<9;iteration++){
      if(solverEvaluationCount>=100)break;
      solverEvaluationCount++;shootingIntegrationStepUpperBound+=1+Math.ceil(seconds*physics.air.ticksPerSecond/physics.air.integrationStepTicks);
      const arrival=sampleAerodynamicPitchStateAtElapsedSeconds(initial(velocity),seconds,physics.air),error=sub(input.target,arrival.position),errorMeters=norm(error),
        relativeSpeed=norm(sub(velocity,input.bodyVelocity));
      if(errorMeters<bestRejectedError){bestRejectedError=errorMeters;bestRejectedRelativeSpeed=relativeSpeed;}
      if(errorMeters<=tolerance){
        if(relativeSpeed>input.maximumThrowSpeedMps)break;
        // Verify the same complete airborne Source, including floor crossings.
        // It is a prediction kernel only; no launched world object is edited.
        verificationKernelBuilds++;
        const kernel=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:0,elapsedSeconds:0,ball:initial(velocity)},
          throughElapsedSeconds:seconds,profile:physics}),verified=kernel.evaluateAt(seconds,'incoming'),verifiedError=norm(sub(input.target,verified.moment.ball.position));
        if(kernel.boundaries.some(b=>b.kind==='ground'&&b.elapsedSeconds<seconds)||verifiedError>tolerance)break;
        completedWallMilliseconds=performance.now()-started;
        const result=Object.freeze({kind:'planned' as const,initialVelocity:Object.freeze(velocity),flightSeconds:seconds,
          predictedArrivalPosition:verified.moment.ball.position,predictedArrivalVelocity:verified.moment.ball.velocity,
          arrivalErrorMeters:verifiedError,relativeReleaseSpeedMps:relativeSpeed,diagnostics:diagnostics(),readPerformance:performanceCounters});
        return result;
      }
      if(previous){
        const step=values(sub(velocity,previous.velocity)),change=values(sub(arrival.position,previous.position)),mapped=matvec(inverse,change),
          row=[0,1,2].map(j=>step.reduce((s,x,i)=>s+x*inverse[i][j],0)),denominator=dot(step,mapped);
        if(Math.abs(denominator)>1e-12*Math.max(1,norm(vector(step))*norm(vector(mapped)))){
          inverse=inverse.map((line,i)=>line.map((x,j)=>x+(step[i]-mapped[i])*row[j]/denominator));
        }
      }
      previous={velocity,position:arrival.position};let step=vector(matvec(inverse,values(error)));
      if(!finiteVec(step))break;
      const length=norm(step),stepLimit=Math.max(20,input.maximumThrowSpeedMps*2);if(length>stepLimit)step=mul(step,stepLimit/length);
      velocity=add(velocity,step);
      if(norm(velocity)>240)break;
    }
  }
  completedWallMilliseconds=performance.now()-started;
  return Object.freeze({kind:'unreachable' as const,reason:'NO_AIRBORNE_SOLUTION_WITHIN_SPEED_TIME_AND_FINITE_SOLVER_LIMITS' as const,
    diagnostics:Object.freeze({...diagnostics(),bestCandidateArrivalErrorMeters:Number.isFinite(bestRejectedError)?bestRejectedError:null,
      bestCandidateRelativeReleaseSpeedMps:Number.isFinite(bestRejectedRelativeSpeed)?bestRejectedRelativeSpeed:null}),readPerformance:performanceCounters});
}
