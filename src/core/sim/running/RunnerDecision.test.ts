import { describe, expect, it } from 'vitest';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import {
  decideRunnerMotionIntent,
  type RunnerDecisionInput,
  type RunnerKnownContext,
} from './RunnerDecision';

const timing = {
  minimumDecisionDelayTicks: 30_000,
  maximumDecisionDelayTicks: 180_000,
  fixedRecognitionOffsetTicks: 10_000,
} as const;

const world = (
  knownContext: RunnerKnownContext,
  communications:
    PlayerPerceivedWorldState<RunnerKnownContext>['communications'] = [],
): PlayerPerceivedWorldState<RunnerKnownContext> => ({
  observerId: 'runner',
  observationTime: 1_000_000,
  attention: {
    target: { kind: 'base', base: knownContext.nextBase },
    focusedSinceTick: 900_000,
  },
  ball: null,
  players: [],
  communications,
  knownContext,
});

const baseContext: RunnerKnownContext = {
  currentBase: 1,
  nextBase: 2,
  forcedToAdvance: false,
  tagUp: { kind: 'none' },
};

const input = (
  overrides: Partial<RunnerDecisionInput> = {},
): RunnerDecisionInput => ({
  runnerId: 'runner',
  perceivedWorld: world(baseContext),
  perceivedCues: [{
    kind: 'next_base_race',
    observedAt: 980_000,
    confidence: 0.9,
    runnerArrivalTick: 1_800_000,
    defenderControlTick: 1_950_000,
  }],
  minimumCueConfidence: 0.5,
  coachTrust: 1,
  minimumAdvanceSafetyMarginTicks: 50_000,
  decisionAbility: 0.8,
  timingParameters: timing,
  ...overrides,
});

describe('RunnerDecision', () => {
  it('advances when the perceived next-base race clears the safety margin', () => {
    const result = decideRunnerMotionIntent(
      input(),
    );

    expect(result.reason).toBe('next_base_race');
    expect(result.perceivedRaceMarginTicks)
      .toBe(150_000);
    expect(result.motionIntent.kind).toBe('advance');
    expect(result.motionIntent.issuedTick)
      .toBe(result.decisionTick);
  });

  it('holds when the perceived next-base race is too tight', () => {
    const result = decideRunnerMotionIntent(
      input({
        perceivedCues: [{
          kind: 'next_base_race',
          observedAt: 980_000,
          confidence: 0.9,
          runnerArrivalTick: 1_900_000,
          defenderControlTick: 1_920_000,
        }],
      }),
    );

    expect(result.motionIntent.kind).toBe('hold');
    expect(result.perceivedRaceMarginTicks)
      .toBe(20_000);
  });

  it('advances on a force obligation even when the optional race would be bad', () => {
    const result = decideRunnerMotionIntent(
      input({
        perceivedWorld: world({
          ...baseContext,
          forcedToAdvance: true,
        }),
        perceivedCues: [{
          kind: 'next_base_race',
          observedAt: 980_000,
          confidence: 0.9,
          runnerArrivalTick: 2_000_000,
          defenderControlTick: 1_700_000,
        }],
      }),
    );

    expect(result.reason).toBe('forced_advance');
    expect(result.motionIntent.kind).toBe('advance');
  });

  it('holds while the runner is still awaiting perceived first fielder touch', () => {
    const result = decideRunnerMotionIntent(
      input({
        perceivedWorld: world({
          ...baseContext,
          tagUp: {
            kind: 'awaiting_first_touch',
          },
        }),
      }),
    );

    expect(result.reason).toBe('tag_up_wait');
    expect(result.motionIntent.kind).toBe('hold');
  });

  it('retreats to satisfy tag-up retouch before considering an advance signal', () => {
    const coach = {
      event: {
        sourceId: 'third-base-coach',
        targetScope: {
          kind: 'player' as const,
          playerId: 'runner',
        },
        kind: 'coach_signal' as const,
        issuedAt: 930_000,
        content: {
          kind: 'runner_action' as const,
          action: 'advance' as const,
        },
      },
      receivedAt: 970_000,
      confidence: 0.95,
    };

    const result = decideRunnerMotionIntent(
      input({
        perceivedWorld: world({
          ...baseContext,
          tagUp: {
            kind: 'must_retouch',
            originBase: 1,
          },
        }, [coach]),
      }),
    );

    expect(result.reason).toBe('tag_up_retouch');
    expect(result.motionIntent.kind).toBe('retreat');
  });

  it('retreats from a current-base pickoff/tag threat before considering an optional advance', () => {
    const result = decideRunnerMotionIntent(
      input({
        perceivedCues: [
          {
            kind: 'next_base_race',
            observedAt: 980_000,
            confidence: 0.9,
            runnerArrivalTick: 1_800_000,
            defenderControlTick: 2_100_000,
          },
          {
            kind: 'current_base_threat',
            observedAt: 990_000,
            confidence: 0.9,
            runnerReturnTick: 1_250_000,
            defenderTagTick: 1_220_000,
          },
        ],
      }),
    );

    expect(result.reason).toBe('current_base_threat');
    expect(result.motionIntent.kind).toBe('retreat');
  });

  it('can follow an already received coach instruction when no higher-priority obligation exists', () => {
    const coach = {
      event: {
        sourceId: 'first-base-coach',
        targetScope: { kind: 'team' as const },
        kind: 'coach_signal' as const,
        issuedAt: 930_000,
        content: {
          kind: 'runner_action' as const,
          action: 'advance' as const,
        },
      },
      receivedAt: 960_000,
      confidence: 0.9,
    };

    const result = decideRunnerMotionIntent(
      input({
        perceivedWorld: world(
          baseContext,
          [coach],
        ),
        perceivedCues: [],
      }),
    );

    expect(result.reason).toBe('coach_instruction');
    expect(result.motionIntent.kind).toBe('advance');
    expect(result.evidenceAvailableAt).toBe(960_000);
  });

  it('does not use a coach communication that has not arrived yet', () => {
    const futureCoach = {
      event: {
        sourceId: 'first-base-coach',
        targetScope: { kind: 'team' as const },
        kind: 'coach_signal' as const,
        issuedAt: 990_000,
        content: {
          kind: 'runner_action' as const,
          action: 'advance' as const,
        },
      },
      receivedAt: 1_010_000,
      confidence: 1,
    };

    const result = decideRunnerMotionIntent(
      input({
        perceivedWorld: world(
          baseContext,
          [futureCoach],
        ),
        perceivedCues: [],
      }),
    );

    expect(result.reason).toBe('no_actionable_evidence');
    expect(result.motionIntent.kind).toBe('hold');
  });

  it('changes cognitive issue time with decision ability without changing the chosen action', () => {
    const slow = decideRunnerMotionIntent(
      input({ decisionAbility: 0 }),
    );
    const fast = decideRunnerMotionIntent(
      input({ decisionAbility: 1 }),
    );

    expect(slow.motionIntent.kind)
      .toBe(fast.motionIntent.kind);
    expect(fast.decisionTick)
      .toBeLessThan(slow.decisionTick);
  });
});
