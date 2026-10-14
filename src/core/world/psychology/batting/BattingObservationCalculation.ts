import type { EmotionResult } from '../EmotionTypes';
import { attempt, fail, integer, list, obj, text } from '../EmotionValidation';
import { cloneExecutionData, safeTickSum } from '../execution/ExecutionValidation';
import { coreCall, numberValue } from './BattingValidation';
import type { Vec3 } from '../../../model/geometry';
import { DeterministicRng } from '../../../rng/DeterministicRng';
import { isObservationRefreshDue, type AttentionState, type ObservationSample } from '../../../sim/perception/Observation';
import { evaluateObservationGeometry, type ObserverViewState } from '../../../sim/perception/ObservationGeometry';
import { estimateOcclusionVisibility, type SphericalOccluder } from '../../../sim/perception/Occlusion';
import { composeObservationQuality } from '../../../sim/perception/ObservationQuality';
import { captureSpatialObservation } from '../../../sim/perception/ObservationCapture';
import { predictSpatialObservationMemory, type RememberedPrediction, type SpatialMotionEstimate } from '../../../sim/perception/ObservationMemory';
import { createPlayerObservationCalibration, type PlayerObservationCalibration } from '../../../sim/perception/PlayerObservationCalibration';

export type BattingObservationValues = Readonly<{ calibration: PlayerObservationCalibration; deliveryLatencyTicks: number }>;
export type BattingObservationCalculationInput = Readonly<{
  nominalValues: BattingObservationValues; effectiveValues: BattingObservationValues;
  input: Readonly<{
    observedTick: number; deliveryCutTick: number; ticksPerSecond: number; seed: number;
    observer: ObserverViewState; target: SpatialMotionEstimate; occluders: readonly SphericalOccluder[];
    attention: AttentionState; lastObservedTick: number | null;
  }>;
}>;
export type BattingObservationCalculation = BattingObservationCalculationInput & Readonly<{
  algorithm: 'batting-observation-calculation-v1';
  status: 'REFRESH_NOT_DUE' | 'NOT_DETECTED' | 'AWAITING_DELIVERY' | 'DELIVERED';
  sample: ObservationSample<SpatialMotionEstimate> | null; availableTick: number | null;
  deliveredMemory: RememberedPrediction<SpatialMotionEstimate> | null;
}>;
const vector = (raw: unknown, path: string): Vec3 => {
  const v = obj(raw, ['x', 'y', 'z'], path);
  for (const key of ['x', 'y', 'z']) numberValue(v[key], path + '.' + key);
  return v as Vec3;
};
const values = (raw: unknown, path: string): BattingObservationValues => {
  const v = obj(raw, ['calibration', 'deliveryLatencyTicks'], path);
  const deliveryLatencyTicks = integer(v.deliveryLatencyTicks, path + '.deliveryLatencyTicks');
  if (deliveryLatencyTicks === 0) fail('INVALID_INPUT', path + '.deliveryLatencyTicks');
  return { deliveryLatencyTicks, calibration: coreCall(path, () => createPlayerObservationCalibration(v.calibration as PlayerObservationCalibration)) };
};

/** Pure sensory calculation over one already-sampled instant. It creates no trajectory,
 * swing score, model Source, durable receipt or proof of original physical ownership. */
