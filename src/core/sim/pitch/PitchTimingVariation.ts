import type { SeedRoot } from '../../rng/SeedRoot';
import type { DeterministicRng } from '../../rng/DeterministicRng';

export type PitchTimingVariationInput = Readonly<{
  root: SeedRoot;
  outingId: string;
  playId: number;
  pitchIndex: number;
  naturalVariationUs: number;
}>;

export type PitchTimingVariation = Readonly<{
  outingBiasUs: number;
  pitchJitterUs: number;
  naturalDeviationUs: number;
}>;

const signedSample = (rng: DeterministicRng, halfWidth: number): number => (
  halfWidth === 0 ? 0 : rng.nextUint32() % (2 * halfWidth + 1) - halfWidth
);

export const samplePitchTimingVariation = (
  input: PitchTimingVariationInput,
): PitchTimingVariation => {
  if (typeof input.outingId !== 'string' || input.outingId.length === 0) {
    throw new Error('outingId must not be empty');
  }
  for (const [name, value] of [['playId', input.playId], ['pitchIndex', input.pitchIndex]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative safe integer`);
    }
  }
  if (
    !Number.isSafeInteger(input.naturalVariationUs)
    || input.naturalVariationUs < 0
    || input.naturalVariationUs > 50_000
  ) {
    throw new Error('naturalVariationUs must stay within 0..50ms');
  }
  const halfWidth = Math.floor(input.naturalVariationUs / 2);
  const outingBiasUs = signedSample(
    input.root.streamRng(0, 'pitch_timing', `outing:${input.outingId}`), halfWidth,
  );
  const pitchJitterUs = signedSample(
    input.root.streamRng(
      input.playId, 'pitch_timing', `outing:${input.outingId}:pitch:${input.pitchIndex}`,
    ),
    halfWidth,
  );
  const naturalDeviationUs = Math.max(-50_000, Math.min(50_000, outingBiasUs + pitchJitterUs));
  return Object.freeze({ outingBiasUs, pitchJitterUs, naturalDeviationUs });
};
