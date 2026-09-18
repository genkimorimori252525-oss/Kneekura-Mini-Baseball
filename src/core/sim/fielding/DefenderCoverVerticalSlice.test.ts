import { describe, expect, it } from 'vitest';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import {
  decideDefensiveIntent,
  type DefensiveDecisionInput,
  type DefensiveKnownContext,
} from './DefensiveDecision';
import type { DefensiveDecisionTimingParameters } from './DefensiveDecisionTiming';
import {
  advanceDefenderMotion,
  type DefenderMotionParameters,
} from './DefenderMotion';
import {
  resolveDefensiveMovementTarget,
  type DefensiveFieldLandmarks,
} from './DefensiveMovementTarget';

const perceivedWorld: PlayerPerceivedWorldState<DefensiveKnownContext> = {
  observerId: 'pitcher',
  observationTime: 1_200_000,
  attention: {
    target: { kind: 'player', playerId: 'first-baseman' },
    focusedSinceTick: 1_050_000,
  },
  ball: null,
  players: [{
    playerId: 'first-baseman',
    memory: {
      estimate: {
        position: { x: 2, z: 3 },
        velocity: { x: -1, z: 2 },
      },
      sourceObservedAt: 1_100_000,
      predictedAt: 1_200_000,
      confidence: 0.88,
    },
  }],
  communications: [],
  knownContext: {
    outs: 1,
    occupiedBases: [1],
  },
};

const decisionInput: DefensiveDecisionInput = {
  perceivedWorld,
  self: {
    playerId: 'pitcher',
    registeredPosition: 'P',
    position: { x: 0, z: 0 },
  },
  prePlayPlan: {
    ballPursuitPriority: 0.35,
    baseCoverPriorities: [{ base: 1, priority: 0.9 }],
    relayPriority: 0.5,
    backupPriority: 0.45,
    deepCoveragePriority: 0.3,
    holdPriority: 0.1,
  },
  perceivedCues: [{
    kind: 'teammate_ball_commitment',
    playerId: 'first-baseman',
    observedAt: 1_120_000,
    confidence: 0.8,
  }, {
    kind: 'base_needs_cover',
    base: 1,
    observedAt: 1_130_000,
    confidence: 0.9,
  }],
  minimumCueConfidence: 0.5,
  communicationTrust: 1,
};

const timing: DefensiveDecisionTimingParameters = {
  minimumDecisionDelayTicks: 40_000,
  maximumDecisionDelayTicks: 240_000,
  fixedProcessingOffsetTicks: 10_000,
};

const motion: DefenderMotionParameters = {
  ticksPerSecond: 1_000_000,
  maxIntegrationStepTicks: 2_000,
  accelerationMps2: 4,
  brakingMps2: 4,
  topSpeedMps: 8,
  arrivalRadiusMeters: 0.05,
};

const landmarks: DefensiveFieldLandmarks = {
  basePositions: {
    1: { x: 27.43, z: 0 },
    2: { x: 27.43, z: 27.43 },
    3: { x: 0, z: 27.43 },
    4: { x: 0, z: 0 },
  },
};

describe('individual first-base cover physical vertical slice', () => {
  it('turns awareness timing into a real position difference with identical movement ability', () => {
    const fastDecision = decideDefensiveIntent(decisionInput, 0.8, timing);
    const slowDecision = decideDefensiveIntent(decisionInput, 0.2, timing);

    expect(fastDecision.intent).toEqual({ kind: 'base_cover', base: 1 });
    expect(slowDecision.intent).toEqual(fastDecision.intent);

    const target = resolveDefensiveMovementTarget(
      fastDecision.intent,
      perceivedWorld,
      landmarks,
    );
    expect(target).toEqual({ x: 27.43, z: 0 });

    const commonTick = 1_500_000;
    const fast = advanceDefenderMotion({
      tick: fastDecision.decisionTick,
      position: { x: 0, z: 0 },
      velocity: { x: 0, z: 0 },
    }, target, commonTick - fastDecision.decisionTick, motion);
    const slow = advanceDefenderMotion({
      tick: slowDecision.decisionTick,
      position: { x: 0, z: 0 },
      velocity: { x: 0, z: 0 },
    }, target, commonTick - slowDecision.decisionTick, motion);

    expect(fast.tick).toBe(commonTick);
    expect(slow.tick).toBe(commonTick);
    expect(fast.position.x).toBeCloseTo(0.1568, 8);
    expect(slow.position.x).toBeCloseTo(0.0512, 8);
    expect(fast.position.x).toBeGreaterThan(slow.position.x);
  });

  it('does not globally invent cover movement when the pitcher missed teammate commitment', () => {
    const missed: DefensiveDecisionInput = {
      ...decisionInput,
      perceivedCues: [{
        kind: 'base_needs_cover',
        base: 1,
        observedAt: 1_130_000,
        confidence: 0.9,
      }],
    };
    const decision = decideDefensiveIntent(missed, 1, timing);
    const target = resolveDefensiveMovementTarget(
      decision.intent,
      perceivedWorld,
      landmarks,
    );

    expect(decision.intent).toEqual({ kind: 'hold' });
    expect(target).toBeNull();

    const result = advanceDefenderMotion({
      tick: decision.decisionTick,
      position: { x: 0, z: 0 },
      velocity: { x: 0, z: 0 },
    }, target, 200_000, motion);

    expect(result.position).toEqual({ x: 0, z: 0 });
    expect(result.velocity).toEqual({ x: 0, z: 0 });
  });
});
