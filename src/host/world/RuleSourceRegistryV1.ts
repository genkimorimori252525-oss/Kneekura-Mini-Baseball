import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** An authored game definition. The base profile is a compatibility constraint,
 * not evidence that an official NPB pole clause has been obtained or adopted. */
export type AcceptedProjectFairPoleRuleSourceV1 = Readonly<{
  sourceId: string; sourceVersion: string; kind: 'project_fair_pole_rule_source_v1';
  evidenceAuthority: 'EXPLICIT_PROJECT_RULE_MODEL';
  scope: Readonly<{ ruleModelId: string; ruleModelRevision: string }>;
  baseProfile: Readonly<{ ruleProfileId: 'npb-2026'; rulesRevision: '2026' }>;
  interpretation: 'ADOPTED_FAIR_POLE_CONTACT_IS_FAIR_V1'; availableFromDay: number;
  provenance: Readonly<{ kind: 'INLINE_PROJECT_DEFINITION'; definitionText: string }>;
}>;
export type RegisteredProjectFairPoleRuleSourceV1 = Readonly<{
  kind: 'registered_project_rule_source_v1'; source: AcceptedProjectFairPoleRuleSourceV1;
  registeredBaseProfile: Readonly<{ ruleProfileId: 'npb-2026'; rulesRevision: '2026'; profileHash: string }>;
  interpretationContract: 'adopted_fair_pole_policy_v145'; authorityLimit: 'PROJECT_RULE_MODEL_ONLY';
}>;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const fields = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');

export const projectFairPoleRuleSourceV1Input = (raw: unknown, sourceId: string): AcceptedProjectFairPoleRuleSourceV1 => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'kind', 'evidenceAuthority', 'scope', 'baseProfile', 'interpretation', 'availableFromDay', 'provenance'])
    || !text(sourceId) || s.sourceId !== sourceId || !text(s.sourceVersion) || s.kind !== 'project_fair_pole_rule_source_v1'
    || s.evidenceAuthority !== 'EXPLICIT_PROJECT_RULE_MODEL' || s.interpretation !== 'ADOPTED_FAIR_POLE_CONTACT_IS_FAIR_V1'
    || !fields(s.scope, ['ruleModelId', 'ruleModelRevision']) || !text(s.scope.ruleModelId) || !text(s.scope.ruleModelRevision)
    || !fields(s.baseProfile, ['ruleProfileId', 'rulesRevision']) || s.baseProfile.ruleProfileId !== 'npb-2026' || s.baseProfile.rulesRevision !== '2026'
    || typeof s.availableFromDay !== 'number' || !Number.isSafeInteger(s.availableFromDay) || s.availableFromDay < 0
    || !fields(s.provenance, ['kind', 'definitionText']) || s.provenance.kind !== 'INLINE_PROJECT_DEFINITION' || !text(s.provenance.definitionText))
    throw Error('invalid explicit project fair-pole rule Source');
  return freeze({ sourceId, sourceVersion: s.sourceVersion, kind: s.kind, evidenceAuthority: s.evidenceAuthority,
    scope: { ruleModelId: s.scope.ruleModelId, ruleModelRevision: s.scope.ruleModelRevision },
    baseProfile: { ruleProfileId: s.baseProfile.ruleProfileId, rulesRevision: s.baseProfile.rulesRevision },
    interpretation: s.interpretation, availableFromDay: s.availableFromDay,
    provenance: { kind: s.provenance.kind, definitionText: s.provenance.definitionText } });
};

/** A registry entry binds an explicit definition to the compiled profile only.
 * Root, surface, geometry, applicability day and official adoption are separate. */
export const deriveProjectFairPoleRuleRegistrationV1 = (raw: unknown, sourceId: string): RegisteredProjectFairPoleRuleSourceV1 => {
  const source = projectFairPoleRuleSourceV1Input(raw, sourceId), profile = getRuleProfile(NPB_2026_RULE_PROFILE.id);
  if (profile.id !== source.baseProfile.ruleProfileId || profile.rulesRevision !== source.baseProfile.rulesRevision)
    throw Error('project fair-pole rule production profile revision differs');
  return freeze({ kind: 'registered_project_rule_source_v1', source,
    registeredBaseProfile: { ruleProfileId: source.baseProfile.ruleProfileId, rulesRevision: source.baseProfile.rulesRevision, profileHash: hash(profile) },
    interpretationContract: 'adopted_fair_pole_policy_v145', authorityLimit: 'PROJECT_RULE_MODEL_ONLY' });
};
