import { describe, expect, it } from 'vitest';
import {
  resolveRunnerDecisionTiming,
} from './RunnerDecisionTiming';

const parameters = {
  minimumDecisionDelayTicks: 30_000,
  maximumDecisionDelayTicks: 180_000,
  fixedRecognitionOffsetTicks: 10_000,
} as const;

describe('RunnerDecisionTiming', () => {
  it('maps low decision ability to the slow end', () => {
    expect(resolveRunnerDecisionTiming(
      1_000_000,
      0,
      parameters,
    )).toEqual({
      evidenceAvailableAt: 1_000_000,
      decisionDelayTicks: 190_000,
      decisionTick: 1_190_000,
    });
  });

  it('maps high decision ability to the fast end', () => {
    expect(resolveRunnerDecisionTiming(
      1_000_000,
      1,
      parameters,
    )).toEqual({
      evidenceAvailableAt: 1_000_000,
      decisionDelayTicks: 40_000,
      decisionTick: 1_040_000,
    });
  });

  it('rejects invalid ability and timing calibration', () => {
    expect(() => resolveRunnerDecisionTiming(
      1_000_000,
      1.1,
      parameters,
    )).toThrow(
      'decisionAbility must be finite and within [0, 1]',
    );

    expect(() => resolveRunnerDecisionTiming(
      1_000_000,
      0.5,
      {
        ...parameters,
        minimumDecisionDelayTicks: 200_000,
      },
    )).toThrow(
      'minimumDecisionDelayTicks must be <= maximumDecisionDelayTicks',
    );
  });
});
