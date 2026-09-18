import { describe, expect, it } from 'vitest';
import type {
  DefenderWorldState,
} from '../../model/CanonicalWorldSnapshot';
import {
  applyTeamCoveragePlanToWorld,
} from './TeamCoverageWorldAdapter';
import type {
  TeamCoveragePlan,
} from './TeamCoveragePlan';

const defenders: readonly DefenderWorldState[] = [
  {
    playerId: 'p',
    registeredPosition: 'P',
    position: { x: 0, z: 18 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'c',
    registeredPosition: 'C',
    position: { x: 0, z: -2 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: '1b',
    registeredPosition: '1B',
    position: { x: 18, z: 20 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: '2b',
    registeredPosition: '2B',
    position: { x: 8, z: 24 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: '3b',
    registeredPosition: '3B',
    position: { x: -20, z: 20 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'ss',
    registeredPosition: 'SS',
    position: { x: -8, z: 24 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'lf',
    registeredPosition: 'LF',
    position: { x: -30, z: 55 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'cf',
    registeredPosition: 'CF',
    position: { x: 0, z: 22 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
  {
    playerId: 'rf',
    registeredPosition: 'RF',
    position: { x: 30, z: 55 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  },
];

const plan: TeamCoveragePlan = {
  totalPriority: 6.1,
  assignments: [
    {
      playerId: '1b',
      registeredPosition: '1B',
      intent: { kind: 'ball_handler' },
      selectedPriority: 0.95,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: '2b',
      registeredPosition: '2B',
      intent: { kind: 'base_cover', base: 2 },
      selectedPriority: 0.8,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: '3b',
      registeredPosition: '3B',
      intent: { kind: 'base_cover', base: 3 },
      selectedPriority: 0.7,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'c',
      registeredPosition: 'C',
      intent: { kind: 'base_cover', base: 4 },
      selectedPriority: 0.8,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'cf',
      registeredPosition: 'CF',
      intent: {
        kind: 'backup',
        target: { x: 0, z: 40 },
      },
      selectedPriority: 0.6,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'lf',
      registeredPosition: 'LF',
      intent: {
        kind: 'deep_coverage',
        target: { x: -28, z: 60 },
      },
      selectedPriority: 0.6,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'p',
      registeredPosition: 'P',
      intent: { kind: 'base_cover', base: 1 },
      selectedPriority: 0.9,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'rf',
      registeredPosition: 'RF',
      intent: { kind: 'hold' },
      selectedPriority: 0.2,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'ss',
      registeredPosition: 'SS',
      intent: {
        kind: 'relay',
        target: { x: 12, z: 28 },
      },
      selectedPriority: 0.55,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
  ],
};

describe('TeamCoverageWorldAdapter', () => {
  it('writes the coordinated team roles into world state without moving any defender', () => {
    const result = applyTeamCoveragePlanToWorld(
      defenders,
      plan,
    );

    expect(result).toHaveLength(9);

    const cf = result.find(
      (defender) => defender.playerId === 'cf',
    );
    expect(cf).toEqual({
      playerId: 'cf',
      registeredPosition: 'CF',
      position: { x: 0, z: 22 },
      velocity: { x: 0, z: 0 },
      assignment: {
        kind: 'backup',
        target: { x: 0, z: 40 },
      },
    });

    const firstBaseman = result.find(
      (defender) => defender.playerId === '1b',
    );
    expect(firstBaseman?.assignment)
      .toEqual({ kind: 'ball_handler' });

    const pitcher = result.find(
      (defender) => defender.playerId === 'p',
    );
    expect(pitcher?.assignment)
      .toEqual({ kind: 'base_cover', base: 1 });
  });

  it('preserves arbitrary shifted coordinates and physical velocity exactly', () => {
    const moving = defenders.map((defender) => (
      defender.playerId === 'cf'
        ? {
            ...defender,
            velocity: { x: 1.2, z: -0.4 },
          }
        : defender
    ));

    const result = applyTeamCoveragePlanToWorld(
      moving,
      plan,
    );

    const cf = result.find(
      (defender) => defender.playerId === 'cf',
    );
    expect(cf?.position).toEqual({ x: 0, z: 22 });
    expect(cf?.velocity).toEqual({
      x: 1.2,
      z: -0.4,
    });
  });

  it('rejects a plan whose player identity or registered position disagrees with the world', () => {
    const mismatched: TeamCoveragePlan = {
      ...plan,
      assignments: plan.assignments.map(
        (assignment) => (
          assignment.playerId === 'cf'
            ? {
                ...assignment,
                registeredPosition: 'RF' as const,
              }
            : assignment
        ),
      ),
    };

    expect(() => applyTeamCoveragePlanToWorld(
      defenders,
      mismatched,
    )).toThrow(
      'team coverage assignment registeredPosition must match world state',
    );
  });
});
