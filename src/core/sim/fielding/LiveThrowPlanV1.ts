import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import type { Quaternion } from '../pitching/BaseballOrientation';
import {exactLiveThrowPhysicalKeyV113,internLiveThrowPhysicalNamespaceV113,memoizeLiveThrowPhysicalV113} from './LiveThrowPhysicalMemoV113';

export type LiveThrowPlanInputV1=Readonly<{
  releasePosition:Vec3;bodyVelocity:Vec3;maximumThrowSpeedMps:number;spin:Vec3;physics:AeroGroundBallPhysicsV1;
  target:Vec3;maximumFlightSeconds?:number;materialOrientationAtRelease?:Quaternion;
  effortSelectionV103?:LiveThrowEffortSelectionV103;preferredFlightSecondsV103?:number;
}>;
/** Author tuning, not an empirical MLB preparation curve. Capacity is never
 * clamped; the existing finite solver limit applies only to issued output. */
export const LIVE_THROW_EFFORT_POLICY_V103=Object.freeze({defaultBuildSeconds:.6,effortExponent:2,
  maximumCommandSpeedMps:120,maximumFeasibleFlights:4});
export type LiveThrowEffortSelectionV103=Readonly<{capacityMps:number;remainingTransferSeconds:number;handPreparationSeconds:number;
  chargeElapsedSeconds:number;buildSeconds:number;receiverReadySeconds:number;deadlineSeconds?:number;preferStrongestFeasibleV103?:boolean;
  /** Pick the throw that reaches the taker first (charge grows with the square of speed, so a short feed goes softer), not the
   * strongest: throwEarliestArrivalV1. Ties go to the lighter throw. */
  preferEarliestArrivalV1?:boolean}>;
