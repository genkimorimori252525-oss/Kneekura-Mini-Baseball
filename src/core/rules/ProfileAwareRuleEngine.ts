import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import {
  selectAdvantageousInningEndingOut,
  type AdvantageousInningEndingOutResult,
  type InningEndingScoringOption,
} from './AdvantageousFourthOut';
import {
  resolveNPB2026AlignmentViolationPenalty,
  type NPB2026AlignmentViolationPenaltyInput,
  type NPB2026AlignmentViolationPenaltyResult,
} from './NPB2026AlignmentViolationPenalty';
import {
  assertMatchRuleProfile,
  type RuleContext,
} from './RuleContext';
import {
  evaluateTagUpCompliance,
  type TagUpComplianceInput,
  type TagUpComplianceResult,
} from './TagUpCompliance';
import {
  evaluateInningInfieldSideLock,
  type InningInfieldSideAssignment,
  type InningInfieldSideLockResult,
} from './InningInfieldSideAssignment';
import {
  evaluatePitchReleaseInfieldSide,
  type PitchReleaseInfieldSideInput,
  type PitchReleaseInfieldSideResult,
} from './PitchReleaseInfieldSideRule';
import {
  evaluatePitchingMotionInfieldBoundary,
  type PitchingMotionInfieldBoundaryInput,
  type PitchingMotionInfieldBoundaryParameters,
  type PitchingMotionInfieldBoundaryResult,
} from './PitchingMotionInfieldBoundaryRule';
import {
  resolveTagUpAppeal,
  type TagUpAppealInput,
  type TagUpAppealResult,
} from './TagUpAppealRule';

const assertTagUpSemantics = (
  context: RuleContext,
): void => {
  if (
    context.profile.tagUp.legalReleaseBasis
    !== 'first_fielder_touch'
  ) {
    throw new Error(
      `unsupported tag-up release basis: ${context.profile.tagUp.legalReleaseBasis}`,
    );
  }
};

const assertAppealSemantics = (
  context: RuleContext,
  input: TagUpAppealInput,
): void => {
  const appealWindow = input.window;

  if (!context.profile.tagUp.earlyDepartureRequiresAppeal) {
    throw new Error(
      'active rule profile does not require an appeal for early departure',
    );
  }
  if (
    context.profile.appeal.sameTickWindowCloseResolution
    !== 'unresolved'
  ) {
    throw new Error(
      'unsupported same-tick appeal-window resolution policy',
    );
  }

  if (
    appealWindow.closeReason === 'next_pitch_or_play'
    && !context.profile.appeal.nextPitchOrPlayClosesWindow
  ) {
    throw new Error(
      'active rule profile does not close appeals on next pitch/play',
    );
  }
  if (
    appealWindow.closeReason === 'defense_left_field'
    && !context.profile.appeal
      .defenseLeavingFieldClosesInningEndingWindow
  ) {
    throw new Error(
      'active rule profile does not close appeals when defense leaves field',
    );
  }
};

export const evaluateTagUpComplianceForMatch = (
  match: CanonicalMatchState,
  context: RuleContext,
  input: TagUpComplianceInput,
): TagUpComplianceResult => {
  assertMatchRuleProfile(match, context);
  assertTagUpSemantics(context);
  return evaluateTagUpCompliance(input);
};

export const resolveTagUpAppealForMatch = (
  match: CanonicalMatchState,
  context: RuleContext,
  input: TagUpAppealInput,
): TagUpAppealResult => {
  assertMatchRuleProfile(match, context);
  assertTagUpSemantics(context);
  assertAppealSemantics(context, input);
  return resolveTagUpAppeal(input);
};

export const resolveAdvantageousFourthOutForMatch = (
  match: CanonicalMatchState,
  context: RuleContext,
  options: readonly InningEndingScoringOption[],
): AdvantageousInningEndingOutResult => {
  assertMatchRuleProfile(match, context);

  if (
    context.profile.appeal.advantageousFourthOutPolicy
    !== 'defense_may_elect_advantageous_out'
  ) {
    throw new Error(
      'active rule profile does not permit advantageous fourth-out election',
    );
  }

  return selectAdvantageousInningEndingOut(options);
};

