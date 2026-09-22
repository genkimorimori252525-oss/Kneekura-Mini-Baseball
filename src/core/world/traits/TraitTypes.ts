/** Projection/lifecycle data. True abilities, physical feasibility and learned source skills stay with their owners. */
export type TraitLifecycleClass = 'GRADED_DYNAMIC' | 'LEARNED_MASTERY_PERSISTENT' | 'GREEN_SLOW_PREFERENCE'
  | 'DYNAMIC_DESCRIPTOR' | 'CAUSAL_NEGATIVE_DYNAMIC' | 'RELATIONSHIP_CONTEXTUAL' | 'CAREER_HISTORY_DESCRIPTOR';
export type ImplementedLifecycle = Extract<TraitLifecycleClass, 'GRADED_DYNAMIC' | 'LEARNED_MASTERY_PERSISTENT' | 'GREEN_SLOW_PREFERENCE'>;
export type TraitFamily = Readonly<{
  familyId: string; referenceName: string; lifecycleClass: ImplementedLifecycle;
  stateIds: readonly string[]; neutralStateId: string | null;
  sourceRoute: 'PRESSURE_APPRAISAL' | 'SOURCE_EXECUTION' | 'PREFERENCE';
}>;
export type TraitScope = Readonly<{ careerId: string; playerId: string }>;
/** day is the career's monotonic day ordinal, NOT day-of-season; sequence orders same-day observations. */
export type TraitTime = Readonly<{ season: number; day: number; sequence: number }>;
export type MasteryRequirement = Readonly<{
  stateId: string; minimumRepetitions: number; minimumPracticeDays: number; minimumDistinctiveness: number;
}>;
export type GreenPolicy = Readonly<{
  familyId: string; enterThreshold: number; leaveThreshold: number; minimumObservations: number; minimumDays: number;
}>;
export type TraitPolicy = Readonly<{
  policyId: string; version: string;
  learned: readonly Readonly<{ familyId: string; tiers: readonly MasteryRequirement[] }>[];
  green: readonly GreenPolicy[];
}>;
export type TraitSourceEvidence = Readonly<{
  sourceKey: string; sourceRevision: number; sourceSnapshotId: string;
  evidenceRevision: number; episodeId: string; eventIds: readonly string[];
  changeKind: 'RECOGNITION' | 'DEVELOPMENT' | 'BOTH';
}>;
export type TraitAssessment =
  | Readonly<{ kind: 'CURRENT_SOURCE'; stateId: string | null }>
  | Readonly<{ kind: 'LEARNED_TECHNIQUE'; stateId: string | null;
      stage: 'CATALYST' | 'HYPOTHESIS' | 'REPETITION' | 'CONSOLIDATED';
      relevantRepetitions: number; practiceDays: number; distinctiveness: number }>
  | Readonly<{ kind: 'SLOW_PREFERENCE'; support: readonly Readonly<{ stateId: string; value: number }>[];
      behavior: 'VOLUNTARY' | 'ACCEPTED' | 'MANAGER_COMMAND'; internalized: boolean }>;
export type TraitEvaluation = Readonly<{
  scope: TraitScope; policyRef: Readonly<{ policyId: string; version: string }>;
  evaluationId: string; expectedRevision: number; time: TraitTime; familyId: string;
  source: TraitSourceEvidence; assessment: TraitAssessment;
}>;
export type PendingPreference = Readonly<{ stateId: string; sinceDay: number; observations: number }>;
export type PreferenceProof = Readonly<PendingPreference & { fromStateId: string; evaluation: TraitEvaluation }>;
export type TraitEntry = Readonly<{
  familyId: string; effectiveStateId: string | null; lastEvaluation: TraitEvaluation;
  masteryProof: TraitEvaluation | null; pending: PendingPreference | null;
  preferenceProof: PreferenceProof | null; changesThisSeason: number;
}>;
export type TraitState = Readonly<{
  schemaVersion: 1; registryVersion: 'canonical09-lifecycle-subset-v1'; scope: TraitScope;
  policy: TraitPolicy; revision: number; time: TraitTime | null; entries: readonly TraitEntry[];
}>;
export type TraitTransition = 'UNCHANGED' | 'ACQUIRED' | 'CHANGED' | 'REMOVED' | 'MASTERY_RETAINED';
export type TraitReceipt = Readonly<{
  type: 'TRAIT_EVALUATION_ACCEPTED'; beforeRevision: number; afterRevision: number;
  evaluation: TraitEvaluation; beforeStateId: string | null; afterStateId: string | null;
  transition: TraitTransition; diagnostics: readonly 'GREEN_CHURN_CALIBRATION'[];
}>;
export type TraitIssueCode = 'INVALID_INPUT' | 'UNKNOWN_FAMILY' | 'UNSUPPORTED_STATE' | 'POLICY_MISMATCH'
  | 'MISSING_FAMILY_POLICY' | 'SCOPE_MISMATCH' | 'STALE_REVISION' | 'BACKDATED_EVALUATION'
  | 'DUPLICATE_EVIDENCE' | 'SOURCE_CONFLICT' | 'DUPLICATE_SOURCE_MASTERY' | 'INCONSISTENT_STATE'
  | 'OVERFLOW' | 'REPLAY_MISMATCH' | 'ILLEGAL_ACTION' | 'COMMAND_NOT_ACCEPTED';
export type TraitResult<T> = Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: Readonly<{ code: TraitIssueCode; path: string }> }>;
export type TraitEvaluationResult = Readonly<{ state: TraitState; receipt: TraitReceipt }>;
export type TraitPortfolio = Readonly<{
  boundary: 'TRAIT_LIFECYCLE_ONLY'; scope: TraitScope; revision: number;
  families: readonly Readonly<{ familyId: string; lifecycleClass: ImplementedLifecycle; stateId: string;
    sourceRoute: TraitFamily['sourceRoute']; source: TraitSourceEvidence }>[];
}>;
export type ActionWeight = Readonly<{ actionId: string; weight: number }>;
export type PreferenceDirective =
  | Readonly<{ kind: 'NONE' }>
  | Readonly<{ kind: 'SOFT'; understood: boolean; accepted: boolean; managerInfluence: number; weights: readonly ActionWeight[] }>
  | Readonly<{ kind: 'HARD'; understood: boolean; accepted: boolean; actionId: string }>;
export type PreferenceIntentInput = Readonly<{
  scope: TraitScope; familyId: string; decisionId: string; contextId: string;
  sourceSnapshotId: string; legalActionIds: readonly string[];
  playerWeights: readonly ActionWeight[]; directive: PreferenceDirective;
}>;
export type PreferenceIntent = Readonly<{
  boundary: 'PREFERENCE_INTENT_ONLY'; scope: TraitScope; familyId: string;
  decisionId: string; contextId: string; sourceSnapshotId: string;
  mode: 'PLAYER_DEFAULT' | 'SOFT_BLEND' | 'HARD_COMMAND'; hardActionId: string | null;
  weights: readonly ActionWeight[];
}>;
