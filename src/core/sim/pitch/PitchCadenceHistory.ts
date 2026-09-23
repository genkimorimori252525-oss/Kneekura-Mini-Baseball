export type ObservedPitchStart = Readonly<{
  observedReadyUs: number;
  observedMotionStartUs: number;
}>;

export type CadenceSurprise = Readonly<{
  expectedIntervalUs: number | null;
  observedIntervalUs: number;
  surpriseUs: number | null;
}>;

export const observePitchCadence = (
  observedIntervalsUs: readonly number[],
  observation: ObservedPitchStart,
): Readonly<{ history: readonly number[]; surprise: CadenceSurprise }> => {
  const { observedReadyUs, observedMotionStartUs } = observation;
  if (
    !Number.isSafeInteger(observedReadyUs) || observedReadyUs < 0
    || !Number.isSafeInteger(observedMotionStartUs)
    || observedMotionStartUs <= observedReadyUs
  ) throw new Error('observed pitch start must follow observed ready time');
  if (observedIntervalsUs.some((interval) => !Number.isSafeInteger(interval) || interval <= 0)) {
    throw new Error('observed cadence history must contain positive integer intervals');
  }
  const observedIntervalUs = observedMotionStartUs - observedReadyUs;
  const recent = observedIntervalsUs.slice(-3);
  const expectedIntervalUs = recent.length === 3
    ? [...recent].sort((a, b) => a - b)[1] : null;
  return Object.freeze({
    history: Object.freeze([...recent, observedIntervalUs].slice(-3)),
    surprise: Object.freeze({
      expectedIntervalUs, observedIntervalUs,
      surpriseUs: expectedIntervalUs === null ? null : observedIntervalUs - expectedIntervalUs,
    }),
  });
};
