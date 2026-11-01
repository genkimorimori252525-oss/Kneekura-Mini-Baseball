import { cloneInert } from '../../src/core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../src/core/model/geometry';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../../src/core/sim/pitching/BaseballOrientation';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../../src/core/sim/ball/SourceFreeBallKernel';
import { calculateBaseballAerodynamics } from '../../src/core/sim/ball/BaseballAerodynamics';
import { observePitchBreakTiming, type PitchBreakTimingObservation, type TimedPitchState } from '../../src/integration/browser/PitchBreakTiming';
import { observeReleasedPitchWorkbenchV155, type simulatePitcherWorkbenchV77 } from '../../src/integration/browser/PitcherWorkbenchV77';

function assert(value:unknown,message:string):asserts value { if(!value)throw Error('pitch break low spin: '+message); }
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z), dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z,
  subtract=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),
  scale=(v:Vec3,k:number):Vec3=>({x:v.x*k,y:v.y*k,z:v.z*k}), zero=():Vec3=>({x:0,y:0,z:0});
export const PITCH_BREAK_LOW_SPIN_PROTOCOL_V158=freeze({
  version:'pitch_break_low_spin_protocol_v158',authority:'READ_ONLY_SHARED_SOURCE_MODEL_NOT_REAL_PITCH_CALIBRATION',
  spinScales:[.02,.1,.3,1] as const,gyroDegrees:[0,30,60,85] as const,materialPhaseDegrees:[0,90,180,270] as const,
  gyroMeaning:'ANGLE_FROM_RELATIVE_AIR_TRANSVERSE_PLANE_TOWARD_POSITIVE_RELATIVE_AIR',
  materialPhaseMeaning:'WORLD_LEFT_ROTATION_ABOUT_CASE_SPIN_AXIS_NOT_THESIS_PHASE_IDENTIFICATION',
  maximumAbsoluteAmountDifferenceMeters:.02,maximumRelativeAmountDifference:.05,maximumDirectionDifferenceDegrees:5,
  amountToleranceMeaning:'ABSOLUTE_AND_RELATIVE_LIMITS_MUST_BOTH_HOLD_IN_BOTH_BASES',
  largeAmountMinimumMeters:.1,minimumP50FractionDifference:.05,minimumLate20FractionDifference:.05,
  observationIntervals:[160,640] as const,refinementFactors:[1,2] as const,
  primaryBasis:'SAME_REFERENCE_ELAPSED_TIME_SAME_RELEASE_AIRLESS_GRAVITY',
  secondaryBasis:'EACH_ACTUAL_AT_SAME_PLANE_AGAINST_COMMON_GRAVITY_PLANE',
  thresholdsAreHumanCalibration:false,forceTimerAdded:false,seedSearch:false,nativeAdmission:false});

