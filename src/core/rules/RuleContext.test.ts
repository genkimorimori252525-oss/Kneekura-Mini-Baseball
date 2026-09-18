import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import {
  NPB_2026_RULE_PROFILE,
  type RuleProfile,
} from './RuleProfile';
import {
  assertMatchRuleProfile,
  createRuleContext,
} from './RuleContext';

const match = (
  ruleProfileId = asRuleProfileId('npb-2026'),
): CanonicalMatchState => ({
  ruleProfileId,
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 1,
});

describe('RuleContext', () => {
  it('binds adjudication to the selected immutable profile', () => {
    const context = createRuleContext(NPB_2026_RULE_PROFILE);

    expect(context).toEqual({
      profile: NPB_2026_RULE_PROFILE,
    });
    expect(() => assertMatchRuleProfile(
      match(),
      context,
    )).not.toThrow();
  });

  it('rejects adjudicating canonical state under a different profile id', () => {
    const alternate: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('npb-test-alternate'),
    };

    expect(() => assertMatchRuleProfile(
      match(),
      createRuleContext(alternate),
    )).toThrow(
      'match rule profile npb-2026 does not match adjudication profile npb-test-alternate',
    );
  });

  it('rejects empty or malformed context profiles through the model/profile boundary', () => {
    expect(() => asRuleProfileId('')).toThrow(
      'rule profile id must not be empty',
    );
  });
});
