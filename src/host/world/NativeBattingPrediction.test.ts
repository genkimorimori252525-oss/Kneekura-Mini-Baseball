import { expect, it } from 'vitest';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { calculateBattingObservation } from '../../core/world/psychology/batting/BattingObservationCalculation';
import { sampleAerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
const modules = import.meta.glob('./NativeBattingPrediction.ts');
const implementation = async () => { const load = modules['./NativeBattingPrediction.ts']; expect(load, 'OWNED_OBSERVED_MOTION_FORECAST_MISSING').toBeTypeOf('function'); return await load() as typeof import('./NativeBattingPrediction'); };
const observation = (deliveryCutTick = 140) => {
  const values = { calibration: playerObservationCalibrationFixture(), deliveryLatencyTicks: 20 };
  const result = calculateBattingObservation({ nominalValues: values, effectiveValues: values, input: { observedTick: 100, deliveryCutTick, ticksPerSecond: 1000,
    seed: 42, observer: { position: { x: 0, y: 0, z: 0 }, forward: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    target: { position: { x: 5, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } }, occluders: [], attention: { target: { kind: 'ball' }, focusedSinceTick: 0 }, lastObservedTick: null } });
  if (!result.ok) throw new Error(result.reason.path); return result.value;
};
// Existing explicit Core sensory fixture units; the forecast never receives actual future truth.
const calibration = () => ({ algorithm: 'observed_motion_with_pinned_aerodynamic_priors_v1' as const, horizonTicks: 800,
  observerKnownSpinPrior: { x: 0, y: 0, z: 0 }, parameters: { ticksPerSecond: 1000, integrationStepTicks: 2, gravityY: -9.80665,
    aerodynamics: { ballMassKg: 0.145, ballRadiusM: 0.0366, airDensityKgM3: 1.225, windVelocityMps: { x: 0, y: 0, z: 0 }, dragCoefficient: 0.35 } } });
it('BP01 forecast starts from the delivered original capture and retains the explicit aerodynamic prior', async () => {
  const api = await implementation(), original = observation(), model = calibration(), result = api.deriveBattingObservedMotionForecast(original, model, 140);
  expect(result.kind).toBe('observed_motion_forecast');
  if (result.kind !== 'observed_motion_forecast') throw new Error('fixture observation unavailable');
  expect(result.trajectory.start.position).toEqual(original.sample!.estimate.position);
  expect(result.trajectory.start.velocity).toEqual(original.sample!.estimate.velocity);
  expect(result.trajectory.start.spin).toEqual(model.observerKnownSpinPrior); expect(result.trajectory.start.tick).toBe(100);
  expect(result.trajectory.endTick).toBe(900); expect(result.availableTick).toBe(140); expect(result).not.toHaveProperty('swingScore');
  expect(sampleAerodynamicPitchTrajectory(result.trajectory, 100)).toEqual(result.trajectory.start);
});
it('BP02 unavailable sensory evidence stays pending and never manufactures a forecast or score', async () => {
  const api = await implementation(), result = api.deriveBattingObservedMotionForecast(observation(110), calibration(), 140);
  expect(result).toEqual({ kind: 'pending', reason: 'batting_observation_not_delivered' });
});
it('BP03 mixed clocks, changed delivered memory and forecast tick overflow reject', async () => {
  const api = await implementation(), original = observation();
  expect(() => api.deriveBattingObservedMotionForecast(original, { ...calibration(), parameters: { ...calibration().parameters, ticksPerSecond: 1_000_000 } }, 140)).toThrow();
  const memory = original.deliveredMemory!;
  const changed = { ...original, deliveredMemory: { ...memory, estimate: { ...memory.estimate, position: { ...memory.estimate.position, x: memory.estimate.position.x + 1 } } } };
  expect(() => api.deriveBattingObservedMotionForecast(changed, calibration(), 140)).toThrow();
  expect(() => api.deriveBattingObservedMotionForecast(original, { ...calibration(), horizonTicks: Number.MAX_SAFE_INTEGER }, 140)).toThrow();
  expect(api.deriveBattingObservedMotionForecast(original, calibration(), 901)).toEqual({ kind: 'pending', reason: 'batting_prediction_horizon_expired' });
});

it('BP04 a real pending capture needs its owned delivery cut before forecasting, and later retention preserves original evidence', async () => {
  const api = await implementation(), { deriveBattingObservationDelivery } = await import('./NativeBattingDelivery');
  const capture = observation(100), parameters = capture.nominalValues.calibration.memoryDecayParameters;
  expect(capture.status).toBe('AWAITING_DELIVERY');
  expect(deriveBattingObservationDelivery(capture, parameters, parameters, 119)).toEqual({ kind: 'pending', reason: 'batting_delivery_latency_not_reached' });
  const before = JSON.stringify(capture), delivery = deriveBattingObservationDelivery(capture, parameters, parameters, 140);
  if (delivery.kind !== 'batting_observation_delivered') throw new Error('explicit fixture delivery pending');
  const forecast = api.deriveDeliveredBattingObservedMotionForecast(capture, delivery, calibration(), 140);
  expect(forecast.kind).toBe('observed_motion_forecast');
  if (forecast.kind !== 'observed_motion_forecast') throw new Error('explicit fixture forecast pending');
  expect(forecast.trajectory.start.tick).toBe(100); expect(forecast.availableTick).toBe(140);
  expect(forecast.trajectory.start.position).toEqual(capture.sample!.estimate.position); expect(JSON.stringify(capture)).toBe(before);
  expect(() => api.deriveDeliveredBattingObservedMotionForecast(capture, delivery, calibration(), 139)).toThrow();
  const memory = delivery.deliveredMemory;
  const changed = { ...delivery, deliveredMemory: { ...memory, estimate: { ...memory.estimate, position: { ...memory.estimate.position, x: memory.estimate.position.x + 1 } } } };
  expect(() => api.deriveDeliveredBattingObservedMotionForecast(capture, changed, calibration(), 140)).toThrow();
});
