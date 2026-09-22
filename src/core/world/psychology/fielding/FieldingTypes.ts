import type { Vec2, Vec3 } from '../../../model/geometry';
import type { ThrowLaunch, ThrowLaunchCalibration } from '../../../sim/fielding/ThrowLaunch';
import type { BallTransferTimingParameters, BallTransferTiming } from '../../../sim/fielding/BallTransferTiming';
import type { DefensiveIntentCandidate } from '../../../sim/fielding/DefensiveDecision';
import type { DefensiveReplanTrigger } from '../../../sim/fielding/DefensiveReplan';
import type { DefenderFirstStepTimingParameters } from '../../../sim/fielding/DefenderFirstStepTiming';
import type { DefenderMotionState, DefenderMotionParameters, DefenderMotionSegment } from '../../../sim/fielding/DefenderMotion';
import type { EmotionState } from '../EmotionTypes';
import type { EmotionExecutionAcceptance, ExecutionFrame } from '../execution/ExecutionTypes';
export type ThrowEffortProfile = Readonly<{
 profileId: string; minimumAggression: number; motorDurationTicks: number; calibration: ThrowLaunchCalibration;
}>;
export type FieldingSourceBase = Readonly<{
 sourceId: string; revision: number; frame: ExecutionFrame; observationTick: number; validUntilTick: number;
}>;
/** Current stationary release-pose contract. A moving holder requires a future body-model adapter. */
export type ThrowSource = FieldingSourceBase & Readonly<{
 kind: 'THROW'; ballId: string; holderId: string | null; securedPossessionTick: number;
 origin: Vec3; holderVelocity: Vec3; receiverId: string; target: Vec3;
 armStrength: number; throwingAccuracy: number; transferAbility: number; transfer: BallTransferTimingParameters;
 repertoireId: string; repertoireVersion: string; physicalSpeedCeilingMps: number; profiles: readonly ThrowEffortProfile[];
 randomSeed: number;
}>;
/** Candidates already derived from the actor's perceived world, not omniscient team state. */
export type ReplanSource = FieldingSourceBase & Readonly<{
 kind: 'REPLAN'; lastDecisionTick: number | null; triggers: readonly DefensiveReplanTrigger[];
 candidates: readonly DefensiveIntentCandidate[]; ballTarget: Vec2 | null;
 baseTargets: Readonly<Record<1 | 2 | 3 | 4, Vec2>>;
 body: DefenderMotionState; previousTarget: Vec2 | null;
 firstStepAbility: number; firstStep: DefenderFirstStepTimingParameters;
 motion: DefenderMotionParameters; endTick: number;
}>;
export type FieldingExecutionRequest = Readonly<{
 currentFrame: ExecutionFrame; currentEmotion: EmotionState; acceptedExecution: EmotionExecutionAcceptance;
 source: ThrowSource | ReplanSource;
}>;
export type ThrowPhysicalPlan = Readonly<{
 kind: 'THROW'; ballId: string; receiverId: string; profileId: string; commitmentTick: number;
 transfer: BallTransferTiming; motorStartTick: number; launch: ThrowLaunch;
}>;
export type DefensivePhysicalPlan = Readonly<{
 kind: 'REPLAN'; triggerTick: number; commitmentTick: number; movementStartTick: number;
 selected: DefensiveIntentCandidate; target: Vec2 | null;
 segments: readonly DefenderMotionSegment[]; endState: DefenderMotionState;
}>;
export type FieldingStatus = 'READY' | 'WAITING' | 'MISSED_WINDOW' | 'MISSED_COMMITMENT'
 | 'NO_CONTROL' | 'NO_NEW_TRIGGER';
export type FieldingExecutionProposal = Readonly<{
 algorithm: 'emotion-fielding-consumers-v1'; request: FieldingExecutionRequest;
 scheduledTick: number; status: FieldingStatus; plan: ThrowPhysicalPlan | DefensivePhysicalPlan | null;
}>;
export type FieldingAcceptance = Readonly<{
 kind: 'FieldingExecutionAccepted'; expectedFrame: ExecutionFrame; afterWorldRevision: number;
 emotionRevision: number; actionKey: string; proposal: FieldingExecutionProposal;
}>;
