import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { samePaOccupiedRunnerHoldReferencesValid } from './SamePlateAppearanceOccupiedRunnerHold';
import type { WorkloadBoundPlayerPitchRequest } from './WorkloadBoundPlayerPitchRuntime';
import type { TakePitchAgainstBatterInput } from '../../core/sim/pitching/PitchAgainstBatter';
import { createPlayerObservationCalibration, type PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { createPlayerDecisionCalibration, type PlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import { createPlayerLocomotionCalibration, type PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import type { AcceptedBattingCapability, AcceptedBattingRepertoire, AcceptedBattingDecisionModel, AcceptedBattingObservationCalibration } from './PlayerBattingModel';
import { battingCapabilityValuesInput, battingRepertoireValuesInput, battingDecisionValuesInput, battingObservationValuesInput } from './PlayerBattingExecutionCalibration';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as referenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, samePaDispatchRouteValid, samePaDispatchParticipantInputs,
  type SamePaDispatchMember, type SamePaDispatchRoute, type SamePaDispatchParticipantInput } from './SamePlateAppearanceDispatchRoles';

export type SamePaTimingReference = SamePaReference<'world_pitch_timing_baselines' | 'world_pitch_timing_updates'>;
export type SamePaReleaseReference = SamePaReference<'world_player_release_baselines' | 'world_player_release_changes'>;
export type SamePaDispatchBase = Readonly<{ sourceId: string; sourceVersion: string;
  enrollmentReference: SamePaReference<'same_pa_enrollments'>; viewReference: SamePaReference<'reserved_pa_execution_views'>;
  firstPhysicalPitchSourceId: string }>;
export type AcceptedSamePaFirstPitchAction = SamePaDispatchBase & Readonly<{
  capability: 'same_pa_first_pitch_action_v1'; variant: 'declared_take_v1'; pitcherPlayerId: string; batterPlayerId: string;
  nominalPitch: Readonly<{ delivery: Pick<WorkloadBoundPlayerPitchRequest['delivery'],
    'matchSeed' | 'moundReference' | 'outingId' | 'readyAtUs' | 'timingIntent' | 'physics'>;
    flight: WorkloadBoundPlayerPitchRequest['flight']; batter: Omit<TakePitchAgainstBatterInput, 'trajectory'> }>;
  timingReference: SamePaTimingReference; releaseReference: SamePaReleaseReference;
  pitchResponseReference: SamePaReference<'world_pitch_fatigue_policies'>; batterModelReference: SamePaReference<'world_player_batting_models'>;
  geometryReference: Readonly<{ kind: 'action_source_take_geometry_v1' }>;
  occupiedRunnerHoldReferences?: readonly SamePaReference<'world_same_pa_occupied_runner_holds'>[];
}>;
type ExecutionValues = {
  batter_observation: AcceptedBattingObservationCalibration['values']; batter_decision: AcceptedBattingDecisionModel['values'];
  batter_motor: AcceptedBattingCapability['values']; batter_swing: AcceptedBattingRepertoire['values'];
  defender_observation: PlayerObservationCalibration; defender_decision: PlayerDecisionCalibration; defender_locomotion: PlayerLocomotionCalibration;
};
type NominalOwner = {
  pitch_delivery: SamePaTimingReference['owner']; batter_observation: 'world_player_batting_models'; batter_decision: 'world_player_batting_models';
  batter_motor: 'world_player_batting_models'; batter_swing: 'world_player_batting_models';
  defender_observation: 'world_player_observation_models'; defender_decision: 'world_player_decision_models'; defender_locomotion: 'world_player_locomotion_models';
};
const parameterKeys = Object.freeze({ batter_observation: 'observationCalibration', batter_decision: 'decisionModel',
  batter_motor: 'capability', batter_swing: 'repertoire' } as const);
type BattingRoute = keyof typeof parameterKeys;
export type SamePaNominalParameterReference<R extends BattingRoute = BattingRoute> = Readonly<{
  parameterKey: typeof parameterKeys[R]; sourceId: string; sourceVersion: string; sourceHash: string }>;
export type AcceptedSamePaExecutionCalibration = { [R in SamePaDispatchRoute]: SamePaDispatchBase & Readonly<{
  capability: 'same_pa_execution_calibration_v1'; member: SamePaDispatchMember; route: R; nominalReference: SamePaReference<NominalOwner[R]>;
  nominalParameterReference: R extends BattingRoute ? SamePaNominalParameterReference<R> : null;
  acceptedAtDay: number; provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
  response: R extends 'pitch_delivery' ? Readonly<{ kind: 'accepted_pitch_response_v1'; policyReference: SamePaReference<'world_pitch_fatigue_policies'> }>
    : Readonly<{ kind: 'accepted_execution_values_v1'; values: ExecutionValues[Exclude<R, 'pitch_delivery'>] }>;
}> }[SamePaDispatchRoute];
export type AcceptedSamePaConsumerSet = SamePaDispatchBase & Readonly<{ capability: 'same_pa_consumer_set_v1';
  actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>; participantInputs: readonly SamePaDispatchParticipantInput[] }>;
export type AcceptedSamePaFirstPitchEpisode = SamePaDispatchBase & Readonly<{ capability: 'same_pa_first_pitch_episode_v1';
  actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>; consumerSetReference: SamePaReference<'pa_dispatch_v1_consumer_sets'> }>;
export type AcceptedSamePaFirstPitchRight = SamePaDispatchBase & Readonly<{ capability: 'same_pa_first_pitch_right_v1';
  prefixReference: SamePaReference<'reserved_pa_work_prefixes'>; actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>;
  consumerSetReference: SamePaReference<'pa_dispatch_v1_consumer_sets'>; episodeReference: SamePaReference<'pa_dispatch_v1_episodes'> }>;
export type AcceptedSamePaPhysicalPitch = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_physical_pitch_v1';
  rightReference: SamePaReference<'pa_dispatch_v1_rights'>; actionReference: SamePaReference<'pa_dispatch_v1_action_plans'> }>;
/** A prospective physical Source reference deliberately has no result hash. */
export type SamePaPhysicalSourceReference = Readonly<{ sourceId: string; sourceVersion: string; sourceHash: string }>;
export type SamePaDerivedConsumption = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_consumption_v1';
  rightReference: SamePaReference<'pa_dispatch_v1_rights'>; episodeReference: SamePaReference<'pa_dispatch_v1_episodes'>;
  physicalSourceReference: SamePaPhysicalSourceReference }>;
