import { describe, expect, it } from 'vitest';
import {
  resolveDefenderFirstStepTiming,
} from './DefenderFirstStepTiming';

const parameters = {
  minimumFirstStepDelayTicks: 30_000,
  maximumFirstStepDelayTicks: 150_000,
  fixedMotorOffsetTicks: 10_000,
} as const;

describe('DefenderFirstStepTiming', () => {
  it('maps low first-step ability to the slow end of the reaction-delay calibration', () => {
    expect(resolveDefenderFirstStepTiming(
      1_000_000,
      0,
      parameters,
    )).toEqual({
      recognitionTick: 1_000_000,
      firstStepDelayTicks: 160_000,
      movementStartTick: 1_160_000,
    });
  });

  it('maps high first-step ability to the fast end without changing recognition time', () => {
    expect(resolveDefenderFirstStepTiming(
      1_000_000,
      1,
      parameters,
    )).toEqual({
      recognitionTick: 1_000_000,
      firstStepDelayTicks: 40_000,
      movementStartTick: 1_040_000,
    });
  });

  it('interpolates deterministically inside the calibration range', () => {
    expect(resolveDefenderFirstStepTiming(
      1_000_000,
      0.5,
      parameters,
    ).movementStartTick).toBe(1_100_000);
  });

  it('rejects invalid ability or timing calibration', () => {
    expect(() => resolveDefenderFirstStepTiming(
      1_000_000,
      1.1,
      parameters,
    )).toThrow(
      'firstStepAbility must be finite and within [0, 1]',
    );

    expect(() => resolveDefenderFirstStepTiming(
      1_000_000,
      0.5,
      {
        ...parameters,
        minimumFirstStepDelayTicks: 200_000,
      },
    )).toThrow(
      'minimumFirstStepDelayTicks must be <= maximumFirstStepDelayTicks',
    );
  });
});
