import type { BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { BattedWorldPiecewiseFieldAcquisitionPlan, BattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import type { BattedWorldPiecewiseFieldThrowPlan, BattedWorldPiecewiseFieldThrowProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';
import type { PiecewiseFieldMotionStep } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import type { OwnedMotionContribution, OwnedMotionComposition, OwnedMotionAdoption } from './OwnedBattedWorldMotion';
import type { OwnedMotionKnownWork } from './OwnedMotionKnownWorkFromSqlite';
import type { DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

export type OwnedAcquisitionPlanAction = Readonly<{ kind: 'owned_acquisition_plan_v1'; knownWork: readonly OwnedMotionKnownWork[] }>;
export type OwnedThrowPlanAction = Readonly<{ kind: 'owned_throw_plan_v1'; modelSourceId: string; receiverPlayerId: string;
  knownWork: readonly OwnedMotionKnownWork[] }>;
export type OwnedMotionV2Action = Readonly<{ kind: 'owned_motion_v2';
  checkpoint: Readonly<{ kind: 'motion'; throughTick: number }>
    | Readonly<{ kind: 'retained_quantizer_bucket_v1'; throughTick: number }>
    | Readonly<{ kind: 'operation'; planSourceId: string; throughElapsedSeconds: number }>;
  contributions: readonly OwnedMotionContribution[]; knownWork: readonly OwnedMotionKnownWork[] }>;
export type OwnedScheduledMotionAction = OwnedAcquisitionPlanAction | OwnedThrowPlanAction | OwnedMotionV2Action;
export type OwnedScheduledMotionComposition = Omit<OwnedMotionComposition,
  'version' | 'requestedCheckpointThroughTick' | 'checkpointThroughTick' | 'contributors'> & Readonly<{
    contributors: readonly (OwnedMotionComposition['contributors'][number] & Readonly<{ motorCutProof: import('./OwnedScheduledMotionMotorCut').OwnedScheduledMotionMotorCutProof | null }>)[];
    version: 'owned_motion_composition_v2'; requestedCheckpoint: OwnedMotionV2Action['checkpoint']; checkpointThroughElapsedSeconds: number;
    /** Arithmetic goal only, present exclusively for retained_quantizer_bucket_v1. */
    quantizerBoundary?: import('../../core/sim/liveAction/QuantizerClosedGenerationBoundary').QuantizerClosedGenerationBoundary;
  }>;
export type OwnedScheduledMotionAdoption = Omit<OwnedMotionAdoption,
  'version' | 'requestedCheckpointThroughTick' | 'checkpointThroughTick' | 'status'> & Readonly<{
    version: 'owned_motion_adoption_v2'; requestedCheckpoint: OwnedMotionV2Action['checkpoint']; checkpointThroughElapsedSeconds: number;
    status: 'checkpoint_reached' | 'physical_boundary' | 'coverage_exhausted' | 'operation_milestone' | 'decision_boundary';
  }>;
export type OwnedScheduledMotionReference = Readonly<{ sourceId: string; sourceHash: string; snapshotHash: string }>;
export type OwnedScheduledMotionOperation = Readonly<{
  planSourceId: string; planReference: OwnedScheduledMotionReference;
  /** A manifest of immutable earlier physical step identities, never nested snapshots. */
  previousSteps: readonly OwnedScheduledMotionReference[];
  /** This exact input was mechanically derived from the current complete composition. */
  step: PiecewiseFieldMotionStep;
  bridge: Readonly<{ legacyPlanReference: OwnedScheduledMotionReference; previousAdvanceReference: OwnedScheduledMotionReference | null }> | null;
}> & (Readonly<{ kind: 'acquisition'; plan: BattedWorldPiecewiseFieldAcquisitionPlan; progress: BattedWorldPiecewiseFieldAcquisitionProgress }>
  | Readonly<{ kind: 'throw'; plan: BattedWorldPiecewiseFieldThrowPlan; progress: BattedWorldPiecewiseFieldThrowProgress }>);
export type OwnedScheduledMotionExecution = Readonly<{ kind: 'owned_acquisition_plan_v1'; field: BattedWorldFieldMotion;
  plan: BattedWorldPiecewiseFieldAcquisitionPlan }>
  | Readonly<{ kind: 'owned_throw_plan_v1'; field: BattedWorldFieldMotion; model: DurablePlayerFieldingModel; plan: BattedWorldPiecewiseFieldThrowPlan }>
  | Readonly<{ kind: 'owned_motion_v2'; field: BattedWorldFieldMotion; composition: OwnedScheduledMotionComposition;
    adoption: OwnedScheduledMotionAdoption; operation: OwnedScheduledMotionOperation | null;
    liveWork: import('./OwnedScheduledMotionLiveWork').OwnedScheduledMotionLiveWork }>;
export const isOwnedScheduledMotionKind = (kind: string): kind is OwnedScheduledMotionAction['kind'] =>
  kind === 'owned_motion_v2' || kind === 'owned_acquisition_plan_v1' || kind === 'owned_throw_plan_v1';

import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { ownedMotionV2ContributionsInput } from './OwnedBattedWorldMotion';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const id = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && JSON.stringify(Object.keys(v).sort()) === JSON.stringify([...names].sort());
export const ownedScheduledMotionActionInput = (raw: OwnedScheduledMotionAction): OwnedScheduledMotionAction => {
  const action = cloneInert(raw);
  if (!Array.isArray(action.knownWork) || action.knownWork.length !== 10 || new Set(action.knownWork.map(w => w.playerId)).size !== 10
    || action.knownWork.some(w => !fields(w, ['playerId', 'decisionSourceId', 'motorSourceId']) || !id(w.playerId)
      || w.decisionSourceId !== null && !id(w.decisionSourceId) || w.motorSourceId !== null && !id(w.motorSourceId))) {
    throw new Error('invalid owned scheduled motion known-work Source');
  }
  if (action.kind === 'owned_acquisition_plan_v1') {
    if (!fields(action, ['kind', 'knownWork'])) throw new Error('invalid owned acquisition plan Source');
  } else if (action.kind === 'owned_throw_plan_v1') {
    if (!fields(action, ['kind', 'modelSourceId', 'receiverPlayerId', 'knownWork']) || !id(action.modelSourceId)
      || !id(action.receiverPlayerId)) throw new Error('invalid owned throw plan Source');
  } else if (action.kind === 'owned_motion_v2') {
    const c = action.checkpoint;
    if (!fields(action, ['kind', 'checkpoint', 'contributions', 'knownWork']) || !c
      || !(c.kind === 'motion' && fields(c, ['kind', 'throughTick']) && tick(c.throughTick))
      && !(c.kind === 'retained_quantizer_bucket_v1' && fields(c, ['kind', 'throughTick']) && tick(c.throughTick))
      && !(c.kind === 'operation' && fields(c, ['kind', 'planSourceId', 'throughElapsedSeconds']) && id(c.planSourceId)
        && Number.isFinite(c.throughElapsedSeconds) && c.throughElapsedSeconds >= 0)) throw new Error('invalid owned motion v2 checkpoint Source');
    ownedMotionV2ContributionsInput({ contributions: action.contributions, knownWork: action.knownWork });
    if (c.kind === 'retained_quantizer_bucket_v1' && action.contributions.some(v => v.kind !== 'retained')) {
      throw new Error('retained quantizer checkpoint admits no motor adoption');
    }
  } else throw new Error('unsupported owned scheduled motion Source');
  return freeze(action);
};
