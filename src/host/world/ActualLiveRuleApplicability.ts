import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ActualFirstBaseEndedEvidence } from './ActualFirstBasePlayEnd';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Scope = Pick<ActualFirstBaseEndedEvidence, 'source' | 'exactEnd' | 'physicalPrefixReference' | 'finalRuleReference'
  | 'operativeCallReferences' | 'firstBaseEvidenceApplicability'>;
/** Identity/consumption check only. The caller must obtain this scope from the
 * same-connection authenticated closed-end reader, which owns the actual suffix proof. */
export const assertActualLiveRuleApplicability = (raw: Scope, ruleEvidenceRevision: number): void => {
  const s = cloneInert(raw), a = s.firstBaseEvidenceApplicability, refs = s.operativeCallReferences;
  if (!a || a.version !== 'owned_first_base_evidence_applicability_v1' || a.coverage !== 'no_new_rule_relevant_physical_or_base_facts'
    || a.ownerSourceId !== s.source.sourceId || a.fence.owner !== 'actual_first_base_play_ends' || a.fence.sourceId !== s.source.sourceId
    || json(a.rule) !== json(refs.ruleEvidence) || json(a.call) !== json(refs.call) || json(a.perception) !== json(refs.perception)
    || a.ruleEvidenceRevision !== ruleEvidenceRevision || a.rule.sourceId !== s.finalRuleReference.sourceId
    || a.rule.owner !== s.finalRuleReference.owner || a.rule.snapshotHash !== s.finalRuleReference.snapshotHash
    || json(a.through) !== json(s.exactEnd) || a.from.originTick !== a.through.originTick
    || a.from.elapsedSeconds > a.through.elapsedSeconds || a.from.tick > a.through.tick
    || json(a.physicalPrefixReference) !== json(s.physicalPrefixReference)
    || a.physicalCut.baseFieldSourceId !== s.source.baseFieldSourceId || a.physicalCut.executionSourceId !== s.source.executionSourceId) {
    throw new Error('actual original first-base evidence applicability differs');
  }
};
