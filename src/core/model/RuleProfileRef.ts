declare const RULE_PROFILE_ID_BRAND: unique symbol;

export type RuleProfileId = string & Readonly<{
  [RULE_PROFILE_ID_BRAND]: 'RuleProfileId';
}>;

export const asRuleProfileId = (
  value: string,
): RuleProfileId => {
  if (value.length === 0) {
    throw new Error('rule profile id must not be empty');
  }
  return value as RuleProfileId;
};
