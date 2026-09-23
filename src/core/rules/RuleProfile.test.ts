import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import {
  NPB_2026_RULE_PROFILE,
  getRuleProfile,
  isKnownRuleProfileId,
} from './RuleProfile';

describe('RuleProfile', () => {
  it('declares the adopted NPB 2026 rule policy explicitly', () => {
    expect(NPB_2026_RULE_PROFILE).toEqual({
      id: asRuleProfileId('npb-2026'),
      jurisdiction: 'NPB',
      season: 2026,
      rulesRevision: '2026',
      tagUp: {
        legalReleaseBasis: 'first_fielder_touch',
        earlyDepartureRequiresAppeal: true,
      },
      appeal: {
        nextPitchOrPlayClosesWindow: true,
        defenseLeavingFieldClosesInningEndingWindow: true,
        sameTickWindowCloseResolution: 'unresolved',
        advantageousFourthOutPolicy:
          'defense_may_elect_advantageous_out',
      },
      officialWindows: {
        appeal: { available: true },
      },
      thirdOutScoring: {
        batterRunnerBeforeFirstSuppressesRuns: true,
        forceThirdOutSuppressesRuns: true,
        precedingRunnerAppealSuppressesFollowingRuns: true,
      },
      defensiveAlignment: {
        requiredInfielderCount: 4,
        infieldBoundary: {
          enabled: true,
          evaluationMoment: 'pitching_related_motion_start',
          geometrySource: 'stadium_profile',
        },
        secondBaseSide: {
          enabled: true,
          evaluationMoment: 'pitch_release',
          minimumInfieldersEachSideOfSecondBase: 2,
          sideDeterminedBy: 'both_feet',
          assignmentLock: {
            enabled: true,
            establishedAt: 'inning_first_pitch_release',
            duration: 'half_inning',
          },
        },
        violationPolicyId: 'npb_2026_5_02_c',
      },
    });
  });

  it('resolves the profile by its canonical id', () => {
    const id = asRuleProfileId('npb-2026');

    expect(isKnownRuleProfileId(id)).toBe(true);
    expect(getRuleProfile(id)).toBe(NPB_2026_RULE_PROFILE);
  });

  it('fails explicitly for an unsupported replay/profile id', () => {
    const unknown = asRuleProfileId('npb-2099');

    expect(isKnownRuleProfileId(unknown)).toBe(false);
    expect(() => getRuleProfile(unknown)).toThrow(
      'unsupported rule profile: npb-2099',
    );
  });
});
