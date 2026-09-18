import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from './CanonicalMatchState';
import { asRuleProfileId } from './RuleProfileRef';

describe('RuleProfileRef', () => {
  it('stores the authoritative rules profile id in canonical match state', () => {
    const state: CanonicalMatchState = {
      ruleProfileId: asRuleProfileId('npb-2026'),
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
    };

    expect(state.ruleProfileId).toBe('npb-2026');
  });

  it('rejects empty profile ids at the model boundary', () => {
    expect(() => asRuleProfileId('')).toThrow(
      'rule profile id must not be empty',
    );
  });
});
