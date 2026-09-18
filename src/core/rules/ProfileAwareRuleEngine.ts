import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import {
  selectAdvantageousInningEndingOut,
  type AdvantageousInningEndingOutResult,
  type InningEndingScoringOption,
} from './AdvantageousFourthOut';
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
    input.window.closeReason === 'next_pitch_or_play'
    && !context.profile.appeal.nextPitchOrPlayClosesWindow
  ) {
    throw new Error(
      'active rule profile does not close appeals on next pitch/play',
    );
  }
  if (
    input.window.closeReason === 'defense_left_field'
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
