import type { ActiveEmotion, EmotionInfluence, EmotionResult, EmotionState } from './EmotionTypes';
import { attempt, compareTime, fail, integer, obj, readAppraisal, readKind, readPolicy, readScope, readTime, same } from './EmotionValidation';

export function createEmotionState(input: unknown): EmotionResult<EmotionState> {
  return attempt(() => {
    const v = obj(input,['scope','policy'],'creation');
    return { schemaVersion: 1, scope: readScope(v.scope,'creation.scope'), policy: readPolicy(v.policy,'creation.policy'),
      revision: 0, lastAppraisal: null, active: null, calmObservations: 0 };
  });
}
export function readState(input: unknown): EmotionState {
  const v = obj(input,['schemaVersion','scope','policy','revision','lastAppraisal','active','calmObservations'],'state');
  if (v.schemaVersion !== 1) fail('INVALID_INPUT','state.schemaVersion');
  const scope = readScope(v.scope,'state.scope'), policy = readPolicy(v.policy,'state.policy');
  const revision = integer(v.revision,'state.revision'), calmObservations = integer(v.calmObservations,'state.calmObservations');
  const lastAppraisal = v.lastAppraisal === null ? null : readAppraisal(v.lastAppraisal,'state.lastAppraisal');
  let active: ActiveEmotion | null = null;
  if (v.active !== null) {
    const a = obj(v.active,['emotion','activatedAt'],'state.active');
    active = { emotion: readKind(a.emotion,'state.active.emotion'), activatedAt: readTime(a.activatedAt,'state.active.activatedAt') };
  }
  if (revision === 0) {
    if (lastAppraisal !== null || active !== null || calmObservations !== 0) fail('INCONSISTENT_STATE','state.initial');
  } else {
    if (!lastAppraisal || lastAppraisal.expectedRevision === Number.MAX_SAFE_INTEGER
      || lastAppraisal.expectedRevision + 1 !== revision) fail('INCONSISTENT_STATE','state.revision');
    if (!same(scope,lastAppraisal.scope)) fail('INCONSISTENT_STATE','state.lastAppraisal.scope');
    if (policy.policyId !== lastAppraisal.policyRef.policyId || policy.version !== lastAppraisal.policyRef.version)
      fail('INCONSISTENT_STATE','state.lastAppraisal.policyRef');
    const qualified = lastAppraisal.candidates.filter(x => x.behavioralImpact > 0
      && x.pressure >= policy.thresholds.find(t => t.emotion === x.emotion)!.activation);
    if (!active && qualified.length > 0) fail('INCONSISTENT_STATE','state.active');
    if (active) {
      const candidate = lastAppraisal.candidates.find(x => x.emotion === active!.emotion)!;
      const thresholds = policy.thresholds.find(x => x.emotion === active!.emotion)!;
      const order = compareTime(active.activatedAt,lastAppraisal.time);
      if (order > 0 || (revision === 1 && order !== 0) || candidate.behavioralImpact === 0
        || calmObservations >= policy.clearAfterCalmEvents || calmObservations >= revision
        || qualified.some(x => x.behavioralImpact > candidate.behavioralImpact)
        || (candidate.pressure < thresholds.sustain) !== (calmObservations > 0)
        || (order === 0 && candidate.pressure < thresholds.activation)) fail('INCONSISTENT_STATE','state.active');
    }
  }
  if (!active && calmObservations !== 0) fail('INCONSISTENT_STATE','state.calmObservations');
  return { schemaVersion: 1, scope, policy, revision, lastAppraisal, active, calmObservations };
}
export const restoreEmotionState = (input: unknown): EmotionResult<EmotionState> => attempt(() => readState(input));
/** One atomic read model for future execution AND observer consumers; not proof of game integration. */
export function getEmotionInfluence(input: unknown): EmotionResult<EmotionInfluence> {
  return attempt(() => {
    const s = readState(input), a = s.lastAppraisal;
    const candidate = s.active && a ? a.candidates.find(x => x.emotion === s.active!.emotion)! : null;
    return { boundary: 'EMOTION_GATE_ONLY', scope: s.scope, revision: s.revision, time: a?.time ?? null,
      activeEmotion: s.active?.emotion ?? null, effects: candidate?.effects ?? null,
      source: candidate && a ? { appraisalId: a.appraisalId, contextId: a.contextId,
        sourceSnapshotId: a.sourceSnapshotId, candidateId: candidate.candidateId } : null };
  });
}
