import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';
import { observePitchBreakTiming, type PitchBreakTimingObservation, type TimedPitchState } from './PitchBreakTiming';
import { comparePitchReleaseV155 } from './PitchReleaseComparisonV155';

function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const basis='SAME_REFERENCE_ELAPSED_TIME_SHARED_RELEASE_AIRLESS_GRAVITY_V159' as const;

/** Adds an observation on one shared clock to the existing inverse-aiming
 * comparison. It never writes an official ball, skill, flight or result. */
export function comparePitchTimeShapeV159(input:Parameters<typeof comparePitchReleaseV155>[0]) {
  const compared=comparePitchReleaseV155(input),reference=compared.reference.pitch.diagnostics.sourceDescriptor,
    variant=compared.variantFixedRelease.descriptor,end=compared.reference.metrics.flightSeconds,
    initial=reference.initial.ball,gravity=reference.profile.air.gravityY,planeZ=compared.reference.metrics.measurementPlaneZ;
  if(variant.profile.air.gravityY!==gravity)throw Error('pitch time shape: matching gravity required for a shared baseline');
  if(!(['x','y','z'] as const).every(key=>Object.is(initial.position[key],variant.initial.ball.position[key])&&Object.is(initial.velocity[key],variant.initial.ball.velocity[key])))
    throw Error('pitch time shape: matching release position and velocity required');
  const times=Array.from({length:161},(_,index)=>index===160?end:end*index/160),
    baseline:TimedPitchState[]=times.map(time=>({elapsedSeconds:time,position:time===0?{...initial.position}:
      {x:initial.position.x+initial.velocity.x*time,y:initial.position.y+initial.velocity.y*time+gravity*time*time/2,z:initial.position.z+initial.velocity.z*time},
      velocity:time===0?{...initial.velocity}:{...initial.velocity,y:initial.velocity.y+gravity*time},phase:'airborne',counterfactualGroundIgnored:true}));
  const observe=(descriptor:SourceFreeBallDescriptorV2)=>{
    const kernel=createSourceFreeBallKernel(descriptor),actual:TimedPitchState[]=times.map(elapsedSeconds=>{
      const state=kernel.evaluateAt(elapsedSeconds),ball=state.moment.ball;
      return {elapsedSeconds,position:ball.position,velocity:ball.velocity,phase:state.phase};
    });
    return observePitchBreakTiming({actual,baseline,planeZ,comparisonBasis:basis,
      groundEvents:{actual:kernel.boundaries.filter(row=>row.kind==='ground'&&row.elapsedSeconds<=end).map(row=>row.elapsedSeconds),baseline:[]}});
  };
  const referenceObservation=observe(reference),variantFixedReleaseObservation=observe(variant),
    digest=(timing:PitchBreakTimingObservation)=>({status:timing.status,amountMeters:timing.finalXY.normMeters,
      p10Seconds:timing.percentTimes.p10?.elapsedSeconds??null,p50Seconds:timing.percentTimes.p50?.elapsedSeconds??null,
      p90Seconds:timing.percentTimes.p90?.elapsedSeconds??null,
      p50Fraction:timing.percentTimes.p50===null?null:timing.percentTimes.p50.elapsedSeconds/end,
      late20Fraction:timing.late20Percent.projectedFraction}),
    commonTimeV159={status:'MEASURED' as const,comparisonBasis:basis,referenceElapsedSeconds:end,
      reference:digest(referenceObservation),variantFixedRelease:digest(variantFixedReleaseObservation)},
    timeShapeV159={version:'pitch_time_shape_v159' as const,comparisonBasis:basis,referenceElapsedSeconds:end,measurementPlaneZ:planeZ,
      referenceObservation,variantFixedReleaseObservation,nativeAdmission:false as const,officialResult:null,physicalKickCalibrated:false as const};
  return freeze({...compared,version:'pitch_time_shape_comparison_v159' as const,summary:{...compared.summary,commonTimeV159},timeShapeV159});
}
