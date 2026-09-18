import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { RuleProfile } from './RuleProfile';

export type RuleContext = Readonly<{
  profile: RuleProfile;
}>;

export const createRuleContext = (
  profile: RuleProfile,
): RuleContext => ({
  profile,
});

export const assertMatchRuleProfile = (
  match: CanonicalMatchState,
  context: RuleContext,
): void => {
  if (match.ruleProfileId !== context.profile.id) {
    throw new Error(
      `match rule profile ${match.ruleProfileId} does not match adjudication profile ${context.profile.id}`,
    );
  }
};
