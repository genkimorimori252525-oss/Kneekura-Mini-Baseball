/** State/decision data only. No renderer, result probabilities, or permanent emotional ratings. */
export const EMOTIONS = ['SUPERIORITY', 'MOTIVATION', 'FEAR', 'IMPATIENCE', 'ANGER'] as const;
export type EmotionKind = typeof EMOTIONS[number];
export type EmotionScope = Readonly<{ careerId: string; matchId: string; playerId: string }>;
export type EmotionTime = Readonly<{ tick: number; sequence: number }>;
export type EmotionPolicy = Readonly<{
  policyId: string; version: string; clearAfterCalmEvents: number;
  thresholds: readonly Readonly<{ emotion: EmotionKind; activation: number; sustain: number }>[];
}>;
/** Signed time shifts are integer simulation ticks, never render milliseconds. */
export type EmotionDecisionEffects = Readonly<{
  swingDecisionShiftTicks: number; throwIntentShiftTicks: number; defenseReplanShiftTicks: number;
  swingAggressionDelta: number; throwAggressionDelta: number; runningRiskDelta: number;
}>;
export type EmotionCandidate = Readonly<{
  emotion: EmotionKind; candidateId: string; pressure: number;
  /** Comparable [0,1] impact estimate produced by the pinned appraisal model, not this gate. */
  behavioralImpact: number; effects: EmotionDecisionEffects;
}>;
export type EmotionAppraisal = Readonly<{
  scope: EmotionScope; policyRef: Readonly<{ policyId: string; version: string }>;
  appraisalId: string; contextId: string; appraisalModelVersion: string; sourceSnapshotId: string;
  evidenceEventIds: readonly string[]; expectedRevision: number; time: EmotionTime;
  candidates: readonly EmotionCandidate[];
}>;
export type ActiveEmotion = Readonly<{ emotion: EmotionKind; activatedAt: EmotionTime }>;
export type EmotionState = Readonly<{
  schemaVersion: 1; scope: EmotionScope; policy: EmotionPolicy; revision: number;
  lastAppraisal: EmotionAppraisal | null; active: ActiveEmotion | null; calmObservations: number;
}>;
export type EmotionInfluence = Readonly<{
  boundary: 'EMOTION_GATE_ONLY'; scope: EmotionScope; revision: number; time: EmotionTime | null;
  activeEmotion: EmotionKind | null; effects: EmotionDecisionEffects | null;
  source: Readonly<{ appraisalId: string; contextId: string; sourceSnapshotId: string; candidateId: string }> | null;
}>;
export type EmotionIssueCode = 'INVALID_INPUT' | 'INCONSISTENT_STATE' | 'SCOPE_MISMATCH' | 'POLICY_MISMATCH'
  | 'STALE_REVISION' | 'BACKDATED_APPRAISAL' | 'DUPLICATE_APPRAISAL' | 'REVISION_OVERFLOW' | 'REPLAY_MISMATCH';
export type EmotionIssue = Readonly<{ code: EmotionIssueCode; path: string }>;
export type EmotionResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; reason: EmotionIssue }>;
export type EmotionTransition = 'NONE' | 'ACTIVATED' | 'MAINTAINED' | 'CHANGED' | 'CLEARED';
/** Every accepted appraisal has a receipt, including invisible calm-counter updates. */
export type EmotionEvaluationEvent = Readonly<{
  kind: 'EmotionEvaluated'; request: EmotionAppraisal; beforeRevision: number; afterRevision: number;
  transition: EmotionTransition; active: ActiveEmotion | null; calmObservations: number;
}>;
export type EmotionTransitionResult = Readonly<{ ok: true; state: EmotionState; event: EmotionEvaluationEvent }>
  | Readonly<{ ok: false; state: EmotionState; reason: EmotionIssue }>;
