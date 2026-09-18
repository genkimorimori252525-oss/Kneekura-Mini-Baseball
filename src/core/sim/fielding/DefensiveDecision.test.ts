import { describe, expect, it } from 'vitest';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import {
  generateDefensiveIntentCandidates,
  type DefensiveDecisionInput,
  type DefensiveKnownContext,
  type DefensivePerceivedCue,
  type PrePlayDefensivePlan,
} from './DefensiveDecision';

const perceivedWorld = (): PlayerPerceivedWorldState<DefensiveKnownContext> => ({
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
});

const plan: PrePlayDefensivePlan = {
  ballPursuitPriority: 0.35,
  baseCoverPriorities: [
    { base: 1, priority: 0.9 },
    { base: 2, priority: 0.5 },
  ],
  relayPriority: 0.5,
  backupPriority: 0.45,
  deepCoveragePriority: 0.3,
  holdPriority: 0.1,
};

const cues: readonly DefensivePerceivedCue[] = [
  {
    kind: 'teammate_ball_commitment',
    playerId: 'first-baseman',
    observedAt: 1_120_000,
    confidence: 0.8,
  },
  {
    kind: 'base_needs_cover',
    base: 1,
    observedAt: 1_130_000,
    confidence: 0.9,
  },
];

const input = (
  perceivedCues: readonly DefensivePerceivedCue[],
): DefensiveDecisionInput => ({
  perceivedWorld: perceivedWorld(),
  self: {
    playerId: 'pitcher',
    registeredPosition: 'P',
    position: { x: 0, z: 0 },
  },
  prePlayPlan: plan,
  perceivedCues,
  minimumCueConfidence: 0.5,
});

describe('DefensiveDecision candidate generation', () => {
  it('generates first-base cover from locally perceived teammate commitment and coverage need', () => {
    const candidates = generateDefensiveIntentCandidates(input(cues));
    const cover = candidates.find((candidate) => (
      candidate.intent.kind === 'base_cover' && candidate.intent.base === 1
    ));

    expect(cover).toBeDefined();
    expect(cover?.evidenceAvailableAt).toBe(1_130_000);
    expect(cover?.localPriority).toBeCloseTo(0.72, 10);
  });

  it('does not invent first-base cover from hidden teammate truth when commitment was not perceived', () => {
    const candidates = generateDefensiveIntentCandidates(input([
      cues[1],
    ]));

    expect(candidates.some((candidate) => (
      candidate.intent.kind === 'base_cover' && candidate.intent.base === 1
    ))).toBe(false);
  });

  it('ignores a commitment cue for a teammate absent from the perceived world', () => {
    const candidates = generateDefensiveIntentCandidates(input([
      {
        kind: 'teammate_ball_commitment',
        playerId: 'shortstop-not-observed',
        observedAt: 1_120_000,
        confidence: 1,
      },
      cues[1],
    ]));

    expect(candidates.some((candidate) => (
      candidate.intent.kind === 'base_cover' && candidate.intent.base === 1
    ))).toBe(false);
  });

  it('always retains a local hold candidate instead of requiring a global assignment', () => {
    const candidates = generateDefensiveIntentCandidates(input([]));

    expect(candidates).toContainEqual({
      intent: { kind: 'hold' },
      localPriority: 0.1,
      evidenceAvailableAt: 1_200_000,
      evidenceKinds: ['pre_play_plan'],
    });
  });

  it('can consider the ball only when the observer actually has a ball memory', () => {
    const world = perceivedWorld();
    const withBall: DefensiveDecisionInput = {
      ...input([]),
      perceivedWorld: {
        ...world,
        ball: {
          estimate: {
            position: { x: 1, y: 0.3, z: 2 },
            velocity: { x: 3, y: -1, z: 4 },
          },
          sourceObservedAt: 1_150_000,
          predictedAt: 1_200_000,
          confidence: 0.8,
        },
      },
    };

    const candidates = generateDefensiveIntentCandidates(withBall);
    const ballHandler = candidates.find((candidate) => (
      candidate.intent.kind === 'ball_handler'
    ));

    expect(ballHandler?.localPriority).toBeCloseTo(0.28, 10);
  });
});
