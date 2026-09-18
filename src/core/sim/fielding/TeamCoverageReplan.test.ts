import { describe, expect, it } from 'vitest';
import type {
  DefensivePosition,
} from '../../model/CanonicalWorldSnapshot';
import type {
  DefensiveIntentCandidate,
} from './DefensiveDecision';
import {
  createTeamCoveragePlan,
  type DefenderCoverageCandidateSet,
} from './TeamCoveragePlan';
import {
  replanTeamCoveragePlan,
} from './TeamCoverageReplan';

const candidate = (
  intent: DefensiveIntentCandidate['intent'],
  localPriority: number,
  evidenceAvailableAt = 1_000_000,
): DefensiveIntentCandidate => ({
  intent,
  localPriority,
  evidenceAvailableAt,
  evidenceKinds: ['fixture'],
});

const set = (
  playerId: string,
  registeredPosition: DefensivePosition,
  candidates: readonly DefensiveIntentCandidate[],
): DefenderCoverageCandidateSet => ({
  playerId,
  registeredPosition,
  candidates,
});

const initialSets = (): readonly DefenderCoverageCandidateSet[] => [
  set('p', 'P', [
    candidate({ kind: 'base_cover', base: 1 }, 0.9),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('c', 'C', [
    candidate({ kind: 'base_cover', base: 4 }, 0.8),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('1b', '1B', [
    candidate({ kind: 'ball_handler' }, 0.95),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('2b', '2B', [
    candidate({ kind: 'base_cover', base: 2 }, 0.8),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('3b', '3B', [
    candidate({ kind: 'base_cover', base: 3 }, 0.8),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('ss', 'SS', [
    candidate(
      { kind: 'relay', target: { x: 12, z: 28 } },
      0.7,
    ),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('lf', 'LF', [
    candidate(
      {
        kind: 'deep_coverage',
        target: { x: -28, z: 60 },
      },
      0.6,
    ),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('cf', 'CF', [
    candidate(
      { kind: 'backup', target: { x: 0, z: 40 } },
      0.6,
    ),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('rf', 'RF', [
    candidate({ kind: 'hold' }, 0.2),
  ]),
];

const changedSets = (): readonly DefenderCoverageCandidateSet[] => [
  set('p', 'P', [
    candidate({ kind: 'base_cover', base: 1 }, 0.7, 2_000_000),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('c', 'C', [
    candidate({ kind: 'base_cover', base: 4 }, 0.8, 2_000_000),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('1b', '1B', [
    candidate(
      { kind: 'base_cover', base: 1 },
      0.85,
      2_000_000,
    ),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('2b', '2B', [
    candidate(
      { kind: 'relay', target: { x: 18, z: 32 } },
      0.7,
      2_000_000,
    ),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('3b', '3B', [
    candidate({ kind: 'base_cover', base: 3 }, 0.8, 2_000_000),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('ss', 'SS', [
    candidate({ kind: 'base_cover', base: 2 }, 0.75, 2_000_000),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('lf', 'LF', [
    candidate(
      {
        kind: 'backup',
        target: { x: -18, z: 48 },
      },
      0.6,
      2_000_000,
    ),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('cf', 'CF', [
    candidate({ kind: 'ball_handler' }, 0.95, 2_000_000),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
  set('rf', 'RF', [
    candidate(
      {
        kind: 'deep_coverage',
        target: { x: 28, z: 62 },
      },
      0.6,
      2_000_000,
    ),
    candidate({ kind: 'hold' }, 0.1, 2_000_000),
  ]),
];

describe('TeamCoverageReplan', () => {
  it('replans deterministically at an explicit canonical revision tick', () => {
    const initial = createTeamCoveragePlan({
      defenders: initialSets(),
      requireBallHandler: true,
    });

    const run = () => replanTeamCoveragePlan({
      previousPlan: initial,
      nextPlanInput: {
        defenders: changedSets(),
        requireBallHandler: true,
      },
      revisionTick: 2_000_000,
      reason: 'ball_state_changed',
    });

    const first = run();
    const second = run();

    expect(first).toEqual(second);
    expect(first.revisionTick).toBe(2_000_000);
    expect(first.reason).toBe('ball_state_changed');

    expect(
      first.plan.assignments.find(
        (assignment) => (
          assignment.intent.kind === 'ball_handler'
        ),
      )?.playerId,
    ).toBe('cf');

    expect(first.changedPlayerIds)
      .toContain('1b');
    expect(first.changedPlayerIds)
      .toContain('cf');
  });

  it('records only actual role changes', () => {
    const initial = createTeamCoveragePlan({
      defenders: initialSets(),
      requireBallHandler: true,
    });

    const revision = replanTeamCoveragePlan({
      previousPlan: initial,
      nextPlanInput: {
        defenders: initialSets(),
        requireBallHandler: true,
      },
      revisionTick: 1_100_000,
      reason: 'communication_received',
    });

    expect(revision.changedPlayerIds).toEqual([]);
    expect(revision.plan).toEqual(initial);
  });

  it('rejects candidate evidence from after the revision tick', () => {
    const initial = createTeamCoveragePlan({
      defenders: initialSets(),
      requireBallHandler: true,
    });

    const future = changedSets().map((entry) => (
      entry.playerId === 'cf'
        ? {
            ...entry,
            candidates: [
              candidate(
                { kind: 'ball_handler' },
                0.95,
                2_000_001,
              ),
              candidate(
                { kind: 'hold' },
                0.1,
                2_000_000,
              ),
            ],
          }
        : entry
    ));

    expect(() => replanTeamCoveragePlan({
      previousPlan: initial,
      nextPlanInput: {
        defenders: future,
        requireBallHandler: true,
      },
      revisionTick: 2_000_000,
      reason: 'ball_state_changed',
    })).toThrow(
      'coverage replanning cannot use candidate evidence from after revisionTick',
    );
  });
});
