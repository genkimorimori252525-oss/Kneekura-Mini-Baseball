import { expect, it } from 'vitest';
import { derivePitchSequencingEvidence } from './PitchSequencingEvidence';

it('keeps intended hold, realized hold and observed surprise separate', () => {
  expect(derivePitchSequencingEvidence({
    timeline: {
      deliveryMode: 'QUICK', cadenceIntent: 'DELIBERATE',
      deliberateExtraHoldUs: 300_000, startIntervalUs: 10_320_000,
    },
    baseStartIntervalUs: 10_000_000,
    cadenceSurpriseUs: 270_000,
  })).toEqual({
    deliveryMode: 'QUICK', cadenceIntent: 'DELIBERATE',
    intendedHoldChangeUs: 300_000, realizedHoldChangeUs: 320_000,
    cadenceSurpriseUs: 270_000,
  });
});
