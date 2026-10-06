import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { TemporalObservationErrorParameters } from '../../core/sim/perception/ObservationCapture';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Explicit accepted recipient policy; no sensor calibration or rule knowledge defaults. */
export type AcceptedRunnerVisibleContactWaitPolicy = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'runner_visible_contact_fly_wait_v1';
  careerId: string; playerId: string; personLinkSourceId: string; acceptedAtDay: number;
  observationModelSourceId: string; ticksPerSecond: number;
  classification: Readonly<{ version: 'paired_visible_contact_and_loft_estimates_v1';
    minimumContactRecognitionConfidence: number; maximumEstimatedContactGapMeters: number;
    minimumLoftRecognitionConfidence: number; minimumHeightAboveGroundMeters: number;
    minimumUpwardVelocityMps: number; groundReferenceHeightMeters: number }>;
  timingErrorParameters: TemporalObservationErrorParameters;
  availability: Readonly<{ version: 'capture_plus_explicit_sensor_delay_v1'; sensorDelayTicks: number }>;
}>;
export type AcceptedRunnerEventView = Readonly<{
  sourceId: string; sourceVersion: string; kind: 'prospective_runner_event_view_v1';
  physicalActorSourceId: string; gameId: string; playerId: string; policySourceId: string;
  validFromTick: number; validThroughTick: number; attentionStartedAtTick: number;
  poseVersion: string; bodyRelativeEyeOffset: Readonly<{ x: number; y: number; z: number }>;
  forward: Readonly<{ x: number; y: number; z: number }>; attentionTarget: 'bat_ball_contact';
}>;
export type RunnerContactWaitPolicyAdmission = Readonly<{
  source: AcceptedRunnerVisibleContactWaitPolicy; sourceHash: string; observationModelHash: string;
}>;
export type RunnerContactWaitViewAdmission = Readonly<{
  source: AcceptedRunnerEventView; sourceHash: string; policyHash: string; observationModelHash: string;
  actorHash: string; recipientBindingHash: string;
  registeredAt: Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
  admission: 'prospective_before_dependent_pitch';
}>;
export type RunnerContactWaitPolicyViewAuthority = Readonly<{
  readAcceptedPolicy(sourceId: string): AcceptedRunnerVisibleContactWaitPolicy | null;
  readAcceptedView(sourceId: string): AcceptedRunnerEventView | null;
}>;
export type RunnerContactWaitPolicyViewStore = Readonly<{
  acceptPolicy(sourceId: string): RunnerContactWaitPolicyAdmission;
  readPolicy(sourceId: string): RunnerContactWaitPolicyAdmission | null;
  acceptView(sourceId: string): RunnerContactWaitViewAdmission;
  readView(sourceId: string): RunnerContactWaitViewAdmission | null;
  close(): void;
}>;

export const runnerContactWaitId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const fields = (value: unknown, names: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const unit = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const vector = (value: AcceptedRunnerEventView['forward']) => fields(value, ['x', 'y', 'z'])
  && [value.x, value.y, value.z].every(Number.isFinite);

export const runnerContactWaitPolicyInput = (raw: AcceptedRunnerVisibleContactWaitPolicy, sourceId: string) => {
  const source = cloneInert(raw), c = source?.classification, t = source?.timingErrorParameters, a = source?.availability;
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'careerId', 'playerId', 'personLinkSourceId', 'acceptedAtDay',
    'observationModelSourceId', 'ticksPerSecond', 'classification', 'timingErrorParameters', 'availability'])
    || source.sourceId !== sourceId || ![sourceId, source.sourceVersion, source.careerId, source.playerId,
      source.personLinkSourceId, source.observationModelSourceId].every(runnerContactWaitId)
    || source.capability !== 'runner_visible_contact_fly_wait_v1' || !tick(source.acceptedAtDay)
    || !tick(source.ticksPerSecond) || source.ticksPerSecond === 0
    || !fields(c, ['version', 'minimumContactRecognitionConfidence', 'maximumEstimatedContactGapMeters',
      'minimumLoftRecognitionConfidence', 'minimumHeightAboveGroundMeters', 'minimumUpwardVelocityMps', 'groundReferenceHeightMeters'])
    || c.version !== 'paired_visible_contact_and_loft_estimates_v1' || !unit(c.minimumContactRecognitionConfidence)
    || !unit(c.minimumLoftRecognitionConfidence) || !nonnegative(c.maximumEstimatedContactGapMeters)
    || !nonnegative(c.minimumHeightAboveGroundMeters) || !nonnegative(c.minimumUpwardVelocityMps)
    || !Number.isFinite(c.groundReferenceHeightMeters)
    || !fields(t, ['minimumDetectionQuality', 'minimumTimeErrorSeconds', 'maximumTimeErrorSeconds'])
    || !unit(t.minimumDetectionQuality) || !nonnegative(t.minimumTimeErrorSeconds)
    || !nonnegative(t.maximumTimeErrorSeconds) || t.maximumTimeErrorSeconds < t.minimumTimeErrorSeconds
    || !fields(a, ['version', 'sensorDelayTicks']) || a.version !== 'capture_plus_explicit_sensor_delay_v1'
    || !tick(a.sensorDelayTicks)) throw new Error('invalid accepted runner contact wait policy Source');
  return freeze(source);
};
export const runnerContactWaitViewInput = (raw: AcceptedRunnerEventView, sourceId: string) => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'kind', 'physicalActorSourceId', 'gameId', 'playerId', 'policySourceId',
    'validFromTick', 'validThroughTick', 'attentionStartedAtTick', 'poseVersion', 'bodyRelativeEyeOffset', 'forward', 'attentionTarget'])
    || source.sourceId !== sourceId || ![sourceId, source.sourceVersion, source.physicalActorSourceId, source.gameId,
      source.playerId, source.policySourceId, source.poseVersion].every(runnerContactWaitId)
    || source.kind !== 'prospective_runner_event_view_v1' || source.attentionTarget !== 'bat_ball_contact'
    || ![source.validFromTick, source.validThroughTick, source.attentionStartedAtTick].every(tick)
    || source.validThroughTick < source.validFromTick || source.attentionStartedAtTick > source.validThroughTick
    || !vector(source.bodyRelativeEyeOffset) || !vector(source.forward)
    || !Number.isFinite(Math.hypot(source.forward.x, source.forward.y, source.forward.z))
    || Math.hypot(source.forward.x, source.forward.y, source.forward.z) === 0) throw new Error('invalid accepted runner event view Source');
  return freeze(source);
};