export function createPitchBreakLowSpinCasesV158(raw:SourceFreeBallDescriptorV2,refinementFactor:1|2=1){
  const base=cloneInert(raw),air=base.profile.air,aero=air.aerodynamics,spin=base.initial.ball.spin,
    velocity=subtract(base.initial.ball.velocity,aero.windVelocityMps),spinMagnitude=norm(spin),airMagnitude=norm(velocity),
    material=base.materialOrientationAtStart;
  assert(refinementFactor===1||refinementFactor===2,'predeclared refinement one or two required');
  assert(base.initial.elapsedSeconds===0,'release-rooted elapsed clock required');
  assert(material!==undefined&&aero.seamForce!==undefined&&aero.seamForce.coefficientScale>0&&aero.spinDecay!==undefined,
    'saved material, enabled seam and spin decay required');
  assert(spinMagnitude>0&&airMagnitude>0,'nonzero spin and relative air required');
  const airUnit=scale(velocity,1/airMagnitude),transverse=subtract(spin,scale(airUnit,dot(spin,airUnit))),transverseMagnitude=norm(transverse);
  assert(transverseMagnitude>1e-12*spinMagnitude,'nonparallel spin-plane basis required');
  const transverseUnit=scale(transverse,1/transverseMagnitude),nominalResolved=resolveAerodynamicIntegrationStepTicksV1(spin,air),
    commonIntegrationStepTicks=Math.max(1,Math.floor(nominalResolved/refinementFactor)),
    clock={ticksPerSecond:air.ticksPerSecond,originalNominalStepTicks:air.integrationStepTicks,commonIntegrationStepTicks},cases=[];
  for(const spinScale of PITCH_BREAK_LOW_SPIN_PROTOCOL_V158.spinScales)
    for(const gyroDegrees of PITCH_BREAK_LOW_SPIN_PROTOCOL_V158.gyroDegrees)
      for(const materialPhaseDegrees of PITCH_BREAK_LOW_SPIN_PROTOCOL_V158.materialPhaseDegrees){
        const radians=gyroDegrees*Math.PI/180,axis={x:transverseUnit.x*Math.cos(radians)+airUnit.x*Math.sin(radians),
          y:transverseUnit.y*Math.cos(radians)+airUnit.y*Math.sin(radians),z:transverseUnit.z*Math.cos(radians)+airUnit.z*Math.sin(radians)},
          chosenSpin=scale(axis,spinMagnitude*spinScale),orientation=materialPhaseDegrees===0?material:
            normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(chosenSpin,materialPhaseDegrees*Math.PI/180),material)),
          descriptor:SourceFreeBallDescriptorV2={...base,initial:{...base.initial,ball:{...base.initial.ball,spin:chosenSpin}},
            materialOrientationAtStart:orientation,profile:{...base.profile,air:{...air,integrationStepTicks:commonIntegrationStepTicks}}};
        assert(resolveAerodynamicIntegrationStepTicksV1(chosenSpin,descriptor.profile.air)===commonIntegrationStepTicks,'all effective Source steps must equal declared common step');
        cases.push({id:`spin-${spinScale}_gyro-${gyroDegrees}_phase-${materialPhaseDegrees}`,
          factors:{spinScale,gyroDegrees,materialPhaseDegrees},descriptor});
      }
  return freeze({clock,cases});
}
type Workbench=ReturnType<typeof simulatePitcherWorkbenchV77>;
type Released=Parameters<typeof observeReleasedPitchWorkbenchV155>[0];
export type PitchBreakLowSpinReferenceV158=Readonly<{sourceDescriptor:SourceFreeBallDescriptorV2;referenceElapsedSeconds:number;
  measurementPlaneZ:number;battingSetupV94:Released['battingSetupV94'];releaseCommand:Workbench['metrics']['breakTimingV155']['releaseCommand']}>;
type Case=Readonly<{id:string;factors:Readonly<{spinScale:number;gyroDegrees:number;materialPhaseDegrees:number}>;descriptor:SourceFreeBallDescriptorV2}>;
type XY=Readonly<{x:number;y:number}>;
type Status=PitchBreakTimingObservation['status'];
export type PitchBreakLowSpinComparisonV158=Readonly<{id:string;factors:Case['factors'];
  commonTime:Readonly<{status:Status;amountMeters:number;direction:XY|null;p50Fraction:number|null;late20Fraction:number|null}>;
  samePlane:Readonly<{status:Status|'NO_FINITE_PLANE_CROSSING';amountMeters:number|null;direction:XY|null}>}>;

/** Reports actual kernel states. Analytic gravity is only the explicitly
 * labeled comparison baseline; it never supplies an actual flight state. */
