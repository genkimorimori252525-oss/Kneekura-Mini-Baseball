import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
} from '../../model/DefensiveRatings';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import type {
  CoverageThrowPlanSelection,
} from './CoverageThrowPlan';
import {
  createCoverageThrowLaunch,
} from './CoverageThrowExecution';

const ratings = createDefensiveRatings({
  positionSuitability: {
    P: 0.5,
    C: 0.5,
    '1B': 0.8,
    '2B': 0.5,
    '3B': 0.5,
    SS: 0.5,
    LF: 0.5,
    CF: 0.5,
    RF: 0.5,
  },
  firstStep: 0.5,
  acceleration: 0.5,
  battedBallRead: 0.5,
  routeEfficiency: 0.5,
  catching: 0.5,
  transfer: 0.5,
  armStrength: 0.75,
  throwingAccuracy: 0.8,
  situationalAwareness: 0.5,
  tagSkill: 0.5,
});

const selection: CoverageThrowPlanSelection = {
  throwerId: '1b',
  selection: {
    selected: {
      id: 'home',
      targetBase: 4,
      receiverId: 'c',
      estimatedCompletionTick: 5_360_000,
      outProbability: 0.62,
      scoringThreats: [{
        runnerId: 'winning-run',
        scoreProbability: 0.08,
      }],
      expectedExtraBasesAllowed: 0.7,
    },
    evaluations: [{
      id: 'home',
      immediateLossProbability: 0.08,
      criticalScoreSwingProbability: 0.08,
      expectedRunsAllowed: 0.08,
      outProbability: 0.62,
      expectedExtraBasesAllowed: 0.7,
      estimatedCompletionTick: 5_360_000,
    }],
  },
};

describe('CoverageThrowExecution', () => {
  it('turns the selected team throw target into the existing rated physical launch', () => {
    const result = createCoverageThrowLaunch({
      selection,
      releaseTick: 5_000_000,
      origin: { x: 24, y: 1.4, z: 5 },
      receiverTarget: {
        playerId: 'c',
        position: { x: 0, y: 1, z: 0 },
      },
      throwerRatings: ratings,
      rng: new DeterministicRng(20260918),
      calibration: {
        minimumReleaseSpeedMps: 20,
        maximumReleaseSpeedMps: 40,
        minimumTargetErrorMeters: 0.02,
        maximumTargetErrorMeters: 0.42,
      },
    });

    expect(result.throwerId).toBe('1b');
    expect(result.receiverId).toBe('c');
    expect(result.targetBase).toBe(4);
    expect(result.launch.releaseSpeedMps)
      .toBeCloseTo(35, 12);
    expect(Math.hypot(
      result.launch.initialVelocity.x,
      result.launch.initialVelocity.y,
      result.launch.initialVelocity.z,
    )).toBeCloseTo(35, 12);
  });

  it('rejects a receiver target that does not match the selected coverage receiver', () => {
    expect(() => createCoverageThrowLaunch({
      selection,
      releaseTick: 5_000_000,
      origin: { x: 24, y: 1.4, z: 5 },
      receiverTarget: {
        playerId: 'p',
        position: { x: 27, y: 1, z: 0 },
      },
      throwerRatings: ratings,
      rng: new DeterministicRng(20260918),
      calibration: {
        minimumReleaseSpeedMps: 20,
        maximumReleaseSpeedMps: 40,
        minimumTargetErrorMeters: 0.02,
        maximumTargetErrorMeters: 0.42,
      },
    })).toThrow(
      'receiver target must match selected throw-plan receiver',
    );
  });
});
