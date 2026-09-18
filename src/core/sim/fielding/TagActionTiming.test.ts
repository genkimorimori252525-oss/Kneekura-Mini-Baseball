import { describe, expect, it } from 'vitest';
import {
  resolveTagActionTiming,
} from './TagActionTiming';

const parameters = {
  minimumTagActionDelayTicks: 30_000,
  maximumTagActionDelayTicks: 140_000,
  fixedPossessionOffsetTicks: 10_000,
} as const;

describe('TagActionTiming', () => {
  it('maps low tag skill to the slow end of tag-action timing', () => {
    expect(resolveTagActionTiming(
      4_000_000,
      0,
      parameters,
    )).toEqual({
      possessionReadyTick: 4_000_000,
      tagActionDelayTicks: 150_000,
      tagActionStartTick: 4_150_000,
    });
  });

  it('maps high tag skill to the fast end while preserving possession time', () => {
    expect(resolveTagActionTiming(
      4_000_000,
      1,
      parameters,
    )).toEqual({
      possessionReadyTick: 4_000_000,
      tagActionDelayTicks: 40_000,
      tagActionStartTick: 4_040_000,
    });
  });

  it('interpolates deterministically', () => {
    expect(resolveTagActionTiming(
      4_000_000,
      0.5,
      parameters,
    ).tagActionStartTick).toBe(4_095_000);
  });

  it('rejects invalid skill or timing calibration', () => {
    expect(() => resolveTagActionTiming(
      4_000_000,
      1.1,
      parameters,
    )).toThrow(
      'tagSkill must be finite and within [0, 1]',
    );

    expect(() => resolveTagActionTiming(
      4_000_000,
      0.5,
      {
        ...parameters,
        minimumTagActionDelayTicks: 200_000,
      },
    )).toThrow(
      'minimumTagActionDelayTicks must be <= maximumTagActionDelayTicks',
    );
  });
});
