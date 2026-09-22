import type { TraitResult } from '../TraitTypes';
import { attempt, fail, same } from '../TraitValidation';
import { deriveSourceTraitProjection } from './SourceTraitProjection';
import { notAfter, readSourceTraitRequest, sourceKey } from './SourceTraitValidation';
import type { SourceTraitDifference, SourceTraitEntry, SourceTraitTransition } from './SourceTraitTypes';
function transition(before: SourceTraitEntry, after: SourceTraitEntry): SourceTraitTransition {
  if (after.status === 'PRESENT') return before.status !== 'PRESENT' ? 'APPEARED'
    : before.stateId === after.stateId ? 'UNCHANGED' : 'CHANGED';
  if (after.status === 'ABSENT') return before.status === 'PRESENT' ? 'CLEARED'
    : before.status === 'ABSENT' ? 'UNCHANGED' : 'RESOLVED_ABSENT';
  return before.status === 'PRESENT' || before.status === 'ABSENT' ? 'BECAME_UNAVAILABLE' : 'UNCHANGED';
}
/** Recomputes both views from evidence. Never treats caller-written projection rows as truth. */
export const compareSourceTraitRequests = (beforeInput: unknown, afterInput: unknown): TraitResult<SourceTraitDifference> => attempt(() => {
  const before = readSourceTraitRequest(beforeInput), after = readSourceTraitRequest(afterInput);
  if (!same(before.scope, after.scope) || before.targetTeamId !== after.targetTeamId) fail('SCOPE_MISMATCH', 'comparison.scope');
  if (!notAfter(before.time, after.time)) fail('BACKDATED_EVALUATION', 'comparison.time');
  if (after.worldRevision < before.worldRevision) fail('STALE_REVISION', 'comparison.worldRevision');
  if (before.projectionId === after.projectionId && !same(before, after)) fail('DUPLICATE_EVIDENCE', 'comparison.projectionId');
  if (before.policy.policyId === after.policy.policyId && before.policy.version === after.policy.version && !same(before.policy, after.policy))
    fail('POLICY_MISMATCH', 'comparison.policy');
  const classifications = new Map(before.assessments.map(a => [a.classificationId, a]));
  for (const a of after.assessments) {
    const old = classifications.get(a.classificationId);
    if (old && !same(old, a)) fail('SOURCE_CONFLICT', 'comparison.classificationId');
  }
  const oldSources = new Map(before.currentSources.map(s => [sourceKey(s), s]));
  const oldSnapshots = new Map(before.currentSources.map(s => [s.snapshotId, s]));
  for (const s of after.currentSources) {
    const old = oldSources.get(sourceKey(s)), snapshot = oldSnapshots.get(s.snapshotId);
    if (snapshot && !same(snapshot, s)) fail('SOURCE_CONFLICT', 'comparison.snapshotId');
    if (old && (s.revision < old.revision || !notAfter(old.time, s.time)
      || (s.revision === old.revision && !same(s, old)))) fail('SOURCE_CONFLICT', 'comparison.currentSources');
  }
  const a = deriveSourceTraitProjection(before), b = deriveSourceTraitProjection(after);
  return { boundary: 'SOURCE_TRAIT_DIFFERENCE_ONLY', beforeProjectionId: a.projectionId, afterProjectionId: b.projectionId,
    changes: a.entries.map((entry, i) => ({ familyId: entry.familyId, transition: transition(entry, b.entries[i]!), before: entry, after: b.entries[i]! })) };
});
