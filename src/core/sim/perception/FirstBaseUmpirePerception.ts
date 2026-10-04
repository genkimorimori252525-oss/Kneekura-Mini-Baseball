import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import { evaluateObservationGeometry } from './ObservationGeometry';
import { composeObservationQuality } from './ObservationQuality';
import { estimateOcclusionVisibility } from './Occlusion';
import type { DeterministicRng } from '../../rng/DeterministicRng';
import type { ObservationSample } from './Observation';
import type { ObserverViewState, ObservationGeometryParameters, ObservationTargetTruth } from './ObservationGeometry';
import type { ObservationQualityParameters } from './ObservationQuality';
import { captureTemporalObservation, type TemporalObservationErrorParameters } from './ObservationCapture';
import type { SphericalOccluder } from './Occlusion';

export type FirstBaseUmpireCalibration = Readonly<{
  version: 'first_base_timing_triangular_v1'; perceptionAbility: number;
  geometryParameters: ObservationGeometryParameters; qualityParameters: ObservationQualityParameters;
  timingErrorParameters: TemporalObservationErrorParameters; callDelaySeconds: number;
}>;
export type FirstBaseTimingCue = Readonly<{
  elapsedSeconds: number; target: ObservationTargetTruth; occluders: readonly SphericalOccluder[];
}>;
export type FirstBasePerceptionInput = Readonly<{
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>; observedAtElapsedSeconds: number;
  calibration: FirstBaseUmpireCalibration | null; view: ObserverViewState | null;
  attention: Readonly<{ control: number; touch: number }> | null;
  events: Readonly<{ control: FirstBaseTimingCue; touch: FirstBaseTimingCue }> | null;
}>;
export type FirstBasePerceivedPlay = Readonly<{ kind: 'pending'; reason: string }>
  | Readonly<{ kind: 'undetectable'; cue: 'control' | 'touch' }>
  | Readonly<{ kind: 'perceived'; control: ObservationSample<number>; touch: ObservationSample<number>; observedAtElapsedSeconds: number }>;
export type FirstBaseCallSchedule = Readonly<{ kind: 'pending'; reason: string }>
  | Readonly<{ kind: 'scheduled'; calledAtElapsedSeconds: number }>
  | Readonly<{ kind: 'called'; call: 'out' | 'safe'; calledAtElapsedSeconds: number; availableAtElapsedSeconds: number; tick: number }>;
const fields = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const requireFields = (v: unknown, keys: readonly string[]): void => {
  if (!fields(v, keys)) throw new Error('invalid first-base umpire fields');
};
const unit = (v: number): void => { if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error('invalid first-base umpire quality'); };
const elapsed = (v: number): void => { if (!Number.isFinite(v) || v < 0) throw new Error('invalid first-base umpire elapsed time'); };
const vector = (v: unknown): void => {
  requireFields(v, ['x', 'y', 'z']);
  if (!Object.values(v!).every(Number.isFinite)) throw new Error('invalid first-base umpire vector');
};
const freeze = <T>(v: T): T => {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v;
};
const clock = (v: FirstBasePerceptionInput['clock']): void => {
  requireFields(v, ['originTick', 'ticksPerSecond']);
  if (!Number.isSafeInteger(v.ticksPerSecond) || v.ticksPerSecond <= 0) throw new Error('invalid first-base umpire clock');
  quantizeEventTick(v.originTick, 0, v.ticksPerSecond);
};