export type SamePaDerivedEpisodeAdmission = Omit<SamePaDerivedConsumption, 'capability'> & Readonly<{ capability: 'same_pa_episode_admission_v1' }>;
/** Consumer-action operation payloads are deliberately unexposed until each
 * concrete adapter has its exact Core input union. There is no generic bag. */
export type SamePaDispatchSource = AcceptedSamePaFirstPitchAction | AcceptedSamePaExecutionCalibration | AcceptedSamePaConsumerSet
  | AcceptedSamePaFirstPitchEpisode | AcceptedSamePaFirstPitchRight | AcceptedSamePaPhysicalPitch | SamePaDerivedConsumption | SamePaDerivedEpisodeAdmission;

const baseFields = ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'viewReference', 'firstPhysicalPitchSourceId'];
const fail = (): never => { throw new Error('invalid same-PA dispatch Source'); };
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const timingRef = (v: unknown) => referenceValid(v, 'world_pitch_timing_baselines') || referenceValid(v, 'world_pitch_timing_updates');
const releaseRef = (v: unknown) => referenceValid(v, 'world_player_release_baselines') || referenceValid(v, 'world_player_release_changes');
const vector = (v: unknown) => fields(v, ['x', 'y', 'z']) && Object.values(v).every(n => typeof n === 'number' && Number.isFinite(n));
const baseValid = (s: SamePaDispatchBase, extra: readonly string[]) => fields(s, [...baseFields, ...extra])
  && referenceValid(s.enrollmentReference, 'same_pa_enrollments') && referenceValid(s.viewReference, 'reserved_pa_execution_views') && text(s.firstPhysicalPitchSourceId);
