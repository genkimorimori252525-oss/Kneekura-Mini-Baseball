import { cloneInert } from '../../src/core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../src/core/model/geometry';
import { resolveAerodynamicIntegrationStepTicksV1 } from '../../src/core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle, rotateVectorByQuaternion } from '../../src/core/sim/pitching/BaseballOrientation';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../../src/core/sim/ball/SourceFreeBallKernel';
import { calculateBaseballAerodynamics } from '../../src/core/sim/ball/BaseballAerodynamics';
import { observePitchBreakTiming, type PitchBreakTimingObservation, type TimedPitchState } from '../../src/integration/browser/PitchBreakTiming';
import { observeReleasedPitchWorkbenchV155, simulatePitcherWorkbenchV77 } from '../../src/integration/browser/PitcherWorkbenchV77';

const magnitude=(v:Vec3)=>Math.hypot(v.x,v.y,v.z),
  subtract=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),
  cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw Error('pitch break feasibility: '+message);}
function freeze<T>(value:T):T {if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

export const PITCH_BREAK_FEASIBILITY_PROTOCOL_V156=freeze({
  version:'pitch_break_feasibility_protocol_v156',authority:'READ_ONLY_MODEL_COUNTERFACTUAL_NOT_REAL_PITCH_CALIBRATION',
  spinTiltDegrees:30,materialPhaseDegrees:90,observationIntervals:160,denseObservationIntervals:640,
  absoluteAmountToleranceFloorMeters:.02,maximumRelativeAmountDifference:.05,maximumDirectionDifferenceDegrees:5,
  amountToleranceMeaning:'MAXIMUM_OF_ABSOLUTE_FLOOR_AND_FIVE_PERCENT_OF_PAIR_MEAN',
  minimumP50FractionDifference:.05,minimumLate20FractionDifference:.05,
  primaryBasis:'SAME_REFERENCE_ELAPSED_TIME_SAME_RELEASE_AIRLESS_GRAVITY',
  secondaryBasis:'EACH_ACTUAL_AT_SAME_PLANE_AGAINST_COMMON_GRAVITY_PLANE',
  integrationStepChoice:'REFERENCE_SEAM_RESOLVED_STEP_COMMON_TO_ALL_CASES',
  thresholdsAreHumanCalibration:false,forceTimerAdded:false,seedSearch:false});

/** Explicit experiment profiles, not authoring changes. Spin/material controls
 * use existing rotations; force integration remains owned by Source. */
export function createPitchBreakFeasibilityCasesV156(raw:SourceFreeBallDescriptorV2,refinementFactor:1|2=1){
  const base=cloneInert(raw),air=base.profile.air,aero=air.aerodynamics,spin=base.initial.ball.spin,
    velocity=subtract(base.initial.ball.velocity,aero.windVelocityMps),rotationAxis=cross(spin,velocity),
    material=base.materialOrientationAtStart,seam=aero.seamForce,decay=aero.spinDecay;
  assert(refinementFactor===1||refinementFactor===2,'refinement must be explicitly one or two');
  assert(base.initial.elapsedSeconds===0,'release-rooted elapsed clock required');
  assert(material!==undefined&&seam!==undefined&&seam.coefficientScale>0&&decay!==undefined,'saved material, enabled seam and spin decay required');
  assert(magnitude(spin)>0&&magnitude(velocity)>0&&magnitude(rotationAxis)>1e-12*magnitude(spin)*magnitude(velocity),'nonzero nonparallel spin and relative air velocity required');
  const nominalResolved=resolveAerodynamicIntegrationStepTicksV1(spin,air),
    commonIntegrationStepTicks=Math.max(1,Math.floor(nominalResolved/refinementFactor)),
    tilted=rotateVectorByQuaternion(spin,quaternionFromAxisAngle(rotationAxis,PITCH_BREAK_FEASIBILITY_PROTOCOL_V156.spinTiltDegrees*Math.PI/180)),
    clock={ticksPerSecond:air.ticksPerSecond,originalNominalStepTicks:air.integrationStepTicks,commonIntegrationStepTicks},
    cases=[];
  for(const axis of ['ORIGINAL','TOWARD_AIR_30_DEGREES'] as const)
    for(const phase of ['ORIGINAL','PHASE_90_DEGREES'] as const)
      for(const seamMode of ['OFF','SAVED'] as const)
        for(const decayMode of ['OFF','SAVED'] as const){
          const chosenSpin=axis==='ORIGINAL'?{...spin}:tilted,
            orientation=phase==='ORIGINAL'?material:normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(chosenSpin,Math.PI/2),material)),
            dynamics={...aero,seamForce:{...seam,coefficientScale:seamMode==='OFF'?0:seam.coefficientScale}};
          if(decayMode==='OFF')delete dynamics.spinDecay;
          const descriptor:SourceFreeBallDescriptorV2={...base,
            initial:{...base.initial,ball:{...base.initial.ball,spin:chosenSpin}},
            materialOrientationAtStart:orientation,
            profile:{...base.profile,air:{...air,integrationStepTicks:commonIntegrationStepTicks,aerodynamics:dynamics}}};
          assert(resolveAerodynamicIntegrationStepTicksV1(chosenSpin,descriptor.profile.air)===commonIntegrationStepTicks,'effective Source steps must match declared common step');
          cases.push({id:`axis-${axis}_phase-${phase}_seam-${seamMode}_decay-${decayMode}`,
            factors:{axis,material:phase,seam:seamMode,decay:decayMode},descriptor});
        }
  return freeze({clock,cases});
}

