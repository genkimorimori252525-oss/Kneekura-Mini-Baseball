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

const candidate = (
  intent: DefensiveIntentCandidate['intent'],
  localPriority: number,
): DefensiveIntentCandidate => ({
  intent,
  localPriority,
  evidenceAvailableAt: 1_000_000,
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

const ordinaryFixture = (): readonly DefenderCoverageCandidateSet[] => [
  set('p', 'P', [
    candidate({ kind: 'base_cover', base: 1 }, 0.9),
    candidate({ kind: 'ball_handler' }, 0.3),
    candidate({ kind: 'hold' }, 0.05),
  ]),
  set('c', 'C', [
    candidate({ kind: 'base_cover', base: 4 }, 0.8),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('1b', '1B', [
    candidate({ kind: 'ball_handler' }, 0.95),
    candidate({ kind: 'base_cover', base: 1 }, 0.4),
    candidate({ kind: 'hold' }, 0.05),
  ]),
  set('2b', '2B', [
    candidate({ kind: 'base_cover', base: 2 }, 0.8),
    candidate({ kind: 'hold' }, 0.1),
  ]),
  set('3b', '3B', [
    candidate({ kind: 'base_cover', base: 3 }, 0.7),
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

describe('TeamCoveragePlan', () => {
  it('assigns one ball handler and non-conflicting base covers across all nine defenders', () => {
    const plan = createTeamCoveragePlan({
      defenders: ordinaryFixture(),
      requireBallHandler: true,
    });

    expect(plan.assignments).toHaveLength(9);
    expect(plan.assignments.filter(
      (assignment) => (
        assignment.intent.kind === 'ball_handler'
      ),
    )).toHaveLength(1);

    expect(
      plan.assignments.find(
        (assignment) => assignment.playerId === '1b',
      )?.intent,
    ).toEqual({ kind: 'ball_handler' });
    expect(
      plan.assignments.find(
        (assignment) => assignment.playerId === 'p',
      )?.intent,
    ).toEqual({ kind: 'base_cover', base: 1 });

    const coveredBases = plan.assignments
      .filter((assignment) => (
        assignment.intent.kind === 'base_cover'
      ))
      .map((assignment) => (
        assignment.intent.kind === 'base_cover'
          ? assignment.intent.base
          : null
      ));
    expect(new Set(coveredBases).size)
      .toBe(coveredBases.length);
  });

  it('beats a greedy per-player first-choice assignment when team role constraints interact', () => {
    const defenders: readonly DefenderCoverageCandidateSet[] = [
      set('a', '1B', [
        candidate({ kind: 'ball_handler' }, 0.9),
        candidate({ kind: 'base_cover', base: 1 }, 0.89),
        candidate({ kind: 'hold' }, 0),
      ]),
      set('b', '2B', [
        candidate({ kind: 'ball_handler' }, 0.88),
        candidate({ kind: 'hold' }, 0),
      ]),
      set('c', 'C', [candidate({ kind: 'hold' }, 0)]),
      set('p', 'P', [candidate({ kind: 'hold' }, 0)]),
      set('3b', '3B', [candidate({ kind: 'hold' }, 0)]),
      set('ss', 'SS', [candidate({ kind: 'hold' }, 0)]),
      set('lf', 'LF', [candidate({ kind: 'hold' }, 0)]),
      set('cf', 'CF', [candidate({ kind: 'hold' }, 0)]),
      set('rf', 'RF', [candidate({ kind: 'hold' }, 0)]),
    ];

    const plan = createTeamCoveragePlan({
      defenders,
      requireBallHandler: true,
    });

    expect(
      plan.assignments.find(
        (assignment) => assignment.playerId === 'a',
      )?.intent,
    ).toEqual({ kind: 'base_cover', base: 1 });
    expect(
      plan.assignments.find(
        (assignment) => assignment.playerId === 'b',
      )?.intent,
    ).toEqual({ kind: 'ball_handler' });
    expect(plan.totalPriority).toBeCloseTo(1.77, 12);
  });

  it('chooses only one defender for the same base-cover obligation', () => {
    const fixture = ordinaryFixture().map((entry) => (
      entry.playerId === '2b'
        ? {
            ...entry,
            candidates: [
              candidate(
                { kind: 'base_cover', base: 1 },
                0.85,
              ),
              ...entry.candidates,
            ],
          }
        : entry
    ));

    const plan = createTeamCoveragePlan({
      defenders: fixture,
      requireBallHandler: true,
    });

    const firstBaseCovers = plan.assignments.filter(
      (assignment) => (
        assignment.intent.kind === 'base_cover'
        && assignment.intent.base === 1
      ),
    );

    expect(firstBaseCovers).toHaveLength(1);
    expect(firstBaseCovers[0].playerId).toBe('p');
  });

  it('is deterministic and independent of defender input ordering', () => {
    const forward = createTeamCoveragePlan({
      defenders: ordinaryFixture(),
      requireBallHandler: true,
    });
    const reversed = createTeamCoveragePlan({
      defenders: [...ordinaryFixture()].reverse(),
      requireBallHandler: true,
    });

    expect(reversed).toEqual(forward);
  });

  it('fails explicitly when a required ball handler cannot be assigned', () => {
    const noHandler = ordinaryFixture().map((entry) => ({
      ...entry,
      candidates: entry.candidates.filter(
        (item) => item.intent.kind !== 'ball_handler',
      ),
    }));

    expect(() => createTeamCoveragePlan({
      defenders: noHandler,
      requireBallHandler: true,
    })).toThrow(
      'no valid team coverage plan satisfies the role constraints',
    );
  });

  it('requires exactly nine unique defenders', () => {
    expect(() => createTeamCoveragePlan({
      defenders: ordinaryFixture().slice(0, 8),
      requireBallHandler: true,
    })).toThrow(
      'team coverage plan requires exactly nine defenders',
    );
  });
});