export function measurePitchBreakLowSpinCaseV158(rawReference:PitchBreakLowSpinReferenceV158,rawItem:Case,observationIntervals:160|640=160){
  assert(observationIntervals===160||observationIntervals===640,'predeclared observation grid required');
  const reference=cloneInert(rawReference),item=cloneInert(rawItem),descriptor=item.descriptor,
    kernel=createSourceFreeBallKernel(descriptor),air=descriptor.profile.air,initial=descriptor.initial.ball,end=reference.referenceElapsedSeconds;
  assert(end>0&&end<=descriptor.throughElapsedSeconds,'reference elapsed time outside Source horizon');
  assert((['x','y','z'] as const).every(key=>initial.position[key]===reference.sourceDescriptor.initial.ball.position[key]&&
    initial.velocity[key]===reference.sourceDescriptor.initial.ball.velocity[key]),'reference and case release PV must match');
  const times=Array.from({length:observationIntervals+1},(_,index)=>index===observationIntervals?end:end*index/observationIntervals),
    sourceSamples=times.map(elapsedSeconds=>{const state=kernel.evaluateAt(elapsedSeconds),ball=state.moment.ball;
      return {elapsedSeconds,tick:ball.tick,position:ball.position,velocity:ball.velocity,spin:ball.spin,
        orientation:state.materialOrientation??state.orientation,phase:state.phase};}),
    actual:TimedPitchState[]=sourceSamples.map(sample=>({elapsedSeconds:sample.elapsedSeconds,position:sample.position,velocity:sample.velocity,phase:sample.phase})),
    baseline:TimedPitchState[]=times.map(time=>({elapsedSeconds:time,position:time===0?{...initial.position}:
      {x:initial.position.x+initial.velocity.x*time,y:initial.position.y+initial.velocity.y*time+air.gravityY*time*time/2,z:initial.position.z+initial.velocity.z*time},
      velocity:time===0?{...initial.velocity}:{...initial.velocity,y:initial.velocity.y+air.gravityY*time},phase:'airborne',counterfactualGroundIgnored:true})),
    timingAtReference=observePitchBreakTiming({actual,baseline,planeZ:reference.measurementPlaneZ,
      comparisonBasis:'FIXED_REFERENCE_ELAPSED_TIME_SHARED_RELEASE_AIRLESS_GRAVITY_V158',
      groundEvents:{actual:kernel.boundaries.filter(row=>row.kind==='ground'&&row.elapsedSeconds<=end).map(row=>row.elapsedSeconds),baseline:[]}}),
    direction=timingAtReference.finalXY.direction,
    project=(v:Vec3)=>direction===null?null:v.x*direction.x+v.y*direction.y,
    forceSeries=sourceSamples.map(sample=>{
      if(sample.phase!=='airborne')return {elapsedSeconds:sample.elapsedSeconds,force:null,projected:null};
      const a=calculateBaseballAerodynamics(sample.velocity,sample.spin,air.aerodynamics,sample.orientation),seamAcceleration=a.seamAcceleration??zero(),
        gravityAcceleration={x:0,y:air.gravityY,z:0};
      return {elapsedSeconds:sample.elapsedSeconds,force:{dragAcceleration:a.dragAcceleration,liftAcceleration:a.liftAcceleration,seamAcceleration,
        totalAirAcceleration:a.totalAcceleration,gravityAcceleration,totalFreeFlightAcceleration:{...a.totalAcceleration,y:a.totalAcceleration.y+air.gravityY}},
        projected:direction===null?null:{drag:project(a.dragAcceleration)!,lift:project(a.liftAcceleration)!,seam:project(seamAcceleration)!,totalAir:project(a.totalAcceleration)!}};
    }),
    command=reference.releaseCommand,commandObservation={requestedTarget:command.requestedTarget,selectedTarget:command.selectedTarget,commandedTarget:command.commandedTarget,
      nominalReleaseVelocity:initial.velocity,executedReleaseVelocity:initial.velocity,
      inverseCompensationBasis:'FIX_REFERENCE_RELEASE_FOR_PREDECLARED_LOW_SPIN_MATRIX_V158',postReleaseExecutionReaimed:false as const},
    ownPlate=(()=>{
      try{
        const observed=observeReleasedPitchWorkbenchV155({descriptor,battingSetupV94:reference.battingSetupV94,releaseSpeedKmh:norm(initial.velocity)*3.6,
          commandObservation,releaseMode:'FIXED_RELEASE'}),{breakTimingV155,...metrics}=observed.metrics,own=breakTimingV155.commonTime.airlessGravity;
        return {status:'MEASURED' as const,metrics,timingAtOwnPlate:{status:own.status,percentTimes:own.percentTimes,late20Percent:own.late20Percent,
          groundClassification:own.groundClassification}};
      }catch(error){
        if(!(error instanceof Error)||!/(actual Source did not reach the plate plane|counterfactual did not reach plate plane)/.test(error.message))throw error;
        return {status:'NO_FINITE_PLANE_CROSSING' as const,reason:error.message};
      }
    })(),
    planeDelta=ownPlate.status==='MEASURED'?subtract(ownPlate.metrics.platePosition,ownPlate.metrics.qualityV121.gravityOnly.platePosition):null,
    planeAmount=planeDelta===null?null:Math.hypot(planeDelta.x,planeDelta.y),
    comparison:PitchBreakLowSpinComparisonV158={id:item.id,factors:item.factors,
      commonTime:{status:timingAtReference.status,amountMeters:timingAtReference.finalXY.normMeters,direction,
        p50Fraction:timingAtReference.percentTimes.p50===null?null:timingAtReference.percentTimes.p50.elapsedSeconds/end,
        late20Fraction:timingAtReference.late20Percent.projectedFraction},
      samePlane:{status:ownPlate.status==='MEASURED'?ownPlate.timingAtOwnPlate.status:ownPlate.status,amountMeters:planeAmount,
        direction:planeDelta===null||planeAmount===null||planeAmount===0?null:{x:planeDelta.x/planeAmount,y:planeDelta.y/planeAmount}}};
  return freeze({...item,effectiveIntegrationStepTicks:resolveAerodynamicIntegrationStepTicksV1(initial.spin,air),
    authority:'READ_ONLY_SHARED_SOURCE_MODEL_COUNTERFACTUAL',nativeAdmission:false,officialResult:null,
    observation:{referenceElapsedSeconds:end,timingAtReference,sourceSamples,forceSeries,ownPlate},comparison});
}

