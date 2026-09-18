import { describe, expect, it } from 'vitest';
import {
  CORE_PROTOCOL_VERSION,
  advanceRunnerMotion,
  buildPlayerPerceivedWorldState,
  capturePlanarObservation,
  captureSpatialObservation,
  composeObservationQuality,
  createLiveBallCatchOutcome,
  createObservationSample,
  createSecuredCatchOutcome,
  evaluateCatchRetentionLoad,
  decideDefensiveIntent,
  evaluateObservationGeometry,
  estimateOcclusionVisibility,
  findBaseTouchTick,
  findNextDefensiveReplanTick,
  findFirstTrueTick,
  findGloveBallContactTick,
  findRunnerBaseTouchTick,
  findSecureCatchTick,
  findTagContactTick,
  findThrowReleaseTick,
  isObservationRefreshDue,
  predictPlanarObservationMemory,
  generateDefensiveIntentCandidates,
  projectRunnerWorldState,
  resolveCatchRetention,
  resolveDefensiveDecisionTiming,
  resolveCommunicationReception,
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

  it('exposes exact physical tag contact timing through the shared Core API', () => {
    expect(typeof findTagContactTick).toBe('function');
  });

  it('exposes exact throw release timing through the shared Core API', () => {
    expect(typeof findThrowReleaseTick).toBe('function');
  });
});