export function calculateBattingObservation(raw: unknown): EmotionResult<BattingObservationCalculation> {
  return attempt<BattingObservationCalculation>(() => {
    const path = 'batting.observation';
    const wrapper = obj(cloneExecutionData(raw, path), ['nominalValues', 'effectiveValues', 'input'], path);
    const nominalValues = values(wrapper.nominalValues, path + '.nominalValues');
    const effectiveValues = values(wrapper.effectiveValues, path + '.effectiveValues');
    const input = obj(wrapper.input, ['observedTick', 'deliveryCutTick', 'ticksPerSecond', 'seed',
      'observer', 'target', 'occluders', 'attention', 'lastObservedTick'], path + '.input');
    for (const key of ['observedTick', 'deliveryCutTick', 'ticksPerSecond', 'seed']) integer(input[key], path + '.' + key);
    if (input.lastObservedTick !== null) integer(input.lastObservedTick, path + '.lastObservedTick');
    const i = input as BattingObservationCalculationInput['input'], calibration = effectiveValues.calibration;
    const attention = obj(i.attention, ['target', 'focusedSinceTick'], path + '.attention');
    integer(attention.focusedSinceTick, path + '.attention.focusedSinceTick');
    const attentionKind = (attention.target as { kind?: unknown } | null)?.kind;
    const attentionTarget = obj(attention.target, attentionKind === 'ball' ? ['kind'] : attentionKind === 'player' ? ['kind', 'playerId']
      : attentionKind === 'coach' ? ['kind', 'coachId'] : ['kind', 'base'], path + '.attention.target');
    if (attentionKind === 'player') text(attentionTarget.playerId, path + '.attention.playerId');
    else if (attentionKind === 'coach') text(attentionTarget.coachId, path + '.attention.coachId');
    else if (attentionKind === 'base') {
      if (![1, 2, 3, 4].includes(attentionTarget.base as number)) fail('INVALID_INPUT', path + '.attention.base');
    } else if (attentionKind !== 'ball') fail('INVALID_INPUT', path + '.attention.kind');
    if (i.ticksPerSecond === 0 || i.seed > 0xffff_ffff
      || i.deliveryCutTick < i.observedTick || i.attention.focusedSinceTick > i.observedTick
      || i.lastObservedTick !== null && i.lastObservedTick > i.observedTick
      || calibration.memoryDecayParameters.ticksPerSecond !== i.ticksPerSecond
      || nominalValues.calibration.memoryDecayParameters.ticksPerSecond !== i.ticksPerSecond) fail('INVALID_INPUT', path + '.chronologyOrClock');
    const observer = obj(i.observer, ['position', 'forward', 'velocity'], path + '.observer');
    for (const key of ['position', 'forward', 'velocity']) vector(observer[key], path + '.observer.' + key);
    const target = obj(i.target, ['position', 'velocity'], path + '.target');
    vector(target.position, path + '.target.position'); vector(target.velocity, path + '.target.velocity');
    list(i.occluders, (raw, p) => {
      const occluder = obj(raw, ['center', 'radiusMeters'], p); vector(occluder.center, p + '.center');
      numberValue(occluder.radiusMeters, p + '.radiusMeters', true); return occluder;
    }, path + '.occluders');
    const shell = { algorithm: 'batting-observation-calculation-v1' as const, nominalValues, effectiveValues, input: i };
    const availableTick = safeTickSum(i.observedTick, effectiveValues.deliveryLatencyTicks, path + '.delivery');
    const geometry = coreCall(path + '.geometry', () => evaluateObservationGeometry(i.observer, i.target, calibration.geometryParameters));
    cloneExecutionData(geometry, path + '.geometry');
    const visibility = coreCall(path + '.occlusion', () => estimateOcclusionVisibility(i.observer.position, i.target.position, i.occluders));
    const due = coreCall(path + '.refresh', () => isObservationRefreshDue({ target: { kind: 'ball' },
      attention: i.attention,
      lastObservedAt: i.lastObservedTick, currentTick: i.observedTick, policy: calibration.refreshPolicy }));
    if (!due) return { ...shell, status: 'REFRESH_NOT_DUE', sample: null, availableTick: null, deliveredMemory: null };
    const quality = coreCall(path + '.quality', () => composeObservationQuality({ ...geometry, occlusionVisibility: visibility,
      attentionQuality: i.attention.target.kind === 'ball' ? 1 : 0, observationDurationSeconds: 0, perceptionAbility: calibration.perceptionAbility }, calibration.qualityParameters));
    cloneExecutionData(quality, path + '.quality');
    // A zero detection threshold never makes an occluded or out-of-FOV ball visible.
    const sample = quality.visibilityQuality === 0 ? null : coreCall(path + '.capture', () => captureSpatialObservation(i.target,
      i.observedTick, quality.totalQuality, new DeterministicRng(i.seed), calibration.errorParameters));
    cloneExecutionData(sample, path + '.sample');
    if (sample === null) return { ...shell, status: 'NOT_DETECTED', sample: null, availableTick: null, deliveredMemory: null };
    if (availableTick > i.deliveryCutTick) return { ...shell, status: 'AWAITING_DELIVERY', sample, availableTick, deliveredMemory: null };
    const deliveredMemory = coreCall(path + '.memory', () => predictSpatialObservationMemory(sample, i.deliveryCutTick, calibration.memoryDecayParameters));
    cloneExecutionData(deliveredMemory, path + '.memory');
    return { ...shell, status: 'DELIVERED', sample, availableTick, deliveredMemory };
  });
}
