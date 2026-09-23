import { expect, it } from 'vitest';
import { buildPitchTimingDecisionContext, decidePitchTimingIntent } from './PitchTimingDecisionContext';

it('offers count, leverage and runner facts without forcing cadence or quick delivery', () => {
  const context = buildPitchTimingDecisionContext({
    balls: 3, strikes: 2, highLeverage: true,
    runnerOnFirst: true, stealThreat: true,
  });
  expect(context).toEqual({
    threeBallCount: true, fullCount: true, highLeverage: true,
    runnerOnFirst: true, stealThreat: true,
  });
  expect(decidePitchTimingIntent(context, () => ({
    deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD',
  }))).toEqual({ deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' });
  expect(decidePitchTimingIntent(context, () => ({
    deliveryMode: 'QUICK', cadenceIntent: 'DELIBERATE',
  }))).toEqual({ deliveryMode: 'QUICK', cadenceIntent: 'DELIBERATE' });
});