const actionValid = (s: AcceptedSamePaFirstPitchAction): boolean => {
  if (!baseValid(s, ['variant', 'pitcherPlayerId', 'batterPlayerId', 'nominalPitch', 'timingReference', 'releaseReference',
    'pitchResponseReference', 'batterModelReference', 'geometryReference', ...('occupiedRunnerHoldReferences' in s ? ['occupiedRunnerHoldReferences'] : [])]) || s.variant !== 'declared_take_v1'
    || 'occupiedRunnerHoldReferences' in s && !samePaOccupiedRunnerHoldReferencesValid(s.occupiedRunnerHoldReferences)
    || !text(s.pitcherPlayerId) || !text(s.batterPlayerId) || s.pitcherPlayerId === s.batterPlayerId
    || !timingRef(s.timingReference) || !releaseRef(s.releaseReference) || !referenceValid(s.pitchResponseReference, 'world_pitch_fatigue_policies')
    || !referenceValid(s.batterModelReference, 'world_player_batting_models') || !fields(s.geometryReference, ['kind'])
    || s.geometryReference.kind !== 'action_source_take_geometry_v1' || !fields(s.nominalPitch, ['delivery', 'flight', 'batter'])) return false;
  return nominalTakeValid(s.nominalPitch);
};
const nominalTakeValid = (pitch: AcceptedSamePaFirstPitchAction['nominalPitch']): boolean => {
  if (!fields(pitch, ['delivery', 'flight', 'batter'])) return false;
  const { delivery: d, flight: f, batter: b } = pitch;
  if (!fields(d, ['matchSeed', 'moundReference', 'outingId', 'readyAtUs', 'timingIntent', 'physics'])
    || !integer(d.matchSeed) || d.matchSeed > 0xffff_ffff || !vector(d.moundReference) || !text(d.outingId) || !integer(d.readyAtUs)
    || !fields(d.timingIntent, ['deliveryMode', 'cadenceIntent'])
    || !['NORMAL', 'QUICK'].includes(d.timingIntent.deliveryMode) || !['STANDARD', 'DELIBERATE'].includes(d.timingIntent.cadenceIntent)
    || !fields(d.physics, ['velocity', 'spin']) || !vector(d.physics.velocity) || !vector(d.physics.spin)
    || !fields(f, ['durationUs', 'acceleration']) || !integer(f.durationUs) || f.durationUs === 0 || !vector(f.acceleration)
    || !fields(b, ['action', 'plateZ', 'strikeZone', 'ballRadiusMeters']) || !fields(b.action, ['kind']) || b.action.kind !== 'take'
    || !Number.isFinite(b.plateZ) || !positive(b.ballRadiusMeters) || !fields(b.strikeZone, ['centerX', 'halfWidth', 'lowerY', 'upperY'])) return false;
  const z = b.strikeZone;
  return [z.centerX, z.lowerY, z.upperY].every(Number.isFinite) && positive(z.halfWidth) && z.upperY > z.lowerY;
};
export const samePaNominalTakeInput = (raw: unknown): AcceptedSamePaFirstPitchAction['nominalPitch'] => {
  const pitch = cloneInert(raw) as AcceptedSamePaFirstPitchAction['nominalPitch'];
  if (!nominalTakeValid(pitch)) throw new Error('invalid explicit same-PA nominal TAKE input'); return freeze(pitch);
};

const calibrationValid = (s: AcceptedSamePaExecutionCalibration): boolean => {
  if (!baseValid(s, ['member', 'route', 'nominalReference', 'nominalParameterReference', 'acceptedAtDay', 'provenance', 'response'])
    || !samePaDispatchMemberValid(s.member) || !samePaDispatchRouteValid(s.route) || !integer(s.acceptedAtDay)
    || !fields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(s.provenance).every(text)) return false;
  if (s.route === 'pitch_delivery') return timingRef(s.nominalReference) && s.nominalParameterReference === null
    && fields(s.response, ['kind', 'policyReference']) && s.response.kind === 'accepted_pitch_response_v1'
    && referenceValid(s.response.policyReference, 'world_pitch_fatigue_policies');
  const parameterKey = Object.hasOwn(parameterKeys, s.route) ? parameterKeys[s.route as BattingRoute] : null;
  if (parameterKey !== null) {
    const p = s.nominalParameterReference;
    if (!referenceValid(s.nominalReference, 'world_player_batting_models') || !fields(p, ['parameterKey', 'sourceId', 'sourceVersion', 'sourceHash'])
      || p.parameterKey !== parameterKey || !text(p.sourceId) || !text(p.sourceVersion) || !samePaHash(p.sourceHash)) return false;
  } else {
    const owner = s.route === 'defender_observation' ? 'world_player_observation_models'
      : s.route === 'defender_decision' ? 'world_player_decision_models' : 'world_player_locomotion_models';
    if (s.nominalParameterReference !== null || !referenceValid(s.nominalReference, owner)) return false;
  }
  if (!fields(s.response, ['kind', 'values']) || s.response.kind !== 'accepted_execution_values_v1') return false;
  switch (s.route) {
    case 'batter_observation': battingObservationValuesInput(s.response.values); break;
    case 'batter_decision': battingDecisionValuesInput(s.response.values); break;
    case 'batter_motor': battingCapabilityValuesInput(s.response.values); break;
    case 'batter_swing': battingRepertoireValuesInput(s.response.values); break;
    case 'defender_observation': createPlayerObservationCalibration(s.response.values); break;
    case 'defender_decision': createPlayerDecisionCalibration(s.response.values); break;
    case 'defender_locomotion': createPlayerLocomotionCalibration(s.response.values); break;
  }
  return true;
};

