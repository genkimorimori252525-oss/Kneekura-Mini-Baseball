import {
  asRuleProfileId,
  type RuleProfileId,
} from '../model/RuleProfileRef';

export type RuleProfile = Readonly<{
  id: RuleProfileId;
  jurisdiction: string;
  season: number;
  rulesRevision: string;
  tagUp: Readonly<{
    legalReleaseBasis: 'first_fielder_touch' | 'secure_catch';
    earlyDepartureRequiresAppeal: boolean;
  }>;
  appeal: Readonly<{
    nextPitchOrPlayClosesWindow: boolean;
    defenseLeavingFieldClosesInningEndingWindow: boolean;
    sameTickWindowCloseResolution:
      | 'unresolved'
      | 'appeal_wins'
      | 'window_close_wins';
    advantageousFourthOutPolicy:
      | 'defense_may_elect_advantageous_out'
      | 'disabled';
  }>;
  thirdOutScoring: Readonly<{
    batterRunnerBeforeFirstSuppressesRuns: boolean;
    forceThirdOutSuppressesRuns: boolean;
    precedingRunnerAppealSuppressesFollowingRuns: boolean;
  }>;
  defensiveAlignment: Readonly<{
    requiredInfielderCount: number;
    evaluationMoment: 'pitch_release' | 'pitching_motion_start';
    minimumInfieldersEachSideOfSecondBase: number;
    sideDeterminedBy: 'both_feet' | 'body_center';
    violationPolicyId: string;
  }>;
}>;

export const NPB_2026_RULE_PROFILE: RuleProfile = {
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
  thirdOutScoring: {
    batterRunnerBeforeFirstSuppressesRuns: true,
    forceThirdOutSuppressesRuns: true,
    precedingRunnerAppealSuppressesFollowingRuns: true,
  },
  defensiveAlignment: {
    requiredInfielderCount: 4,
    evaluationMoment: 'pitch_release',
    minimumInfieldersEachSideOfSecondBase: 2,
    sideDeterminedBy: 'both_feet',
    violationPolicyId: 'npb_2026_5_02_c',
  },
};

const RULE_PROFILES = new Map<string, RuleProfile>([
  [NPB_2026_RULE_PROFILE.id, NPB_2026_RULE_PROFILE],
]);

export const isKnownRuleProfileId = (
  id: RuleProfileId,
): boolean => RULE_PROFILES.has(id);

export const getRuleProfile = (
  id: RuleProfileId,
): RuleProfile => {
  const profile = RULE_PROFILES.get(id);
  if (profile === undefined) {
    throw new Error(`unsupported rule profile: ${id}`);
  }
  return profile;
};
