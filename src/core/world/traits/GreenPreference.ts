import type { GreenPolicy, TraitAssessment, TraitEntry } from './TraitTypes';
import { fail, order } from './TraitValidation';

/** Supports independent, internalized observations only; commands never teach a preference here. */
export function greenCandidate(current: string, assessment: TraitAssessment, policy: GreenPolicy): string | null {
  if (assessment.kind !== 'SLOW_PREFERENCE') fail('INCONSISTENT_STATE', 'green.assessment');
  if (!assessment.internalized || assessment.behavior === 'MANAGER_COMMAND') return null;
  const incumbent = assessment.support.find(x => x.stateId === current)!;
  if (incumbent.value > policy.leaveThreshold) return null;
  return [...assessment.support].filter(x => x.stateId !== current && x.value >= policy.enterThreshold)
    .sort((a, b) => b.value - a.value || order(a.stateId, b.stateId))[0]?.stateId ?? null;
}

export function advanceGreen(entry: TraitEntry, policy: GreenPolicy): TraitEntry {
  const evaluation = entry.lastEvaluation;
  const candidate = greenCandidate(entry.effectiveStateId!, evaluation.assessment, policy);
  if (candidate === null) return { ...entry, pending: null };
  const pending = entry.pending?.stateId === candidate
    ? { ...entry.pending, observations: Math.min(policy.minimumObservations, entry.pending.observations + 1) }
    : { stateId: candidate, sinceDay: evaluation.time.day, observations: 1 };
  if (pending.observations < policy.minimumObservations || evaluation.time.day - pending.sinceDay < policy.minimumDays)
    return { ...entry, pending };
  if (entry.changesThisSeason === Number.MAX_SAFE_INTEGER) fail('OVERFLOW', 'green.changesThisSeason');
  return { ...entry, effectiveStateId: candidate, pending: null, changesThisSeason: entry.changesThisSeason + 1,
    preferenceProof: { ...pending, fromStateId: entry.effectiveStateId!, evaluation } };
}
