import { expect, it } from 'vitest';
import * as source from './ActualLiveAdjudicationSource';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
const input = { sourceId: 'adjudication', sourceVersion: 'v1', physicalEndSourceId: 'end', policy: null };
it('accepts only source references, never externally supplied outs, score, bases, windows or watermarks', () => {
  for (const key of ['outsAfter', 'score', 'basesAfter', 'windows', 'watermark', 'playEnd', 'call', 'ruleTick']) {
    expect(() => source.actualLiveAdjudicationInput({ ...input, [key]: 1 }, input.sourceId)).toThrow();
  }
  expect(source.actualLiveAdjudicationInput(input, input.sourceId)).toEqual(input);
});
it('anchors explicit supplementary window policy to original match RuleProfile and never overwrites existing policy', () => {
  const policy = { sourceId: 'policy', sourceVersion: 'fixture-v1', ruleProfileId: 'npb-2026',
    officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } };
  const s = source.actualLiveAdjudicationInput({ ...input, policy }, input.sourceId);
  expect(source.actualLiveAdjudicationProfile(NPB_2026_RULE_PROFILE.id, s.policy).officialWindows).toEqual(policy.officialWindows);
  expect(() => source.actualLiveAdjudicationProfile(NPB_2026_RULE_PROFILE.id, { ...policy, ruleProfileId: 'other' })).toThrow(/profile/);
  expect(() => source.actualLiveAdjudicationProfile(NPB_2026_RULE_PROFILE.id, { ...policy,
    officialWindows: { ...policy.officialWindows, appeal: { available: false } } })).toThrow(/profile/);
});
it('retains missing production policy rather than completing it with fixture defaults', () => {
  expect(source.actualLiveAdjudicationProfile(NPB_2026_RULE_PROFILE.id, null).officialWindows).toEqual({ appeal: { available: true } });
});
it('refuses accessor policy without invoking it', () => {
  let calls = 0; const s = { ...input }; Object.defineProperty(s, 'policy', { get: () => { calls++; return null; }, enumerable: true });
  expect(() => source.actualLiveAdjudicationInput(s, input.sourceId)).toThrow(); expect(calls).toBe(0);
});
