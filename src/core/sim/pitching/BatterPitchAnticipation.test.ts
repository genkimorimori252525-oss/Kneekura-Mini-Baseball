import { describe, expect, it } from 'vitest';
import type {
  CatcherPitchCall,
} from './CatcherLead';
import {
  resolveBatterPitchAnticipation,
} from './BatterPitchAnticipation';

const call: CatcherPitchCall = {
  catcherId: 'catcher-1',
  pitcherId: 'pitcher-1',
  pitchOrdinal: 3,
  pitchSkillId: 'skill-slider-like',
  attackZone: 'outside',
  verticalPlan: 'low',
  aggression: 'balanced',
  count: {
    balls: 1,
    strikes: 1,
  },
  managerDirective: {
    attackZone: 'outside',
    verticalPlan: 'low',
    aggression: 'balanced',
  },
};

describe('batter pitch anticipation', () => {
  it('has no surprise when the batter correctly anticipates the final physical call', () => {
    const result =
      resolveBatterPitchAnticipation(
        {
          anticipatedPitchSkillId:
            'skill-slider-like',
          anticipatedAttackZone:
            'outside',
          anticipatedVerticalPlan:
            'low',
          confidence: 0.9,
        },
        call,
      );

    expect(result.mismatchFraction)
      .toBe(0);
    expect(
      result.confidenceWeightedSurprise,
    ).toBe(0);
  });

  it('creates anticipation surprise when the final pitcher choice differs from the read', () => {
    const result =
      resolveBatterPitchAnticipation(
        {
          anticipatedPitchSkillId:
            'skill-fast',
          anticipatedAttackZone:
            'inside',
          anticipatedVerticalPlan:
            'high',
          confidence: 0.9,
        },
        call,
      );

    expect(result.mismatchedDimensions)
      .toBe(3);
    expect(result.mismatchFraction)
      .toBe(1);
    expect(
      result.confidenceWeightedSurprise,
    ).toBeCloseTo(0.9, 12);
  });

  it('does not invent mismatch on dimensions the batter did not anticipate', () => {
    const result =
      resolveBatterPitchAnticipation(
        {
          anticipatedPitchSkillId:
            'skill-fast',
          confidence: 0.6,
        },
        call,
      );

    expect(result.comparedDimensions)
      .toBe(1);
    expect(result.mismatchedDimensions)
      .toBe(1);
    expect(result.attackZoneMatched)
      .toBeNull();
    expect(result.verticalPlanMatched)
      .toBeNull();
  });
});
