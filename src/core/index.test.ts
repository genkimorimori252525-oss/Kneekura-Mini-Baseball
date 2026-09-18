import { describe, expect, it } from 'vitest';
import {
  CORE_PROTOCOL_VERSION,
  advanceDefenderMotion,
  advanceRunnerMotion,
  assessPerceivedGloveTarget,
  buildDefenderMotionTrajectory,
  buildPlayerPerceivedWorldState,
  capturePlanarObservation,
  captureSpatialObservation,
  composeDefenderPhysicalPrimitiveSegment,
  composeObservationQuality,
  createGloveContactInputFromDefenderPrimitive,
  createFlyBallFirstFielderTouchFact,
  createControlledRunnerTagFact,
  createLiveBallCatchOutcome,
  createObservationSample,
  createPlayEndFact,
  createRunnerBaseDepartureFact,
  createSecuredCatchOutcome,
  createTagContactPrimitiveFromDefenderPrimitive,
  applyCatchExecutionTargetError,
  applyForceOutRuleResultToState,
  evaluateCatchBodyStability,
  evaluateCatchRetentionLoad,
  evaluateTagUpCompliance,
  decideDefensiveIntent,
  deriveCatchRetentionParameters,
  evaluateObservationGeometry,
  estimateOcclusionVisibility,
  findAcceleratedGloveBallContactTick,
  findAcceleratedSphereContactTick,
  finalizePendingRunsAtPlayEnd,
  finalizeRulePendingRuns,
  findAcceleratedTagContactTick,
  findBaseTouchTick,
  findNextDefensiveReplanTick,
  findFirstTrueTick,
  createInitialForceObligationState,
  deriveCurrentForceObligations,
  findGloveBallContactTick,
  findRunnerBaseTouchTick,
  findSecureCatchTick,
  findTagContactTick,
  findThrowReleaseTick,
  isObservationRefreshDue,
  planGloveReachPoseSegment,
  predictPlanarObservationMemory,
  generateDefensiveIntentCandidates,
  projectDefenderBodyKinematicsSegment,
  projectDefenderWorldState,
  projectRunnerWorldState,
  resolveCatchRetention,
  resolveBatterRunnerFirstBase,
  resolveDefensiveMovementTarget,
  resolveGroundBallFirstBaseRule,
  resolveFlyCatch,
  resolveForceOutAtTarget,
  resolveForceOutScoringRule,
  resolveThirdOutScoring,
  resolveTagArrival,
  resolveTagOutScoringRule,
  resolveDefensiveDecisionTiming,
  resolveCommunicationReception,
  retireForceParticipant,
  sampleRunnerPhysicalTouchPoint,
  sampleRunnerRoute,
} from './index';

