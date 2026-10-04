import { expect, it } from 'vitest';
import { assertActualLiveRuleApplicability } from './ActualLiveRuleApplicability';
type Scope = Parameters<typeof assertActualLiveRuleApplicability>[0];
// Reconstructed consumer regression, not a persisted-end fixture. The closed-end
// owner independently proves the physical suffix and complete body/base hashes.
const fixture = (): Scope => {
  const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceVersion: 'v1', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
  const rule = ref('batted_world_field_executions', 'original-rule'), call = ref('actual_first_base_umpire_calls', 'original-call');
  const perception = ref('actual_first_base_umpire_observations', 'original-observation');
  const from = { originTick: 0, elapsedSeconds: 1, tick: 1_000_000 }, through = { originTick: 0, elapsedSeconds: 2, tick: 2_000_000 };
  const physicalPrefixReference = { hash: 'c'.repeat(64), sourceId: 'retained-physical-prefix' };
  return { source: { sourceId: 'end', baseFieldSourceId: 'field', executionSourceId: 'later-retained-cut' }, exactEnd: through,
    physicalPrefixReference, finalRuleReference: rule, operativeCallReferences: { ruleEvidence: rule, call, perception },
    firstBaseEvidenceApplicability: { version: 'owned_first_base_evidence_applicability_v1', coverage: 'no_new_rule_relevant_physical_or_base_facts',
      ownerSourceId: 'end', fence: { owner: 'actual_first_base_play_ends', sourceId: 'end' }, rule, call, perception, ruleEvidenceRevision: 7,
      from, through, physicalPrefixReference, physicalCut: { baseFieldSourceId: 'field', executionSourceId: 'later-retained-cut' } } } as unknown as Scope;
};
it('consumes applicability without changing the original rule/call basis to the later retained physical cut', () => {
  const f = fixture(), original = JSON.stringify(f);
  expect(() => assertActualLiveRuleApplicability(f, 7)).not.toThrow();
  expect(f.finalRuleReference.sourceId).not.toBe(f.source.executionSourceId);
  expect(JSON.stringify(f)).toBe(original);
});
it('rejects changed certificate identity, revision, clock, physical prefix or fence', () => {
  const patches = [
    { ownerSourceId: 'another-end' }, { fence: { owner: 'actual_first_base_play_ends', sourceId: 'another-end' } },
    { rule: { ...fixture().firstBaseEvidenceApplicability.rule, sourceId: 'new-rule' } },
    { call: { ...fixture().firstBaseEvidenceApplicability.call, sourceId: 'new-call' } },
    { perception: { ...fixture().firstBaseEvidenceApplicability.perception, sourceId: 'new-observation' } },
    { ruleEvidenceRevision: 8 }, { through: { originTick: 0, elapsedSeconds: 3, tick: 3_000_000 } },
    { from: { originTick: 1, elapsedSeconds: 1, tick: 1_000_001 } },
    { physicalCut: { baseFieldSourceId: 'field', executionSourceId: 'different-cut' } },
    { physicalPrefixReference: { hash: 'd'.repeat(64) } },
  ];
  for (const patch of patches) {
    const f = fixture();
    expect(() => assertActualLiveRuleApplicability({ ...f, firstBaseEvidenceApplicability: { ...f.firstBaseEvidenceApplicability, ...patch } } as Scope, 7)).toThrow(/applicability differs/);
  }
});
