import { samePaOccupiedRunnerCatchResponseInput, type SamePaOccupiedRunnerCatchResponseRequest, type SamePaOccupiedRunnerCatchResponse, type SamePaOccupiedRunnerCatchMotionRequest } from './SamePlateAppearanceOccupiedRunnerCatchResponse';
import type { PrePlayDefensivePlan } from '../../core/sim/fielding/DefensiveDecision';
import type { BattedWorldScheduledFieldAcquisitionAdvance } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import type { BattedWorldScheduledFieldThrowAdvance, BattedWorldScheduledFieldThrowPlan } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import type { AcceptedActualFieldObservation, ActualFieldObservationReceipt } from './ActualFieldObservation';
import type { DefensiveExecutionCalculation } from './DefensiveExecutionCalculation';
import type { SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaDispatchMemberValid } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalFieldMotor } from './SamePlateAppearancePhysicalFieldMotor';
import type { SamePaCatchWorkReference } from './SamePlateAppearanceCatchWork';
import type { SamePaCatchObservationEvidence } from './SamePlateAppearanceCatchObservationFromSqlite';
import type { SamePaCatchDefenderResponse } from './SamePlateAppearanceCatchDefenderResponse';
import { samePaBatterCatchResponseInput, type SamePaBatterCatchResponseRequest, type SamePaBatterCatchResponse } from './SamePlateAppearanceBatterCatchResponse';
export type SamePaPhysicalFieldReference = SamePaReference<'pa_physical_v1_field_roots' | 'pa_physical_v1_field_steps'>;
type CalibrationReference = SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaPhysicalFieldAction =
  | SamePaOccupiedRunnerCatchResponseRequest | SamePaOccupiedRunnerCatchMotionRequest
  | SamePaBatterCatchResponseRequest
  | Readonly<{ kind: 'batter_catch_motion_v1'; responseReference: StepReference }>
  | Readonly<{ kind: 'retained_quantizer_checkpoint_v1' }>
  | Readonly<{ kind: 'batter_run_motion_v1'; planReference: SamePaReference<'world_batter_run_plans'>;
      stationaryHoldContinuations?: readonly Readonly<{ playerId: string; decisionReference: StepReference; throughTick: number }>[] }>
  | Readonly<{ kind: 'defender_observation_v1'; member: SamePaDispatchMember; calibrationReference: CalibrationReference;
      previousObservationReference: StepReference | null; view: AcceptedActualFieldObservation['view']; catchWorkReference?: SamePaCatchWorkReference }>
  | Readonly<{ kind: 'defender_decision_v1'; member: SamePaDispatchMember; calibrationReference: CalibrationReference;
      observationReference: StepReference; priorities: PrePlayDefensivePlan }>
  | Readonly<{ kind: 'defender_catch_response_v1'; member: SamePaDispatchMember; observationReference: StepReference;
      predecessorDecisionReference: StepReference; predecessorMotionReference: StepReference;
      policyDataReference: SamePaReference<'world_received_umpire_defender_policy_data'> | null; previousResponseReference: StepReference | null }>
  | Readonly<{ kind: 'defender_motion_v1'; selections: readonly Readonly<{ member: SamePaDispatchMember;
      decisionReference: StepReference; calibrationReference: CalibrationReference }>[] }>
  | Readonly<{ kind: 'throw_plan_v1'; member: SamePaDispatchMember; calibrationReference: CalibrationReference;
      receiverPlayerId: string; coverageThroughTick: number }>
  | Readonly<{ kind: 'throw_checkpoint_v1'; planReference: StepReference; throughElapsedSeconds: number }>
  | Readonly<{ kind: 'capture_checkpoint_v1'; candidateReference: SamePaPhysicalFieldReference; throughElapsedSeconds: number }>;
