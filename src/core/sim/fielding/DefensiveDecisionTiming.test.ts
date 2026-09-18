import { describe, expect, it } from 'vitest';
import {
  resolveDefensiveDecisionTiming,
  type DefensiveDecisionTimingParameters,
} from './DefensiveDecisionTiming';

const parameters: DefensiveDecisionTimingParameters = {
  minimumDecisionDelayTicks: 40_000,
  maximumDecisionDelayTicks: 240_000,
  fixedProcessingOffsetTicks: 10_000,
};

describe('DefensiveDecisionTiming', () => {
  it('maps elite awareness to the minimum decision delay', () => {
    expect(resolveDefensiveDecisionTiming(
      1_000_000,
      1,
      parameters,
    )).toEqual({
      evidenceAvailableAt: 1_000_000,
      decisionDelayTicks: 50_000,
      decisionTick: 1_050_000,
    });
  });

  it('maps zero awareness to the maximum decision delay', () => {
    expect(resolveDefensiveDecisionTiming(
      1_000_000,
      0,
      parameters,
    )).toEqual({
      evidenceAvailableAt: 1_000_000,
      decisionDelayTicks: 250_000,
      decisionTick: 1_250_000,
    });
  });

  it('changes decision timing monotonically without any physical ability input', () => {
    const fast = resolveDefensiveDecisionTiming(
      2_000_000,
      0.8,
      parameters,
    );
    const slow = resolveDefensiveDecisionTiming(
      2_000_000,
      0.2,
      parameters,
    );

    expect(fast.decisionTick).toBeLessThan(slow.decisionTick);
    expect(fast.decisionDelayTicks).toBe(90_000);
    expect(slow.decisionDelayTicks).toBe(210_000);
  });

  it('rejects invalid awareness, calibration, and authoritative ticks', () => {
    expect(() => resolveDefensiveDecisionTiming(-1, 0.5, parameters)).toThrow();
    expect(() => resolveDefensiveDecisionTiming(0, 1.01, parameters)).toThrow();
    expect(() => resolveDefensiveDecisionTiming(0, 0.5, {
      ...parameters,
      minimumDecisionDelayTicks: 300_000,
    })).toThrow();
  });
});
