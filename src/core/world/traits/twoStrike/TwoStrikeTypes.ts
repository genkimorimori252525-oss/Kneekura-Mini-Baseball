import type { TraitEvaluation, TraitScope, TraitState, TraitTime } from '../TraitTypes';
import type { EmotionInfluence, EmotionState, EmotionTime } from '../../psychology/EmotionTypes';

export type TwoStrikeTechniqueId = 'cut_contact' | 'two_strike_adjustment';
export type TechniqueReference = Readonly<{ sourceKey: string; revision: number; snapshotId: string }>;
/** Technical baseline only. Emotional contributions must not already be included. */
export type TwoStrikeSnapshot = TechniqueReference & Readonly<{
  scope: TraitScope; time: TraitTime; owner: 'TWO_STRIKE_TECHNIQUE'; effectBasis: 'TECHNICAL_ONLY';
}>;
export type CurrentTwoStrikeTechnique = Readonly<{
  source: TwoStrikeSnapshot; recognitionDelayTicks: number; adjustmentSpreadM: number;
  techniques: readonly Readonly<{ familyId: TwoStrikeTechniqueId; source: TechniqueReference; feasible: boolean }>[];
}>;
/** Source-attributed residuals, not strikeout counts or ordinary pitch movement. */
export type TwoStrikeObservation = Readonly<{
  scope: TraitScope; episodeId: string; eventId: string; time: TraitTime; strikes: 2;
  recognitionErrorTicks: number; adjustmentErrorM: number;
}>;
export type TwoStrikeModel = Readonly<{
  modelId: string; version: string; minimumEpisodes: number; minimumDays: number;
  windowDays: number; maximumSourceAgeDays: number;
  redRecognitionTicks: number; extremeRecognitionTicks: number;
  redAdjustmentM: number; extremeAdjustmentM: number;
  redEpisodeFraction: number; extremeEpisodeFraction: number;
  minimumFailedEpisodes: number; minimumExtremeEpisodes: number;
}>;
export type TwoStrikeClassificationRequest = Readonly<{
  classificationId: string; scope: TraitScope; time: TraitTime;
  source: TwoStrikeSnapshot; model: TwoStrikeModel; observations: readonly TwoStrikeObservation[];
}>;
export type TwoStrikeTier = 'RED' | 'RED_EXTREME';
export type TwoStrikeClassification = Readonly<{
  boundary: 'TWO_STRIKE_RECOGNITION_ONLY'; algorithmVersion: 'two-strike-residual-incidence-v1';
  familyId: 'two_strike_weakness'; lifecycleClass: 'CAUSAL_NEGATIVE_DYNAMIC';
  request: TwoStrikeClassificationRequest;
  metrics: Readonly<{ samples: number; episodes: number; spanDays: number;
    failedEpisodes: number; extremeEpisodes: number; failedFraction: number; extremeFraction: number }>;
}> & (Readonly<{ status: 'READY'; stateId: TwoStrikeTier | null; reasons: readonly [] }>
  | Readonly<{ status: 'UNAVAILABLE'; stateId: null; reasons: readonly ('INSUFFICIENT_EVIDENCE' | 'INSUFFICIENT_FAILURE_EVIDENCE' | 'STALE_SOURCE')[] }>);

export type TwoStrikeFrame = Readonly<{
  scope: TraitScope; matchId: string; decisionId: string; contextId: string; worldRevision: number;
  time: TraitTime; emotionTime: EmotionTime; strikes: 0 | 1 | 2;
  expectedTraitRevision: number; expectedEmotionRevision: number;
  currentSource: TechniqueReference; emotionSourceSnapshotId: string;
  recognitionModel: Readonly<{ modelId: string; version: string }>;
}>;
export type TwoStrikeInputRequest = Readonly<{
  frame: TwoStrikeFrame; traits: TraitState; emotion: EmotionState; current: CurrentTwoStrikeTechnique;
  classificationRequest: TwoStrikeClassificationRequest | null;
}>;
export type TwoStrikeWeaknessView = Readonly<{
  status: 'UNASSESSED' | 'OUT_OF_CONTEXT' | 'UNAVAILABLE' | 'READY'; stateId: TwoStrikeTier | null;
  reasons: readonly ('SOURCE_CHANGED' | 'MODEL_CHANGED' | 'ASSESSMENT_EXPIRED' | 'INSUFFICIENT_EVIDENCE' | 'INSUFFICIENT_FAILURE_EVIDENCE' | 'STALE_SOURCE')[];
  /** Retained for audit only when stale; status/stateId determine current applicability. */
  classification: TwoStrikeClassification | null;
}>;
export type TwoStrikeInputBundle = Readonly<{
  boundary: 'TWO_STRIKE_INPUT_ONLY'; frame: TwoStrikeFrame;
  /** Numeric values come from current source, never from named traits or negative tiers. */
  technical: CurrentTwoStrikeTechnique | null;
  learnedTechniques: readonly Readonly<{ familyId: TwoStrikeTechniqueId; acquired: boolean;
    masteryProof: TraitEvaluation | null; feasible: boolean; currentSource: TechniqueReference }>[];
  weakness: TwoStrikeWeaknessView;
  /** Exactly one gate result. Do not also apply pressure-trait bonuses. */
  emotion: EmotionInfluence;
}>;
