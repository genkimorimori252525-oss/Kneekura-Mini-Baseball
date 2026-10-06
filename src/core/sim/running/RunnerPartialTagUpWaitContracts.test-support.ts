import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import type { RunnerDecisionInput, RunnerMotionDecision } from './RunnerDecision';
import type { TemporalObservationErrorParameters } from '../perception/ObservationCapture';
import type { ObservationSample } from '../perception/Observation';
import type { SpatialMotionEstimate } from '../perception/ObservationMemory';

/** Proposed contract only. No implementation, fake Native owner or default calibration. */
export type RunnerPartialTagUpWaitContext = Readonly<{
  currentBase: 1 | 2 | 3; nextBase: 2 | 3 | 4;
  tagUp: Readonly<{ kind: 'awaiting_first_touch' }>;
  forceKnowledge: Readonly<{ status: 'unavailable'; reason: 'fair_foul_unresolved' }>;
}>;
export type RunnerPartialTagUpWaitInput = Readonly<{
  version: 'runner_partial_tag_up_wait_v1'; runnerId: string;
  perceivedWorld: PlayerPerceivedWorldState<RunnerPartialTagUpWaitContext>;
  cueKnowledge: Readonly<{ status: 'unavailable'; reason: 'producer_not_connected' }>;
}> & Pick<RunnerDecisionInput, 'minimumCueConfidence' | 'coachTrust' | 'minimumAdvanceSafetyMarginTicks'
  | 'decisionAbility' | 'timingParameters'>;
export type RunnerPartialTagUpWaitModule = Readonly<{
  decideRunnerMotionIntentFromPartialContext(input: RunnerPartialTagUpWaitInput): RunnerMotionDecision;
}>;

/** Additional immutable Player policy; all spatial calibration stays in its existing owner. */
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

/** References only; the actual event and capture clock are reconstructed, never supplied. */
export type RunnerContactPerceptionSource = Readonly<{
  kind: 'owned_runner_visible_contact_wait_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; physicalActorSourceId: string; prePitchRunnerSourceId: string;
  playerId: string; worldContactSourceId: string; publicKnowledgeSourceId: string;
  viewSourceId: string; policySourceId: string; observationModelSourceId: string;
  decisionMotionModelSourceId: string; previousPerceptionSourceId: null;
}>;
export type RunnerCaptureMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
export type RunnerRequiredCaptureSamples = Readonly<{
  ball: ObservationSample<SpatialMotionEstimate>; batContactPoint: ObservationSample<SpatialMotionEstimate>;
  contactTime: ObservationSample<number>;
}>;
type RecognizedRunnerContact = Readonly<{
  kind: 'recognized_batted_contact_potential_fly'; confidence: number;
  estimatedContactElapsedSeconds: number;
}>;
type RunnerContactReceiptBasis = Readonly<{
  version: 'owned_runner_visible_contact_wait_v1'; source: RunnerContactPerceptionSource;
  recipient: Readonly<{ gameId: string; playId: number; careerId: string; playerId: string;
    personId: string; personLinkSourceId: string }>;
  original: Readonly<{ physicalActorSourceId: string; prePitchRunnerSourceId: string;
    motionRevision: number; controllerHash: string; eventHash: string }>;
  captureAt: RunnerCaptureMoment; registeredAt: RunnerCaptureMoment;
  dependencyHashes: Readonly<{ physicalPitch: string; worldContact: string; actualSelf: string;
    actor: string; runner: string; publicKnowledge: string; view: string; policy: string;
    observationModel: string; decisionMotionModel: string }>;
  quality: Readonly<{ ballTotalQuality: number; batTotalQuality: number; temporalTotalQuality: number }>;
}>;
/** Stored admission state is immutable; later availability is a read-only projection. */
export type RunnerContactPerceptionReceipt = RunnerContactReceiptBasis & (
  Readonly<{ state: 'unavailable'; reason: 'spatial_not_detected' | 'temporal_not_detected'
    | 'surface_visibility_unavailable' | 'contact_not_recognized' | 'loft_not_recognized';
    captures: Readonly<{ ball: ObservationSample<SpatialMotionEstimate> | null;
      batContactPoint: ObservationSample<SpatialMotionEstimate> | null; contactTime: ObservationSample<number> | null }>;
    availableAt: null; recognizedEvent: null }>
  | Readonly<{ state: 'scheduled' | 'available'; reason: null; captures: RunnerRequiredCaptureSamples;
    availableAt: RunnerCaptureMoment; recognizedEvent: RecognizedRunnerContact }>
);
export type RunnerPerceptionEvaluationCut = Readonly<{ kind: 'original_contact'; worldContactSourceId: string }>
  | Readonly<{ kind: 'retained_runner_field_pieces'; fieldSourceId: string }>;
/** Candidate selection references; these are not Native issuance/adoption authority. */
export type RunnerPartialWaitSelectionSource = Readonly<{
  kind: 'owned_runner_partial_wait_selection_v1'; sourceId: string; sourceVersion: string;
  perceptionSourceId: string; publicKnowledgeSourceId: string; decisionMotionModelSourceId: string;
  evaluationCut: RunnerPerceptionEvaluationCut;
}>;
type RunnerContactPerceptionAtCutBasis = Readonly<{
  receiptSourceId: string; receiptHash: string;
  evaluationCut: RunnerPerceptionEvaluationCut; evaluatedAt: RunnerCaptureMoment;
}>;
/** No future samples/classification reach the recipient before actual availability. */
export type RunnerContactPerceptionAtCut = RunnerContactPerceptionAtCutBasis & (
  Readonly<{ state: 'unavailable'; dueAt: null; captures: null; recognizedEvent: null }>
  | Readonly<{ state: 'scheduled'; dueAt: RunnerCaptureMoment; captures: null; recognizedEvent: null }>
  | Readonly<{ state: 'available'; dueAt: RunnerCaptureMoment; captures: RunnerRequiredCaptureSamples;
    recognizedEvent: RecognizedRunnerContact }>
);
export type RunnerPartialWaitSelection = Readonly<{
  source: RunnerPartialWaitSelectionSource; perceptionReceiptSourceId: string; perceptionReceiptHash: string;
  evaluatedAt: RunnerCaptureMoment; decisionInput: RunnerPartialTagUpWaitInput; decision: RunnerMotionDecision;
  identity: Readonly<{ sourceHash: string; inputHash: string; decisionHash: string;
    publicKnowledgeHash: string; decisionMotionModelHash: string }>;
  issuance: 'not_owned'; adoption: 'not_owned';
}>;