/** Consistency is calibrated through explicit timing-error ranges, never a percentage-correct rating. */
export const createFirstBaseUmpireCalibration = (raw: FirstBaseUmpireCalibration): FirstBaseUmpireCalibration => {
  const v = cloneInert(raw);
  requireFields(v, ['version', 'perceptionAbility', 'geometryParameters', 'qualityParameters', 'timingErrorParameters', 'callDelaySeconds']);
  if (v.version !== 'first_base_timing_triangular_v1') throw new Error('unsupported first-base umpire calibration');
  unit(v.perceptionAbility); elapsed(v.callDelaySeconds);
  requireFields(v.geometryParameters, ['fullQualityHalfAngleRadians', 'maxVisibleHalfAngleRadians', 'fullQualityDistanceMeters',
    'maxObservableDistanceMeters', 'fullQualityRelativeSpeedMps', 'maxRelativeSpeedMps']);
  // Exercise the existing parameter validators without adopting any physical observation.
  const zero = { x: 0, y: 0, z: 0 };
  evaluateObservationGeometry({ position: zero, forward: { x: 0, y: 0, z: 1 }, velocity: zero },
    { position: zero, velocity: zero }, v.geometryParameters);
  const q = v.qualityParameters;
  requireFields(q, ['instantaneousDurationQuality', 'fullQualityObservationDurationSeconds', 'minimumAbilityQuality', 'weights']);
  requireFields(q.weights, ['distance', 'relativeSpeed', 'attention', 'duration', 'ability']);
  const total = q.weights.distance + q.weights.relativeSpeed + q.weights.attention + q.weights.duration + q.weights.ability;
  if (!Number.isFinite(total)) throw new Error('first-base umpire quality weight overflow');
  composeObservationQuality({ fovQuality: 1, distanceQuality: 1, relativeSpeedQuality: 1, occlusionVisibility: 1,
    attentionQuality: 1, observationDurationSeconds: 0, perceptionAbility: v.perceptionAbility }, q);
  const e = v.timingErrorParameters;
  requireFields(e, ['minimumDetectionQuality', 'minimumTimeErrorSeconds', 'maximumTimeErrorSeconds']);
  unit(e.minimumDetectionQuality); elapsed(e.minimumTimeErrorSeconds); elapsed(e.maximumTimeErrorSeconds);
  if (e.maximumTimeErrorSeconds < e.minimumTimeErrorSeconds) throw new Error('invalid first-base umpire timing-error range');
  return freeze(v);
};

/** This internal sampler consumes physical cues; only the estimated samples reach the classifier. */
export const perceiveFirstBasePlay = (raw: FirstBasePerceptionInput,
  rng: Readonly<{ control: DeterministicRng; touch: DeterministicRng }>): FirstBasePerceivedPlay => {
  const v = cloneInert(raw);
  requireFields(v, ['clock', 'observedAtElapsedSeconds', 'calibration', 'view', 'attention', 'events']);
  clock(v.clock); elapsed(v.observedAtElapsedSeconds);
  const observedAt = quantizeEventTick(v.clock.originTick, v.observedAtElapsedSeconds, v.clock.ticksPerSecond);
  const calibration = v.calibration === null ? null : createFirstBaseUmpireCalibration(v.calibration);
  if (v.view !== null) {
    requireFields(v.view, ['position', 'forward', 'velocity']); Object.values(v.view).forEach(vector);
    if (Math.hypot(v.view.forward.x, v.view.forward.y, v.view.forward.z) === 0) throw new Error('invalid first-base umpire forward');
  }
  if (v.attention !== null) { requireFields(v.attention, ['control', 'touch']); Object.values(v.attention).forEach(unit); }
  if (v.events !== null) {
    requireFields(v.events, ['control', 'touch']);
    for (const cue of Object.values(v.events)) {
      requireFields(cue, ['elapsedSeconds', 'target', 'occluders']); elapsed(cue.elapsedSeconds);
      if (cue.elapsedSeconds > v.observedAtElapsedSeconds) throw new Error('first-base event precedes observation availability');
      requireFields(cue.target, ['position', 'velocity']); Object.values(cue.target).forEach(vector);
      if (!Array.isArray(cue.occluders)) throw new Error('invalid first-base umpire occluders');
      for (const occluder of cue.occluders) {
        requireFields(occluder, ['center', 'radiusMeters']); vector(occluder.center);
        if (!Number.isFinite(occluder.radiusMeters) || occluder.radiusMeters <= 0) throw new Error('invalid first-base umpire occluder');
      }
    }
  }
  if (!calibration) return freeze({ kind: 'pending', reason: 'calibration_unavailable' });
  if (!v.view) return freeze({ kind: 'pending', reason: 'pose_unavailable' });
  if (!v.attention) return freeze({ kind: 'pending', reason: 'attention_unavailable' });
  if (!v.events) return freeze({ kind: 'pending', reason: 'event_pair_unavailable' });
  const samples: Partial<Record<'control' | 'touch', ObservationSample<number>>> = {};
  for (const key of ['control', 'touch'] as const) {
    const cue = v.events[key], geometry = evaluateObservationGeometry(v.view, cue.target, calibration.geometryParameters);
    const quality = composeObservationQuality({ ...geometry,
      occlusionVisibility: estimateOcclusionVisibility(v.view.position, cue.target.position, cue.occluders),
      attentionQuality: v.attention[key], observationDurationSeconds: 0, perceptionAbility: calibration.perceptionAbility }, calibration.qualityParameters);
    if (quality.visibilityQuality === 0) return freeze({ kind: 'undetectable', cue: key });
    const sample = captureTemporalObservation(cue.elapsedSeconds, observedAt, quality.totalQuality, rng[key], calibration.timingErrorParameters);
    if (!sample) return freeze({ kind: 'undetectable', cue: key });
    samples[key] = sample;
  }
  return freeze({ kind: 'perceived', control: samples.control!, touch: samples.touch!, observedAtElapsedSeconds: v.observedAtElapsedSeconds });
};

