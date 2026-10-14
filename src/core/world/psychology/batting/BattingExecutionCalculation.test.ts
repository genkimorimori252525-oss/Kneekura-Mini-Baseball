import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import * as batting from './BattingCommitment';
import { fixture, change, value } from './BattingFixtures.test-support';
import { playerObservationCalibrationFixture } from '../../../sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { evaluateObservationGeometry } from '../../../sim/perception/ObservationGeometry';
import { composeObservationQuality } from '../../../sim/perception/ObservationQuality';
import { captureSpatialObservation } from '../../../sim/perception/ObservationCapture';
import { predictSpatialObservationMemory } from '../../../sim/perception/ObservationMemory';
import { DeterministicRng } from '../../../rng/DeterministicRng';

// Explicit synthetic values; these do not establish a production fatigue response.
const execution = () => ({ nominalRequest: fixture(), effectiveValues: {
  decision: { modelId: 'fixture-effective-decision', version: 'fixture-v1', threshold: 0.9, aggressionWeight: 0.5 },
  motor: { motorLatencyTicks: 20_000, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 },
  repertoire: { repertoireId: 'fixture-effective-repertoire', repertoireVersion: 'fixture-v1', profiles: fixture().source.profiles },
} });
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const calculation = (input: unknown) => {
  expect(batting).toHaveProperty('calculateBattingExecution');
  return batting.calculateBattingExecution(input);
};
const observation = () => ({ nominalValues: { calibration: playerObservationCalibrationFixture(), deliveryLatencyTicks: 10 },
  effectiveValues: { calibration: playerObservationCalibrationFixture(), deliveryLatencyTicks: 20 },
  input: { observedTick: 100, deliveryCutTick: 140, ticksPerSecond: 1000, seed: 42,
    observer: { position: { x: 0, y: 0, z: 0 }, forward: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    target: { position: { x: 5, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } },
    occluders: [], attention: { target: { kind: 'ball' as const }, focusedSinceTick: 0 }, lastObservedTick: null as number | null } });
const sensory = (input: unknown) => {
  expect(batting).toHaveProperty('calculateBattingObservation');
  return batting.calculateBattingObservation(input);
};

test('BC01 effective threshold changes actual choice while nominal request bytes remain unchanged', () => {
  const input = execution(), before = hash(input.nominalRequest), result = value(calculation(input));
  expect(value(batting.prepareBattingExecution(input.nominalRequest)).commitment?.action).toBe('SWING');
  expect(result.commitment?.action).toBe('TAKE');
  expect(result.nominalRequest).toEqual(input.nominalRequest); expect(hash(input.nominalRequest)).toBe(before);
  expect(result).not.toHaveProperty('request');
  expect(Object.isFrozen(result.effectiveValues.decision)).toBe(true);
  const weighted = change(input, d => { d.nominalRequest = fixture('ANGER', { swingAggressionDelta: 0.3 });
    d.nominalRequest.source.predictions[1].swingScore = 0.4; d.effectiveValues.decision.threshold = 0.5;
    d.effectiveValues.decision.aggressionWeight = 0; });
  expect(value(calculation(weighted)).commitment?.action).toBe('TAKE');
  expect(value(batting.prepareBattingExecution(weighted.nominalRequest)).commitment?.action).toBe('SWING');
});
test('BC02 effective motor latency and technical phase change real trajectory ticks', () => {
  const input = execution(); input.effectiveValues.decision.threshold = 0.5;
  const base = value(calculation(input)).commitment!;
  const delayed = value(calculation(change(input, d => d.effectiveValues.motor.motorLatencyTicks = 150_000))).commitment!;
  expect(delayed.motorStartTick).toBe(310_000); expect(delayed.motorDelayTicks).toBeGreaterThan(base.motorDelayTicks);
  expect(delayed.trajectory!.contactTick - base.trajectory!.contactTick).toBe(delayed.motorDelayTicks - base.motorDelayTicks);
  const phase = value(calculation(change(input, d => d.effectiveValues.motor.technicalTimingOffsetTicks = 10_000))).commitment!;
  expect(phase.trajectory!.contactTick - base.trajectory!.contactTick).toBe(10_000);
  expect(phase.trajectory!.contact).toEqual(base.trajectory!.contact);
});
test('BC03 effective speed ceiling certifies the actual curve and rejects infeasible motion', () => {
  const input = execution(); input.effectiveValues.decision.threshold = 0.5;
  expect(calculation(input).ok).toBe(true);
  const result = calculation(change(input, d => d.effectiveValues.motor.maximumSweetSpotSpeedMps = 1));
  expect(result).toMatchObject({ ok: false, reason: { path: 'batting.source.speedEnvelope.exceeded' } });
});
test('BC04 effective repertoire changes actual curve without rewriting body or equipment', () => {
  const input = execution(); input.effectiveValues.decision.threshold = 0.5;
  const base = value(calculation(input)), changed = change(input, d => {
    d.effectiveValues.repertoire.profiles[0].profile.baseContactSweetSpotSpeedMps = 20;
  });
  const result = value(calculation(changed));
  expect(result.commitment!.trajectory!.contact.sweetSpotVelocity).not.toEqual(base.commitment!.trajectory!.contact.sweetSpotVelocity);
  expect(result.nominalRequest).toEqual(input.nominalRequest);
});
test('BC05 nominal execution values preserve legacy status and commitment bytes', () => {
  const nominalRequest = fixture(), s = nominalRequest.source;
  const result = value(calculation({ nominalRequest, effectiveValues: { decision: s.decisionModel,
    motor: { motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: s.technicalTimingOffsetTicks,
      maximumSweetSpotSpeedMps: s.maximumSweetSpotSpeedMps },
    repertoire: { repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion, profiles: s.profiles } } }));
  const legacy = value(batting.prepareBattingExecution(nominalRequest));
  expect(JSON.stringify([result.scheduledTick, result.status, result.commitment])).toBe(JSON.stringify([legacy.scheduledTick, legacy.status, legacy.commitment]));
});
test('BC06 missing invalid or executable effective values reject without nominal fallback', () => {
  const input = execution();
  for (const mutate of [(d: any) => delete d.effectiveValues.motor, (d: any) => d.effectiveValues.decision.threshold = NaN,
    (d: any) => d.effectiveValues.motor.motorLatencyTicks = 0, (d: any) => d.effectiveValues.motor.extra = 1,
    (d: any) => d.effectiveValues.repertoire.profiles[0].profile.baseContactSweetSpotSpeedMps = -1,
    (d: any) => d.effectiveValues.repertoire.profiles[1].minimumAggression = 0]) {
    expect(calculation(change(input, mutate)).ok).toBe(false);
  }
  let read = false; Object.defineProperty(input.effectiveValues, 'motor', { enumerable: true, get() { read = true; return {}; } });
  expect(calculation(input).ok).toBe(false); expect(read).toBe(false);
});
test('BC07 effective values preserve nominal prediction availability and motor windows', () => {
  const input = execution(); input.effectiveValues.decision.threshold = 0.5;
  expect(value(calculation(change(input, d => d.nominalRequest.source.predictions = []))).status).toBe('NO_OBSERVATION');
  expect(value(calculation(change(input, d => d.nominalRequest.source.predictions[1].availableTick = 200_000))).commitment?.predictionId).toBe('coarse');
  expect(value(calculation(change(input, d => d.nominalRequest.source.latestMotorStartTick = 170_000))).status).toBe('MOTOR_WINDOW_MISSED');
  expect(value(calculation(change(input, d => { d.nominalRequest.source.directive = 'TAKE'; d.nominalRequest.source.predictions = []; }))).commitment?.trajectory).toBeNull();
});
test('BC08 effective sensory values change actual capture and delivery without changing nominal bytes', () => {
  const input = observation(), before = hash(input.nominalValues), base = value(sensory(input));
  const changed = value(sensory(change(input, d => { d.effectiveValues.calibration.perceptionAbility = 0.2;
    d.effectiveValues.calibration.errorParameters.maximumPositionErrorMeters = 4; d.effectiveValues.deliveryLatencyTicks = 30; })));
  expect(changed.sample!.estimate).not.toEqual(base.sample!.estimate); expect(changed.sample!.confidence).toBeLessThan(base.sample!.confidence);
  expect(base.availableTick).toBe(120); expect(changed.availableTick).toBe(130);
  expect(changed.nominalValues).toEqual(input.nominalValues); expect(hash(input.nominalValues)).toBe(before);
  const late = value(sensory(change(input, d => d.effectiveValues.deliveryLatencyTicks = 50)));
  expect(late.status).toBe('AWAITING_DELIVERY'); expect(late.deliveredMemory).toBeNull();
});
test('BC09 sensory output equals existing Core capture and memory and uses effective refresh', () => {
  const input = observation(), c = input.effectiveValues.calibration, i = input.input, result = value(sensory(input));
  const geometry = evaluateObservationGeometry(i.observer, i.target, c.geometryParameters);
  const quality = composeObservationQuality({ ...geometry, occlusionVisibility: 1, attentionQuality: 1,
    observationDurationSeconds: 0, perceptionAbility: c.perceptionAbility }, c.qualityParameters);
  const sample = captureSpatialObservation(i.target, i.observedTick, quality.totalQuality, new DeterministicRng(i.seed), c.errorParameters)!;
  expect(result.sample).toEqual(sample); expect(result.deliveredMemory).toEqual(predictSpatialObservationMemory(sample, i.deliveryCutTick, c.memoryDecayParameters));
  expect(value(sensory(change(input, d => { d.input.lastObservedTick = 95; }))).status).toBe('REFRESH_NOT_DUE');
  expect(value(sensory(change(input, d => { d.input.lastObservedTick = 95; d.effectiveValues.calibration.refreshPolicy.attendedIntervalTicks = 5; }))).status).toBe('DELIVERED');
  const decayed = value(sensory(change(input, d => d.effectiveValues.calibration.memoryDecayParameters.confidenceLossPerSecond = 1)));
  expect(decayed.deliveredMemory!.confidence).toBeLessThan(result.deliveredMemory!.confidence);
});
test('BC10 sensory nondetection chronology invalid domains and finite overflow reject or stay unavailable', () => {
  const input = observation();
  expect(value(sensory(change(input, d => { d.input.observer.forward.x = -1; d.effectiveValues.calibration.errorParameters.minimumDetectionQuality = 0; }))).status).toBe('NOT_DETECTED');
  expect(value(sensory(change(input, d => d.input.occluders = [{ center: { x: 2, y: 0, z: 0 }, radiusMeters: 1 }]))).status).toBe('NOT_DETECTED');
  for (const mutate of [(d: any) => d.effectiveValues.deliveryLatencyTicks = 0,
    (d: any) => d.input.deliveryCutTick = 99, (d: any) => d.input.lastObservedTick = 101,
    (d: any) => d.effectiveValues.calibration.memoryDecayParameters.ticksPerSecond = 2,
    (d: any) => d.input.observedTick = Number.MAX_SAFE_INTEGER,
    (d: any) => d.effectiveValues.calibration.perceptionAbility = NaN,
    (d: any) => { d.input.target.velocity.x = Number.MAX_VALUE; d.input.deliveryCutTick = 5000; },
    (d: any) => d.input.extra = true]) expect(sensory(change(input, mutate)).ok).toBe(false);
});
test('BC11 sensory attention is the original explicit target and controls peripheral refresh', () => {
  const old = observation(), input = old.input;
  const supplied = { ...old, input: { ...input, lastObservedTick: 80,
    attention: { target: { kind: 'player', playerId: 'pitcher' }, focusedSinceTick: 0 } } };
  const first = sensory(supplied);
  expect(first.ok).toBe(true);
  expect(value(first).status).toBe('REFRESH_NOT_DUE');
  expect(value(first).input.attention).toEqual(supplied.input.attention);
  const changed = change(supplied, d => d.effectiveValues.calibration.refreshPolicy.peripheralIntervalTicks = 20);
  expect(value(sensory(changed)).status).toBe('DELIVERED');
  for (const mutate of [(d: any) => d.input.attention.target.kind = 'made_up',
    (d: any) => d.input.attention.focusedSinceTick = 101,
    (d: any) => d.input.attention.target.extra = true]) expect(sensory(change(supplied, mutate)).ok).toBe(false);
});
test('BC12 effective parameter identities obey accepted nominal parameter domains', () => {
  for (const mutate of [(d: any) => d.effectiveValues.decision.modelId = ' padded ',
    (d: any) => d.effectiveValues.repertoire.repertoireId = ' padded ',
    (d: any) => d.effectiveValues.repertoire.profiles[0].profile.version = ' padded ']) {
    expect(calculation(change(execution(), mutate)).ok).toBe(false);
  }
});
