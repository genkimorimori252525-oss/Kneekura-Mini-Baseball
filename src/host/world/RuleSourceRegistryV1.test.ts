import { expect, it } from 'vitest';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { projectFairPoleRuleSourceV1Input, deriveProjectFairPoleRuleRegistrationV1, type AcceptedProjectFairPoleRuleSourceV1 } from './RuleSourceRegistryV1';

const declaration = (): AcceptedProjectFairPoleRuleSourceV1 => ({ sourceId: 'test-project-pole-rule', sourceVersion: 'test-authored-v1',
  kind: 'project_fair_pole_rule_source_v1', evidenceAuthority: 'EXPLICIT_PROJECT_RULE_MODEL',
  scope: { ruleModelId: 'test-game-model', ruleModelRevision: '1' }, baseProfile: { ruleProfileId: 'npb-2026', rulesRevision: '2026' },
  interpretation: 'ADOPTED_FAIR_POLE_CONTACT_IS_FAIR_V1', availableFromDay: 40,
  provenance: { kind: 'INLINE_PROJECT_DEFINITION', definitionText: 'In this test game model, contact with an explicitly adopted fair pole is fair.' } });

it('RSR215-01 derives a project registration from the production profile without claiming official authority or Root adoption', () => {
  const source = declaration(), value = deriveProjectFairPoleRuleRegistrationV1(source, source.sourceId);
  expect(value.source).toEqual(source); expect(value.registeredBaseProfile).toEqual({ ruleProfileId: 'npb-2026', rulesRevision: '2026', profileHash: hash(getRuleProfile(NPB_2026_RULE_PROFILE.id)) });
  expect(value.authorityLimit).toBe('PROJECT_RULE_MODEL_ONLY'); expect(Object.isFrozen(value.source.provenance)).toBe(true);
  expect(Object.keys(value).sort()).toEqual(['authorityLimit', 'interpretationContract', 'kind', 'registeredBaseProfile', 'source']);
});

it.each([
  ['official authority', { evidenceAuthority: 'VERIFIED_OFFICIAL_NPB_SOURCE' }],
  ['unknown interpretation', { interpretation: 'AUTOMATIC_HOME_RUN' }],
  ['foreign profile', { baseProfile: { ruleProfileId: 'unknown', rulesRevision: '2026' } }],
  ['unknown revision', { baseProfile: { ruleProfileId: 'npb-2026', rulesRevision: '2027' } }],
  ['injected profile', { profile: NPB_2026_RULE_PROFILE }],
  ['invented document', { officialDocumentReference: 'unread-document' }],
  ['invented Human gate', { humanApproval: true }],
  ['fractional availability', { availableFromDay: 0.5 }],
  ['negative availability', { availableFromDay: -1 }],
  ['empty definition', { provenance: { kind: 'INLINE_PROJECT_DEFINITION', definitionText: '' } }],
] as const)('RSR215-02 rejects %s as a project declaration', (_name, changed) => {
  expect(() => projectFairPoleRuleSourceV1Input({ ...declaration(), ...changed }, declaration().sourceId)).toThrow();
});

it('RSR215-03 rejects accessors without invoking them and never mutates the declaration', () => {
  let reads = 0; const raw = Object.defineProperty(declaration(), 'provenance', { enumerable: true, get() { reads++; return {}; } });
  expect(() => projectFairPoleRuleSourceV1Input(raw, raw.sourceId)).toThrow(); expect(reads).toBe(0);
  const source = declaration(), before = JSON.stringify(source); deriveProjectFairPoleRuleRegistrationV1(source, source.sourceId); expect(JSON.stringify(source)).toBe(before);
});

it('RSR215-04 rejects a different Source ID and derives availability without making a claim about any game day', () => {
  const source = declaration(); expect(() => projectFairPoleRuleSourceV1Input(source, 'alias')).toThrow();
  expect(deriveProjectFairPoleRuleRegistrationV1(source, source.sourceId).source.availableFromDay).toBe(40);
});
