import { describe, expect, it } from 'vitest';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import {
  chooseDefensiveIntentCandidate,
  decideDefensiveIntent,
  generateDefensiveIntentCandidates,
  type DefensiveCommunicationContent,
  type DefensiveDecisionInput,
  type DefensiveIntentCandidate,
  type DefensiveKnownContext,
  type DefensivePerceivedCue,
  type PrePlayDefensivePlan,
} from './DefensiveDecision';
import type { DefensiveDecisionTimingParameters } from './DefensiveDecisionTiming';

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
  communicationTrust: 1,
});

const timing: DefensiveDecisionTimingParameters = {
  minimumDecisionDelayTicks: 40_000,
  maximumDecisionDelayTicks: 240_000,
  fixedProcessingOffsetTicks: 10_000,
};

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

describe('DefensiveDecision local choice', () => {
  it('lets the pitcher independently choose first-base cover from its local candidates', () => {
    expect(decideDefensiveIntent(input(cues), 0.8, timing)).toEqual({
      intent: { kind: 'base_cover', base: 1 },
      selectedPriority: 0.72,
      evidenceAvailableAt: 1_130_000,
      decisionTick: 1_220_000,
    });
  });

  it('changes only the decision tick when situational awareness changes', () => {
    const fast = decideDefensiveIntent(input(cues), 0.8, timing);
    const slow = decideDefensiveIntent(input(cues), 0.2, timing);

    expect(fast.intent).toEqual({ kind: 'base_cover', base: 1 });
    expect(slow.intent).toEqual(fast.intent);
    expect(fast.selectedPriority).toBe(slow.selectedPriority);
    expect(fast.evidenceAvailableAt).toBe(slow.evidenceAvailableAt);
    expect(fast.decisionTick).toBe(1_220_000);
    expect(slow.decisionTick).toBe(1_340_000);
  });

  it('does not globally repair a missed teammate commitment', () => {
    expect(decideDefensiveIntent(input([cues[1]]), 1, timing).intent).toEqual({
      kind: 'hold',
    });
  });

  it('uses a stable intent key for exact local-priority ties, independent of candidate order', () => {
    const candidates: readonly DefensiveIntentCandidate[] = [
      {
        intent: { kind: 'hold' },
        localPriority: 0.5,
        evidenceAvailableAt: 2_000_000,
        evidenceKinds: ['pre_play_plan'],
      },
      {
        intent: { kind: 'base_cover', base: 1 },
        localPriority: 0.5,
        evidenceAvailableAt: 2_000_000,
        evidenceKinds: ['base_needs_cover'],
      },
    ];

    expect(chooseDefensiveIntentCandidate(candidates).intent).toEqual({
      kind: 'base_cover',
      base: 1,
    });
    expect(chooseDefensiveIntentCandidate([...candidates].reverse()).intent).toEqual({
      kind: 'base_cover',
      base: 1,
    });
  });
});


describe('DefensiveDecision communication evidence', () => {
  const coverCall = (
    receivedAt: number,
    confidence: number,
  ) => ({
    event: {
      sourceId: 'first-baseman',
      targetScope: { kind: 'player' as const, playerId: 'pitcher' },
      kind: 'callout' as const,
      issuedAt: 1_100_000,
      content: {
        kind: 'cover_base' as const,
        base: 1 as const,
      } satisfies DefensiveCommunicationContent,
    },
    receivedAt,
    confidence,
  });

  it('can add a local first-base cover candidate after a recognized callout arrives', () => {
    const world = perceivedWorld();
    const decisionInput: DefensiveDecisionInput = {
      ...input([]),
      communicationTrust: 0.8,
      perceivedWorld: {
        ...world,
        communications: [coverCall(1_150_000, 0.9)],
      },
    };

    const candidates = generateDefensiveIntentCandidates(decisionInput);
    const cover = candidates.find((candidate) => (
      candidate.intent.kind === 'base_cover' && candidate.intent.base === 1
    ));

    expect(cover).toEqual({
      intent: { kind: 'base_cover', base: 1 },
      localPriority: 0.6480000000000001,
      evidenceAvailableAt: 1_150_000,
      evidenceKinds: ['communication:cover_base', 'pre_play_plan'],
    });
    expect(decideDefensiveIntent(decisionInput, 1, timing).intent).toEqual({
      kind: 'base_cover',
      base: 1,
    });
  });

  it('does not expose a callout before its receivedAt tick', () => {
    const world = perceivedWorld();
    const decisionInput: DefensiveDecisionInput = {
      ...input([]),
      perceivedWorld: {
        ...world,
        communications: [coverCall(1_200_001, 1)],
      },
    };

    expect(generateDefensiveIntentCandidates(decisionInput).some((candidate) => (
      candidate.intent.kind === 'base_cover'
    ))).toBe(false);
  });

  it('does not force obedience when another local candidate has higher priority', () => {
    const world = perceivedWorld();
    const decisionInput: DefensiveDecisionInput = {
      ...input([]),
      communicationTrust: 0.5,
      prePlayPlan: {
        ...plan,
        holdPriority: 0.8,
      },
      perceivedWorld: {
        ...world,
        communications: [coverCall(1_150_000, 0.9)],
      },
    };

    expect(decideDefensiveIntent(decisionInput, 1, timing).intent).toEqual({
      kind: 'hold',
    });
  });

  it('ignores a player-targeted callout meant for someone else', () => {
    const world = perceivedWorld();
    const wrongTarget = {
      ...coverCall(1_150_000, 1),
      event: {
        ...coverCall(1_150_000, 1).event,
        targetScope: { kind: 'player' as const, playerId: 'shortstop' },
      },
    };
    const decisionInput: DefensiveDecisionInput = {
      ...input([]),
      perceivedWorld: {
        ...world,
        communications: [wrongTarget],
      },
    };

    expect(generateDefensiveIntentCandidates(decisionInput).some((candidate) => (
      candidate.intent.kind === 'base_cover'
    ))).toBe(false);
  });
});
