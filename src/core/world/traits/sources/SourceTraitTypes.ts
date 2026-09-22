import type { TraitLifecycleClass, TraitScope, TraitTime } from '../TraitTypes';
export type SourceLifecycle = Extract<TraitLifecycleClass, 'DYNAMIC_DESCRIPTOR' | 'CAUSAL_NEGATIVE_DYNAMIC' | 'RELATIONSHIP_CONTEXTUAL' | 'CAREER_HISTORY_DESCRIPTOR'>;
export type SourceOwner = 'BATTING_CONTACT' | 'PITCHING_CONTACT' | 'PITCH_TRAJECTORY' | 'PITCH_QUALITY' | 'PITCH_COMMAND' | 'RELEASE_FAILURE' | 'FAMILIARITY' | 'TEAM_ROSTER' | 'TEAM_PITCH_PROFILE' | 'TEAM_TACTICS' | 'CAREER_HISTORY';
export type SourceRequirement = Readonly<{ role: string; owner: SourceOwner; subject: 'PLAYER' | 'TARGET_TEAM' }>;
export type SourceTraitFamily = Readonly<{
  familyId: string; referenceName: string; lifecycleClass: SourceLifecycle; stateIds: readonly string[];
  requirements: readonly SourceRequirement[]; sourceSections: readonly string[];
  evidenceMode: 'RECOGNITION_REQUIRED' | 'SOURCE_CHANGE_OR_RECOGNITION';
  route: 'CURRENT_SOURCE_DESCRIPTION' | 'CONTEXT_DESCRIPTION' | 'HISTORY_ONLY';
}>;
export type TraitSourceSnapshot = Readonly<{
  careerId: string; owner: SourceOwner; subjectId: string; sourceKey: string;
  revision: number; snapshotId: string; time: TraitTime;
}>;
export type SourceTraitRule = Readonly<{
  familyId: string; modelId: string; modelVersion: string;
  minimumRecognitionEpisodes: number; minimumRecognitionDays: number;
}>;
export type SourceTraitPolicy = Readonly<{ policyId: string; version: string; families: readonly SourceTraitRule[] }>;
export type SourceTraitAssessment = Readonly<{
  familyId: string; classificationId: string; scope: TraitScope; time: TraitTime;
  stateId: string | null; targetTeamId: string | null;
  modelId: string; modelVersion: string; changeKind: 'RECOGNITION' | 'DEVELOPMENT' | 'BOTH';
  bindings: readonly Readonly<{ role: string; source: TraitSourceSnapshot }>[];
  episodes: readonly Readonly<{ episodeId: string; time: TraitTime; eventIds: readonly string[] }>[];
}>;
export type SourceTraitRequest = Readonly<{
  projectionId: string; scope: TraitScope; time: TraitTime; worldRevision: number; targetTeamId: string | null;
  policy: SourceTraitPolicy; currentSources: readonly TraitSourceSnapshot[];
  assessments: readonly SourceTraitAssessment[];
}>;
export type SourceTraitStatus = 'UNASSESSED' | 'OUT_OF_CONTEXT' | 'UNAVAILABLE' | 'ABSENT' | 'PRESENT';
export type SourceTraitReason = 'MODEL_CHANGED' | 'MISSING_SOURCE' | 'STALE_SOURCE' | 'INSUFFICIENT_EVIDENCE';
export type SourceTraitEntry = Readonly<{
  familyId: string; lifecycleClass: SourceLifecycle; route: SourceTraitFamily['route'];
  status: SourceTraitStatus; stateId: string | null; reasons: readonly SourceTraitReason[];
  assessment: SourceTraitAssessment | null;
}>;
/** Recomputable description only. Contains no action, multiplier or writable ability authority. */
export type SourceTraitProjection = Readonly<{
  boundary: 'SOURCE_TRAIT_PROJECTION_ONLY'; registryVersion: 'canonical09-source-descriptors-v1';
  projectionId: string; scope: TraitScope; time: TraitTime; worldRevision: number; targetTeamId: string | null;
  policyRef: Readonly<{ policyId: string; version: string }>; entries: readonly SourceTraitEntry[];
}>;
export type SourceTraitTransition = 'APPEARED' | 'CHANGED' | 'CLEARED' | 'BECAME_UNAVAILABLE' | 'RESOLVED_ABSENT' | 'UNCHANGED';
export type SourceTraitDifference = Readonly<{
  boundary: 'SOURCE_TRAIT_DIFFERENCE_ONLY'; beforeProjectionId: string; afterProjectionId: string;
  changes: readonly Readonly<{ familyId: string; transition: SourceTraitTransition; before: SourceTraitEntry; after: SourceTraitEntry }>[];
}>;
