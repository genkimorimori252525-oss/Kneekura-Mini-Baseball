import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import type { AcceptedBattingCapability, AcceptedBattingRepertoire, AcceptedBattingDecisionModel, AcceptedBattingObservationCalibration } from './PlayerBattingModel';

/** Approved parser-only declaration packet b7375a19. These explicit unchanged
 * synthetic values test domains only, never fatigue response or durable proof.
 * Original provenance: NativeBattingModelStanceFixtures lines 137-158 and the
 * three existing Player*CalibrationFixtures. No nominal-copy production path. */
export const dispatchCalibrationValues = () => {
  const motor: AcceptedBattingCapability['values'] = { motorLatencyTicks: 20_000, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 };
  const decision: AcceptedBattingDecisionModel['values'] = { modelId: 'explicit-test-decision', version: 'v1', threshold: 0.5, aggressionWeight: 0.5 };
  const swing: AcceptedBattingRepertoire['values'] = { repertoireId: 'explicit-test-repertoire', repertoireVersion: 'v1', profiles: [{ minimumAggression: 0, profile: {
    profileId: 'explicit-test-course', version: 'v1', batLengthM: 0.84, sweetSpotT: 0.72,
    centerContactDepthM: 20.1 * 0.0254, contactDepthPopulationStdDevM: 7.2 * 0.0254,
    insideOutsideDepthGainM: 0.075, heightDepthGainM: 0.035,
    baseContactSweetSpotSpeedMps: 31, contactDepthSpeedGainMpsPerM: 4, basePreContactSeconds: 0.165,
    insideOutsideTimingGainSeconds: 0.01, heightTimingGainSeconds: 0.004, followThroughSeconds: 0.135,
    highAttackAngleDeg: 7, middleAttackAngleDeg: 9, lowAttackAngleDeg: 16,
    courseAttackDirectionGainDeg: 6, nominalContactSurfaceDistanceM: 0.0696,
  } }] };
  const calibration = playerObservationCalibrationFixture();
  const observation: AcceptedBattingObservationCalibration['values'] = { calibration: { ...calibration,
    memoryDecayParameters: { ...calibration.memoryDecayParameters, ticksPerSecond: 1_000_000 } }, deliveryLatencyTicks: 10_000 };
  return { batter_motor: motor, batter_decision: decision, batter_swing: swing, batter_observation: observation,
    defender_observation: playerObservationCalibrationFixture(), defender_decision: playerDecisionCalibrationFixture(),
    defender_locomotion: playerLocomotionCalibrationFixture() };
};
export const dispatchCalibrationSources = () => {
  const values = dispatchCalibrationValues();
  const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('result:' + sourceId) });
  const parameters = { batter_motor: ['capability', 'batting-capability', 'test-motor-v1'],
    batter_decision: ['decisionModel', 'batting-decision', 'test-decision-v1'],
    batter_swing: ['repertoire', 'batting-repertoire', 'test-repertoire-v1'],
    batter_observation: ['observationCalibration', 'batting-sensor-calibration', 'test-sensor-v1'] } as const;
  return ['pitch_delivery', ...Object.keys(values)].map(route => {
    const parameter = parameters[route as keyof typeof parameters];
    const owner = route === 'pitch_delivery' ? 'world_pitch_timing_baselines' : parameter ? 'world_player_batting_models'
      : route === 'defender_observation' ? 'world_player_observation_models' : route === 'defender_decision' ? 'world_player_decision_models' : 'world_player_locomotion_models';
    const playerId = parameter ? 'away-2' : 'home-1';
    return { sourceId: 'calibration:' + route, sourceVersion: 'fixture-shape-only-v1', capability: 'same_pa_execution_calibration_v1',
      enrollmentReference: ref('same_pa_enrollments'), viewReference: ref('reserved_pa_execution_views'), firstPhysicalPitchSourceId: 'reserved-pitch',
      member: { playerId, bindingHash: hash('binding:' + playerId), personHash: hash('person:' + playerId), baselineSourceId: 'baseline:' + playerId,
        reservedRevision: 0, reservedStateHash: hash('reserved:' + playerId), projectedStateHash: hash('projected:' + playerId) },
      route, nominalReference: ref(owner), nominalParameterReference: parameter ? { parameterKey: parameter[0], sourceId: parameter[1],
        sourceVersion: parameter[2], sourceHash: hash(parameter) } : null, acceptedAtDay: 11,
      provenance: { assessmentSourceId: 'dispatch-validator-shape-' + route, assessmentVersion: 'fixture-shape-only-v1',
        calibrationSourceId: 'dispatch-validator-independent-declaration-' + route, calibrationVersion: 'fixture-shape-only-v1' },
      response: route === 'pitch_delivery' ? { kind: 'accepted_pitch_response_v1', policyReference: ref('world_pitch_fatigue_policies') }
        : { kind: 'accepted_execution_values_v1', values: values[route as keyof typeof values] } };
  });
};