export type SamePaPhysicalFieldActionResult =
  | SamePaOccupiedRunnerCatchResponse
  | Readonly<{ kind: 'occupied_runner_catch_motion_v1'; responseReference: StepReference; playerId: string; coverageThroughTick: number; planThroughTick: number }>
  | SamePaBatterCatchResponse
  | Readonly<{ kind: 'batter_catch_motion_v1'; responseReference: StepReference; playerId: string;
      controllerSegmentIndex: number; coverageThroughTick: number; planThroughTick: number }>
  | Readonly<{ kind: 'retained_quantizer_checkpoint_v1'; boundary: import('../../core/sim/liveAction/QuantizerClosedGenerationBoundary').QuantizerClosedGenerationBoundary;
      status: 'checkpoint_reached' | 'physical_boundary' }>
  | SamePaCatchDefenderResponse
  | Readonly<{ kind: 'batter_run_motion_v1'; planReference: SamePaReference<'world_batter_run_plans'>; playerId: string;
      controllerSegmentIndex: number; coverageThroughTick: number; planThroughTick: number }>
  | Readonly<{ kind: 'defender_observation_v1'; playerId: string; samplingRequest: AcceptedActualFieldObservation; receipt: ActualFieldObservationReceipt;
      fieldingModelHash: string; catchCommunication?: SamePaCatchObservationEvidence }>
  | Readonly<{ kind: 'defender_decision_v1'; playerId: string; observationReference: StepReference;
      calculation: DefensiveExecutionCalculation; target: Readonly<{ x: number; z: number }> | null;
      availability: ActualFieldObservationReceipt['at']; fieldingModelHash: string }>
  | Readonly<{ kind: 'defender_motion_v1'; motors: readonly SamePaPhysicalFieldMotor[]; coverageThroughTick: number }>
  | Readonly<{ kind: 'throw_plan_v1'; plan: BattedWorldScheduledFieldThrowPlan; fieldingModelHash: string }>
  | Readonly<{ kind: 'throw_checkpoint_v1'; planReference: StepReference; progress: BattedWorldScheduledFieldThrowAdvance }>
  | Readonly<{ kind: 'capture_checkpoint_v1'; candidateReference: SamePaPhysicalFieldReference; progress: BattedWorldScheduledFieldAcquisitionAdvance }>;
const vector = (v: unknown) => fields(v, ['x', 'y', 'z']) && Object.values(v).every(Number.isFinite);
const unit = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const member = (value: unknown, calibrationReference: unknown) => samePaDispatchMemberValid(value)
  && ref(calibrationReference, 'pa_lifecycle_v1_execution_calibrations');