type XY=Readonly<{x:number;y:number}>;
type TrialPacket=Parameters<typeof simulatePitcherWorkbenchV77>[0];
type Options=Readonly<{observationIntervals:160|640;refinementFactor:1|2}>;
type Case=ReturnType<typeof createPitchBreakFeasibilityCasesV156>['cases'][number];
type Reference=ReturnType<typeof simulatePitcherWorkbenchV77>;
const zero=():Vec3=>({x:0,y:0,z:0}),
  xyNorm=(value:XY)=>Math.hypot(value.x,value.y),
  range=(values:readonly number[])=>values.length?{minimum:Math.min(...values),maximum:Math.max(...values)}:null,
  present=(value:number|null):value is number=>value!==null,
  p50Fraction=(timing:PitchBreakTimingObservation)=>timing.percentTimes.p50===null?null:
    timing.percentTimes.p50.elapsedSeconds/timing.raw.at(-1)!.elapsedSeconds;

function measureCase(reference:Reference,item:Case,observationIntervals:160|640){
  const descriptor=item.descriptor,kernel=createSourceFreeBallKernel(descriptor),air=descriptor.profile.air,
    initial=descriptor.initial.ball,referenceElapsedSeconds=reference.metrics.flightSeconds,
    times=Array.from({length:observationIntervals+1},(_,index)=>index===observationIntervals?referenceElapsedSeconds:referenceElapsedSeconds*index/observationIntervals),
    sourceSamples=times.map(elapsedSeconds=>{const source=kernel.evaluateAt(elapsedSeconds);
      return {elapsedSeconds,tick:source.moment.ball.tick,position:source.moment.ball.position,velocity:source.moment.ball.velocity,spin:source.moment.ball.spin,
        orientation:source.materialOrientation??source.orientation,phase:source.phase};}),
    actual:TimedPitchState[]=sourceSamples.map(sample=>({elapsedSeconds:sample.elapsedSeconds,position:sample.position,velocity:sample.velocity,phase:sample.phase})),
    baseline:TimedPitchState[]=times.map(time=>({elapsedSeconds:time,
      position:time===0?{...initial.position}:{x:initial.position.x+initial.velocity.x*time,
        y:initial.position.y+initial.velocity.y*time+air.gravityY*time*time/2,z:initial.position.z+initial.velocity.z*time},
      velocity:time===0?{...initial.velocity}:{x:initial.velocity.x,y:initial.velocity.y+air.gravityY*time,z:initial.velocity.z},
      phase:'airborne',counterfactualGroundIgnored:true})),
    timingAtReference=observePitchBreakTiming({actual,baseline,planeZ:reference.metrics.measurementPlaneZ,
      comparisonBasis:'FIXED_REFERENCE_PLATE_ELAPSED_TIME_SHARED_RELEASE_AIRLESS_GRAVITY_V156',
      groundEvents:{actual:kernel.boundaries.filter(boundary=>boundary.kind==='ground'&&boundary.elapsedSeconds<=referenceElapsedSeconds).map(boundary=>boundary.elapsedSeconds),baseline:[]}}),
    direction=timingAtReference.finalXY.direction,
    project=(value:Vec3)=>direction===null?null:value.x*direction.x+value.y*direction.y,
    forceSeries=sourceSamples.map(sample=>{
      if(sample.phase!=='airborne')return {elapsedSeconds:sample.elapsedSeconds,force:null,projected:null};
      const a=calculateBaseballAerodynamics(sample.velocity,sample.spin,air.aerodynamics,sample.orientation),
        seamAcceleration=a.seamAcceleration??zero(),gravityAcceleration={x:0,y:air.gravityY,z:0};
      return {elapsedSeconds:sample.elapsedSeconds,
        force:{dragAcceleration:a.dragAcceleration,liftAcceleration:a.liftAcceleration,seamAcceleration,totalAirAcceleration:a.totalAcceleration,
          gravityAcceleration,totalFreeFlightAcceleration:{x:a.totalAcceleration.x,y:a.totalAcceleration.y+air.gravityY,z:a.totalAcceleration.z}},
        projected:direction===null?null:{drag:project(a.dragAcceleration)!,lift:project(a.liftAcceleration)!,seam:project(seamAcceleration)!,totalAir:project(a.totalAcceleration)!}};
    }),
    release=reference.metrics.breakTimingV155.releaseCommand,
    commandObservation={requestedTarget:release.requestedTarget,selectedTarget:release.selectedTarget,commandedTarget:release.commandedTarget,
      nominalReleaseVelocity:initial.velocity,executedReleaseVelocity:initial.velocity,
      inverseCompensationBasis:'FIX_REFERENCE_RELEASE_FOR_PREDECLARED_SOURCE_FACTOR_MATRIX',postReleaseExecutionReaimed:false as const},
    ownPlate=(()=>{
      try{
        const observed=observeReleasedPitchWorkbenchV155({descriptor,battingSetupV94:reference.pitch.diagnostics.battingSetupV94,
          releaseSpeedKmh:magnitude(initial.velocity)*3.6,commandObservation,releaseMode:'FIXED_RELEASE'}),
          {breakTimingV155,...metrics}=observed.metrics,own=breakTimingV155.commonTime.airlessGravity;
        return {status:'MEASURED' as const,metrics,timingAtOwnPlate:{status:own.status,percentTimes:own.percentTimes,
          late20Percent:own.late20Percent,groundClassification:own.groundClassification}};
      }catch(error){
        if(!(error instanceof Error)||!/(actual Source did not reach the plate plane|counterfactual did not reach plate plane)/.test(error.message))throw error;
        return {status:'NO_FINITE_PLANE_CROSSING' as const,reason:error.message};
      }
    })();
  return {...item,effectiveIntegrationStepTicks:resolveAerodynamicIntegrationStepTicksV1(initial.spin,air),
    observation:{referenceElapsedSeconds,timingAtReference,sourceSamples,forceSeries,ownPlate}};
}
type MeasuredCase=ReturnType<typeof measureCase>;
function samePlaneMovement(item:MeasuredCase):XY|null {
  const own=item.observation.ownPlate;
  if(own.status!=='MEASURED')return null;
  const one=own.metrics.platePosition,two=own.metrics.qualityV121.gravityOnly.platePosition;
  return {x:one.x-two.x,y:one.y-two.y};
}
function directionDifference(one:XY|null,two:XY|null):number|null {
  if(one===null||two===null||xyNorm(one)<1e-6||xyNorm(two)<1e-6)return null;
  return Math.acos(Math.max(-1,Math.min(1,(one.x*two.x+one.y*two.y)/(xyNorm(one)*xyNorm(two)))))*180/Math.PI;
}
function comparePairs(cases:readonly MeasuredCase[]){
  const protocol=PITCH_BREAK_FEASIBILITY_PROTOCOL_V156,pairs=[];
  for(let index=0;index<cases.length;index++)for(let other=index+1;other<cases.length;other++){
    const a=cases[index],b=cases[other],one=a.observation.timingAtReference,two=b.observation.timingAtReference,
      planeA=samePlaneMovement(a),planeB=samePlaneMovement(b),commonA=one.finalXY.normMeters,commonB=two.finalXY.normMeters,
      samePlaneA=planeA===null?null:xyNorm(planeA),samePlaneB=planeB===null?null:xyNorm(planeB),
      commonTimeAmountDifferenceMeters=Math.abs(commonA-commonB),commonTimeDirectionDifferenceDegrees=directionDifference(one.finalDeltaXYZ,two.finalDeltaXYZ),
      samePlaneAmountDifferenceMeters=samePlaneA===null||samePlaneB===null?null:Math.abs(samePlaneA-samePlaneB),
      samePlaneDirectionDifferenceDegrees=directionDifference(planeA,planeB),
      ownA=a.observation.ownPlate,ownB=b.observation.ownPlate,
      eligible=one.status==='CLASSIFIED'&&two.status==='CLASSIFIED'&&ownA.status==='MEASURED'&&ownB.status==='MEASURED'&&
        ownA.timingAtOwnPlate.status==='CLASSIFIED'&&ownB.timingAtOwnPlate.status==='CLASSIFIED'&&
        samePlaneA!==null&&samePlaneB!==null&&samePlaneA>=1e-6&&samePlaneB>=1e-6,
      amountTolerance=(a:number,b:number)=>Math.max(protocol.absoluteAmountToleranceFloorMeters,protocol.maximumRelativeAmountDifference*(a+b)/2),
      matchedAmountAndDirection=eligible&&commonTimeAmountDifferenceMeters<=amountTolerance(commonA,commonB)&&
        commonTimeDirectionDifferenceDegrees!==null&&commonTimeDirectionDifferenceDegrees<=protocol.maximumDirectionDifferenceDegrees&&
        samePlaneAmountDifferenceMeters!==null&&samePlaneAmountDifferenceMeters<=amountTolerance(samePlaneA!,samePlaneB!)&&
        samePlaneDirectionDifferenceDegrees!==null&&samePlaneDirectionDifferenceDegrees<=protocol.maximumDirectionDifferenceDegrees,
      fractionA=p50Fraction(one),fractionB=p50Fraction(two),lateA=one.late20Percent.projectedFraction,lateB=two.late20Percent.projectedFraction,
      p50FractionDifference=fractionA===null||fractionB===null?null:Math.abs(fractionA-fractionB),
      late20FractionDifference=lateA===null||lateB===null?null:Math.abs(lateA-lateB),
      timeShapeCandidate=matchedAmountAndDirection&&(p50FractionDifference!==null&&p50FractionDifference>=protocol.minimumP50FractionDifference||
        late20FractionDifference!==null&&late20FractionDifference>=protocol.minimumLate20FractionDifference);
    pairs.push({caseAId:a.id,caseBId:b.id,eligible,commonTimeAmountDifferenceMeters,commonTimeDirectionDifferenceDegrees,
      samePlaneAmountDifferenceMeters,samePlaneDirectionDifferenceDegrees,p50FractionDifference,late20FractionDifference,matchedAmountAndDirection,timeShapeCandidate});
  }
  return {pairs};
}
function summarize(cases:readonly MeasuredCase[],analysis:ReturnType<typeof comparePairs>){
  const matched=analysis.pairs.filter(pair=>pair.matchedAmountAndDirection),candidates=matched.filter(pair=>pair.timeShapeCandidate),
    frequencies=Object.fromEntries([...new Set(cases.map(item=>item.observation.timingAtReference.status))]
      .map(status=>[status,cases.filter(item=>item.observation.timingAtReference.status===status).length]));
  return {caseCount:cases.length,pairCount:analysis.pairs.length,primaryStatusCounts:frequencies,
    eligiblePairCount:analysis.pairs.filter(pair=>pair.eligible).length,matchedAmountAndDirectionPairCount:matched.length,candidatePairCount:candidates.length,
    p50FractionRange:range(cases.map(item=>p50Fraction(item.observation.timingAtReference)).filter(present)),
    late20FractionRange:range(cases.map(item=>item.observation.timingAtReference.late20Percent.projectedFraction).filter(present)),
    matchedP50DifferenceRange:range(matched.map(pair=>pair.p50FractionDifference).filter(present)),
    matchedLate20DifferenceRange:range(matched.map(pair=>pair.late20FractionDifference).filter(present)),
    candidatePairs:candidates.map(pair=>[pair.caseAId,pair.caseBId]),
    screenVerdict:candidates.length?'MODEL_TIMING_DIFFERENCE_CANDIDATES':matched.length?'NOT_DEMONSTRATED_IN_PRESCRIBED_MATRIX':'NO_MATCHED_AMOUNT_DIRECTION_PAIRS'};
}
/** One prescribed matrix, with no inverse aiming or random draws after the
 * reference trial. The analytic gravity path is a labeled reporting baseline. */