/** Shape/domain validation only: it does not authenticate owners or admit work. */
export const samePaDispatchSourceInput = (raw: unknown, sourceId?: string): SamePaDispatchSource => {
  const s = cloneInert(raw) as SamePaDispatchSource;
  if (!s || !text(s.sourceId) || !text(s.sourceVersion) || sourceId !== undefined && s.sourceId !== sourceId) fail();
  let valid = false;
  switch (s.capability) {
    case 'same_pa_first_pitch_action_v1': valid = actionValid(s); break;
    case 'same_pa_execution_calibration_v1': valid = calibrationValid(s); break;
    case 'same_pa_consumer_set_v1':
      valid = baseValid(s, ['actionReference', 'participantInputs']) && referenceValid(s.actionReference, 'pa_dispatch_v1_action_plans');
      if (valid) samePaDispatchParticipantInputs(s.participantInputs); break;
    case 'same_pa_first_pitch_episode_v1':
      valid = baseValid(s, ['actionReference', 'consumerSetReference']) && referenceValid(s.actionReference, 'pa_dispatch_v1_action_plans')
        && referenceValid(s.consumerSetReference, 'pa_dispatch_v1_consumer_sets'); break;
    case 'same_pa_first_pitch_right_v1':
      valid = baseValid(s, ['prefixReference', 'actionReference', 'consumerSetReference', 'episodeReference'])
        && referenceValid(s.prefixReference, 'reserved_pa_work_prefixes') && referenceValid(s.actionReference, 'pa_dispatch_v1_action_plans')
        && referenceValid(s.consumerSetReference, 'pa_dispatch_v1_consumer_sets') && referenceValid(s.episodeReference, 'pa_dispatch_v1_episodes'); break;
    case 'same_pa_physical_pitch_v1':
      valid = fields(s, ['sourceId', 'sourceVersion', 'capability', 'rightReference', 'actionReference'])
        && referenceValid(s.rightReference, 'pa_dispatch_v1_rights') && referenceValid(s.actionReference, 'pa_dispatch_v1_action_plans'); break;
    case 'same_pa_consumption_v1': case 'same_pa_episode_admission_v1':
      valid = fields(s, ['sourceId', 'sourceVersion', 'capability', 'rightReference', 'episodeReference', 'physicalSourceReference'])
        && referenceValid(s.rightReference, 'pa_dispatch_v1_rights') && referenceValid(s.episodeReference, 'pa_dispatch_v1_episodes')
        && fields(s.physicalSourceReference, ['sourceId', 'sourceVersion', 'sourceHash']) && text(s.physicalSourceReference.sourceId)
        && text(s.physicalSourceReference.sourceVersion) && samePaHash(s.physicalSourceReference.sourceHash); break;
  }
  if (!valid) fail(); return freeze(s);
};

export type SamePaDispatchBasis = Pick<SamePaDispatchBase, 'enrollmentReference' | 'viewReference' | 'firstPhysicalPitchSourceId'> & Readonly<{ gameDay?: number }>;
/** Exact equality with an owner's separately authenticated immutable basis. */
export const assertSamePaDispatchSourceBasis = (rawSource: unknown, rawBasis: SamePaDispatchBasis): void => {
  const s = samePaDispatchSourceInput(rawSource), basis = cloneInert(rawBasis);
  if (!('enrollmentReference' in s) || !basis || !referenceValid(basis.enrollmentReference, 'same_pa_enrollments')
    || !referenceValid(basis.viewReference, 'reserved_pa_execution_views') || !text(basis.firstPhysicalPitchSourceId)
    || json(s.enrollmentReference) !== json(basis.enrollmentReference) || json(s.viewReference) !== json(basis.viewReference)
    || s.firstPhysicalPitchSourceId !== basis.firstPhysicalPitchSourceId
    || s.capability === 'same_pa_execution_calibration_v1' && (!integer(basis.gameDay) || s.acceptedAtDay > basis.gameDay)) {
    throw new Error('same-PA dispatch Source basis or acceptance day differs');
  }
};
