import type { EmotionAppraisal, EmotionPolicy, EmotionScope, EmotionState } from './EmotionTypes';
import { createEmotionState } from './EmotionState';
export const scope: EmotionScope = { careerId: 'career', matchId: 'match', playerId: 'player' };
export const zeroEffects = () => ({ swingDecisionShiftTicks: 0, throwIntentShiftTicks: 0,
  defenseReplanShiftTicks: 0, swingAggressionDelta: 0, throwAggressionDelta: 0, runningRiskDelta: 0 });
export const policy = (): EmotionPolicy => ({ policyId: 'synthetic-policy', version: 'test-v1', clearAfterCalmEvents: 3,
  thresholds: ['SUPERIORITY','MOTIVATION','FEAR','IMPATIENCE','ANGER'].map(emotion => ({
    emotion: emotion as EmotionPolicy['thresholds'][number]['emotion'], activation: 0.8, sustain: 0.5 })) });
export const state = (): EmotionState => {
  const result = createEmotionState({ scope, policy: policy() });
  if (!result.ok) throw new Error(JSON.stringify(result.reason)); return result.value;
};
export const appraisal = (s: EmotionState, id = 'appraisal-' + s.revision): EmotionAppraisal => ({
  scope: s.scope, policyRef: { policyId: s.policy.policyId, version: s.policy.version },
  appraisalId: id, contextId: 'context', appraisalModelVersion: 'test-appraisal-v1', sourceSnapshotId: 'source-' + id,
  evidenceEventIds: ['world-event-' + id], expectedRevision: s.revision,
  time: { tick: (s.lastAppraisal?.time.tick ?? 0) + 10, sequence: 0 },
  candidates: s.policy.thresholds.map((x,i) => ({ emotion: x.emotion, candidateId: id + '-' + i,
    pressure: 0.2, behavioralImpact: 0, effects: zeroEffects() })),
});
export const candidate = (a: EmotionAppraisal, emotion: EmotionAppraisal['candidates'][number]['emotion'],
  pressure: number, behavioralImpact = 0.4, effects = { ...zeroEffects(), swingAggressionDelta: 0.2 }): EmotionAppraisal => ({
  ...a, candidates: a.candidates.map(x => x.emotion === emotion ? { ...x, pressure, behavioralImpact, effects } : x),
});
