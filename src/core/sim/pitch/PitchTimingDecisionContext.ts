import type { PitchTimingIntent } from './PitchTimingModel';

export type PitchTimingSituation = Readonly<{
  balls: number;
  strikes: number;
  highLeverage: boolean;
  runnerOnFirst: boolean;
  stealThreat: boolean;
}>;

export type PitchTimingDecisionContext = Readonly<{
  threeBallCount: boolean;
  fullCount: boolean;
  highLeverage: boolean;
  runnerOnFirst: boolean;
  stealThreat: boolean;
}>;

export const buildPitchTimingDecisionContext = (
  situation: PitchTimingSituation,
): PitchTimingDecisionContext => {
  if (
    !Number.isSafeInteger(situation.balls) || situation.balls < 0 || situation.balls > 3
    || !Number.isSafeInteger(situation.strikes) || situation.strikes < 0 || situation.strikes > 2
    || [situation.highLeverage, situation.runnerOnFirst, situation.stealThreat]
      .some((value) => typeof value !== 'boolean')
  ) throw new Error('invalid pitch timing decision situation');
  return Object.freeze({
    threeBallCount: situation.balls === 3,
    fullCount: situation.balls === 3 && situation.strikes === 2,
    highLeverage: situation.highLeverage,
    runnerOnFirst: situation.runnerOnFirst,
    stealThreat: situation.stealThreat,
  });
};

export const decidePitchTimingIntent = (
  context: PitchTimingDecisionContext,
  select: (context: PitchTimingDecisionContext) => PitchTimingIntent,
): PitchTimingIntent => {
  const intent = select(context);
  if (
    !intent || !['NORMAL', 'QUICK'].includes(intent.deliveryMode)
    || !['STANDARD', 'DELIBERATE'].includes(intent.cadenceIntent)
  ) throw new Error('decision policy returned invalid pitch timing intent');
  return Object.freeze({ deliveryMode: intent.deliveryMode, cadenceIntent: intent.cadenceIntent });
};
