import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { planLiveThrowV1,liveThrowEffortTimingV103,LIVE_THROW_EFFORT_POLICY_V103,type LiveThrowPlanInputV1 } from './LiveThrowPlanV1';
export { LIVE_THROW_EFFORT_POLICY_V103 } from './LiveThrowPlanV1';

export type LiveThrowActionInputV103=Omit<LiveThrowPlanInputV1,'maximumThrowSpeedMps'|'effortSelectionV103'> & Readonly<{
  capacityMps:number;remainingTransferSeconds:number;handPreparationSeconds:number;chargeElapsedSeconds?:number;
  throwEffortBuildSecondsV103?:number;receiverReadySeconds?:number;deadlineSeconds?:number;preferStrongestFeasibleV103?:boolean;
  /** throwEarliestArrivalV1: the throw that reaches the taker first, not the strongest. */preferEarliestArrivalV1?:boolean;
}>;
/** Shared executable timing hypothesis. All times are relative to the input
 * snapshot; elapsed charge is observable held-ball progress only. A missing
 * (or infinite) deadline requests a routine least-force command; zero requests
 * earliest control. This does not launch a Source or assign a receiver. */
export function planLiveThrowActionV103(raw:LiveThrowActionInputV103){
  const {deadlineSeconds:rawDeadline,...rest}=raw,
    input=cloneInert({...rest,...(rawDeadline===Infinity||rawDeadline===undefined?{}:{deadlineSeconds:rawDeadline})}),
    {capacityMps,remainingTransferSeconds,handPreparationSeconds,chargeElapsedSeconds=0,
      throwEffortBuildSecondsV103=LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds,receiverReadySeconds=0,deadlineSeconds,preferStrongestFeasibleV103,preferEarliestArrivalV1,...command}=input;
  if(!Number.isFinite(capacityMps)||capacityMps<=0)throw new Error('live throw action: positive finite raw capacity required');
  const selection={capacityMps,remainingTransferSeconds,handPreparationSeconds,chargeElapsedSeconds,buildSeconds:throwEffortBuildSecondsV103,receiverReadySeconds,
    ...(deadlineSeconds===undefined?{}:{deadlineSeconds}),...(preferStrongestFeasibleV103===undefined?{}:{preferStrongestFeasibleV103}),...(preferEarliestArrivalV1?{preferEarliestArrivalV1}:{})},
    forecast=planLiveThrowV1({...command,maximumThrowSpeedMps:Math.min(capacityMps,LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps),effortSelectionV103:selection});
  if(forecast.kind!=='planned')return Object.freeze({kind:'unreachable' as const,reason:'NO_SOLUTION_WITHIN_BOUNDED_COMMAND_SEARCH_V103' as const,
    capacityMps,maximumCommandSpeedMps:Math.min(capacityMps,LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps),
    outputSearchLimitApplied:capacityMps>LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps,forecast});
  const timing=liveThrowEffortTimingV103(forecast.relativeReleaseSpeedMps,selection),
    controlSeconds=Math.max(timing.releaseDelaySeconds+forecast.flightSeconds,receiverReadySeconds),
    meetsDeadline=deadlineSeconds===undefined||controlSeconds<=deadlineSeconds;
  return Object.freeze({kind:'planned' as const,capacityMps,commandSpeedMps:forecast.relativeReleaseSpeedMps,...timing,
    outputSearchLimitApplied:capacityMps>LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps,
    flightSeconds:forecast.flightSeconds,controlSeconds,deadlineSeconds:deadlineSeconds??null,meetsDeadline,
    selectionReason:forecast.diagnostics.receiverSynchronizationSelectedV109?'RECEIVER_TIMED_EARLY_RELEASE' as const:
      deadlineSeconds===undefined?'ROUTINE_LEAST_EFFORT' as const:meetsDeadline?preferStrongestFeasibleV103?'STRONGEST_FEASIBLE_COMPETITIVE_THROW' as const:'LEAST_EFFORT_MEETS_DEADLINE' as const:'EARLIEST_CONTROL_DEADLINE_UNREACHABLE' as const,
    forecast});
}
