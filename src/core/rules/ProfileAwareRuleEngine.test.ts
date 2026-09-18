import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import {
  createDefensiveAppealAttemptFact,
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
} from './PhysicalRuleFacts';
import {
  createAppealWindow,
} from './AppealWindow';
import {
  createAppealScoringOption,
} from './AdvantageousFourthOut';
import {
  evaluateTagUpCompliance,
} from './TagUpCompliance';
import {
  NPB_2026_RULE_PROFILE,
  type RuleProfile,
} from './RuleProfile';
import { createRuleContext } from './RuleContext';
import {
  evaluateTagUpComplianceForMatch,
  resolveAdvantageousFourthOutForMatch,
  resolveTagUpAppealForMatch,
} from './ProfileAwareRuleEngine';
import type { AppealOutScoringResult } from './AppealOutScoring';

const match = (
  profileId = asRuleProfileId('npb-2026'),
): CanonicalMatchState => ({
  ruleProfileId: profileId,
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: {
    first: null,
    second: 'runner',
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 1,
});

describe('ProfileAwareRuleEngine', () => {
  it('uses NPB 2026 first-fielder-touch tag-up semantics', () => {
    const result = evaluateTagUpComplianceForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        runnerId: 'runner',
        originBase: 2,
        firstTouch: createFlyBallFirstFielderTouchFact(
          'center-fielder',
          1_000_000,
        ),
        departure: createRunnerBaseDepartureFact(
          'runner',
          2,
          1_050_000,
        ),
        retouch: null,
      },
    );

    expect(result).toMatchObject({
      kind: 'compliant',
      legalAdvanceFromTick: 1_050_000,
    });
  });

  it('refuses to adjudicate a match under a different profile', () => {
    expect(() => evaluateTagUpComplianceForMatch(
      match(asRuleProfileId('npb-2025')),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        runnerId: 'runner',
        originBase: 2,
        firstTouch: createFlyBallFirstFielderTouchFact(
          'center-fielder',
          1_000_000,
        ),
        departure: createRunnerBaseDepartureFact(
          'runner',
          2,
          1_050_000,
        ),
        retouch: null,
      },
    )).toThrow(
      'match rule profile npb-2025 does not match adjudication profile npb-2026',
    );
  });

  it('fails explicitly when a profile uses unsupported tag-up release semantics', () => {
    const unsupported: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('unsupported-release'),
      tagUp: {
        ...NPB_2026_RULE_PROFILE.tagUp,
        legalReleaseBasis: 'secure_catch',
      },
    };

    expect(() => evaluateTagUpComplianceForMatch(
      match(unsupported.id),
      createRuleContext(unsupported),
      {
        runnerId: 'runner',
        originBase: 2,
        firstTouch: createFlyBallFirstFielderTouchFact(
          'center-fielder',
          1_000_000,
        ),
        departure: createRunnerBaseDepartureFact(
          'runner',
          2,
          1_050_000,
        ),
        retouch: null,
      },
    )).toThrow(
      'unsupported tag-up release basis: secure_catch',
    );
  });

  it('uses the profile appeal policy before resolving an early-departure appeal', () => {
    const compliance = evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch: createFlyBallFirstFielderTouchFact(
        'center-fielder',
        1_000_000,
      ),
      departure: createRunnerBaseDepartureFact(
        'runner',
        2,
        990_000,
      ),
      retouch: null,
    });

    const result = resolveTagUpAppealForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        compliance,
        appeal: createDefensiveAppealAttemptFact(
          'shortstop',
          'runner',
          2,
          'tag_up_early_departure',
          1_300_000,
        ),
        window: createAppealWindow(1_000_000),
      },
    );

    expect(result).toMatchObject({
      kind: 'out',
      outTick: 1_300_000,
    });
  });

  it('refuses advantageous-fourth-out selection when the active profile disables it', () => {
    const disabled: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('no-fourth-out'),
      appeal: {
        ...NPB_2026_RULE_PROFILE.appeal,
        advantageousFourthOutPolicy: 'disabled',
      },
    };
    const scoring: AppealOutScoringResult = {
      kind: 'resolved',
      effectiveOut: {
        kind: 'out',
        runnerId: 'runner',
        classification: 'tag_up_appeal',
        appealedBase: 2,
        outTick: 1_300_000,
        appealTick: 1_300_000,
      },
      scored: [],
      suppressed: [],
      simultaneous: [],
    };

    expect(() => resolveAdvantageousFourthOutForMatch(
      match(disabled.id),
      createRuleContext(disabled),
      [
        createAppealScoringOption(
          'a',
          'apparent_third_out',
          scoring,
        ),
        createAppealScoringOption(
          'b',
          'sustained_appeal',
          scoring,
        ),
      ],
    )).toThrow(
      'active rule profile does not permit advantageous fourth-out election',
    );
  });
});
