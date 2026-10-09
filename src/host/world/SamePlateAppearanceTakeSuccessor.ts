import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaNominalTakeInput, type AcceptedSamePaFirstPitchAction, type SamePaPhysicalSourceReference } from './SamePlateAppearanceDispatchSource';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, samePaDispatchRouteValid, type SamePaDispatchMember, type SamePaDispatchRoute } from './SamePlateAppearanceDispatchRoles';
import type { SamePaCompletedTakeCut } from './SamePlateAppearanceContinuation';
import type { SamePaNativePitchCalculation } from './SamePlateAppearanceDispatchExecution';
export type AcceptedSamePaNextTakeAction = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_next_take_action_v1';
  viewReference: SamePaReference<'pa_continuation_v1_execution_views'>; previousPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>;
  nominalPitch: AcceptedSamePaFirstPitchAction['nominalPitch']; timingReference: AcceptedSamePaFirstPitchAction['timingReference'];
  releaseReference: AcceptedSamePaFirstPitchAction['releaseReference']; pitchResponseReference: AcceptedSamePaFirstPitchAction['pitchResponseReference'];
  batterModelReference: AcceptedSamePaFirstPitchAction['batterModelReference'] }>;
export type SamePaNextTakeParticipant = Readonly<{ member: SamePaDispatchMember; calibrationReferences: readonly Readonly<{
  route: SamePaDispatchRoute; calibrationReference: SamePaReference<'pa_continuation_v1_execution_calibrations'> }>[] }>;
export type AcceptedSamePaRetainedTakeSetup = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_retained_take_setup_v1';
  actionReference: SamePaReference<'pa_take_successor_v1_action_plans'>; postureReference: SamePaReference<'batting_observation_v1_postures'>;
  nextPhysicalPitchSourceId: string; participantInputs: readonly SamePaNextTakeParticipant[] }>;
export type AcceptedSamePaSuccessorTakePitch = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_successor_take_pitch_v1';
  actionReference: SamePaReference<'pa_take_successor_v1_action_plans'>; setupReference: SamePaReference<'pa_take_successor_v1_setups'> }>;
export type SamePaTakeSuccessorSource = AcceptedSamePaNextTakeAction | AcceptedSamePaRetainedTakeSetup | AcceptedSamePaSuccessorTakePitch;
export type SamePaRetainedTakeBodyCut = Readonly<{ kind: 'retained_stationary_take_body_cut_v1'; completedAtTick: number;
  previousPhysicalCut: SamePaCompletedTakeCut; originalWorld: DurablePhysicalPlateAppearanceActor['world']; originalWorldHash: string }>;
export type SamePaNextTakeAction = Readonly<{ kind: 'next_take_action_prepared'; source: AcceptedSamePaNextTakeAction; lineage: SamePaExecutionLineage;
  originalActor: DurablePhysicalPlateAppearanceActor; bodyCut: SamePaRetainedTakeBodyCut;
  beforeTimeline: SamePaNativePitchCalculation['beforeTimeline']; nominalTimingHash: string; nominalReleaseHash: string; nominalBattingModelHash: string }>;
export type SamePaRetainedTakeSetup = Readonly<{ kind: 'retained_take_right_prepared'; source: AcceptedSamePaRetainedTakeSetup; lineage: SamePaExecutionLineage;
  viewReference: SamePaReference<'pa_continuation_v1_execution_views'>; expectedProgressRevision: 1; bodyCut: SamePaRetainedTakeBodyCut }>;
export type SamePaSuccessorPitchFrame = Omit<SamePaNativePitchCalculation['frame'], 'kind' | 'viewReference'> & Readonly<{
  kind: 'nonempty_same_pa_pitch_frame_v1'; viewReference: SamePaReference<'pa_continuation_v1_execution_views'>; bodyCut: SamePaRetainedTakeBodyCut }>;
export type SamePaSuccessorTakePitch = Readonly<{ kind: 'same_pa_successor_take_executed_v1'; source: AcceptedSamePaSuccessorTakePitch;
  lineage: SamePaExecutionLineage; viewReference: SamePaReference<'pa_continuation_v1_execution_views'>; progressRevision: 2;
  previousPitchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>; originalActor: DurablePhysicalPlateAppearanceActor; frame: SamePaSuccessorPitchFrame;
  beforeTimeline: SamePaNativePitchCalculation['beforeTimeline']; result: SamePaNativePitchCalculation['calculation'];
  consumerReference: SamePaReference<'pa_take_successor_v1_consumer_actions'> }>;
