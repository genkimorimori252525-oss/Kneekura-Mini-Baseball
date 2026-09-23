import { expect, it } from 'vitest';
import { arbitrateBatteryPitchDecision } from './BatteryPitchDecision';

it('keeps the accepted pitch call under every battery authority', () => {
  const call = Object.freeze({
    id: 'call-7', pitchFamily: 'fastball', target: 'outside', tacticalPurpose: 'attack',
  });
  const intent = { deliveryMode: 'QUICK' as const, cadenceIntent: 'DELIBERATE' as const };
  for (const authority of ['CATCHER_LED', 'PITCHER_LED', 'NEGOTIATED'] as const) {
    const decision = arbitrateBatteryPitchDecision(call, authority, intent);
    expect(decision.acceptedCall).toBe(call);
    expect(decision.acceptedCall.id).toBe('call-7');
    expect(decision.timingIntent).toEqual(intent);
    expect(decision.callAuthority).toBe(authority);
  }
});
