import type { Vec3 } from '../../../model/geometry';
import type { AerodynamicPitchTrajectory } from '../../../sim/pitching/AerodynamicPitchTrajectory';
import type { SwingKinematicsCourseProfileV1 } from '../../../sim/pitching/CourseAwareSwingKinematicsV1';
import type { SwingKinematicsTrajectoryV1 } from '../../../sim/contact/SwingKinematicsV1';
import type { RigidBatPhysicalProperties, RigidBaseballProperties } from '../../../sim/contact/RigidBatBallContact';
import type { StrikeZoneRegion } from '../../../sim/pitching/TakenPitchPhysicalResult';
import type { CanonicalPlateAppearanceTimeline } from '../../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { AerodynamicRigidPitchAgainstBatterResolution } from '../../../sim/pitching/AerodynamicRigidPitchAgainstBatter';
import type { EmotionState } from '../EmotionTypes';
import type { EmotionExecutionAcceptance, ExecutionFrame } from '../execution/ExecutionTypes';

/** Predictions belong to the observer. No actual-flight field exists in this contract. */
export type BattingPrediction = Readonly<{
 predictionId: string; observedTick: number; availableTick: number; validUntilTick: number;
 trajectory: AerodynamicPitchTrajectory; swingScore: number;
}>;
export type BattingSource = Readonly<{
 sourceId: string; revision: number; frame: ExecutionFrame; validUntilTick: number;
 ballId: string; playId: number; pitchOrdinal: number; ticksPerSecond: number;
 count: Readonly<{ balls: number; strikes: number }>; timelineNextSequence: number;
 bodyReadyTick: number; motorLatencyTicks: number; latestMotorStartTick: number; technicalTimingOffsetTicks: number;
 handedness: 'R' | 'L'; centerOfMass: Vec3; batPhysical: RigidBatPhysicalProperties; ball: RigidBaseballProperties;
 plateZ: number; strikeZone: StrikeZoneRegion; maximumSweetSpotSpeedMps: number;
 repertoireId: string; repertoireVersion: string;
 profiles: readonly Readonly<{ minimumAggression: number; profile: SwingKinematicsCourseProfileV1 }>[];
 directive: 'AUTO' | 'TAKE' | 'SWING';
 decisionModel: Readonly<{ modelId: string; version: string; threshold: number; aggressionWeight: number }>;
 predictions: readonly BattingPrediction[];
}>;
export type BattingExecutionRequest = Readonly<{
 currentFrame: ExecutionFrame; currentEmotion: EmotionState; acceptedExecution: EmotionExecutionAcceptance; source: BattingSource;
}>;
export type BattingCommitment = Readonly<{
 action: 'TAKE' | 'SWING'; decisionTick: number; predictionId: string | null; adjustedSwingScore: number | null;
 profileId: string | null; profileVersion: string | null; preferredStartTick: number | null;
 motorStartTick: number | null; motorDelayTicks: number; technicalTimingOffsetTicks: number;
 trajectory: SwingKinematicsTrajectoryV1 | null;
}>;
export type BattingStatus = 'READY' | 'WAITING' | 'MISSED_WINDOW' | 'MISSED_COMMITMENT' | 'NO_OBSERVATION'
 | 'STALE_PREDICTION' | 'UNRESOLVED_PREDICTION' | 'MOTOR_WINDOW_MISSED';
export type BattingExecutionProposal = Readonly<{
 algorithm: 'emotion-batting-consumer-v1'; request: BattingExecutionRequest; scheduledTick: number;
 status: BattingStatus; commitment: BattingCommitment | null;
}>;
export type BattingAcceptance = Readonly<{
 kind: 'BattingCommitmentAccepted'; expectedFrame: ExecutionFrame; afterWorldRevision: number;
 emotionRevision: number; actionKey: string; proposal: BattingExecutionProposal;
}>;
/** This input is deliberately separate from actor planning. A forecast is not a persisted result event. */
export type BattingPhysicalRequest = Readonly<{
 currentFrame: ExecutionFrame; currentEmotion: EmotionState; accepted: BattingAcceptance;
 sourceId: string; revision: number; ballId: string; playId: number; pitchOrdinal: number;
 actualTrajectory: AerodynamicPitchTrajectory; timeline: CanonicalPlateAppearanceTimeline;
}>;
export type BattingPhysicalResolution = Readonly<{
 kind: 'BattingPhysicalForecast'; request: BattingPhysicalRequest; actionKey: string; expectedFrame: ExecutionFrame; emotionRevision: number;
 contactResponse: 'nathan-2012-47-impact-fit-v1'; commitment: BattingCommitment;
 resolution: AerodynamicRigidPitchAgainstBatterResolution;
}>;