export type SamePaSuccessorConsumer = Readonly<{ kind: 'same_pa_successor_pitch_invoked_v1'; source: Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'same_pa_successor_pitch_consumer_v1'; physicalSourceReference: SamePaPhysicalSourceReference;
  setupReference: SamePaReference<'pa_take_successor_v1_setups'>; actionReference: SamePaReference<'pa_take_successor_v1_action_plans'>;
  calibrationReference: SamePaReference<'pa_continuation_v1_execution_calibrations'>; member: SamePaDispatchMember }>;
  lineage: SamePaExecutionLineage; viewReference: SamePaReference<'pa_continuation_v1_execution_views'>; frame: SamePaSuccessorPitchFrame;
  beforeTimeline: SamePaNativePitchCalculation['beforeTimeline']; calculation: SamePaNativePitchCalculation['calculation'] }>;
export const samePaTakeSuccessorSourceInput = (raw: unknown, id?: string): SamePaTakeSuccessorSource => {
  const s = cloneInert(raw) as SamePaTakeSuccessorSource;
  if (!s || !text(s.sourceId) || !text(s.sourceVersion) || id !== undefined && s.sourceId !== id) throw new Error('invalid next TAKE Source');
  if (s.capability === 'same_pa_next_take_action_v1') {
    if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'viewReference', 'previousPitchReference', 'nominalPitch', 'timingReference', 'releaseReference', 'pitchResponseReference', 'batterModelReference'])
      || !ref(s.viewReference, 'pa_continuation_v1_execution_views') || !ref(s.previousPitchReference, 'pa_dispatch_v1_pitch_actions')
      || !(ref(s.timingReference, 'world_pitch_timing_baselines') || ref(s.timingReference, 'world_pitch_timing_updates'))
      || !(ref(s.releaseReference, 'world_player_release_baselines') || ref(s.releaseReference, 'world_player_release_changes'))
      || !ref(s.pitchResponseReference, 'world_pitch_fatigue_policies') || !ref(s.batterModelReference, 'world_player_batting_models')) throw new Error('invalid next TAKE action references');
    samePaNominalTakeInput(s.nominalPitch);
  } else if (s.capability === 'same_pa_retained_take_setup_v1') {
    if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'actionReference', 'postureReference', 'nextPhysicalPitchSourceId', 'participantInputs'])
      || !ref(s.actionReference, 'pa_take_successor_v1_action_plans') || !ref(s.postureReference, 'batting_observation_v1_postures') || !text(s.nextPhysicalPitchSourceId)
      || !Array.isArray(s.participantInputs) || s.participantInputs.length !== 10 || new Set(s.participantInputs.map(p => p.member?.playerId)).size !== 10
      || s.participantInputs.some(p => !fields(p, ['member', 'calibrationReferences']) || !samePaDispatchMemberValid(p.member) || !Array.isArray(p.calibrationReferences)
        || p.calibrationReferences.some(c => !fields(c, ['route', 'calibrationReference']) || !samePaDispatchRouteValid(c.route) || !ref(c.calibrationReference, 'pa_continuation_v1_execution_calibrations')))
      || s.participantInputs.flatMap(p => p.calibrationReferences).length !== 32
      || new Set(s.participantInputs.flatMap(p => p.calibrationReferences.map((c: SamePaNextTakeParticipant['calibrationReferences'][number]) => c.calibrationReference.sourceId))).size !== 32) throw new Error('invalid retained TAKE setup/32 references');
  } else if (s.capability === 'same_pa_successor_take_pitch_v1') {
    if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'actionReference', 'setupReference']) || !ref(s.actionReference, 'pa_take_successor_v1_action_plans')
      || !ref(s.setupReference, 'pa_take_successor_v1_setups')) throw new Error('invalid successor TAKE physical Source');
  } else throw new Error('unsupported next TAKE Source');
  return freeze(s);
};

export type SamePaSuccessorReceipt = Readonly<{ kind: 'same_pa_successor_consumption_v1' | 'same_pa_successor_admission_v1';
  source: Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_successor_consumption_v1' | 'same_pa_successor_admission_v1';
    setupReference: SamePaReference<'pa_take_successor_v1_setups'>; physicalSourceReference: SamePaPhysicalSourceReference }>;
  lineage: SamePaExecutionLineage; viewReference: SamePaReference<'pa_continuation_v1_execution_views'>;
  pitchReference: SamePaReference<'pa_take_successor_v1_pitch_actions'>; consumerReference: SamePaReference<'pa_take_successor_v1_consumer_actions'> }>;
export type SamePaTakePitchBundle = Readonly<{ action: SamePaNextTakeAction; setup: SamePaRetainedTakeSetup; consumer: SamePaSuccessorConsumer;
  pitch: SamePaSuccessorTakePitch; consumption: SamePaSuccessorReceipt; admission: SamePaSuccessorReceipt }>;
