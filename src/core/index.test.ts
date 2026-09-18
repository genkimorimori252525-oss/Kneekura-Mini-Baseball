import { describe, expect, it } from 'vitest';
import {
  CORE_PROTOCOL_VERSION,
  NPB_2026_RULE_PROFILE,
  advanceDefenderMotion,
  advanceRunnerMotion,
  assessPerceivedGloveTarget,
  buildDefenderMotionTrajectory,
  buildPlayerPerceivedWorldState,
  createBatterRunnerFirstBaseFrame,
  createBatterRunnerFirstBaseRoute,
  createBatterRunnerFirstBaseTouchFactFromTimeline,
  createCatchRetentionContactFromAcceleratedReception,
  createControlledBaseContactFactFromCatchOutcomePhysics,
  createControlledBaseContactFactFromDefenderPhysics,
  createBatterStanceGeometry,
  createRunnerMotionStateFromSwingExitTransition,
  buildBatterSwingExitRecoveryTrajectory,
  applyBatterRunnerWorldTimelineToSnapshot,
  applyStrikeoutPlateAppearanceToMatchState,
  applyWalkPlateAppearanceToMatchState,
  applyResolvedLiveBallPlateAppearanceToMatchState,
  buildBatterRunnerWorldTimeline,
  createCanonicalPlateAppearanceTimeline,
  capturePlanarObservation,
  captureSpatialObservation,
  closeAppealWindow,
  composeDefenderPhysicalPrimitiveSegment,
  composeObservationQuality,
  createGloveContactInputFromDefenderPrimitive,
  createFlyBallFirstFielderTouchFact,
  createControlledRunnerTagFact,
  createDefensiveAppealAttemptFact,
  createDefenderFootPlacementFact,
  createFirstPostPitchInfielderTouchFact,
  createLiveBallCatchOutcome,
  createNaturalPlayAdvancementResult,
  createObservationSample,
  createPlayEndFact,
  createRunnerBaseDepartureFact,
  createSecondBaseDivisionReference,
  createSecuredCatchOutcome,
  createTagContactPrimitiveFromDefenderPrimitive,
  applyCatchExecutionTargetError,
  asRuleProfileId,
  assertMatchRuleProfile,
  applyForceOutRuleResultToState,
  evaluateCatchBodyStability,
  evaluateCatchRetentionLoad,
  evaluateSustainedTagUpAppealScoring,
  evaluateTagUpCompliance,
  decideDefensiveIntent,
  deriveCatchRetentionParameters,
  evaluateTagUpComplianceForMatch,
  evaluatePitchReleaseInfieldSide,
  getBatterRunnerDistanceToFirstBase,
  getRuleProfile,
  evaluateObservationGeometry,
  estimateOcclusionVisibility,
  findAcceleratedGloveBallContactTick,
  findAcceleratedSphereContactTick,
  finalizePendingRunsAtPlayEnd,
  finalizeRulePendingRuns,
  findAcceleratedTagContactTick,
  findBaseTouchTick,
  findNextDefensiveReplanTick,
  findPitchPlateCrossing,
  findFirstTrueTick,
  createAppealWindow,
  createRuleContext,
  createRunnerPrecedence,
  createAppealScoringOption,
  createThirdOutScoringOption,
  createTagUpAppealInningEndingOption,
  createExistingThirdOutInningEndingOption,
  createInfieldBoundaryRegion,
  createInitialForceObligationState,
  deriveCurrentForceObligations,
  findGloveBallContactTick,
  findRunnerBaseTouchTick,
  findRunnerBaseTouchTickOnTrajectory,
  findBatterRunnerPostLaunchBaseTouchTick,
  findDefenderControlledBaseContactTick,
  findDefenderFootBaseContactTick,
  findSecureCatchTick,
  findTagContactTick,
  findThrowReleaseTick,
  isObservationRefreshDue,
  planDefenderBaseFootReachPrimitive,
  planGloveReachPoseSegment,
  predictPlanarObservationMemory,
  generateDefensiveIntentCandidates,
  projectDefenderBodyKinematicsSegment,
  projectDefenderWorldState,
  projectRunnerWorldState,
  projectBatterSwingExitRecoveryRunnerWorldState,
  normalizeInfieldBoundaryViolation,
  normalizeInningInfieldSideLockViolation,
  resolveCatchRetention,
  resolveAdvantageousAppealOutOptions,
  resolveBatterRunnerFirstBase,
  resolveBatterRunnerFirstBaseFromPhysicalCatchRace,
  resolveFirstBasePhysicalRace,
  resolveBatterRunnerFirstBaseFromPhysicalRace,
  resolveBatterRunnerFirstBaseFromTimeline,
  resolveGroundBallFirstBasePhysicalRace,
  resolveGroundBallFirstBaseRuleFromPhysicalRace,
  resolveGroundBallFirstBaseRuleFromTimeline,
  resolveDefensiveAlignmentViolationPenaltyForMatch,
  resolveDefensiveMovementTarget,
  resolveGroundBallFirstBaseRule,
  resolveNPB2026AlignmentViolationPenalty,
  resolvePitchCountRule,
  resolveFlyCatch,
  resolveFoulBallRule,
  resolveHalfInningTransition,
  resolveInfieldFlyRule,
  resolveWalkForcedAdvancement,
  createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule,
  completeGroundBallFirstBasePlateAppearance,
  resolveForceOutAtTarget,
  resolveForceOutScoringRule,
  resolveThirdOutScoring,
  resolveTagArrival,
  resolveTagUpAppeal,
  resolveTagUpAppealForMatch,
  resolveAdvantageousFourthOutForMatch,
  evaluatePitchReleaseInfieldSideForMatch,
  establishInningInfieldSideAssignment,
  evaluateInningInfieldSideLock,
  evaluatePitchingMotionInfieldBoundary,
  evaluatePitchingMotionInfieldBoundaryForMatch,
  evaluateInningInfieldSideLockForMatch,
  resolveTagOutScoringRule,
  resolveTakenPitchPhysicalResult,
  resolveSwingingPitchPhysicalResult,
  resolveDefensiveDecisionTiming,
  resolveBatterStanceWorldPosition,
  resolveBatterSwingExitRunTransition,
  resolveBatterSwingExitRunTransitionAfterContact,
  recordBatBallContact,
  recordCountedPitch,
  recordFairBattedBall,
  recordFoulBattedBall,
  recordLiveBallPlayEnd,
  recordTakenPitchPhysicalResult,
  recordSwingingPitchPhysicalResult,
  resolveCommunicationReception,
  retireForceParticipant,
  sampleRunnerPhysicalTouchPoint,
  sampleRunnerMotionTrajectory,
  sampleBatterSwingExitRecoveryTrajectory,
  sampleBatterRunnerWorldTimeline,
  sampleRunnerRoute,
  selectAdvantageousInningEndingOut,
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

  it('exposes the unified batter-runner world timeline through the shared Core API', () => {
    expect(typeof buildBatterRunnerWorldTimeline).toBe('function');
    expect(typeof applyBatterRunnerWorldTimelineToSnapshot).toBe('function');
    expect(typeof sampleBatterRunnerWorldTimeline).toBe('function');
  });

  it('exposes batter swing-exit recovery world trajectory through the shared Core API', () => {
    expect(typeof buildBatterSwingExitRecoveryTrajectory).toBe('function');
    expect(typeof sampleBatterSwingExitRecoveryTrajectory).toBe('function');
    expect(typeof projectBatterSwingExitRecoveryRunnerWorldState).toBe('function');
  });

  it('exposes batter swing-exit run transition physics through the shared Core API', () => {
    expect(typeof resolveBatterSwingExitRunTransition).toBe('function');
    expect(typeof resolveBatterSwingExitRunTransitionAfterContact).toBe('function');
    expect(typeof createRunnerMotionStateFromSwingExitTransition).toBe('function');
  });

  it('exposes batter stance to first-base geometry through the shared Core API', () => {
    expect(typeof createBatterRunnerFirstBaseFrame).toBe('function');
    expect(typeof createBatterStanceGeometry).toBe('function');
    expect(typeof resolveBatterStanceWorldPosition).toBe('function');
    expect(typeof getBatterRunnerDistanceToFirstBase).toBe('function');
    expect(typeof createBatterRunnerFirstBaseRoute).toBe('function');
  });

  it('exposes deterministic runner physical movement through the shared Core API', () => {
    expect(typeof advanceRunnerMotion).toBe('function');
    expect(typeof sampleRunnerMotionTrajectory).toBe('function');
    expect(typeof sampleRunnerRoute).toBe('function');
    expect(typeof sampleRunnerPhysicalTouchPoint).toBe('function');
    expect(typeof findRunnerBaseTouchTick).toBe('function');
    expect(typeof findRunnerBaseTouchTickOnTrajectory).toBe('function');
    expect(typeof findBatterRunnerPostLaunchBaseTouchTick).toBe('function');
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

  it('exposes physical throw-reception contact through Core', () => {
    expect(typeof createCatchRetentionContactFromAcceleratedReception).toBe('function');
  });

  it('exposes defender base-foot reach physics through Core', () => {
    expect(typeof planDefenderBaseFootReachPrimitive).toBe('function');
  });

  it('exposes defender controlled-base physics through Core', () => {
    expect(typeof findDefenderFootBaseContactTick).toBe('function');
    expect(typeof findDefenderControlledBaseContactTick).toBe('function');
    expect(typeof createControlledBaseContactFactFromDefenderPhysics).toBe('function');
    expect(typeof createControlledBaseContactFactFromCatchOutcomePhysics).toBe('function');
  });

  it('exposes the end-to-end first-base physical race through Core', () => {
    expect(typeof resolveFirstBasePhysicalRace).toBe('function');
    expect(typeof resolveGroundBallFirstBasePhysicalRace).toBe('function');
  });

  it('exposes batter-runner physical-to-rule first-base adapters through Core', () => {
    expect(typeof createBatterRunnerFirstBaseTouchFactFromTimeline).toBe('function');
    expect(typeof resolveBatterRunnerFirstBaseFromTimeline).toBe('function');
    expect(typeof resolveBatterRunnerFirstBaseFromPhysicalRace).toBe('function');
    expect(typeof resolveBatterRunnerFirstBaseFromPhysicalCatchRace).toBe('function');
    expect(typeof resolveGroundBallFirstBaseRuleFromTimeline).toBe('function');
    expect(typeof resolveGroundBallFirstBaseRuleFromPhysicalRace).toBe('function');
  });

  it('exposes pitch-count, foul-ball, and infield-fly semantics through the shared Core API', () => {
    expect(typeof resolvePitchCountRule).toBe('function');
    expect(typeof resolveFoulBallRule).toBe('function');
    expect(typeof resolveInfieldFlyRule).toBe('function');
    expect(typeof resolveHalfInningTransition).toBe('function');
  });

  it('exposes physical pitch crossing, taken pitches, and swinging pitches through Core', () => {
    expect(typeof findPitchPlateCrossing).toBe('function');
    expect(typeof resolveTakenPitchPhysicalResult).toBe('function');
    expect(typeof recordTakenPitchPhysicalResult).toBe('function');
    expect(typeof resolveSwingingPitchPhysicalResult).toBe('function');
    expect(typeof recordSwingingPitchPhysicalResult).toBe('function');
  });

  it('exposes the canonical plate-appearance timeline through Core', () => {
    expect(typeof createCanonicalPlateAppearanceTimeline).toBe('function');
    expect(typeof recordCountedPitch).toBe('function');
    expect(typeof recordBatBallContact).toBe('function');
    expect(typeof recordFairBattedBall).toBe('function');
    expect(typeof recordFoulBattedBall).toBe('function');
    expect(typeof recordLiveBallPlayEnd).toBe('function');
    expect(typeof applyStrikeoutPlateAppearanceToMatchState).toBe('function');
    expect(typeof applyWalkPlateAppearanceToMatchState).toBe('function');
    expect(typeof resolveWalkForcedAdvancement).toBe('function');
    expect(typeof applyResolvedLiveBallPlateAppearanceToMatchState).toBe('function');
    expect(typeof createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule).toBe('function');
    expect(typeof completeGroundBallFirstBasePlateAppearance).toBe('function');
  });

  it('exposes the first Correct Rule Result foundation through the shared Core API', () => {
    expect(typeof resolveBatterRunnerFirstBase).toBe('function');
    expect(typeof resolveThirdOutScoring).toBe('function');
    expect(typeof resolveGroundBallFirstBaseRule).toBe('function');
  });

  it('exposes NPB 2026 stadium infield boundary rules through Core', () => {
    expect(typeof createInfieldBoundaryRegion).toBe('function');
    expect(typeof evaluatePitchingMotionInfieldBoundary).toBe('function');
    expect(typeof evaluatePitchingMotionInfieldBoundaryForMatch).toBe('function');
    expect(typeof normalizeInfieldBoundaryViolation).toBe('function');
  });

  it('exposes NPB 2026 defensive alignment penalty resolution through Core', () => {
    expect(typeof createFirstPostPitchInfielderTouchFact).toBe('function');
    expect(typeof normalizeInningInfieldSideLockViolation).toBe('function');
    expect(typeof createNaturalPlayAdvancementResult).toBe('function');
    expect(typeof resolveNPB2026AlignmentViolationPenalty).toBe('function');
    expect(typeof resolveDefensiveAlignmentViolationPenaltyForMatch).toBe('function');
  });

  it('exposes NPB half-inning infield side locking through Core', () => {
    expect(typeof establishInningInfieldSideAssignment).toBe('function');
    expect(typeof evaluateInningInfieldSideLock).toBe('function');
    expect(typeof evaluateInningInfieldSideLockForMatch).toBe('function');
  });

  it('exposes NPB 2026 pitch-release defensive alignment rules through Core', () => {
    expect(typeof createDefenderFootPlacementFact).toBe('function');
    expect(typeof createSecondBaseDivisionReference).toBe('function');
    expect(typeof evaluatePitchReleaseInfieldSide).toBe('function');
    expect(typeof evaluatePitchReleaseInfieldSideForMatch).toBe('function');
  });

  it('exposes the versioned NPB 2026 RuleProfile boundary through Core', () => {
    expect(asRuleProfileId('npb-2026')).toBe('npb-2026');
    expect(getRuleProfile(asRuleProfileId('npb-2026')))
      .toBe(NPB_2026_RULE_PROFILE);
    expect(typeof createRuleContext).toBe('function');
    expect(typeof assertMatchRuleProfile).toBe('function');
    expect(typeof evaluateTagUpComplianceForMatch).toBe('function');
    expect(typeof resolveTagUpAppealForMatch).toBe('function');
    expect(typeof resolveAdvantageousFourthOutForMatch).toBe('function');
  });

  it('exposes runner-precedence-aware advantageous fourth-out scoring through Core', () => {
    expect(typeof createRunnerPrecedence).toBe('function');
    expect(typeof evaluateSustainedTagUpAppealScoring).toBe('function');
    expect(typeof createAppealScoringOption).toBe('function');
    expect(typeof createThirdOutScoringOption).toBe('function');
    expect(typeof selectAdvantageousInningEndingOut).toBe('function');
    expect(typeof createTagUpAppealInningEndingOption).toBe('function');
    expect(typeof createExistingThirdOutInningEndingOption).toBe('function');
    expect(typeof resolveAdvantageousAppealOutOptions).toBe('function');
  });

  it('exposes explicit tag-up appeal rules through the shared Core API', () => {
    expect(typeof createDefensiveAppealAttemptFact).toBe('function');
    expect(typeof createAppealWindow).toBe('function');
    expect(typeof closeAppealWindow).toBe('function');
    expect(typeof resolveTagUpAppeal).toBe('function');
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
