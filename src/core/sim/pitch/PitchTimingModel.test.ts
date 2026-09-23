import { describe, expect, it } from 'vitest';
import {
  normalizePitchMotionPhaseWeights,
  projectQuickGrade,
  validatePitchTimingProfile,
  type PitchTimingProfile,
  type QuickGradeThresholds,
} from './PitchTimingModel';

const profile = (): PitchTimingProfile => ({
  baseStartIntervalUs: 1_000_000,
  normalMotionToReleaseUs: 600_000,
  followThroughUs: 200_000,
  quickSpeedFactor: 1.5,
  cadenceExecutionControl: 0.8,
  cadenceTimingKnowledge: 0.7,
  quickRepeatability: 0.6,
  naturalVariationUs: 40_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 },
  quickPhaseWeights: { gather: 1, transition: 2, stride: 3 },
});

describe('pitch timing profile', () => {
  it('validates physical source values and normalizes phase weights deterministically', () => {
    expect(validatePitchTimingProfile(profile())).toEqual(profile());
    expect(normalizePitchMotionPhaseWeights(profile().normalPhaseWeights)).toEqual({
      gather: 0.2, transition: 0.3, stride: 0.5,
    });
    expect(() => validatePitchTimingProfile({ ...profile(), normalMotionToReleaseUs: 0 }))
      .toThrow('normalMotionToReleaseUs');
    expect(() => validatePitchTimingProfile({ ...profile(), quickSpeedFactor: 0.4 }))
      .toThrow('quickSpeedFactor');
    expect(() => validatePitchTimingProfile({ ...profile(), cadenceTimingKnowledge: 1.1 }))
      .toThrow('cadenceTimingKnowledge');
    expect(() => validatePitchTimingProfile({ ...profile(), naturalVariationUs: 50_001 }))
      .toThrow('naturalVariationUs');
    expect(() => validatePitchTimingProfile({
      ...profile(), quickPhaseWeights: { gather: 1, transition: 0, stride: 1 },
    })).toThrow('quickPhaseWeights.transition');
  });

  it('keeps grade thresholds caller supplied and strictly ordered in speed', () => {
    const thresholds: QuickGradeThresholds = {
      F: 0.7, E: 0.85, D: 0.95, C: 1.05,
      B: 1.3, A: 1.6, Gold: 2.0,
    };
    expect([
      1 / 1.8, 0.75, 0.9, 1, 1.2, 1.4, 1.8, 2.5,
    ].map((factor) => projectQuickGrade(factor, thresholds)))
      .toEqual(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'Gold']);
    expect(() => projectQuickGrade(1, { ...thresholds, E: thresholds.F }))
      .toThrow('strictly increasing');
  });
});