export const samePaPhysicalFieldActionInput = (a: SamePaPhysicalFieldAction): void => {
  if (a?.kind === 'occupied_runner_catch_response_v1') samePaOccupiedRunnerCatchResponseInput(a);
  else if (a?.kind === 'occupied_runner_catch_motion_v1') {
    if (!fields(a, ['kind','responseReference']) || !ref(a.responseReference, 'pa_physical_v1_field_steps')) throw new Error('invalid occupied received motor Source');
  } else if (a?.kind === 'batter_catch_response_v1') samePaBatterCatchResponseInput(a);
  else if (a?.kind === 'batter_catch_motion_v1') {
    if (!fields(a, ['kind', 'responseReference']) || !ref(a.responseReference, 'pa_physical_v1_field_steps')) throw new Error('invalid received batter motion Source');
  } else if (a?.kind === 'retained_quantizer_checkpoint_v1') {
    if (!fields(a, ['kind'])) throw new Error('invalid retained quantizer checkpoint Source');
  } else if (a?.kind === 'defender_observation_v1') {
    const v = a.view, target = v?.attentionTarget;
    if (!fields(a, ['kind', 'member', 'calibrationReference', 'previousObservationReference', 'view', ...('catchWorkReference' in a ? ['catchWorkReference'] : [])]) || !member(a.member, a.calibrationReference)
      || 'catchWorkReference' in a && !ref(a.catchWorkReference, 'pa_catch_v1_work')
      || a.previousObservationReference !== null && !ref(a.previousObservationReference, 'pa_physical_v1_field_steps')
      || !fields(v, ['poseVersion', 'bodyRelativeEyeOffset', 'forward', 'attentionTarget']) || !text(v.poseVersion)
      || !vector(v.bodyRelativeEyeOffset) || !vector(v.forward) || !Number.isFinite(Math.hypot(v.forward.x, v.forward.y, v.forward.z))
      || Math.hypot(v.forward.x, v.forward.y, v.forward.z) === 0
      || !(target?.kind === 'ball' && fields(target, ['kind']) || target?.kind === 'player' && fields(target, ['kind', 'playerId'])
        && text(target.playerId) && target.playerId !== a.member.playerId)) throw new Error('invalid physical field observation Source');
  } else if (a?.kind === 'defender_decision_v1') {
    const p = a.priorities;
    if (!fields(a, ['kind', 'member', 'calibrationReference', 'observationReference', 'priorities']) || !member(a.member, a.calibrationReference)
      || !ref(a.observationReference, 'pa_physical_v1_field_steps')
      || !fields(p, ['ballPursuitPriority', 'baseCoverPriorities', 'relayPriority', 'backupPriority', 'deepCoveragePriority', 'holdPriority'])
      || ![p.ballPursuitPriority, p.relayPriority, p.backupPriority, p.deepCoveragePriority, p.holdPriority].every(unit)
      || !Array.isArray(p.baseCoverPriorities) || new Set(p.baseCoverPriorities.map(b => b.base)).size !== p.baseCoverPriorities.length
      || p.baseCoverPriorities.some(b => !fields(b, ['base', 'priority']) || typeof b.base !== 'number' || ![1, 2, 3, 4].includes(b.base) || !unit(b.priority))) throw new Error('invalid physical field decision Source');
  } else if (a?.kind === 'defender_catch_response_v1') {
    if (!fields(a, ['kind', 'member', 'observationReference', 'predecessorDecisionReference', 'predecessorMotionReference', 'policyDataReference', 'previousResponseReference'])
      || !samePaDispatchMemberValid(a.member) || ![a.observationReference, a.predecessorDecisionReference, a.predecessorMotionReference].every(r => ref(r, 'pa_physical_v1_field_steps'))
      || a.policyDataReference !== null && !ref(a.policyDataReference, 'world_received_umpire_defender_policy_data')
      || a.previousResponseReference !== null && !ref(a.previousResponseReference, 'pa_physical_v1_field_steps')) throw new Error('invalid caught defender response Source');
  } else if (a?.kind === 'defender_motion_v1') {
    if (!fields(a, ['kind', 'selections']) || !Array.isArray(a.selections) || a.selections.length < 1 || a.selections.length > 9
      || new Set(a.selections.map(s => s.member?.playerId)).size !== a.selections.length
      || a.selections.some(s => !fields(s, ['member', 'decisionReference', 'calibrationReference']) || !member(s.member, s.calibrationReference)
        || !ref(s.decisionReference, 'pa_physical_v1_field_steps'))) throw new Error('invalid physical field motion Source');
  } else if (a?.kind === 'throw_plan_v1') {
    if (!fields(a, ['kind', 'member', 'calibrationReference', 'receiverPlayerId', 'coverageThroughTick']) || !member(a.member, a.calibrationReference)
      || !text(a.receiverPlayerId) || a.receiverPlayerId === a.member.playerId || !Number.isSafeInteger(a.coverageThroughTick)
      || a.coverageThroughTick < 0) throw new Error('invalid physical throw plan Source');
  } else if (a?.kind === 'throw_checkpoint_v1') {
    if (!fields(a, ['kind', 'planReference', 'throughElapsedSeconds']) || !ref(a.planReference, 'pa_physical_v1_field_steps')
      || !Number.isFinite(a.throughElapsedSeconds) || a.throughElapsedSeconds < 0) throw new Error('invalid physical throw checkpoint Source');
  } else if (a?.kind === 'capture_checkpoint_v1') {
    if (!fields(a, ['kind', 'candidateReference', 'throughElapsedSeconds'])
      || !(ref(a.candidateReference, 'pa_physical_v1_field_roots') || ref(a.candidateReference, 'pa_physical_v1_field_steps'))
      || !Number.isFinite(a.throughElapsedSeconds) || a.throughElapsedSeconds < 0) throw new Error('invalid physical capture Source');
  } else if (a?.kind === 'batter_run_motion_v1') {
    if (!fields(a, ['kind', 'planReference', ...('stationaryHoldContinuations' in a ? ['stationaryHoldContinuations'] : [])]) || !ref(a.planReference, 'world_batter_run_plans')
      || 'stationaryHoldContinuations' in a && (!Array.isArray(a.stationaryHoldContinuations) || a.stationaryHoldContinuations.length < 1 || a.stationaryHoldContinuations.length > 9
        || new Set(a.stationaryHoldContinuations.map(c => c.playerId)).size !== a.stationaryHoldContinuations.length
        || a.stationaryHoldContinuations.some(c => !fields(c, ['playerId', 'decisionReference', 'throughTick']) || !text(c.playerId)
          || !ref(c.decisionReference, 'pa_physical_v1_field_steps') || typeof c.throughTick !== 'number' || !Number.isSafeInteger(c.throughTick) || c.throughTick < 0))) throw new Error('invalid physical batter-run Source');
  } else throw new Error('unsupported physical field action');
};
