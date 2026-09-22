import type { ActiveEmotion, EmotionCandidate, EmotionState, EmotionTransition, EmotionTransitionResult } from './EmotionTypes';
import { readState } from './EmotionState';
import { attempt, compareTime, fail, readAppraisal, same } from './EmotionValidation';

export function evaluateEmotion(inputState: EmotionState, input: unknown): EmotionTransitionResult {
  const result = attempt(() => {
    const s = readState(inputState), request = readAppraisal(input,'appraisal');
    if (!same(s.scope,request.scope)) fail('SCOPE_MISMATCH','appraisal.scope');
    if (s.policy.policyId !== request.policyRef.policyId || s.policy.version !== request.policyRef.version)
      fail('POLICY_MISMATCH','appraisal.policyRef');
    if (s.revision !== request.expectedRevision) fail('STALE_REVISION','appraisal.expectedRevision');
    if (request.appraisalId === s.lastAppraisal?.appraisalId) fail('DUPLICATE_APPRAISAL','appraisal.appraisalId');
    if (s.lastAppraisal && compareTime(request.time,s.lastAppraisal.time) <= 0) fail('BACKDATED_APPRAISAL','appraisal.time');
    if (s.revision === Number.MAX_SAFE_INTEGER) fail('REVISION_OVERFLOW','state.revision');
    const incumbent = s.active?.emotion ?? null;
    let calm = 0;
    const eligible = request.candidates.filter(candidate => {
      if (candidate.behavioralImpact === 0) return false;
      const threshold = s.policy.thresholds.find(x => x.emotion === candidate.emotion)!;
      if (candidate.emotion !== incumbent) return candidate.pressure >= threshold.activation;
      calm = candidate.pressure < threshold.sustain ? s.calmObservations + 1 : 0;
      return calm < s.policy.clearAfterCalmEvents;
    });
    let chosen: EmotionCandidate | null = null;
    for (const candidate of eligible) {
      if (!chosen || candidate.behavioralImpact > chosen.behavioralImpact
        || (candidate.behavioralImpact === chosen.behavioralImpact
          && (candidate.emotion === incumbent || (chosen.emotion !== incumbent && candidate.candidateId < chosen.candidateId))))
        chosen = candidate;
    }
    const active: ActiveEmotion | null = chosen
      ? (chosen.emotion === incumbent ? s.active : { emotion: chosen.emotion, activatedAt: request.time }) : null;
    const calmObservations = active?.emotion === incumbent && active !== null ? calm : 0;
    const transition: EmotionTransition = !active ? (s.active ? 'CLEARED' : 'NONE')
      : !s.active ? 'ACTIVATED' : active.emotion === s.active.emotion ? 'MAINTAINED' : 'CHANGED';
    const state = readState({ ...s, revision: s.revision + 1, lastAppraisal: request, active, calmObservations });
    return { state, event: { kind: 'EmotionEvaluated' as const, request, beforeRevision: s.revision,
      afterRevision: state.revision, transition, active: state.active, calmObservations: state.calmObservations } };
  });
  return result.ok ? Object.freeze({ ok: true, ...result.value })
    : Object.freeze({ ok: false, state: inputState, reason: result.reason });
}
