import type { PrePlayDefensivePlan } from '../../core/sim/fielding/DefensiveDecision';
import type { BattedWorldScheduledFieldAcquisitionAdvance } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import type { BattedWorldScheduledFieldThrowAdvance, BattedWorldScheduledFieldThrowPlan } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import type { AcceptedActualFieldObservation, ActualFieldObservationReceipt } from './ActualFieldObservation';
import type { DefensiveExecutionCalculation } from './DefensiveExecutionCalculation';
import type { SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaDispatchMemberValid } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalFieldMotor } from './SamePlateAppearancePhysicalFieldMotor';
export type SamePaPhysicalFieldReference = SamePaReference<'pa_physical_v1_field_roots' | 'pa_physical_v1_field_steps'>;
type CalibrationReference = SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaPhysicalFieldAction =
  | Readonly<{ kind: 'defender_observation_v1'; member: SamePaDispatchMember; calibrationReference: CalibrationReference;
      previousObservationReference: StepReference | null; view: AcceptedActualFieldObservation['view'] }>
  | Readonly<{ kind: 'defender_decision_v1'; member: SamePaDispatchMember; calibrationReference: CalibrationReference;
      observationReference: StepReference; priorities: PrePlayDefensivePlan }>
  | Readonly<{ kind: 'defender_motion_v1'; selections: readonly Readonly<{ member: SamePaDispatchMember;
      decisionReference: StepReference; calibrationReference: CalibrationReference }>[] }>
  | Readonly<{ kind: 'throw_plan_v1'; member: SamePaDispatchMember; calibrationReference: CalibrationReference;
      receiverPlayerId: string; coverageThroughTick: number }>
  | Readonly<{ kind: 'throw_checkpoint_v1'; planReference: StepReference; throughElapsedSeconds: number }>
  | Readonly<{ kind: 'capture_checkpoint_v1'; candidateReference: SamePaPhysicalFieldReference; throughElapsedSeconds: number }>;
export type SamePaPhysicalFieldActionResult =
  | Readonly<{ kind: 'defender_observation_v1'; playerId: string; samplingRequest: AcceptedActualFieldObservation; receipt: ActualFieldObservationReceipt; fieldingModelHash: string }>
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
  if (a?.kind === 'defender_observation_v1') {
    const v = a.view, target = v?.attentionTarget;
    if (!fields(a, ['kind', 'member', 'calibrationReference', 'previousObservationReference', 'view']) || !member(a.member, a.calibrationReference)
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
  } else throw new Error('unsupported physical field action');
};
