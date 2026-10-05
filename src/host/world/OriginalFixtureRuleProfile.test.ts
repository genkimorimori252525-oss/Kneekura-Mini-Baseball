import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { match } from './OfficialParticipationPlayFixtures.test-support';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { continuousPitchFixture } from './ContinuousPitchFixtures.test-support';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';

const known = { ruleProfileId: NPB_2026_RULE_PROFILE.id };
const unknown = { ruleProfileId: asRuleProfileId('not-registered-fixture-profile') };
// Intentional RED calls exercise the forthcoming optional fixture parameter;
// existing functions currently ignore it, exposing the missing propagation.
describe('explicit original Match fixture profile', () => {
  it('preserves the complete legacy default Match bytes', () => {
    expect(JSON.stringify(match())).toBe('{"ruleProfileId":"test-rules","inning":1,"half":"top","outs":0,"balls":0,"strikes":0,"bases":{"first":null,"second":null,"third":null},"score":{"away":0,"home":0},"playId":7}');
  });
  it('selects a known profile before any persistence', () => {
    const value = match(known);
    expect(value).toEqual({ ...match(), ruleProfileId: NPB_2026_RULE_PROFILE.id });
    expect(getRuleProfile(value.ruleProfileId)).toBe(NPB_2026_RULE_PROFILE);
  });
  it('rejects an explicit unknown profile instead of using the legacy fallback', () => {
    expect(() => match(unknown)).toThrow(/unsupported rule profile/);
  });
  it('does not accept a caller-supplied rules object as authority', () => {
    expect(() => match({ ...known, ruleProfile: NPB_2026_RULE_PROFILE } as never)).toThrow();
  });
  it('does not mutate the accepted profile option or registered profile', () => {
    const profileBytes = JSON.stringify(NPB_2026_RULE_PROFILE), option = Object.freeze({ ...known });
    expect(match(option).ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    expect(option).toEqual(known); expect(JSON.stringify(NPB_2026_RULE_PROFILE)).toBe(profileBytes);
  });
  it('retains legacy initialization when no option is supplied', () => {
    const f = officialPitchWorkloadFixture(true, true, undefined, true);
    try { expect(f.initial.ruleProfileId).toBe('test-rules'); expect(f.official.getMatch('game-1')!.matchState.ruleProfileId).toBe('test-rules'); }
    finally { f.close(); }
  });
  it('persists the known initial Match before any physical pitch exists', () => {
    const f = officialPitchWorkloadFixture(true, true, undefined, true, undefined, known);
    try {
      expect(f.initial.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
      expect(f.official.getMatch('game-1')!.matchState.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
      expect(f.firstInput.match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
      expect(f.firstInput.adjudication.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    } finally { f.close(); }
  });
  it('passes the known profile to the accepted original World', () => {
    const f = continuousPitchFixture(undefined, true, undefined, known);
    try {
      expect(f.initial.match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
      expect(f.official.getMatch('game-1')!.matchState.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    } finally { f.close(); }
  });
  it('passes the known profile through actor setup without accepting a pitch', () => {
    const x = physicalPlateAppearanceActorFixture(undefined, undefined, known);
    try {
      expect(x.f.initial.match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
      const actor = x.actors.accept(x.source.sourceId);
      expect(actor.match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
      expect(x.f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions').get()!.n).toBe(0);
    } finally { x.f.close(); }
  });
});
