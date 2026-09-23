import { describe, expect, it } from 'vitest';
import { SeedRoot } from '../../rng/SeedRoot';
import { samplePitchTimingVariation } from './PitchTimingVariation';

describe('pitch timing natural variation', () => {
  it('keeps outing bias fixed and every natural total within ±50 ms', () => {
    const root = new SeedRoot(20260924);
    const samples = Array.from({ length: 10_000 }, (_, pitchIndex) =>
      samplePitchTimingVariation({
        root, outingId: 'pitcher-7:outing-3', playId: 100 + Math.floor(pitchIndex / 10),
        pitchIndex, naturalVariationUs: 50_000,
      }));
    expect(new Set(samples.map((sample) => sample.outingBiasUs)).size).toBe(1);
    expect(samples.every((sample) =>
      Math.abs(sample.naturalDeviationUs) <= 50_000
      && sample.naturalDeviationUs === sample.outingBiasUs + sample.pitchJitterUs)).toBe(true);
    expect(new Set(samples.map((sample) => sample.pitchJitterUs)).size).toBeGreaterThan(1);
    expect(samplePitchTimingVariation({
      root, outingId: 'pitcher-7:outing-3', playId: 100, pitchIndex: 0,
      naturalVariationUs: 50_000,
    })).toEqual(samples[0]);
  });

  it('allows a mechanically repeatable zero-variance source', () => {
    expect(samplePitchTimingVariation({
      root: new SeedRoot(1), outingId: 'outing-1', playId: 1,
      pitchIndex: 1, naturalVariationUs: 0,
    })).toEqual({ outingBiasUs: 0, pitchJitterUs: 0, naturalDeviationUs: 0 });
  });
});
