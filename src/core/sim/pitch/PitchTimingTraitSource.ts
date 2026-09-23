export type PitchTimingTraitEvidence = Readonly<{
  quickMotionDurationsUs: readonly number[];
  quickRepeatability: number;
  deliberatePitchCount: number;
  observedSurprisesUs: readonly number[];
  cadenceExecutionErrorsUs: readonly number[];
}>;

export type PitchTimingTraitSource = Readonly<{
  quick: Readonly<{
    sampleCount: number;
    medianMotionToReleaseUs: number | null;
    repeatability: number;
  }>;
  cadence: Readonly<{
    deliberatePitchCount: number;
    observedSampleCount: number;
    meanAbsoluteObservedSurpriseUs: number | null;
    executionSampleCount: number;
    meanAbsoluteExecutionErrorUs: number | null;
  }>;
}>;

const meanAbsolute = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;

export const projectPitchTimingTraitSource = (
  evidence: PitchTimingTraitEvidence,
): PitchTimingTraitSource => {
  if (
    !Number.isFinite(evidence.quickRepeatability)
    || evidence.quickRepeatability < 0 || evidence.quickRepeatability > 1
    || !Number.isSafeInteger(evidence.deliberatePitchCount)
    || evidence.deliberatePitchCount < 0
    || evidence.quickMotionDurationsUs.some((value) => !Number.isSafeInteger(value) || value <= 0)
    || [...evidence.observedSurprisesUs, ...evidence.cadenceExecutionErrorsUs]
      .some((value) => !Number.isSafeInteger(value))
  ) throw new Error('invalid timing trait evidence');
  const sorted = [...evidence.quickMotionDurationsUs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? null : sorted.length % 2 === 1
    ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Object.freeze({
    quick: Object.freeze({
      sampleCount: sorted.length,
      medianMotionToReleaseUs: median,
      repeatability: evidence.quickRepeatability,
    }),
    cadence: Object.freeze({
      deliberatePitchCount: evidence.deliberatePitchCount,
      observedSampleCount: evidence.observedSurprisesUs.length,
      meanAbsoluteObservedSurpriseUs: meanAbsolute(evidence.observedSurprisesUs),
      executionSampleCount: evidence.cadenceExecutionErrorsUs.length,
      meanAbsoluteExecutionErrorUs: meanAbsolute(evidence.cadenceExecutionErrorsUs),
    }),
  });
};
