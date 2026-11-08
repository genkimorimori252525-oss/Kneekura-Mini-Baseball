import { describe, expect, it } from 'vitest';
import type {
  CanonicalWorldSnapshot,
  DefensivePosition,
} from '../../core/model/CanonicalWorldSnapshot';
import { createTeamCoveragePlan } from '../../core/sim/fielding/TeamCoveragePlan';
import type { DefensiveIntent } from '../../core/sim/fielding/DefensiveDecision';
import {
  inspectNativeTeamCoverageAdmission,
  type NativeTeamCoverageGateInput,
} from './TeamCoverageExecutionGate';

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const TICK = 1_000_000;

const world = (): CanonicalWorldSnapshot => ({
  tick: TICK,
  ball: { position: { x: 0, y: 1, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    spin: { x: 0, y: 0, z: 0 } },
  defenders: POSITIONS.map((registeredPosition, index) => ({
    playerId: 'fielder-' + registeredPosition,
    registeredPosition,
    position: { x: index, z: index * 2 },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' as const },
  })),
  runners: [],
});

const fixture = (overrides: Partial<Record<DefensivePosition, DefensiveIntent>> = {}): NativeTeamCoverageGateInput => {
  const plan = createTeamCoveragePlan({
    requireBallHandler: true,
    defenders: POSITIONS.map(registeredPosition => {
      const id = 'fielder-' + registeredPosition;
      const chosen = overrides[registeredPosition] ?? (
        registeredPosition === 'P' ? { kind: 'ball_handler' } : { kind: 'hold' }
      );
      return {
        playerId: id, registeredPosition,
        candidates: [{
          intent: chosen as DefensiveIntent,
          localPriority: 0.7,
          evidenceAvailableAt: TICK,
          evidenceKinds: ['source_observation', 'pre_play_plan'],
        }],
      };
    }),
  });
  return {
    reference: {
      sourceId: 'team-coverage-v1', sourceVersion: 'fixture',
      physicalPitchSourceId: 'pitch-original-v1',
      sourceHash: 'a'.repeat(64), playId: 6, revision: 1,
      observedAtTick: TICK, availableAtTick: TICK,
    },
    world: world(),
    plan,
  };
};

describe('fail-closed Native team coverage role admission', () => {
  it('keeps the original nine-person ball-handler/hold proposal pending Native acceptance', () => {
    const input = fixture();
    const original = JSON.stringify(input);
    const inspected = inspectNativeTeamCoverageAdmission(input);
    expect(inspected.status).toBe('eligible_for_individual_native_source_request');
    expect(inspected.blockedActors).toHaveLength(0);
    expect(inspected.eligibleIndividualRequests).toHaveLength(9);
    expect(inspected.eligibleIndividualRequests.filter(a => a.intent.kind === 'ball_handler'))
      .toHaveLength(1);
    expect(inspected.eligibleIndividualRequests.some(a =>
      a.playerId === 'fielder-P' && a.intent.kind === 'ball_handler',
    )).toBe(true);
    expect(inspected.teamPlanAdopted).toBe(false);
    expect(inspected.bodiesMoved).toBe(false);
    expect(inspected.physicalOutsConfirmed).toBeNull();
    expect(inspected.officialResult).toBeNull();
    expect(JSON.stringify(input)).toBe(original);
    expect(inspectNativeTeamCoverageAdmission(input)).toEqual(inspected);
  });

  it('refuses partial adoption when even one base-cover or relay actor is unsupported', () => {
    const proposal = fixture({
      '2B': { kind: 'base_cover', base: 2 },
      'SS': { kind: 'relay', target: { x: 12, z: 19 } },
      'CF': { kind: 'backup', target: { x: -2, z: 22 } },
      'RF': { kind: 'deep_coverage', target: { x: 5, z: 50 } },
    });
    const gate = inspectNativeTeamCoverageAdmission(proposal);
    expect(gate.status).toBe('blocked_unsupported_team_intents');
    expect(gate.eligibleIndividualRequests).toEqual([]);
    expect(gate.blockedActors.map(x => x.intent).sort()).toEqual([
      'backup', 'base_cover', 'deep_coverage', 'relay',
    ]);
    expect(gate.blockedActors.every(x => x.requires === 'native_owner_team_role_source_and_physical_motor'))
      .toBe(true);
    expect(gate.teamPlanAdopted).toBe(false);
    expect(gate.officialResult).toBeNull();
  });

  it('requires original same-play world/source timing and rejects future strategic evidence', () => {
    const original = fixture();
    expect(() => inspectNativeTeamCoverageAdmission({
      ...original,
      reference: { ...original.reference, availableAtTick: TICK + 1 },
    })).toThrow('future world observations');
    expect(() => inspectNativeTeamCoverageAdmission({
      ...original,
      reference: { ...original.reference, sourceHash: 'not-a-digest' },
    })).toThrow('original source identity');
    expect(() => inspectNativeTeamCoverageAdmission({
      ...original, world: { ...original.world, tick: TICK + 100 },
    })).toThrow('unavailable or future');
    expect(() => inspectNativeTeamCoverageAdmission({
      ...original,
      plan: {
        ...original.plan,
        assignments: original.plan.assignments.map((item, index) => index === 0
          ? { ...item, evidenceAvailableAt: TICK + 100 } : item),
      },
    })).toThrow('future perceived evidence');
  });

  it('rejects duplicated or missing roster identity instead of inventing a fielder', () => {
    const input = fixture();
    expect(() => inspectNativeTeamCoverageAdmission({
      ...input,
      world: {
        ...input.world,
        defenders: [...input.world.defenders.slice(0, 8), input.world.defenders[0]],
      },
    })).toThrow('world identities or positions are duplicated');
    expect(() => inspectNativeTeamCoverageAdmission({
      ...input,
      plan: {
        ...input.plan,
        assignments: input.plan.assignments.map((item, index) => index === 8
          ? { ...item, playerId: input.plan.assignments[0].playerId } : item),
      },
    })).toThrow('does not match original world defender');
  });

  it('never accepts duplicate ball handlers or redundant base covering even in forged plans', () => {
    const input = fixture();
    const twoHandlers = {
      ...input.plan,
      assignments: input.plan.assignments.map((item, index) => index === 1
        ? { ...item, intent: { kind: 'ball_handler' as const } } : item),
    };
    expect(() => inspectNativeTeamCoverageAdmission({ ...input, plan: twoHandlers }))
      .toThrow('duplicate ball handlers');
    const duplicatedBase = {
      ...input.plan,
      assignments: input.plan.assignments.map((item, index) => index === 1 || index === 2
        ? { ...item, intent: { kind: 'base_cover' as const, base: 2 as const } } : item),
    };
    expect(() => inspectNativeTeamCoverageAdmission({ ...input, plan: duplicatedBase }))
      .toThrow('multiple coverers to one base');
  });

  it('rejects future or inconsistent plan priority without rewriting official play state', () => {
    const original = fixture();
    expect(() => inspectNativeTeamCoverageAdmission({
      ...original, plan: { ...original.plan, totalPriority: 9000 },
    })).toThrow('priority summary differs');
    const r = inspectNativeTeamCoverageAdmission(original);
    expect('score' in r).toBe(false);
    expect('result' in r).toBe(false);
    expect(r.authority).toBe('NATIVE_HOST_MUST_ADMIT_EACH_SOURCE_AND_CONFIRM_PHYSICAL_STATE');
  });
});