export type ProfileAwarePitchingMotionInfieldBoundaryInput =
  Omit<PitchingMotionInfieldBoundaryInput, 'parameters'>
  & Readonly<{
    parameters: Omit<
      PitchingMotionInfieldBoundaryParameters,
      'requiredInfielderCount'
    >;
  }>;

export const evaluatePitchingMotionInfieldBoundaryForMatch = (
  match: CanonicalMatchState,
  context: RuleContext,
  input: ProfileAwarePitchingMotionInfieldBoundaryInput,
): PitchingMotionInfieldBoundaryResult => {
  assertMatchRuleProfile(match, context);

  const policy = context.profile.defensiveAlignment.infieldBoundary;
  if (!policy.enabled) {
    throw new Error(
      'active rule profile does not enable the infield-boundary restriction',
    );
  }
  if (
    policy.evaluationMoment !== 'pitching_related_motion_start'
    || policy.geometrySource !== 'stadium_profile'
  ) {
    throw new Error(
      'unsupported infield-boundary alignment semantics',
    );
  }

  return evaluatePitchingMotionInfieldBoundary({
    ...input,
    parameters: {
      requiredInfielderCount:
        context.profile.defensiveAlignment.requiredInfielderCount,
      footContactRadiusMeters:
        input.parameters.footContactRadiusMeters,
    },
  });
};

export const evaluatePitchReleaseInfieldSideForMatch = (
  match: CanonicalMatchState,
  context: RuleContext,
  input: Omit<PitchReleaseInfieldSideInput, 'parameters'>,
): PitchReleaseInfieldSideResult => {
  assertMatchRuleProfile(match, context);

  const policy = context.profile.defensiveAlignment.secondBaseSide;
  if (!policy.enabled) {
    throw new Error(
      'active rule profile does not enable the second-base side restriction',
    );
  }
  if (
    policy.evaluationMoment !== 'pitch_release'
    || policy.sideDeterminedBy !== 'both_feet'
  ) {
    throw new Error(
      'unsupported second-base side alignment semantics',
    );
  }

  return evaluatePitchReleaseInfieldSide({
    ...input,
    parameters: {
      requiredInfielderCount:
        context.profile.defensiveAlignment.requiredInfielderCount,
      minimumInfieldersEachSideOfSecondBase:
        policy.minimumInfieldersEachSideOfSecondBase,
    },
  });
};

export const evaluateInningInfieldSideLockForMatch = (
  match: CanonicalMatchState,
  context: RuleContext,
  assignment: InningInfieldSideAssignment,
  current: PitchReleaseInfieldSideResult,
): InningInfieldSideLockResult => {
  assertMatchRuleProfile(match, context);

  const policy = (
    context.profile.defensiveAlignment
      .secondBaseSide.assignmentLock
  );
  if (!policy.enabled) {
    throw new Error(
      'active rule profile does not enable inning infield side locking',
    );
  }
  if (
    policy.establishedAt !== 'inning_first_pitch_release'
    || policy.duration !== 'half_inning'
  ) {
    throw new Error(
      'unsupported inning infield side-lock semantics',
    );
  }

  return evaluateInningInfieldSideLock(
    assignment,
    current,
  );
};

export const resolveDefensiveAlignmentViolationPenaltyForMatch = (
  match: CanonicalMatchState,
  context: RuleContext,
  input: NPB2026AlignmentViolationPenaltyInput,
): NPB2026AlignmentViolationPenaltyResult => {
  assertMatchRuleProfile(match, context);

  const policyId = context.profile.defensiveAlignment.violationPolicyId;
  if (policyId !== 'npb_2026_5_02_c') {
    throw new Error(
      `unsupported defensive alignment violation policy: ${policyId}`,
    );
  }

  return resolveNPB2026AlignmentViolationPenalty(input);
};