export function liveThrowEffortTimingV103(speedMps:number,input:LiveThrowEffortSelectionV103){
  const effort=(speedMps/input.capacityMps)**LIVE_THROW_EFFORT_POLICY_V103.effortExponent,
    chargeSeconds=input.buildSeconds*effort,remainingChargeSeconds=Math.max(0,chargeSeconds-input.chargeElapsedSeconds),
    releaseDelaySeconds=input.remainingTransferSeconds+Math.max(input.handPreparationSeconds,remainingChargeSeconds);
  return {effort,chargeSeconds,remainingChargeSeconds,releaseDelaySeconds};
}
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
  assert(fields(input,['releasePosition','bodyVelocity','maximumThrowSpeedMps','spin','physics','target'],['maximumFlightSeconds','materialOrientationAtRelease','effortSelectionV103','preferredFlightSecondsV103'])
    &&[input.releasePosition,input.bodyVelocity,input.spin,input.target].every(finiteVec)
    &&Number.isFinite(input.maximumThrowSpeedMps)&&input.maximumThrowSpeedMps>0&&input.maximumThrowSpeedMps<=120
    &&Number.isFinite(maximumFlightSeconds)&&maximumFlightSeconds>=.05&&maximumFlightSeconds<=8,'finite throw command, target and SI speed required');
  const selection=input.effortSelectionV103,preferred=input.preferredFlightSecondsV103;
  assert(preferred===undefined||Number.isFinite(preferred)&&preferred>=.05&&preferred<=maximumFlightSeconds,'finite preferred flight within command time required');
  assert(!selection||fields(selection,['capacityMps','remainingTransferSeconds','handPreparationSeconds','chargeElapsedSeconds','buildSeconds','receiverReadySeconds'],['deadlineSeconds','preferStrongestFeasibleV103','preferEarliestArrivalV1'])
    &&Number.isFinite(selection.capacityMps)&&selection.capacityMps>0&&input.maximumThrowSpeedMps<=selection.capacityMps
    &&[selection.remainingTransferSeconds,selection.handPreparationSeconds,selection.chargeElapsedSeconds,selection.buildSeconds,selection.receiverReadySeconds]
      .every(n=>Number.isFinite(n)&&n>=0)&&selection.buildSeconds<=5
    &&(selection.deadlineSeconds===undefined||Number.isFinite(selection.deadlineSeconds)&&selection.deadlineSeconds>=0)
    &&(selection.preferStrongestFeasibleV103===undefined||typeof selection.preferStrongestFeasibleV103==='boolean')
    &&(selection.preferEarliestArrivalV1===undefined||typeof selection.preferEarliestArrivalV1==='boolean'),'finite effort timing and raw capacity required');
  const physics=createAeroGroundBallPhysicsProfile(input.physics),tolerance=.02,
    initial=(velocity:Vec3)=>({tick:0,position:input.releasePosition,velocity,spin:input.spin});
  const airNamespace=internLiveThrowPhysicalNamespaceV113(()=>exactLiveThrowPhysicalKeyV113(physics.air)),
    profileNamespace=internLiveThrowPhysicalNamespaceV113(()=>exactLiveThrowPhysicalKeyV113(physics));
  assert(input.releasePosition.y>=physics.ground.radiusM&&input.target.y>=physics.ground.radiusM,'airborne throw endpoints must be above the physical floor');
  let candidateCount=0,solverEvaluationCount=0,shootingIntegrationStepUpperBound=0,verificationKernelBuilds=0,completedWallMilliseconds=0,
    receiverSynchronizationSelectedV109=false;
  const performanceCounters=()=>Object.freeze({wallMilliseconds:completedWallMilliseconds,candidateCount,solverEvaluationCount,shootingIntegrationStepUpperBound,
    verificationKernelBuilds,timingBasis:'MONOTONIC_WALL_CLOCK_NOT_PROCESS_CPU' as const});
  const diagnostics=()=>Object.freeze({basis:'EXPLICIT_AERO_THROW_COMMAND_PREDICTION_V1' as const,actualSourceRead:false as const,
    nativeAuthentication:false as const,candidateCount,solverEvaluationCount,shootingIntegrationStepUpperBound,verificationKernelBuilds,
    speedCapBasis:'RELEASE_VELOCITY_RELATIVE_TO_THROWER_BODY' as const,targetToleranceMeters:tolerance,
    maximumFlightSeconds,maximumThrowSpeedMps:input.maximumThrowSpeedMps,receiverSynchronizationSelectedV109});
  const delta=sub(input.target,input.releasePosition),directDistance=norm(delta),
    firstTime=Math.max(.05,directDistance/(input.maximumThrowSpeedMps+norm(input.bodyVelocity)));
  const candidates:number[]=[];
  for(let t=firstTime; t<maximumFlightSeconds&&candidates.length<18; t=Math.max(t+.035,t*1.16))candidates.push(t);
  if(candidates.at(-1)!==maximumFlightSeconds)candidates.push(maximumFlightSeconds);
  let estimateCandidate:((seconds:number)=>{speed:number;control:number;meets:boolean;release:number;arrival:number})|undefined,
    synchronizedFlightV109:number|undefined;
  if(selection){
    // Include the vacuum minimum-energy duration and the available deadline
    // duration, then order by a cheap command estimate. Every selected result
    // still needs the complete aerodynamic solve and physical floor check.
    const energyTime=Math.sqrt(2*directDistance/Math.max(.01,Math.abs(physics.air.gravityY))),
      deadlineFlight=selection.deadlineSeconds===undefined?0:selection.deadlineSeconds-selection.remainingTransferSeconds-selection.handPreparationSeconds;
    for(const t of [energyTime,deadlineFlight])if(t>=.05&&t<=maximumFlightSeconds&&!candidates.includes(t))candidates.push(t);
    const estimate=(seconds:number)=>{
      const velocity={x:delta.x/seconds,y:delta.y/seconds-physics.air.gravityY*seconds/2,z:delta.z/seconds},speed=norm(sub(velocity,input.bodyVelocity)),
        timing=liveThrowEffortTimingV103(speed,selection),control=Math.max(timing.releaseDelaySeconds+seconds,selection.receiverReadySeconds),
        meets=selection.deadlineSeconds===undefined||control<=selection.deadlineSeconds;
      return {speed,control,meets,release:timing.releaseDelaySeconds,arrival:timing.releaseDelaySeconds+seconds};
    };
    estimateCandidate=estimate;
    // A moving receiver can make a fast ball wait in the thrower's hand. Add
    // the gentle, longer-flight solution on the increasing-arrival branch.
    // This cheap root only orders a command hypothesis; the same bounded aero
    // and floor verification must still accept it before it may be selected.
    if(selection.receiverReadySeconds>selection.remainingTransferSeconds+selection.handPreparationSeconds+firstTime){
      const points=[...candidates].sort((a,b)=>a-b);
      for(let i=1;i<points.length;i++){
        let low=points[i-1],high=points[i];
        if(estimate(low).arrival>selection.receiverReadySeconds||estimate(high).arrival<selection.receiverReadySeconds)continue;
        for(let iteration=0;iteration<24;iteration++){
          const middle=(low+high)/2;
          if(estimate(middle).arrival<selection.receiverReadySeconds)low=middle;else high=middle;
        }
        if(estimate(high).speed<=input.maximumThrowSpeedMps)synchronizedFlightV109=high;
      }
      if(synchronizedFlightV109!==undefined&&!candidates.includes(synchronizedFlightV109))candidates.push(synchronizedFlightV109);
    }
    if(selection.preferEarliestArrivalV1)candidates.sort((a,b)=>{const x=estimate(a),y=estimate(b);
      return x.meets!==y.meets?(x.meets?-1:1):x.control-y.control||x.speed-y.speed;});
    else candidates.sort((a,b)=>{const x=estimate(a),y=estimate(b);
      if(x.meets!==y.meets)return x.meets?-1:1;
      return x.meets?x.speed-y.speed||x.control-y.control:x.control-y.control||x.speed-y.speed;});
  }
  const competitive=!selection?.preferEarliestArrivalV1&&!!selection?.preferStrongestFeasibleV103&&selection.deadlineSeconds!==undefined&&selection.deadlineSeconds>0,
    earliestCandidates=competitive?[...candidates].sort((a,b)=>estimateCandidate!(a).control-estimateCandidate!(b).control):[],
    competitiveDeadlineCandidates=competitive?[...candidates].sort((a,b)=>{const x=estimateCandidate!(a),y=estimateCandidate!(b);
      return x.meets!==y.meets?(x.meets?-1:1):x.meets?y.speed-x.speed:x.control-y.control;}):[];
  if(competitive)candidates.sort((a,b)=>a-b);
  if(competitive&&synchronizedFlightV109!==undefined){
    candidates.splice(candidates.indexOf(synchronizedFlightV109),1);candidates.unshift(synchronizedFlightV109);
  }
  if(preferred!==undefined){const index=candidates.indexOf(preferred);if(index>=0)candidates.splice(index,1);candidates.unshift(preferred);}
  type Feasible={initialVelocity:Vec3;flightSeconds:number;predictedArrivalPosition:Vec3;predictedArrivalVelocity:Vec3;
    predictedMaterialOrientation?:Quaternion;arrivalErrorMeters:number;relativeReleaseSpeedMps:number};
  const feasible:Feasible[]=[];
  const planned=(result:Feasible)=>Object.freeze({kind:'planned' as const,...result,diagnostics:diagnostics(),readPerformance:performanceCounters});
  let bestRejectedError=Infinity,bestRejectedRelativeSpeed=Infinity,overspeedLowerSeconds=0,overspeedLowerMps=Infinity,capacityUpperSeconds=Infinity,capacityUpperMps=0,
    refinementAttempts=0,competitivePhase:'capacity'|'refine'|'fallback'|'deadline_refine'='capacity',
    lateCompetitive:{result:Feasible;control:number}|null=null,timelyCompetitive:{result:Feasible;control:number}|null=null;
  const attempted=new Set<number>();
  for(let candidateIndex=0;candidateIndex<candidates.length;candidateIndex++){
    const seconds=candidates[candidateIndex];
    if(competitive&&attempted.has(seconds))continue;
    attempted.add(seconds);const previousFeasibleCount=feasible.length;
    candidateCount++;
    let velocity={x:delta.x/seconds,y:delta.y/seconds-physics.air.gravityY*seconds/2,z:delta.z/seconds},
      inverse=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>i===j?1/seconds:0)),
      previous:{velocity:Vec3;position:Vec3}|null=null;
    for(let iteration=0;iteration<9;iteration++){
      if(solverEvaluationCount>=100)break;
      solverEvaluationCount++;shootingIntegrationStepUpperBound+=1+Math.ceil(seconds*physics.air.ticksPerSecond/physics.air.integrationStepTicks);
      const arrival=memoizeLiveThrowPhysicalV113('shooting',()=>exactLiveThrowPhysicalKeyV113([initial(velocity),seconds,input.materialOrientationAtRelease]),
        ()=>sampleAerodynamicPitchStateAtElapsedSeconds(initial(velocity),seconds,physics.air,input.materialOrientationAtRelease),airNamespace),error=sub(input.target,arrival.position),errorMeters=norm(error),
        relativeSpeed=norm(sub(velocity,input.bodyVelocity));
      if(errorMeters<bestRejectedError){bestRejectedError=errorMeters;bestRejectedRelativeSpeed=relativeSpeed;}
      if(errorMeters<=tolerance){
        if(relativeSpeed>input.maximumThrowSpeedMps){if(competitive&&seconds<capacityUpperSeconds&&seconds>overspeedLowerSeconds){overspeedLowerSeconds=seconds;overspeedLowerMps=relativeSpeed;}break;}
        // Verify the same complete airborne Source, including floor crossings.
        // It is a prediction kernel only; no launched world object is edited.
        verificationKernelBuilds++;
        const verification=memoizeLiveThrowPhysicalV113('verification',()=>exactLiveThrowPhysicalKeyV113([initial(velocity),seconds,input.materialOrientationAtRelease]),
          ()=>{const kernel=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:0,elapsedSeconds:0,ball:initial(velocity)},
            throughElapsedSeconds:seconds,profile:physics,...(input.materialOrientationAtRelease?{materialOrientationAtStart:input.materialOrientationAtRelease}:{})});
            // Preserve full physical verification on every cache miss, then
            // release the unused cells, descriptor and evaluator closure.
            return {verified:kernel.evaluateAt(seconds,'incoming'),boundaries:kernel.boundaries};
          },profileNamespace),verified=verification.verified,verifiedError=norm(sub(input.target,verified.moment.ball.position));
        if(verification.boundaries.some(b=>b.kind==='ground'&&b.elapsedSeconds<seconds)||verifiedError>tolerance)break;
        completedWallMilliseconds=performance.now()-started;
        const result={initialVelocity:Object.freeze(velocity),flightSeconds:seconds,
          predictedArrivalPosition:verified.moment.ball.position,predictedArrivalVelocity:verified.moment.ball.velocity,
          ...(verified.materialOrientation?{predictedMaterialOrientation:verified.materialOrientation}:{}),
          arrivalErrorMeters:verifiedError,relativeReleaseSpeedMps:relativeSpeed};
        if(!selection||preferred===seconds)return planned(result);
        feasible.push(result);break;
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
    if(competitive&&selection&&feasible.length&&seconds!==synchronizedFlightV109){
      const accepted=feasible.length>previousFeasibleCount?feasible.at(-1)!:null;
      if(competitivePhase==='capacity'&&accepted){
        const timing=liveThrowEffortTimingV103(accepted.relativeReleaseSpeedMps,selection),
          meets=Math.max(timing.releaseDelaySeconds+seconds,selection.receiverReadySeconds)<=selection.deadlineSeconds!;
        competitivePhase=meets?'refine':'fallback';
        if(!meets)lateCompetitive={result:accepted,control:Math.max(timing.releaseDelaySeconds+seconds,selection.receiverReadySeconds)};
        if(!meets)candidates.splice(candidateIndex+1,candidates.length-candidateIndex-1,...[earliestCandidates[0],...competitiveDeadlineCandidates]);
      }
      if((competitivePhase==='fallback'||competitivePhase==='deadline_refine')&&accepted){
        const timing=liveThrowEffortTimingV103(accepted.relativeReleaseSpeedMps,selection),control=Math.max(timing.releaseDelaySeconds+seconds,selection.receiverReadySeconds);
        if(control<=selection.deadlineSeconds!){
          if(!timelyCompetitive||accepted.relativeReleaseSpeedMps>timelyCompetitive.result.relativeReleaseSpeedMps)timelyCompetitive={result:accepted,control};
        }else if(!lateCompetitive||accepted.relativeReleaseSpeedMps<lateCompetitive.result.relativeReleaseSpeedMps)lateCompetitive={result:accepted,control};
        if(lateCompetitive&&timelyCompetitive&&feasible.length<4&&lateCompetitive.result.flightSeconds<timelyCompetitive.result.flightSeconds){
          competitivePhase='deadline_refine';
          const low=lateCompetitive.result.flightSeconds,high=timelyCompetitive.result.flightSeconds,span=high-low,
            lateSpeed=lateCompetitive.result.relativeReleaseSpeedMps,timelySpeed=timelyCompetitive.result.relativeReleaseSpeedMps,
            targetControl=Math.max(selection.receiverReadySeconds,selection.deadlineSeconds!-.0001);
          let lower=low,upper=high;
          // Charge is quadratic in output. Interpolating total time linearly
          // leaves avoidable force unused, so solve the cheap inverse-duration
          // speed model with the actual charge curve before the next full solve.
          for(let iteration=0;iteration<24;iteration++){
            const middle=(lower+upper)/2,weight=(1/middle-1/low)/(1/high-1/low),speed=lateSpeed+weight*(timelySpeed-lateSpeed),
              timing=liveThrowEffortTimingV103(speed,selection),control=Math.max(timing.releaseDelaySeconds+middle,selection.receiverReadySeconds);
            if(control>targetControl)lower=middle;else upper=middle;
          }
          const refined=Math.max(low+span*.05,Math.min(high-span*.05,upper));
          // This boundary is about time available for charge, not the arm's
          // maximum capacity. Every interpolated command is independently
          // solved and verified within the same four-solution budget.
          candidates.splice(candidateIndex+1,candidates.length-candidateIndex-1,refined,...earliestCandidates);
        }
      }
      if(competitivePhase==='refine'){
        if(accepted&&seconds<capacityUpperSeconds){capacityUpperSeconds=seconds;capacityUpperMps=accepted.relativeReleaseSpeedMps;}
        // Reserve the fourth feasible flight for an earliest-control option.
        // Refinement shares the same 100 shooting evaluations and never
        // creates a fifth verified solution or claims unbounded full force.
        if(feasible.length<3&&overspeedLowerSeconds>0&&capacityUpperSeconds-overspeedLowerSeconds>.0001&&refinementAttempts<6){
          // Inverse duration is approximately proportional to release speed;
          // interpolate the measured bracket toward 99.75% output, with a
          // guarded interval so nonlinear drag cannot repeat an endpoint.
          refinementAttempts++;const span=capacityUpperSeconds-overspeedLowerSeconds,
            weight=(input.maximumThrowSpeedMps*.9975-overspeedLowerMps)/(capacityUpperMps-overspeedLowerMps),
            interpolated=1/((1-weight)/overspeedLowerSeconds+weight/capacityUpperSeconds),
            refined=Number.isFinite(interpolated)?Math.max(overspeedLowerSeconds+span*.05,Math.min(capacityUpperSeconds-span*.05,interpolated))
              :(overspeedLowerSeconds+capacityUpperSeconds)/2;
          candidates.splice(candidateIndex+1,candidates.length-candidateIndex-1,refined,...earliestCandidates);
        }else {competitivePhase='fallback';candidates.splice(candidateIndex+1,candidates.length-candidateIndex-1,...earliestCandidates);}
      }
    }
    if(feasible.length>=LIVE_THROW_EFFORT_POLICY_V103.maximumFeasibleFlights)break;
  }
  completedWallMilliseconds=performance.now()-started;
  if(selection&&feasible.length){
    const scored=feasible.map(result=>{const timing=liveThrowEffortTimingV103(result.relativeReleaseSpeedMps,selection),
      control=Math.max(timing.releaseDelaySeconds+result.flightSeconds,selection.receiverReadySeconds);
      return {result,effort:timing.effort,control,
        projectedRelease:timing.releaseDelaySeconds+Math.max(0,selection.receiverReadySeconds-timing.releaseDelaySeconds-result.flightSeconds),
        meets:selection.deadlineSeconds===undefined||control<=selection.deadlineSeconds};});
    scored.sort((a,b)=>a.meets!==b.meets?(a.meets?-1:1):selection.preferEarliestArrivalV1?a.control-b.control||a.effort-b.effort:a.meets
      ?competitive?b.result.relativeReleaseSpeedMps-a.result.relativeReleaseSpeedMps||a.control-b.control:a.effort-b.effort||a.control-b.control
      :a.control-b.control||a.effort-b.effort);
    let chosen=scored[0];
    const synchronized=competitive?scored.find(s=>s.result.flightSeconds===synchronizedFlightV109):undefined;
    // Preserve the runner deadline and the strong-throw policy for ready
    // receivers. Only trade strength for an earlier release when receipt is
    // constrained by receiver arrival. 25ms is controller search tolerance,
    // not a custody/OUT tolerance; a missed deadline gets no extra allowance.
    if(synchronized&&synchronized.meets===chosen.meets
      &&synchronized.control<=chosen.control+(chosen.meets ? .025 : 1e-9)
      &&synchronized.projectedRelease<chosen.projectedRelease-1e-3)chosen=synchronized;
    receiverSynchronizationSelectedV109=!!synchronized&&chosen===synchronized;
    return planned(chosen.result);
  }
  return Object.freeze({kind:'unreachable' as const,reason:'NO_AIRBORNE_SOLUTION_WITHIN_SPEED_TIME_AND_FINITE_SOLVER_LIMITS' as const,
    diagnostics:Object.freeze({...diagnostics(),bestCandidateArrivalErrorMeters:Number.isFinite(bestRejectedError)?bestRejectedError:null,
      bestCandidateRelativeReleaseSpeedMps:Number.isFinite(bestRejectedRelativeSpeed)?bestRejectedRelativeSpeed:null}),readPerformance:performanceCounters});
}
