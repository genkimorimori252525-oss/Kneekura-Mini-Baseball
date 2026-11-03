import { simulatePitcherWorkbenchV77, observeReleasedPitchWorkbenchV155 } from './PitcherWorkbenchV77';
import type { SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';

type TrialInput=Parameters<typeof simulatePitcherWorkbenchV77>[0];
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

/** Compare normal inverse aiming with an explicitly counterfactual release.
 * All paths use the same released-Source kernel; no world result is edited. */
export function comparePitchReleaseV155(input:Readonly<{reference:TrialInput;variant:TrialInput}>){
  if(!input||typeof input!=='object'||Object.keys(input).sort().join('|')!=='reference|variant')throw Error('pitch release comparison: two explicit trial inputs required');
  const reference=simulatePitcherWorkbenchV77(input.reference),variant=simulatePitcherWorkbenchV77(input.variant),
    base=reference.pitch.diagnostics.sourceDescriptor,changed=variant.pitch.diagnostics.sourceDescriptor;
  if(reference.metrics.measurementPlaneZ!==variant.metrics.measurementPlaneZ||base.profile.air.ticksPerSecond!==changed.profile.air.ticksPerSecond)
    throw Error('pitch release comparison: matching measurement plane and physical clock required');
  const descriptor:SourceFreeBallDescriptorV2={...changed,throughElapsedSeconds:Math.max(base.throughElapsedSeconds,changed.throughElapsedSeconds),
    initial:{...changed.initial,ball:{...changed.initial.ball,position:{...reference.fixedInitial.position},velocity:{...reference.fixedInitial.velocity}}}},
    command=variant.metrics.breakTimingV155.releaseCommand,
    commandObservation={requestedTarget:command.requestedTarget,selectedTarget:command.selectedTarget,commandedTarget:command.commandedTarget,
      nominalReleaseVelocity:descriptor.initial.ball.velocity,executedReleaseVelocity:descriptor.initial.ball.velocity,
      inverseCompensationBasis:'FIX_REFERENCE_RELEASE_NO_INVERSE_REAIM_FOR_VARIANT',postReleaseExecutionReaimed:false as const};
  const observe=()=>{
    try{return {status:'MEASURED' as const,descriptor,...observeReleasedPitchWorkbenchV155({descriptor,
      battingSetupV94:variant.pitch.diagnostics.battingSetupV94,
      releaseSpeedKmh:Math.hypot(descriptor.initial.ball.velocity.x,descriptor.initial.ball.velocity.y,descriptor.initial.ball.velocity.z)*3.6,
      commandObservation,releaseMode:'FIXED_RELEASE'})};}
    catch(error){
      if(!(error instanceof Error)||!/(actual Source did not reach the plate plane|counterfactual did not reach plate plane)/.test(error.message))throw error;
      return {status:'NO_FINITE_PLANE_CROSSING' as const,descriptor,reason:error.message};
    }
  };
  const fixed=observe(),brief=(metrics:typeof variant.metrics)=>({platePosition:metrics.platePosition,flightSeconds:metrics.flightSeconds,
    releaseYawDegrees:metrics.breakTimingV155.releaseCommand.yawDegrees,releaseElevationDegrees:metrics.breakTimingV155.releaseCommand.elevationDegrees,
    p10Seconds:metrics.breakTimingV155.commonTime.zeroSpinOriginalAir.percentTimes.p10?.elapsedSeconds??null,
    p50Seconds:metrics.breakTimingV155.commonTime.zeroSpinOriginalAir.percentTimes.p50?.elapsedSeconds??null,
    p90Seconds:metrics.breakTimingV155.commonTime.zeroSpinOriginalAir.percentTimes.p90?.elapsedSeconds??null}),
    summary={measurementPlaneZ:variant.metrics.measurementPlaneZ,
      commandedTargetsMatch:(['x','y','z'] as const).every(axis=>Object.is(reference.metrics.breakTimingV155.releaseCommand.commandedTarget[axis],command.commandedTarget[axis])),
      reference:brief(reference.metrics),variantSameTarget:brief(variant.metrics),
      variantFixedRelease:fixed.status==='MEASURED'?{status:fixed.status,...brief(fixed.metrics)}:{status:fixed.status,reason:fixed.reason}};
  return freeze({version:'pitch_release_comparison_v155' as const,authority:'SHARED_SOURCE_COUNTERFACTUAL_OBSERVATION' as const,
    nativeAdmission:false as const,officialResult:null,reference,variant,variantFixedRelease:fixed,summary,
    comparisonBasis:'REFERENCE_ACTUAL_POSITION_AND_VELOCITY_WITH_VARIANT_SPIN_MATERIAL_AND_AIR' as const,
    controls:{ordinary:'EACH_OWN_INVERSE_TARGET_PLAN',counterfactual:'REFERENCE_RELEASE_FIXED_BEFORE_FLIGHT',
      throughElapsedSeconds:descriptor.throughElapsedSeconds,canonicalOutcomeChanged:false as const}});
}
