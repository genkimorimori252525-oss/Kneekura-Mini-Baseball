import { describe, expect, it } from 'vitest';
import { cameraForScene, MINI_PITCH_BALL_VISUAL_SAMPLE_US,
  MINI_BATTED_BALL_VISUAL_SAMPLE_US, sceneCutPolicy, runnerNameInk } from './BroadcastScenePolicy';

const before = {
  chosenCamera: 'batter' as const, autoOverhead: true, contactOccurred: false,
  followThroughComplete: false, batterHasStartedRunning: false,
  uncertainFairFoul: false, fair: false,
};
const baseCut = {
  kind: 'foul' as const, elapsedSinceContactUs: 0,
  tapAtElapsedUs: null, ballResolved: false, playClosed: false,
  runnerPerspective: false, followThroughComplete: false,
};

describe('TBD/LAD presentation-only scene policy', () => {
  it('samples just the pitch ball at 1.2x current cadence', () => {
    expect(MINI_PITCH_BALL_VISUAL_SAMPLE_US).toBeCloseTo(22_916.6666667, 5);
    expect(MINI_BATTED_BALL_VISUAL_SAMPLE_US / MINI_PITCH_BALL_VISUAL_SAMPLE_US).toBeCloseTo(1.2);
  });
  it('tracks batted ball, completes follow-through, then changes to runner POV', () => {
    expect(cameraForScene(before)).toBe('batter');
    expect(cameraForScene({ ...before, contactOccurred: true, fair: true })).toBe('batter');
    expect(cameraForScene({ ...before, contactOccurred: true, fair: true,
      followThroughComplete: true, batterHasStartedRunning: true })).toBe('runner');
    expect(cameraForScene({ ...before, contactOccurred: true, uncertainFairFoul: true,
      followThroughComplete: true, batterHasStartedRunning: true })).toBe('runner');
    expect(cameraForScene({ ...before, chosenCamera: 'catcher', contactOccurred: true, fair: true })).toBe('overhead');
  });
  it('keeps foul follow at least 2s after an early tap, at most 5s', () => {
    expect(sceneCutPolicy({ ...baseCut, elapsedSinceContactUs: 1_500_000, tapAtElapsedUs: 300_000 }).mayCut).toBe(false);
    expect(sceneCutPolicy({ ...baseCut, elapsedSinceContactUs: 2_000_000, tapAtElapsedUs: 300_000 }).kind).toBe('foul-user-skip');
    expect(sceneCutPolicy({ ...baseCut, elapsedSinceContactUs: 3_000_000, tapAtElapsedUs: 3_000_000 }).kind).toBe('foul-user-skip');
    expect(sceneCutPolicy({ ...baseCut, elapsedSinceContactUs: 4_999_999 }).mayCut).toBe(false);
    expect(sceneCutPolicy({ ...baseCut, elapsedSinceContactUs: 5_000_000 }).kind).toBe('foul-watch-expired');
  });
  it('never auto-cuts unresolved fair flight', () => {
    expect(sceneCutPolicy({ ...baseCut, kind: 'fair', elapsedSinceContactUs: 9_000_000 }).mayCut).toBe(false);
    expect(sceneCutPolicy({ ...baseCut, kind: 'fair', elapsedSinceContactUs: 9_000_000,
      ballResolved: true }).kind).toBe('fair-resolved');
    expect(sceneCutPolicy({ ...baseCut, kind: 'fair', elapsedSinceContactUs: 1_000_000,
      tapAtElapsedUs: 900_000, runnerPerspective: true, followThroughComplete: true }).kind).toBe('runner-user-skip');
  });
  it('distinguishes runner names in red only on overhead', () => {
    expect(runnerNameInk('runner', 'overhead')).toBe('#ff7777');
    expect(runnerNameInk('fielder', 'overhead')).toBeNull();
    expect(runnerNameInk('runner', 'batter')).toBeNull();
  });
});