export function runPitchBreakFeasibilityV156(packet:TrialPacket,options:Options={observationIntervals:160,refinementFactor:1}){
  assert(options.observationIntervals===160||options.observationIntervals===640,'only predeclared observation grids supported');
  assert(options.refinementFactor===1||options.refinementFactor===2,'only predeclared integration sensitivity supported');
  const original=simulatePitcherWorkbenchV77(packet),sourceDescriptor=original.pitch.diagnostics.sourceDescriptor,
    generated=createPitchBreakFeasibilityCasesV156(sourceDescriptor,options.refinementFactor),
    cases=generated.cases.map(item=>measureCase(original,item,options.observationIntervals)),pairAnalysis=comparePairs(cases),
    referenceCase=cases.find(item=>item.factors.axis==='ORIGINAL'&&item.factors.material==='ORIGINAL'&&item.factors.seam==='SAVED'&&item.factors.decay==='SAVED')!,
    sameVector=(a:Vec3,b:Vec3)=>(['x','y','z'] as const).every(key=>Object.is(a[key],b[key])),
    referenceBaseTrajectoryExact=referenceCase.observation.sourceSamples.every(sample=>{
      const actual=original.sampleAtPitchElapsedSeconds(sample.elapsedSeconds)!;
      return sameVector(sample.position,actual.position)&&sameVector(sample.velocity,actual.velocity)&&sameVector(sample.spin,actual.spin)&&sample.phase===actual.phase
        &&Object.is(sample.tick,actual.tick)&&(['w','x','y','z'] as const).every(key=>Object.is(sample.orientation[key],actual.orientation[key]));
    });
  // A lab profile with a different declared step is a different numerical
  // input even when the initial resolved step matches. Retain its actual
  // difference; exact replay is asserted separately with the original input.
  const differences=referenceCase.observation.sourceSamples.map(sample=>{const actual=original.sampleAtPitchElapsedSeconds(sample.elapsedSeconds)!;
    return {elapsedSeconds:sample.elapsedSeconds,position:magnitude(subtract(sample.position,actual.position)),
      velocity:magnitude(subtract(sample.velocity,actual.velocity)),spin:magnitude(subtract(sample.spin,actual.spin)),
      materialOrientationComponent:Math.max(...(['w','x','y','z'] as const).map(key=>Math.abs(sample.orientation[key]-actual.orientation[key]))),
      phaseExact:sample.phase===actual.phase,tickExact:Object.is(sample.tick,actual.tick)};}),
    originalKernel=createSourceFreeBallKernel(sourceDescriptor),
    originalSourceSamples=referenceCase.observation.sourceSamples.map(sample=>original.sampleAtPitchElapsedSeconds(sample.elapsedSeconds)!),
    originalReferenceReplayExact=originalSourceSamples.every(actual=>{const restored=originalKernel.evaluateAt(actual.elapsedSeconds),ball=restored.moment.ball,
      orientation=restored.materialOrientation??restored.orientation;
      return Object.is(actual.tick,ball.tick)&&sameVector(actual.position,ball.position)&&sameVector(actual.velocity,ball.velocity)&&sameVector(actual.spin,ball.spin)
        &&actual.phase===restored.phase&&(['w','x','y','z'] as const).every(key=>Object.is(actual.orientation[key],orientation[key]));});
  assert(originalReferenceReplayExact,'identical original Source descriptor must replay every reference value exactly');
  const originalVersusLab={comparison:'ORIGINAL_DECLARED_STEP_VS_EXPLICIT_LAB_STEP',exact:referenceBaseTrajectoryExact,
    firstDifference:differences.find(item=>item.position!==0||item.velocity!==0||item.spin!==0||item.materialOrientationComponent!==0||!item.phaseExact||!item.tickExact)??null,
    maximumDifference:{position:Math.max(...differences.map(item=>item.position)),velocity:Math.max(...differences.map(item=>item.velocity)),spin:Math.max(...differences.map(item=>item.spin)),
      materialOrientationComponent:Math.max(...differences.map(item=>item.materialOrientationComponent))},
    rawDifferences:differences,differencesRoundedOrAcceptedByTolerance:false};
  return freeze({version:'pitch_break_feasibility_v156',authority:'READ_ONLY_SHARED_SOURCE_MODEL_COUNTERFACTUAL',nativeAdmission:false,officialResult:null,
    protocol:PITCH_BREAK_FEASIBILITY_PROTOCOL_V156,options:{...options},clock:generated.clock,
    reference:{input:original.input,context:original.context,sourceDescriptor,
      measurementPlaneZ:original.metrics.measurementPlaneZ,referenceElapsedSeconds:original.metrics.flightSeconds},originalSourceSamples,originalVersusLab,
    invariants:{originalReferenceReplayExact,referenceBaseTrajectoryExact,postReleaseReaimed:false,physicalKickCalibrated:false},cases,pairAnalysis,summary:summarize(cases,pairAnalysis)});
}
type Run=ReturnType<typeof runPitchBreakFeasibilityV156>;
function sensitivity(base:Run,refined:Run){
  return base.cases.map((item,index)=>{
    const other=refined.cases[index];assert(item.id===other.id,'sensitivity must retain every prescribed case in order');
    const a=item.observation.timingAtReference,b=other.observation.timingAtReference,p50a=p50Fraction(a),p50b=p50Fraction(b),
      lateA=a.late20Percent.projectedFraction,lateB=b.late20Percent.projectedFraction;
    return {caseId:item.id,primaryStatusBefore:a.status,primaryStatusAfter:b.status,amountDifferenceMeters:Math.abs(a.finalXY.normMeters-b.finalXY.normMeters),
      p50FractionDifference:p50a===null||p50b===null?null:Math.abs(p50a-p50b),
      late20FractionDifference:lateA===null||lateB===null?null:Math.abs(lateA-lateB)};
  });
}
export function runPitchBreakFeasibilityStudyV156(packet:TrialPacket){
  const nominal=runPitchBreakFeasibilityV156(packet,{observationIntervals:160,refinementFactor:1}),
    observationDense=runPitchBreakFeasibilityV156(packet,{observationIntervals:640,refinementFactor:1}),
    physicalHalfStep=runPitchBreakFeasibilityV156(packet,{observationIntervals:640,refinementFactor:2}),
    observationSensitivity=sensitivity(nominal,observationDense),physicalStepSensitivity=sensitivity(observationDense,physicalHalfStep),
    key=(pair:readonly string[])=>pair.join('|'),denseKeys=new Set(observationDense.summary.candidatePairs.map(key)),halfKeys=new Set(physicalHalfStep.summary.candidatePairs.map(key)),
    candidateClassificationIntersection=nominal.summary.candidatePairs.filter(pair=>denseKeys.has(key(pair))&&halfKeys.has(key(pair))),
    anyCandidates=nominal.summary.candidatePairCount+observationDense.summary.candidatePairCount+physicalHalfStep.summary.candidatePairCount>0;
  return freeze({version:'pitch_break_feasibility_study_v156',authority:'READ_ONLY_SHARED_SOURCE_MODEL_COUNTERFACTUAL',nativeAdmission:false,officialResult:null,
    nominal,observationDense,physicalHalfStep,
    summary:{nominal:nominal.summary,observationDense:observationDense.summary,physicalHalfStep:physicalHalfStep.summary,
      observationSensitivity,physicalStepSensitivity,candidateClassificationIntersection,physicalKickCalibrated:false,
      numericalConvergenceCertified:false,
      verdict:candidateClassificationIntersection.length?'SAME_PAIR_SCREENED_IN_ALL_THREE_RUNS':anyCandidates?'SCREEN_CLASSIFICATION_DIFFERS_BETWEEN_RUNS':'NOT_DEMONSTRATED_IN_PRESCRIBED_MATRIX'}});
}
