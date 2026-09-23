import type { PitchTimingIntent } from './PitchTimingModel';

export type BatteryCallAuthority = 'CATCHER_LED' | 'PITCHER_LED' | 'NEGOTIATED';

export type BatteryPitchDecision<TCall extends Readonly<{ id: string }>> = Readonly<{
  acceptedCall: TCall;
  callAuthority: BatteryCallAuthority;
  timingIntent: PitchTimingIntent;
}>;

export const arbitrateBatteryPitchDecision = <TCall extends Readonly<{ id: string }>>(
  acceptedCall: TCall,
  callAuthority: BatteryCallAuthority,
  timingIntent: PitchTimingIntent,
): BatteryPitchDecision<TCall> => {
  if (!acceptedCall || typeof acceptedCall.id !== 'string' || acceptedCall.id.length === 0) {
    throw new Error('an already-legal accepted PitchCall with ID is required');
  }
  if (!['CATCHER_LED', 'PITCHER_LED', 'NEGOTIATED'].includes(callAuthority)) {
    throw new Error('unknown battery call authority');
  }
  if (
    !['NORMAL', 'QUICK'].includes(timingIntent.deliveryMode)
    || !['STANDARD', 'DELIBERATE'].includes(timingIntent.cadenceIntent)
  ) throw new Error('invalid pitch timing intent');
  return Object.freeze({
    acceptedCall,
    callAuthority,
    timingIntent: Object.freeze({ ...timingIntent }),
  });
};