describe('core package', () => {
  it('exposes the first shared protocol version', () => {
    expect(CORE_PROTOCOL_VERSION).toBe(1);
  });

  it('exposes exact event time refinement through the shared Core API', () => {
    expect(findFirstTrueTick(4_000, 6_000, (tick) => tick >= 5_237)).toBe(5_237);
  });

  it('exposes exact glove-ball contact timing through the shared Core API', () => {
    expect(typeof findGloveBallContactTick).toBe('function');
  });

  it('exposes exact secure catch timing through the shared Core API', () => {
    expect(typeof findSecureCatchTick).toBe('function');
  });

  it('exposes catch outcomes that preserve secured and live-ball continuations', () => {
    expect(typeof createSecuredCatchOutcome).toBe('function');
    expect(typeof createLiveBallCatchOutcome).toBe('function');
  });

  it('exposes catch retention skill calibration through the shared Core API', () => {
    expect(typeof deriveCatchRetentionParameters).toBe('function');
  });

  it('exposes deterministic catch-retention physics through the shared Core API', () => {
    expect(typeof evaluateCatchRetentionLoad).toBe('function');
    expect(typeof resolveCatchRetention).toBe('function');
  });

  it('exposes exact base touch timing through the shared Core API', () => {
    expect(typeof findBaseTouchTick).toBe('function');
  });

  it('exposes deterministic runner physical movement through the shared Core API', () => {
    expect(typeof advanceRunnerMotion).toBe('function');
    expect(typeof sampleRunnerRoute).toBe('function');
    expect(typeof sampleRunnerPhysicalTouchPoint).toBe('function');
    expect(typeof findRunnerBaseTouchTick).toBe('function');
    expect(typeof projectRunnerWorldState).toBe('function');
  });

  it('exposes the non-omniscient perception substrate through the shared Core API', () => {
    expect(typeof createObservationSample).toBe('function');
    expect(typeof isObservationRefreshDue).toBe('function');
    expect(typeof predictPlanarObservationMemory).toBe('function');
    expect(typeof resolveCommunicationReception).toBe('function');
    expect(typeof buildPlayerPerceivedWorldState).toBe('function');
  });

  it('exposes observation geometry, occlusion, quality, and capture through the shared Core API', () => {
    expect(typeof evaluateObservationGeometry).toBe('function');
    expect(typeof estimateOcclusionVisibility).toBe('function');
    expect(typeof composeObservationQuality).toBe('function');
    expect(typeof capturePlanarObservation).toBe('function');
    expect(typeof captureSpatialObservation).toBe('function');
  });

  it('exposes individual defender decision foundations through the shared Core API', () => {
    expect(typeof findNextDefensiveReplanTick).toBe('function');
    expect(typeof resolveDefensiveDecisionTiming).toBe('function');
    expect(typeof generateDefensiveIntentCandidates).toBe('function');
    expect(typeof decideDefensiveIntent).toBe('function');
  });

  it('exposes defender physical movement through the shared Core API', () => {
    expect(typeof resolveDefensiveMovementTarget).toBe('function');
    expect(typeof buildDefenderMotionTrajectory).toBe('function');
    expect(typeof advanceDefenderMotion).toBe('function');
    expect(typeof projectDefenderWorldState).toBe('function');
  });

  it('exposes defender body and pose physical primitives through the shared Core API', () => {
    expect(typeof projectDefenderBodyKinematicsSegment).toBe('function');
    expect(typeof composeDefenderPhysicalPrimitiveSegment).toBe('function');
    expect(typeof createGloveContactInputFromDefenderPrimitive).toBe('function');
    expect(typeof createTagContactPrimitiveFromDefenderPrimitive).toBe('function');
  });

  it('exposes catch execution skill physics through the shared Core API', () => {
    expect(typeof applyCatchExecutionTargetError).toBe('function');
    expect(typeof evaluateCatchBodyStability).toBe('function');
  });

  it('exposes perception-driven glove reach through the shared Core API', () => {
    expect(typeof assessPerceivedGloveTarget).toBe('function');
    expect(typeof planGloveReachPoseSegment).toBe('function');
  });

  it('exposes acceleration-aware physical contact through the shared Core API', () => {
    expect(typeof findAcceleratedSphereContactTick).toBe('function');
    expect(typeof findAcceleratedGloveBallContactTick).toBe('function');
    expect(typeof findAcceleratedTagContactTick).toBe('function');
  });

  it('exposes dynamic force obligations through the shared Core API', () => {
    expect(typeof createInitialForceObligationState).toBe('function');
    expect(typeof deriveCurrentForceObligations).toBe('function');
    expect(typeof retireForceParticipant).toBe('function');
    expect(typeof resolveForceOutAtTarget).toBe('function');
    expect(typeof resolveForceOutScoringRule).toBe('function');
    expect(typeof applyForceOutRuleResultToState).toBe('function');
  });

  it('exposes the first Correct Rule Result foundation through the shared Core API', () => {
    expect(typeof resolveBatterRunnerFirstBase).toBe('function');
    expect(typeof resolveThirdOutScoring).toBe('function');
    expect(typeof resolveGroundBallFirstBaseRule).toBe('function');
  });

  it('exposes fly-catch and tag-up compliance through the shared Core API', () => {
    expect(typeof createFlyBallFirstFielderTouchFact).toBe('function');
    expect(typeof createRunnerBaseDepartureFact).toBe('function');
    expect(typeof resolveFlyCatch).toBe('function');
    expect(typeof evaluateTagUpCompliance).toBe('function');
  });

  it('exposes authoritative play-end run finalization through the shared Core API', () => {
    expect(typeof createPlayEndFact).toBe('function');
    expect(typeof finalizePendingRunsAtPlayEnd).toBe('function');
    expect(typeof finalizeRulePendingRuns).toBe('function');
  });

  it('exposes tag-arrival time-play rules through the shared Core API', () => {
    expect(typeof createControlledRunnerTagFact).toBe('function');
    expect(typeof resolveTagArrival).toBe('function');
    expect(typeof resolveTagOutScoringRule).toBe('function');
  });

  it('exposes exact physical tag contact timing through the shared Core API', () => {
    expect(typeof findTagContactTick).toBe('function');
  });

  it('exposes exact throw release timing through the shared Core API', () => {
    expect(typeof findThrowReleaseTick).toBe('function');
  });
});