const directionDifference=(a:XY|null,b:XY|null):number|null=>{
  if(a===null||b===null)return null;
  const denominator=Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y);
  return denominator>0?Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y)/denominator)))*180/Math.PI:null;
};
const relativeDifference=(a:number|null,b:number|null):number|null=>a===null||b===null||a<1e-6||b<1e-6?null:Math.abs(a-b)/((a+b)/2);
const absoluteDifference=(a:number|null,b:number|null):number|null=>a===null||b===null?null:Math.abs(a-b);
const fractionDifference=(a:number|null,b:number|null):number|null=>a===null||b===null?null:Math.abs(a-b);
/** This predicate screens model observations, never alters or selects the
 * actual pitch. Null/invalid classification is retained rather than filled. */
export function analyzePitchBreakLowSpinCasesV158(raw:readonly PitchBreakLowSpinComparisonV158[]){
  const cases=cloneInert(raw),protocol=PITCH_BREAK_LOW_SPIN_PROTOCOL_V158,pairs=[];
  assert(new Set(cases.map(item=>item.id)).size===cases.length,'comparison IDs must be unique');
  for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++){
    const a=cases[i],b=cases[j],one=a.commonTime,two=b.commonTime,planeA=a.samePlane,planeB=b.samePlane,
      commonTimeAmountDifferenceMeters=Math.abs(one.amountMeters-two.amountMeters),
      commonTimeRelativeAmountDifference=relativeDifference(one.amountMeters,two.amountMeters),
      commonTimeDirectionDifferenceDegrees=directionDifference(one.direction,two.direction),
      samePlaneAmountDifferenceMeters=absoluteDifference(planeA.amountMeters,planeB.amountMeters),
      samePlaneRelativeAmountDifference=relativeDifference(planeA.amountMeters,planeB.amountMeters),
      samePlaneDirectionDifferenceDegrees=directionDifference(planeA.direction,planeB.direction),
      eligible=one.status==='CLASSIFIED'&&two.status==='CLASSIFIED'&&planeA.status==='CLASSIFIED'&&planeB.status==='CLASSIFIED'&&
        commonTimeRelativeAmountDifference!==null&&samePlaneRelativeAmountDifference!==null&&
        commonTimeDirectionDifferenceDegrees!==null&&samePlaneDirectionDifferenceDegrees!==null,
      absoluteAmountMatched=commonTimeAmountDifferenceMeters<=protocol.maximumAbsoluteAmountDifferenceMeters&&
        samePlaneAmountDifferenceMeters!==null&&samePlaneAmountDifferenceMeters<=protocol.maximumAbsoluteAmountDifferenceMeters,
      relativeAmountMatched=commonTimeRelativeAmountDifference!==null&&commonTimeRelativeAmountDifference<=protocol.maximumRelativeAmountDifference&&
        samePlaneRelativeAmountDifference!==null&&samePlaneRelativeAmountDifference<=protocol.maximumRelativeAmountDifference,
      directionMatched=commonTimeDirectionDifferenceDegrees!==null&&commonTimeDirectionDifferenceDegrees<=protocol.maximumDirectionDifferenceDegrees&&
        samePlaneDirectionDifferenceDegrees!==null&&samePlaneDirectionDifferenceDegrees<=protocol.maximumDirectionDifferenceDegrees,
      matchedAmountAndDirection=eligible&&absoluteAmountMatched&&relativeAmountMatched&&directionMatched,
      largeAmountBand=[one.amountMeters,two.amountMeters,planeA.amountMeters,planeB.amountMeters]
        .every(amount=>amount!==null&&amount>=protocol.largeAmountMinimumMeters),
      p50FractionDifference=fractionDifference(one.p50Fraction,two.p50Fraction),late20FractionDifference=fractionDifference(one.late20Fraction,two.late20Fraction),
      timeShapeCandidate=matchedAmountAndDirection&&((p50FractionDifference!==null&&p50FractionDifference>=protocol.minimumP50FractionDifference)||
        (late20FractionDifference!==null&&late20FractionDifference>=protocol.minimumLate20FractionDifference));
    pairs.push({caseAId:a.id,caseBId:b.id,eligible,commonTimeAmountDifferenceMeters,commonTimeRelativeAmountDifference,commonTimeDirectionDifferenceDegrees,
      samePlaneAmountDifferenceMeters,samePlaneRelativeAmountDifference,samePlaneDirectionDifferenceDegrees,absoluteAmountMatched,relativeAmountMatched,
      directionMatched,matchedAmountAndDirection,largeAmountBand,p50FractionDifference,late20FractionDifference,timeShapeCandidate});
  }
  const matched=pairs.filter(pair=>pair.matchedAmountAndDirection),candidates=matched.filter(pair=>pair.timeShapeCandidate),
    largeCandidates=candidates.filter(pair=>pair.largeAmountBand),
    primaryStatusCounts=Object.fromEntries([...new Set(cases.map(item=>item.commonTime.status))].map(status=>
      [status,cases.filter(item=>item.commonTime.status===status).length]));
  return freeze({pairs,summary:{caseCount:cases.length,pairCount:pairs.length,primaryStatusCounts,
    eligiblePairCount:pairs.filter(pair=>pair.eligible).length,matchedAmountAndDirectionPairCount:matched.length,candidatePairCount:candidates.length,
    largeAmountMatchedPairCount:matched.filter(pair=>pair.largeAmountBand).length,largeAmountCandidatePairCount:largeCandidates.length,
    candidatePairs:candidates.map(pair=>({caseAId:pair.caseAId,caseBId:pair.caseBId,largeAmountBand:pair.largeAmountBand})),
    screenVerdict:largeCandidates.length?'LARGE_AMOUNT_MODEL_TIMING_DIFFERENCE_CANDIDATES':candidates.length?'ONLY_LOW_AMOUNT_MODEL_TIMING_DIFFERENCE_CANDIDATES':
      matched.length?'NOT_DEMONSTRATED_IN_PRESCRIBED_MATRIX':'NO_MATCHED_AMOUNT_DIRECTION_PAIRS'}});
}
