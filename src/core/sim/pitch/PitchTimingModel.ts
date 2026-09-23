export type PitchMotionPhaseWeights = Readonly<{
  gather: number;
  transition: number;
  stride: number;
}>;

export type PitchTimingProfile = Readonly<{
  baseStartIntervalUs: number;
  normalMotionToReleaseUs: number;
  followThroughUs: number;
  quickSpeedFactor: number;
  cadenceExecutionControl: number;
  cadenceTimingKnowledge: number;
  quickRepeatability: number;
  naturalVariationUs: number;
  normalPhaseWeights: PitchMotionPhaseWeights;
  quickPhaseWeights: PitchMotionPhaseWeights;
}>;

export type PitchTimingIntent = Readonly<{
  deliveryMode: 'NORMAL' | 'QUICK';
  cadenceIntent: 'STANDARD' | 'DELIBERATE';
}>;

export type QuickGrade = 'G' | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'Gold';
export type QuickGradeThresholds = Readonly<Record<Exclude<QuickGrade, 'G'>, number>>;

export const MIN_QUICK_SPEED_FACTOR = 1 / 1.8;
export const MAX_QUICK_SPEED_FACTOR = 2.5;

const positiveDuration = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer microsecond duration`);
  }
};

const unitInterval = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be within 0..1`);
  }
};

const validateWeights = (name: string, weights: PitchMotionPhaseWeights): number => {
  for (const phase of ['gather', 'transition', 'stride'] as const) {
    if (!Number.isFinite(weights[phase]) || weights[phase] <= 0) {
      throw new Error(`${name}.${phase} must be finite and positive`);
    }
  }
  const sum = weights.gather + weights.transition + weights.stride;
  if (!Number.isFinite(sum) || sum <= 0) throw new Error(`${name} sum must be finite and positive`);
  return sum;
};

export const normalizePitchMotionPhaseWeights = (
  weights: PitchMotionPhaseWeights,
): PitchMotionPhaseWeights => {
  const sum = validateWeights('phaseWeights', weights);
  return Object.freeze({
    gather: weights.gather / sum,
    transition: weights.transition / sum,
    stride: weights.stride / sum,
  });
};

export const validatePitchTimingProfile = (input: PitchTimingProfile): PitchTimingProfile => {
  positiveDuration('baseStartIntervalUs', input.baseStartIntervalUs);
  positiveDuration('normalMotionToReleaseUs', input.normalMotionToReleaseUs);
  positiveDuration('followThroughUs', input.followThroughUs);
  if (
    !Number.isFinite(input.quickSpeedFactor)
    || input.quickSpeedFactor < MIN_QUICK_SPEED_FACTOR
    || input.quickSpeedFactor > MAX_QUICK_SPEED_FACTOR
  ) {
    throw new Error('quickSpeedFactor must stay within the approved continuous source range');
  }
  unitInterval('cadenceExecutionControl', input.cadenceExecutionControl);
  unitInterval('cadenceTimingKnowledge', input.cadenceTimingKnowledge);
  unitInterval('quickRepeatability', input.quickRepeatability);
  if (
    !Number.isSafeInteger(input.naturalVariationUs)
    || input.naturalVariationUs < 0
    || input.naturalVariationUs > 50_000
  ) {
    throw new Error('naturalVariationUs must be an integer within the approved 0..50ms range');
  }
  validateWeights('normalPhaseWeights', input.normalPhaseWeights);
  validateWeights('quickPhaseWeights', input.quickPhaseWeights);
  return Object.freeze({
    ...input,
    normalPhaseWeights: Object.freeze({ ...input.normalPhaseWeights }),
    quickPhaseWeights: Object.freeze({ ...input.quickPhaseWeights }),
  });
};

export const projectQuickGrade = (
  quickSpeedFactor: number,
  thresholds: QuickGradeThresholds,
): QuickGrade => {
  if (
    !Number.isFinite(quickSpeedFactor)
    || quickSpeedFactor < MIN_QUICK_SPEED_FACTOR
    || quickSpeedFactor > MAX_QUICK_SPEED_FACTOR
  ) {
    throw new Error('quickSpeedFactor must stay within the approved continuous source range');
  }
  let previous = MIN_QUICK_SPEED_FACTOR;
  for (const grade of ['F', 'E', 'D', 'C', 'B', 'A', 'Gold'] as const) {
    const boundary = thresholds[grade];
    if (!Number.isFinite(boundary) || boundary <= previous || boundary > MAX_QUICK_SPEED_FACTOR) {
      throw new Error('quick grade thresholds must be strictly increasing in speed');
    }
    previous = boundary;
  }
  if (quickSpeedFactor < thresholds.F) return 'G';
  if (quickSpeedFactor < thresholds.E) return 'F';
  if (quickSpeedFactor < thresholds.D) return 'E';
  if (quickSpeedFactor < thresholds.C) return 'D';
  if (quickSpeedFactor < thresholds.B) return 'C';
  if (quickSpeedFactor < thresholds.A) return 'B';
  if (quickSpeedFactor < thresholds.Gold) return 'A';
  return 'Gold';
};
