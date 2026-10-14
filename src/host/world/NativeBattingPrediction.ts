import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { calculateBattingObservation, type BattingObservationCalculation } from '../../core/world/psychology/batting/BattingObservationCalculation';
import { sampleAerodynamicPitchTrajectory, type AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import type { AcceptedBattingPredictionCalibration } from './PlayerBattingModel';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields } from './SamePlateAppearanceWorkPrefix';
import { deriveBattingObservationDelivery, type BattingObservationDelivery } from './NativeBattingDelivery';

export type BattingObservedMotionForecast = Readonly<{
  kind: 'observed_motion_forecast'; algorithm: 'observed_motion_with_pinned_aerodynamic_priors_v1';
  observedTick: number; availableTick: number; validUntilTick: number; trajectory: AerodynamicPitchTrajectory;
}>;
const forecastFromCapture = (observation: BattingObservationCalculation, calibration: AcceptedBattingPredictionCalibration['values'], evaluatedAtTick: number):
  BattingObservedMotionForecast | Readonly<{ kind: 'pending'; reason: 'batting_prediction_horizon_expired' }> => {
  if (!fields(calibration, ['algorithm', 'horizonTicks', 'observerKnownSpinPrior', 'parameters']) || calibration.algorithm !== 'observed_motion_with_pinned_aerodynamic_priors_v1'
    || !Number.isSafeInteger(calibration.horizonTicks) || calibration.horizonTicks <= 0 || !fields(calibration.observerKnownSpinPrior, ['x', 'y', 'z'])
    || !Object.values(calibration.observerKnownSpinPrior).every(Number.isFinite) || !fields(calibration.parameters, ['ticksPerSecond', 'integrationStepTicks', 'gravityY', 'aerodynamics'])
    || calibration.parameters.ticksPerSecond !== observation.input.ticksPerSecond || !Number.isSafeInteger(evaluatedAtTick) || evaluatedAtTick < observation.input.observedTick
    || !observation.sample) throw new Error('invalid delivered batting forecast parameters');
  const sample = observation.sample, endTick = sample.observedAt + calibration.horizonTicks;
  if (!Number.isSafeInteger(endTick)) throw new Error('batting forecast horizon overflow');
  if (endTick < evaluatedAtTick) return freeze({ kind: 'pending', reason: 'batting_prediction_horizon_expired' });
  const trajectory: AerodynamicPitchTrajectory = { start: { tick: sample.observedAt, position: sample.estimate.position, velocity: sample.estimate.velocity, spin: calibration.observerKnownSpinPrior }, endTick, parameters: calibration.parameters };
  calculateBaseballAerodynamics(trajectory.start.velocity, trajectory.start.spin, trajectory.parameters.aerodynamics); sampleAerodynamicPitchTrajectory(trajectory, trajectory.start.tick);
  return freeze({ kind: 'observed_motion_forecast', algorithm: calibration.algorithm, observedTick: sample.observedAt, availableTick: evaluatedAtTick, validUntilTick: endTick, trajectory });
};
export const deriveDeliveredBattingObservedMotionForecast = (rawCapture: BattingObservationCalculation, rawDelivery: BattingObservationDelivery,
  rawCalibration: AcceptedBattingPredictionCalibration['values'], evaluatedAtTick: number) => {
  const capture = cloneInert(rawCapture), delivery = cloneInert(rawDelivery), calibration = cloneInert(rawCalibration);
  if (!fields(delivery, ['kind', 'availableTick', 'evaluatedAtTick', 'nominalMemoryParameters', 'effectiveMemoryParameters', 'deliveredMemory'])
    || delivery.kind !== 'batting_observation_delivered' || evaluatedAtTick < delivery.evaluatedAtTick) throw new Error('batting forecast lacks delivered knowledge at its cut');
  const original = deriveBattingObservationDelivery(capture, delivery.nominalMemoryParameters, delivery.effectiveMemoryParameters, delivery.evaluatedAtTick);
  if (original.kind !== 'batting_observation_delivered' || json(original) !== json(delivery)) throw new Error('batting forecast delivery differs');
  return forecastFromCapture(capture, calibration, evaluatedAtTick);
};
/** Numerical composition only. Native producers authenticate the original
 * observation/model first. This has neither future-flight input nor a scoring
 * model: a complete BattingPrediction requires its separate accepted score. */
export const deriveBattingObservedMotionForecast = (rawObservation: BattingObservationCalculation,
  rawCalibration: AcceptedBattingPredictionCalibration['values'], evaluatedAtTick: number): BattingObservedMotionForecast | Readonly<{ kind: 'pending'; reason: 'batting_observation_not_delivered' | 'batting_prediction_horizon_expired' }> => {
  const observation = cloneInert(rawObservation), calibration = cloneInert(rawCalibration);
  const fail = (): never => { throw new Error('invalid batting original observation or prediction calibration'); };
  if (!fields(observation, ['algorithm', 'status', 'sample', 'availableTick', 'deliveredMemory', 'nominalValues', 'effectiveValues', 'input'])
    || !fields(calibration, ['algorithm', 'horizonTicks', 'observerKnownSpinPrior', 'parameters'])
    || calibration.algorithm !== 'observed_motion_with_pinned_aerodynamic_priors_v1'
    || !Number.isSafeInteger(calibration.horizonTicks) || calibration.horizonTicks <= 0
    || !fields(calibration.observerKnownSpinPrior, ['x', 'y', 'z']) || !Object.values(calibration.observerKnownSpinPrior).every(Number.isFinite)
    || !fields(calibration.parameters, ['ticksPerSecond', 'integrationStepTicks', 'gravityY', 'aerodynamics'])
    || calibration.parameters.ticksPerSecond !== observation.input.ticksPerSecond || !Number.isSafeInteger(evaluatedAtTick) || evaluatedAtTick < observation.input.deliveryCutTick) return fail();
  const recomputed = calculateBattingObservation({ nominalValues: observation.nominalValues, effectiveValues: observation.effectiveValues, input: observation.input });
  if (!recomputed.ok || json(recomputed.value) !== json(observation)) return fail();
  if (observation.status !== 'DELIVERED') return freeze({ kind: 'pending', reason: 'batting_observation_not_delivered' });
  const memory = observation.deliveredMemory, sample = observation.sample;
  if (!memory || !sample || observation.availableTick === null || memory.predictedAt < observation.availableTick || memory.sourceObservedAt !== observation.input.observedTick) return fail();
  // Core's prediction chronology retains the actual capture tick. Start from
  // the delivered original sample, not a later memory projection relabelled as
  // an earlier observation. Evaluation availability is an owned cut, not the
  // earliest time the sensory sample could have arrived.
  const endTick = sample.observedAt + calibration.horizonTicks;
  if (!Number.isSafeInteger(endTick)) return fail();
  if (endTick < evaluatedAtTick) return freeze({ kind: 'pending', reason: 'batting_prediction_horizon_expired' });
  const trajectory: AerodynamicPitchTrajectory = { start: { tick: sample.observedAt, position: sample.estimate.position,
    velocity: sample.estimate.velocity, spin: calibration.observerKnownSpinPrior }, endTick, parameters: calibration.parameters };
  // Validate the existing physics domains without advancing into actual truth.
  calculateBaseballAerodynamics(trajectory.start.velocity, trajectory.start.spin, calibration.parameters.aerodynamics);
  sampleAerodynamicPitchTrajectory(trajectory, trajectory.start.tick);
  return freeze({ kind: 'observed_motion_forecast', algorithm: calibration.algorithm, observedTick: memory.sourceObservedAt,
    availableTick: evaluatedAtTick, validUntilTick: endTick, trajectory });
};
