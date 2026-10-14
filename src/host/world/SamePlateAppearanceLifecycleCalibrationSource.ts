import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { createPlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import { createPlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import { resolveBallTransferTiming } from '../../core/sim/fielding/BallTransferTiming';
import type { AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { battingCapabilityValuesInput, battingRepertoireValuesInput, battingDecisionValuesInput, battingObservationValuesInput } from './PlayerBattingExecutionCalibration';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as ref, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, samePaDispatchRouteValid } from './SamePlateAppearanceDispatchRoles';
import type { AcceptedSamePaExecutionCalibration } from './SamePlateAppearanceDispatchSource';
type Lifecycle<C> = C extends AcceptedSamePaExecutionCalibration ? Omit<C, 'capability' | 'viewReference'> & Readonly<{
  capability: 'same_pa_lifecycle_execution_calibration_v1'; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'> }> : never;
export type SamePaFieldThrowValues = Pick<AcceptedPlayerFieldingModel, 'transferParameters' | 'throwCalibration'>;
/** Optional current-cut preparation. The historical all32 dispatch set is unchanged. */
export type AcceptedSamePaLifecycleThrowCalibration = Omit<Lifecycle<Extract<AcceptedSamePaExecutionCalibration, { route: 'defender_locomotion' }>>,
  'route' | 'nominalReference' | 'response'> & Readonly<{ route: 'defender_throw'; nominalReference: SamePaReference<'world_player_fielding_models'>;
    response: Readonly<{ kind: 'accepted_execution_values_v1'; values: SamePaFieldThrowValues }> }>;
export type AcceptedSamePaLifecycleCalibration = Lifecycle<AcceptedSamePaExecutionCalibration> | AcceptedSamePaLifecycleThrowCalibration;
export type SamePaLifecycleCalibration = Readonly<{ kind: 'same_pa_lifecycle_calibration'; source: AcceptedSamePaLifecycleCalibration;
  lineage: SamePaExecutionLineage; nominalInputHash: string; effectiveResponseHash: string }>;
const keys = { batter_observation: 'observationCalibration', batter_decision: 'decisionModel', batter_motor: 'capability', batter_swing: 'repertoire' } as const;
export const samePaFieldThrowValuesInput = (values: SamePaFieldThrowValues): void => {
  const transfer = values?.transferParameters, c = values?.throwCalibration;
  if (!fields(values, ['transferParameters', 'throwCalibration'])
    || !fields(transfer, ['minimumTransferDelayTicks', 'maximumTransferDelayTicks', 'fixedGripOffsetTicks'])
    || !fields(c, ['minimumReleaseSpeedMps', 'maximumReleaseSpeedMps', 'minimumTargetErrorMeters', 'maximumTargetErrorMeters'])
    || !Object.values(c).every(Number.isFinite) || c.minimumReleaseSpeedMps <= 0 || c.maximumReleaseSpeedMps < c.minimumReleaseSpeedMps
    || c.minimumTargetErrorMeters < 0 || c.maximumTargetErrorMeters < c.minimumTargetErrorMeters) throw new Error('invalid lifecycle accepted throw values');
  resolveBallTransferTiming(0, 0, transfer);
};
export const samePaLifecycleCalibrationInput = (raw: unknown, id?: string): AcceptedSamePaLifecycleCalibration => {
  const s = cloneInert(raw) as AcceptedSamePaLifecycleCalibration;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'viewReference', 'firstPhysicalPitchSourceId', 'member', 'route', 'nominalReference',
    'nominalParameterReference', 'acceptedAtDay', 'provenance', 'response']) || !text(s.sourceId) || !text(s.sourceVersion) || id !== undefined && s.sourceId !== id
    || s.capability !== 'same_pa_lifecycle_execution_calibration_v1' || !ref(s.enrollmentReference, 'same_pa_enrollments')
    || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views') || !text(s.firstPhysicalPitchSourceId) || !samePaDispatchMemberValid(s.member)
    || !(samePaDispatchRouteValid(s.route) || s.route === 'defender_throw') || !Number.isSafeInteger(s.acceptedAtDay) || s.acceptedAtDay < 0
    || !fields(s.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion']) || !Object.values(s.provenance).every(text)) throw new Error('invalid lifecycle calibration Source');
  if (s.route === 'pitch_delivery') {
    if (!(ref(s.nominalReference, 'world_pitch_timing_baselines') || ref(s.nominalReference, 'world_pitch_timing_updates')) || s.nominalParameterReference !== null
      || !fields(s.response, ['kind', 'policyReference']) || s.response.kind !== 'accepted_pitch_response_v1' || !ref(s.response.policyReference, 'world_pitch_fatigue_policies')) throw new Error('invalid lifecycle pitch calibration');
  } else {
    const key = Object.hasOwn(keys, s.route) ? keys[s.route as keyof typeof keys] : null;
    if (key) {
      const p = s.nominalParameterReference;
      if (!ref(s.nominalReference, 'world_player_batting_models') || !fields(p, ['parameterKey', 'sourceId', 'sourceVersion', 'sourceHash'])
        || p.parameterKey !== key || !text(p.sourceId) || !text(p.sourceVersion) || !samePaHash(p.sourceHash)) throw new Error('invalid lifecycle batting parameter reference');
    } else if (s.nominalParameterReference !== null || !ref(s.nominalReference, s.route === 'defender_observation' ? 'world_player_observation_models'
      : s.route === 'defender_decision' ? 'world_player_decision_models' : s.route === 'defender_throw' ? 'world_player_fielding_models'
        : 'world_player_locomotion_models')) throw new Error('invalid lifecycle defender model reference');
    if (!fields(s.response, ['kind', 'values']) || s.response.kind !== 'accepted_execution_values_v1') throw new Error('invalid lifecycle accepted response');
    switch (s.route) {
      case 'batter_observation': battingObservationValuesInput(s.response.values); break;
      case 'batter_decision': battingDecisionValuesInput(s.response.values); break;
      case 'batter_motor': battingCapabilityValuesInput(s.response.values); break;
      case 'batter_swing': battingRepertoireValuesInput(s.response.values); break;
      case 'defender_observation': createPlayerObservationCalibration(s.response.values); break;
      case 'defender_decision': createPlayerDecisionCalibration(s.response.values); break;
      case 'defender_locomotion': createPlayerLocomotionCalibration(s.response.values); break;
      case 'defender_throw': samePaFieldThrowValuesInput(s.response.values); break;
    }
  }
  return freeze(s);
};