/** No physics, rule result or correctness flag is accepted at this decision boundary. */
export const classifyPerceivedFirstBasePlay = (raw: FirstBasePerceivedPlay): 'out' | 'safe' | 'simultaneous' | null => {
  const v = cloneInert(raw);
  if (v.kind === 'pending') { requireFields(v, ['kind', 'reason']); return null; }
  if (v.kind === 'undetectable') { requireFields(v, ['kind', 'cue']); return null; }
  requireFields(v, ['kind', 'control', 'touch', 'observedAtElapsedSeconds']);
  if (v.kind !== 'perceived') throw new Error('invalid perceived first-base play');
  elapsed(v.observedAtElapsedSeconds);
  for (const sample of [v.control, v.touch]) {
    requireFields(sample, ['estimate', 'observedAt', 'confidence']); unit(sample.confidence);
    if (!Number.isFinite(sample.estimate) || !Number.isSafeInteger(sample.observedAt) || sample.observedAt < 0) throw new Error('invalid perceived first-base timing sample');
  }
  if (v.control.observedAt !== v.touch.observedAt) throw new Error('perceived first-base sample availability differs');
  return v.control.estimate < v.touch.estimate ? 'out' : v.control.estimate > v.touch.estimate ? 'safe' : 'simultaneous';
};

export const resolveFirstBaseCallSchedule = (perceived: FirstBasePerceivedPlay, raw: FirstBaseUmpireCalibration,
  time: FirstBasePerceptionInput['clock'], currentElapsedSeconds: number): FirstBaseCallSchedule => {
  const calibration = createFirstBaseUmpireCalibration(raw); clock(time); elapsed(currentElapsedSeconds);
  const call = classifyPerceivedFirstBasePlay(perceived);
  if (call === null) return freeze({ kind: 'pending', reason: perceived.kind === 'pending' ? perceived.reason : 'event_not_detected' });
  if (call === 'simultaneous') return freeze({ kind: 'pending', reason: 'perceived_simultaneity' });
  if (perceived.kind !== 'perceived') throw new Error('invalid first-base call perception');
  if (perceived.control.observedAt !== quantizeEventTick(time.originTick, perceived.observedAtElapsedSeconds, time.ticksPerSecond)
    || currentElapsedSeconds < perceived.observedAtElapsedSeconds) throw new Error('first-base call observation availability differs');
  const calledAtElapsedSeconds = perceived.observedAtElapsedSeconds + calibration.callDelaySeconds;
  const tick = quantizeEventTick(time.originTick, calledAtElapsedSeconds, time.ticksPerSecond);
  if (currentElapsedSeconds < calledAtElapsedSeconds) return freeze({ kind: 'scheduled', calledAtElapsedSeconds });
  return freeze({ kind: 'called', call, calledAtElapsedSeconds, availableAtElapsedSeconds: calledAtElapsedSeconds, tick });
};
