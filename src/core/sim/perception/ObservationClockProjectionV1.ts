import { createPlayerObservationCalibration, type PlayerObservationCalibration } from './PlayerObservationCalibration';

/** Exact unit projection only. SI parameters and ability are never changed.
 * It authenticates no Source, player, observation history or Native action. */
export const projectObservationClockV1 = (raw: PlayerObservationCalibration, targetTicksPerSecond: number): PlayerObservationCalibration => {
  const original=createPlayerObservationCalibration(raw);
  if(!Number.isSafeInteger(targetTicksPerSecond)||targetTicksPerSecond<=0)throw new Error('observation clock projection requires a positive safe integer clock');
  const from=BigInt(original.memoryDecayParameters.ticksPerSecond),to=BigInt(targetTicksPerSecond);
  const interval=(ticks:number)=>{
    const numerator=BigInt(ticks)*to;
    if(numerator%from!==0n)throw new Error('observation clock projection interval is not exactly representable');
    const value=numerator/from;
    if(value<=0n||value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('observation clock projection interval exceeds safe integer range');
    return Number(value);
  };
  return createPlayerObservationCalibration({...original,refreshPolicy:{attendedIntervalTicks:interval(original.refreshPolicy.attendedIntervalTicks),
    peripheralIntervalTicks:interval(original.refreshPolicy.peripheralIntervalTicks)},memoryDecayParameters:{...original.memoryDecayParameters,ticksPerSecond:targetTicksPerSecond}});
};
