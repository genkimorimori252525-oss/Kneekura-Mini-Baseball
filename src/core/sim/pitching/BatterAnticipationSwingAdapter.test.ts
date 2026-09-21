import { describe, expect, it } from 'vitest';
import {
  applyBatterAnticipationToSwingWindow,
} from './BatterAnticipationSwingAdapter';

const swing = {
  startTick: 1_300_000,
  endTick: 1_380_000,
  ticksPerSecond: 1_000_000,
  stateAtStart: {
    pose: {
      grip: {
        x: -0.4,
        y: 1,
        z: 0,
      },
      tip: {
        x: 0.4,
        y: 1,
        z: 0,
      },
    },
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
    angularVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
} as const;

describe('batter anticipation swing adapter', () => {
  it('does not move swing timing when anticipation was correct', () => {
    const result =
      applyBatterAnticipationToSwingWindow(
        swing,
        {
          confidence: 0.9,
          comparedDimensions: 3,
          mismatchedDimensions: 0,
          mismatchFraction: 0,
          confidenceWeightedSurprise: 0,
          pitchSkillMatched: true,
          attackZoneMatched: true,
          verticalPlanMatched: true,
        },
        {
          maxRecognitionDelayTicks:
            30_000,
        },
        1_450_000,
      );

    expect(result.recognitionDelayTicks)
      .toBe(0);
    expect(result.adjustedSwing)
      .toEqual(swing);
  });

  it('delays recognition only through explicit calibration when a confident read is contradicted', () => {
    const result =
      applyBatterAnticipationToSwingWindow(
        swing,
        {
          confidence: 0.8,
          comparedDimensions: 3,
          mismatchedDimensions: 3,
          mismatchFraction: 1,
          confidenceWeightedSurprise: 0.8,
          pitchSkillMatched: false,
          attackZoneMatched: false,
          verticalPlanMatched: false,
        },
        {
          maxRecognitionDelayTicks:
            25_000,
        },
        1_450_000,
      );

    expect(result.recognitionDelayTicks)
      .toBe(20_000);
    expect(
      result.adjustedSwing.startTick,
    ).toBe(1_320_000);
    expect(
      result.adjustedSwing.endTick,
    ).toBe(1_400_000);
  });

  it('caps delay so the swing window remains inside the physical pitch interval', () => {
    const result =
      applyBatterAnticipationToSwingWindow(
        swing,
        {
          confidence: 1,
          comparedDimensions: 1,
          mismatchedDimensions: 1,
          mismatchFraction: 1,
          confidenceWeightedSurprise: 1,
          pitchSkillMatched: false,
          attackZoneMatched: null,
          verticalPlanMatched: null,
        },
        {
          maxRecognitionDelayTicks:
            100_000,
        },
        1_400_000,
      );

    expect(result.recognitionDelayTicks)
      .toBe(20_000);
    expect(
      result.adjustedSwing.endTick,
    ).toBe(1_400_000);
  });
});
