import type { EmotionScope, EmotionState, EmotionTime } from '../EmotionTypes';
import type { AppraisalInput, AppliedAppraisal } from '../appraisal/AppraisalTypes';
import type { RunnerDecisionInput, RunnerMotionDecision } from '../../../sim/running/RunnerDecision';
import type { RunnerMotionParameters, RunnerMotionState, RunnerMotionTrajectory } from '../../../sim/running/RunnerMotion';
export type ExecutionFrame = Readonly<{
 scope: EmotionScope; contextId: string; snapshotId: string; worldRevision: number; time: EmotionTime;
}>;
export type DecisionTimingWindow = Readonly<{ tick: number; earliestTick: number; latestTick: number }>;
export type EmotionFreeDecisionBaseline = Readonly<{
 basis: 'WITHOUT_EMOTION'; sourceId: string; revision: number; frame: ExecutionFrame;
 swingDecision: DecisionTimingWindow; throwIntent: DecisionTimingWindow; defenseReplan: DecisionTimingWindow;
 swingAggression: number; throwAggression: number; minimumAdvanceSafetyMarginTicks: number;
}>;
export type ExecutionModel = Readonly<{
 modelId: string; version: string; runningRiskTicksPerUnit: number; maximumAdvanceSafetyMarginTicks: number;
}>;
/** Full existing decision/physics source, not true-world clairvoyant cues or a desired outcome. */
export type EmotionRunnerSource = Readonly<{
 sourceId: string; revision: number; frame: ExecutionFrame; decision: RunnerDecisionInput;
 body: RunnerMotionState; parameters: RunnerMotionParameters; endTick: number;
}>;
export type EmotionExecutionRequest = Readonly<{
 executionId: string; frame: ExecutionFrame; beforeEmotion: EmotionState; appraisal: AppraisalInput;
 baseline: EmotionFreeDecisionBaseline; model: ExecutionModel; runner: EmotionRunnerSource | null;
}>;
export type AppliedDecisionTiming = Readonly<{
 tick: number; requestedShiftTicks: number; appliedShiftTicks: number; constrainedByEarliest: boolean;
 status: 'READY' | 'MISSED_WINDOW';
}>;
export type EmotionDecisionInputs = Readonly<{
 basis: 'SINGLE_EMOTION_GATE_APPLIED'; swingDecision: AppliedDecisionTiming; throwIntent: AppliedDecisionTiming;
 defenseReplan: AppliedDecisionTiming; swingAggression: number; throwAggression: number;
 minimumAdvanceSafetyMarginTicks: number;
 realized: Readonly<{ swingAggressionDelta: number; throwAggressionDelta: number; safetyMarginDeltaTicks: number }>;
}>;
export type EmotionRunnerExecution = Readonly<{ decision: RunnerMotionDecision; trajectory: RunnerMotionTrajectory }>;
export type EmotionExecutionProposal = Readonly<{
 boundary: 'SINGLE_GATE_EXECUTION_PROPOSAL'; algorithmVersion: 'emotion-decision-consumer-v1';
 request: EmotionExecutionRequest; appraisal: AppliedAppraisal; inputs: EmotionDecisionInputs;
 runner: EmotionRunnerExecution | null;
}>;
export type EmotionExecutionAcceptance = Readonly<{
 kind: 'EmotionExecutionAccepted'; executionId: string; expectedFrame: ExecutionFrame;
 afterWorldRevision: number; beforeEmotionRevision: number; afterEmotionRevision: number;
 proposal: EmotionExecutionProposal;
}>;
