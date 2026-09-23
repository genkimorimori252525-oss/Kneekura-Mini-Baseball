import { describe, expect, it } from 'vitest';
import { SeedRoot } from '../../rng/SeedRoot';
import { resolveDeliberateExtraHoldUs } from './PitchCadenceIntent';

describe('pitch cadence intent', () => {
  it('keeps standard cadence at zero and deliberate hold inside +100–400 ms', () => {
    const root = new SeedRoot(41);
    const input = { root, outingId: 'outing-1', playId: 7, pitchIndex: 0 };
    expect(resolveDeliberateExtraHoldUs({
      ...input, timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' },
    })).toBe(0);
    const holds = Array.from({ length: 1000 }, (_, pitchIndex) =>
      resolveDeliberateExtraHoldUs({
        ...input, pitchIndex,
        timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'DELIBERATE' },
      }));
    expect(holds.every((hold) => hold >= 100_000 && hold <= 400_000)).toBe(true);
    expect(new Set(holds).size).toBeGreaterThan(1);
    expect(resolveDeliberateExtraHoldUs({
      ...input, timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'DELIBERATE' },
    })).toBe(holds[0]);
  });
});
