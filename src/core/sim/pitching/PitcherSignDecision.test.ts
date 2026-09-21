import { describe, expect, it } from 'vitest';
import type {
  CatcherPitchCall,
} from './CatcherLead';
import {
  resolvePitcherSignDecision,
  type PitcherSignBehaviorProfile,
} from './PitcherSignDecision';

const catcherCall: CatcherPitchCall = {
  catcherId: 'catcher-1',
  pitcherId: 'pitcher-1',
  pitchOrdinal: 4,
  pitchSkillId: 'skill-fast',
  attackZone: 'outside',
  verticalPlan: 'low',
  aggression: 'balanced',
  count: {
    balls: 1,
    strikes: 2,
  },
  managerDirective: {
    attackZone: 'outside',
    verticalPlan: 'low',
    aggression: 'balanced',
  },
};

const behavior = (
  signAutonomy: number,
): PitcherSignBehaviorProfile => ({
  pitcherId: 'pitcher-1',
  signAutonomy,
  pitchSkillWeights: {
    'skill-fast': 1,
    'skill-break': 1e12,
  },
  defaultPitchSkillWeight: 1,
  attackZoneWeights: {
    inside: 1e12,
    middle: 1,
    outside: 1,
  },
  verticalPlanWeights: {
    low: 1,
    middle: 1,
    high: 1e12,
  },
  aggressionWeights: {
    challenge: 1e12,
    balanced: 1,
    waste: 1,
  },
  catcherCallRetentionMultiplier:
    1e-12,
});

describe('pitcher sign decision', () => {
  it('can model a compliant pitcher who always accepts the catcher', () => {
    const result =
      resolvePitcherSignDecision({
        matchSeed: 20260921,
        playId: 8,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
        ],
        catcherCall,
        behavior: behavior(0),
      });

    expect(result.kind)
      .toBe('accepted_catcher_call');
    expect(result.finalCall)
      .toEqual(catcherCall);
  });

  it('can model an autonomous pitcher who overrides without receiving any outcome bonus', () => {
    const result =
      resolvePitcherSignDecision({
        matchSeed: 20260921,
        playId: 8,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
        ],
        catcherCall,
        behavior: behavior(1),
      });

    expect(result.kind)
      .toBe('pitcher_override');
    expect(result.finalCall).toMatchObject({
      pitchSkillId: 'skill-break',
      attackZone: 'inside',
      verticalPlan: 'high',
      aggression: 'challenge',
    });
  });

  it('is deterministic for the same pitcher personality and pitch ordinal', () => {
    const input = {
      matchSeed: 555,
      playId: 9,
      availablePitchSkillIds: [
        'skill-fast',
        'skill-break',
      ],
      catcherCall,
      behavior: behavior(0.5),
    } as const;

    expect(
      resolvePitcherSignDecision(input),
    ).toEqual(
      resolvePitcherSignDecision(input),
    );
  });

  it('rejects impossible catcher repertoire choices', () => {
    expect(() =>
      resolvePitcherSignDecision({
        matchSeed: 1,
        playId: 1,
        availablePitchSkillIds: [
          'skill-break',
        ],
        catcherCall,
        behavior: behavior(1),
      }),
    ).toThrow(
      'catcher-selected pitchSkillId must be available to pitcher',
    );
  });
});
