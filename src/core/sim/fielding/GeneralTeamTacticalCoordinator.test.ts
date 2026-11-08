import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { DefensivePosition } from '../../model/CanonicalWorldSnapshot';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createInitialForceObligationState } from '../../rules/ForceObligation';
import type { DefensiveIntentCandidate } from './DefensiveDecision';
import type { DefensiveSearchDefender, DefensiveSearchEvidenceReference, DefensiveSearchRunner } from './GeneralDefensivePlaySearch';
import {
  createGeneralTeamTacticalCoordinator,
  replanGeneralTeamTacticalCoordinator,
  type GeneralTeamTacticalHandoff,
  type GeneralTeamTacticalInput,
  type GeneralTeamTacticalReplanCause,
} from './GeneralTeamTacticalCoordinator';

const START = 2_000_000;
const PLAY = 101;
const BASES = {
  1: { x: 25, z: 0 },
  2: { x: 25, z: 25 },
  3: { x: 0, z: 25 },
  4: { x: 0, z: 0 },
} as const;
const PEOPLE = [
  ['P', 'pitcher', 12, 12],
  ['C', 'catcher', 0, 0],
  ['1B', 'first', 25, 0],
  ['2B', 'second', 24, 25],
  ['3B', 'third', 0, 25],
  ['SS', 'shortstop', 25, 25],
  ['LF', 'left', -14, 48],
  ['CF', 'center', 12, 59],
  ['RF', 'right', 48, 47],
] as const satisfies readonly (readonly [DefensivePosition, string, number, number])[];
type Player = typeof PEOPLE[number][1];

function evidence(id: string, time = START, revision = 1,
  observedAtTick = time, availableAtTick = time): DefensiveSearchEvidenceReference {
  return {
    playId: PLAY,
    sourceId: id,
    sourceHash: 'b'.repeat(64),
    revision,
    observedAtTick,
    availableAtTick,
  };
}

function match(mask = 1, outs = 0): CanonicalMatchState {
  return {
    ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 5, half: 'top', outs, balls: 0, strikes: 0,
    bases: {
      first: mask & 1 ? 'runner-first' : null,
      second: mask & 2 ? 'runner-second' : null,
      third: mask & 4 ? 'runner-third' : null,
    },
    score: { away: 0, home: 0 }, playId: PLAY,
  };
}

function defenders(): DefensiveSearchDefender[] {
  return PEOPLE.map(([registeredPosition, playerId, x, z]) => ({
    registeredPosition, playerId,
    position: { x, z }, velocity: { x: 0, z: 0 },
    topSpeedMps: 8, accelerationMps2: 10,
    baseCoverRadiusMeters: 0.15,
    maximumThrowSpeedMps: 45,
    throwTransferDelayTicks: 20_000,
    receptionSecureDelayTicks: 15_000,
    situationalAwareness: 1,
    decisionTiming: {
      minimumDecisionDelayTicks: 10_000,
      maximumDecisionDelayTicks: 1_500_000,
      fixedProcessingOffsetTicks: 0,
    },
    // No base/out outcome, identity or location is invented from the time.
  }));
}

function runners(m: CanonicalMatchState, time: number): DefensiveSearchRunner[] {
  const active: Array<readonly [string, number, { x: number; z: number }]> = [
    ['batter', 1, BASES[4]],
  ];
  if (m.bases.first !== null) active.push([m.bases.first, 2, BASES[1]]);
  if (m.bases.second !== null) active.push([m.bases.second, 3, BASES[2]]);
  if (m.bases.third !== null) active.push([m.bases.third, 4, BASES[3]]);
  return active.map(([playerId, base, position], index) => ({
    playerId, position, velocity: { x: 0, z: 0 },
    motionRevision: 10 + index,
    arrivals: [{
      targetBase: base as 1 | 2 | 3 | 4,
      earliestArrivalNotBeforeTick: time + (base === 1 ? 4_500_000 : 2_300_000),
      motionRevision: 10 + index,
      evidence: evidence('accepted-runner:' + playerId, time, 10 + index),
    }],
  }));
}

function candidate(intent: DefensiveIntentCandidate['intent'], priority: number, time: number): DefensiveIntentCandidate {
  return {
    intent, localPriority: priority, evidenceAvailableAt: time - 15,
    evidenceKinds: ['accepted_perception', 'pre_play_plan'],
  };
}

function coverageCandidates(holder: Player, time: number) {
  return PEOPLE.map(([registeredPosition, playerId]) => {
    const list: DefensiveIntentCandidate[] = [];
    if (playerId === holder) {
      list.push(candidate({ kind: 'ball_handler' }, 3, time));
    } else if (playerId === 'first') {
      list.push(candidate({ kind: 'base_cover', base: 1 }, 1, time));
    } else if (playerId === 'second') {
      list.push(candidate({ kind: 'base_cover', base: 2 }, 1, time));
    } else if (playerId === 'third') {
      list.push(candidate({ kind: 'base_cover', base: 3 }, 1, time));
    } else if (playerId === 'catcher') {
      list.push(candidate({ kind: 'base_cover', base: 4 }, 1, time));
    } else if (playerId === 'left') {
      list.push(candidate({ kind: 'deep_coverage', target: { x: -15, z: 40 } }, 0.5, time));
    } else if (playerId === 'center') {
      list.push(candidate({ kind: 'backup', target: { x: 12, z: 30 } }, 0.5, time));
    } else if (playerId === 'right') {
      list.push(candidate({ kind: 'relay', target: { x: 30, z: 35 } }, 0.5, time));
    }
    list.push(candidate({ kind: 'hold' }, 0.1, time));
    return { playerId, registeredPosition, candidates: list };
  });
}

function fixture(opts: Readonly<{
  time?: number;
  revision?: number;
  holder?: Player;
  mask?: number;
  outs?: number;
}> = {}): GeneralTeamTacticalInput {
  const time = opts.time ?? START;
  const revision = opts.revision ?? 1;
  const holder = opts.holder ?? 'shortstop';
  const m = match(opts.mask ?? 1, opts.outs ?? 0);
  return {
    coverageInput: { defenders: coverageCandidates(holder, time), requireBallHandler: true },
    coverageSource: {
      evidence: evidence('accepted-team-coverage:' + revision, time, revision, time - 25, time - 5),
      defenders: PEOPLE.map(([registeredPosition, playerId]) => ({
        registeredPosition, playerId,
        evidence: evidence('accepted-player-candidates:' + playerId + ':' + revision,
          time, revision, time - 60, time - 10),
      })),
    },
    physical: {
      match: m, batterRunnerId: 'batter',
      observation: {
        evidence: evidence('accepted-physical-world:' + revision, time, revision),
        forceContext: {
          status: 'live_batted_ball_batter_active',
          forceState: createInitialForceObligationState(m.bases, 'batter'),
          evidence: evidence('accepted-force-context:' + revision, time, revision, time - 100, time - 60),
        },
        ballCustody: {
          holderId: holder,
          securedAtTick: time - 200,
          evidence: evidence('accepted-ball-custody:' + revision, time, revision, time - 190, time - 100),
        },
        defenders: defenders(),
        runners: runners(m, time),
      },
      baseCoverTargets: BASES,
      ticksPerSecond: 1_000_000,
      search: { maxSteps: 2, beamWidth: 32, horizonThroughTick: time + 5_000_000 },
    },
    ownerCapabilities: {
      admittedIntentKinds: ['ball_handler', 'hold'],
      supportedPhysicalActions: [],
      supportsSequentialReplan: false,
    },
  };
}

function trigger(perceivedAt: number, kind: GeneralTeamTacticalReplanCause['trigger']['kind'] =
  'runner_motion_recognized'): GeneralTeamTacticalReplanCause {
  return {
    trigger: { kind, perceivedAt },
    evidence: evidence('accepted-replan-trigger:' + perceivedAt, perceivedAt, 2,
      perceivedAt - 40, perceivedAt),
    reason: kind === 'runner_motion_recognized'
      ? 'runner_state_changed' : 'ball_state_changed',
  };
}

function verifyNineRoles(value: GeneralTeamTacticalHandoff, source: GeneralTeamTacticalInput): void {
  expect(value.roles).toHaveLength(9);
  expect(value.coverage.assignments).toEqual(value.roles);
  const byPlayer = new Map(value.roles.map(role => [role.playerId, role]));
  expect(byPlayer.size).toBe(9);
  for (const defender of source.physical.observation.defenders) {
    expect(byPlayer.get(defender.playerId)?.registeredPosition).toBe(defender.registeredPosition);
  }
  expect(value.roles.filter(role => role.intent.kind === 'ball_handler')
    .map(role => role.playerId)).toEqual([source.physical.observation.ballCustody.holderId]);
  const covers = value.roles.filter(role => role.intent.kind === 'base_cover')
    .map(role => role.intent.kind === 'base_cover' ? role.intent.base : null);
  expect(new Set(covers).size).toBe(covers.length);
}

describe('generic nine-player tactical advisory/coverage coordinator', () => {
  it('preserves all nine accepted physical identities and source-backed roles', () => {
    const input = fixture();
    const original = JSON.stringify(input);
    const result = createGeneralTeamTacticalCoordinator(input);
    expect(result.kind).toBe('read_only_team_tactical_handoff_v1');
    expect(result.revision).toBe(0);
    expect(result.playId).toBe(PLAY);
    expect(result.observedAtTick).toBe(START);
    verifyNineRoles(result, input);
    expect(result.coverageSource.defenders).toHaveLength(9);
    expect(result.physical.observation).toEqual(input.physical.observation);
    expect(result.physical.observation.runners.map(r => r.motionRevision)).toEqual([10, 11]);
    expect(result.coverageSource.evidence.sourceId).toBe('accepted-team-coverage:1');
    expect(result.sourceAuthority).toBe('opaque_refs_require_native_owner_verification');
    expect(JSON.stringify(input)).toBe(original);
  });

  it('keeps force hypotheses as alternatives and defers scoring/threat ranking to ThrowPlan', () => {
    const input = fixture();
    const result = createGeneralTeamTacticalCoordinator(input);
    expect(result.searchStatus).toBe('candidates');
    expect(result.opportunities.length).toBeGreaterThan(2);
    expect(result.opportunities.some(op =>
      op.hypothesis.steps.map(step => step.targetBase).join(',') === '2,1')).toBe(true);
    expect(result.opportunities.every(op =>
      op.kind === 'unexecuted_force_hypothesis'
      && op.hypothesis.kind === 'hypothetical_only'
      && op.admission.canExecute === false
      && op.admission.officialResult === null)).toBe(true);
    expect(result.strategicSelection).toEqual({
      kind: 'pending_evidence', owner: 'ThrowPlan', selected: null,
      reason: 'source_backed_throw_value_and_rule_context_required',
    });
    expect(result.execution).toEqual({
      status: 'requires_team_intent_owner_admission',
      canExecute: false, confirmedOuts: null, officialResult: null, nextMatchState: null,
    });
    expect(Object.keys(result)).not.toContain('selected');
    expect(Object.keys(result)).not.toContain('score');
    expect(Object.keys(result)).not.toContain('outs');
  });

  it('labels first-step matching cover roles and missing coverage instead of silently issuing a throw', () => {
    const withCover = createGeneralTeamTacticalCoordinator(fixture());
    const coverPlan = withCover.opportunities.find(item => item.hypothesis.steps[0].method === 'throw_to_coverer'
      && item.hypothesis.steps[0].receiverId === 'second'
      && item.hypothesis.steps[0].targetBase === 2);
    expect(coverPlan?.currentFirstStepCoverage).toBe('receiver_already_assigned_to_target_base');
    const source = fixture();
    const withoutCover: GeneralTeamTacticalInput = {
      ...source, coverageInput: {
        ...source.coverageInput,
        defenders: source.coverageInput.defenders.map(defender =>
          defender.playerId === 'second'
            ? { ...defender, candidates: defender.candidates.filter(c => c.intent.kind === 'hold') }
            : defender),
      },
    };
    const result = createGeneralTeamTacticalCoordinator(withoutCover);
    expect(result.roles.find(x => x.playerId === 'second')?.intent.kind).toBe('hold');
    expect(result.opportunities.find(item => item.hypothesis.steps[0].method === 'throw_to_coverer'
      && item.hypothesis.steps[0].receiverId === 'second'
      && item.hypothesis.steps[0].targetBase === 2)?.currentFirstStepCoverage)
      .toBe('requires_new_coverage_assignment');
    expect(result.execution.canExecute).toBe(false);
  });

  it('owns no official result even when an external capability declaration claims full admission', () => {
    const source = fixture({ mask: 7 });
    const able: GeneralTeamTacticalInput = {
      ...source,
      ownerCapabilities: {
        admittedIntentKinds: ['ball_handler', 'base_cover'],
        supportedPhysicalActions: [
          'carry_ball_to_base', 'throw_launch', 'secured_reception', 'controlled_base_contact',
        ],
        supportsSequentialReplan: true,
      },
    };
    const outcome = createGeneralTeamTacticalCoordinator(able);
    expect(outcome.opportunities.length).toBeGreaterThan(0);
    expect(outcome.opportunities.every(item =>
      item.admission.kind === 'requires_team_intent_owner_admission'
      && item.admission.canExecute === false
      && item.admission.confirmedOuts === null)).toBe(true);
    expect(outcome.execution.officialResult).toBeNull();
    expect(outcome.strategicSelection.selected).toBeNull();
  });

  it('remains deterministic under reversed nine-player candidate/observation/source order', () => {
    const source = fixture({ mask: 7, holder: 'third', outs: 1 });
    const reverse: GeneralTeamTacticalInput = {
      ...source,
      coverageInput: { ...source.coverageInput, defenders: [...source.coverageInput.defenders].reverse() },
      coverageSource: {
        ...source.coverageSource,
        defenders: [...source.coverageSource.defenders].reverse(),
      },
      physical: {
        ...source.physical,
        observation: {
          ...source.physical.observation,
          defenders: [...source.physical.observation.defenders].reverse(),
          runners: [...source.physical.observation.runners].reverse(),
        },
      },
    };
    const a = createGeneralTeamTacticalCoordinator(source);
    const b = createGeneralTeamTacticalCoordinator(reverse);
    expect(a.coverage).toEqual(b.coverage);
    expect(a.opportunities).toEqual(b.opportunities);
    expect(a.strategicSelection).toEqual(b.strategicSelection);
    expect(a.opportunities.some(op => op.hypothesis.steps[0].targetBase === 4)).toBe(true);
  });

  it('freezes independent output snapshots to protect accepted earlier facts from later input edits', () => {
    const source = fixture();
    const output = createGeneralTeamTacticalCoordinator(source);
    const recorded = JSON.stringify(output);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.coverage.assignments)).toBe(true);
    expect(Object.isFrozen(output.roles[0])).toBe(true);
    expect(Object.isFrozen(output.physical.observation.runners[0].arrivals[0])).toBe(true);
    (source.physical.observation.defenders[0].position as { x: number }).x = 999;
    (source.coverageInput.defenders[0].candidates as DefensiveIntentCandidate[])
      .push(candidate({ kind: 'hold' }, 0, START));
    expect(JSON.stringify(output)).toBe(recorded);
    expect(output.physical.observation.defenders[0].position.x).not.toBe(999);
    expect(() => {
      (output.roles[0] as { selectedPriority: number }).selectedPriority = 900;
    }).toThrow();
  });

  it('replans from a later generic perception trigger and preserves the old nine-player revision', () => {
    const firstInput = fixture();
    const previous = createGeneralTeamTacticalCoordinator(firstInput);
    const next = fixture({ time: START + 200_000, revision: 2, holder: 'third' });
    const original = JSON.stringify(previous);
    const run = () => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next, cause: trigger(START + 120_000),
    });
    const changed = run();
    expect(changed).toEqual(run());
    expect(changed.revision).toBe(1);
    expect(changed.observedAtTick).toBe(START + 200_000);
    expect(changed.replan?.reason).toBe('runner_state_changed');
    expect(changed.replan?.revisionTick).toBe(START + 200_000);
    expect(changed.replan?.previousPlan).toEqual(previous.coverage);
    expect(changed.replan?.plan).toEqual(changed.coverage);
    expect(changed.replan?.changedPlayerIds).toEqual(['shortstop', 'third']);
    expect(changed.cause?.trigger.kind).toBe('runner_motion_recognized');
    expect(changed.physical.observation.ballCustody.holderId).toBe('third');
    verifyNineRoles(changed, next);
    expect(JSON.stringify(previous)).toBe(original);
    expect(previous.roles.find(role => role.playerId === 'shortstop')?.intent.kind).toBe('ball_handler');
    expect(changed.roles.find(role => role.playerId === 'third')?.intent.kind).toBe('ball_handler');
    expect(changed.execution.canExecute).toBe(false);
  });

  it('supports unchanged nine-player coverage after a communication trigger with no invented role switch', () => {
    const previous = createGeneralTeamTacticalCoordinator(fixture());
    const next = fixture({ time: START + 200_000, revision: 2 });
    const changed = replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next, cause: {
        ...trigger(START + 120_000, 'communication_received'),
        reason: 'communication_received',
      },
    });
    expect(changed.replan?.changedPlayerIds).toEqual([]);
    expect(changed.coverage.assignments.map(role => [role.playerId, role.intent]))
      .toEqual(previous.coverage.assignments.map(role => [role.playerId, role.intent]));
    expect(changed.coverage.assignments[0].evidenceAvailableAt)
      .toBeGreaterThan(previous.coverage.assignments[0].evidenceAvailableAt);
    expect(changed.revision).toBe(1);
    expect(changed.strategicSelection.selected).toBeNull();
  });

  it('rejects missing defender role/candidate owner, role position mismatch and custody disagreement', () => {
    const source = fixture();
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageInput: {
        ...source.coverageInput,
        defenders: source.coverageInput.defenders.slice(0, -1),
      },
    })).toThrow('all nine defender roles');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageSource: {
        ...source.coverageSource,
        defenders: source.coverageSource.defenders.slice(1),
      },
    })).toThrow('all nine defender roles');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageSource: {
        ...source.coverageSource,
        defenders: source.coverageSource.defenders.map(defender =>
          defender.playerId === 'shortstop' ? { ...defender, registeredPosition: 'P' as const } : defender),
      },
    })).toThrow('candidate ownership');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageInput: {
        ...source.coverageInput,
        defenders: source.coverageInput.defenders.map(defender =>
          defender.playerId === 'shortstop'
            ? { ...defender, candidates: defender.candidates.filter(c => c.intent.kind !== 'ball_handler') }
            : defender),
      },
    })).toThrow('no valid team coverage plan');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, physical: {
        ...source.physical,
        observation: {
          ...source.physical.observation,
          ballCustody: { ...source.physical.observation.ballCustody, holderId: 'first' },
        },
      },
    })).toThrow('ball handler must match');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageInput: { ...source.coverageInput, requireBallHandler: false },
    })).toThrow('one explicitly assigned ball handler');
  });

  it('rejects future, foreign, malformed and unowned candidate evidence before any tactical handoff', () => {
    const source = fixture();
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageInput: {
        ...source.coverageInput,
        defenders: source.coverageInput.defenders.map(defender =>
          defender.playerId === 'shortstop'
            ? { ...defender, candidates: [
                { ...defender.candidates[0], evidenceAvailableAt: START + 1 },
                ...defender.candidates.slice(1),
              ] }
            : defender),
      },
    })).toThrow('future evidence');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageSource: {
        ...source.coverageSource,
        evidence: { ...source.coverageSource.evidence, playId: PLAY + 1 },
      },
    })).toThrow('foreign play');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageSource: {
        ...source.coverageSource,
        defenders: source.coverageSource.defenders.map(defender =>
          defender.playerId === 'first'
            ? { ...defender, evidence: { ...defender.evidence, availableAtTick: START + 100 } }
            : defender),
      },
    })).toThrow('future or unavailable evidence');
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, coverageSource: {
        ...source.coverageSource,
        evidence: { ...source.coverageSource.evidence, sourceHash: 'forged' },
      },
    })).toThrow('source ID/hash reference');
  });

  it('keeps nine assignments but returns no force suggestions when real runner/force context is absent', () => {
    const source = fixture({ mask: 7 });
    const missingRunner: GeneralTeamTacticalInput = {
      ...source, physical: {
        ...source.physical,
        observation: {
          ...source.physical.observation,
          runners: source.physical.observation.runners.map(runner =>
            runner.playerId === 'runner-first' ? { ...runner, arrivals: [] } : runner),
        },
      },
    };
    const pending = createGeneralTeamTacticalCoordinator(missingRunner);
    expect(pending.searchStatus).toBe('insufficient_runner_evidence');
    expect(pending.opportunities).toEqual([]);
    verifyNineRoles(pending, source);
    for (const status of [
      'caught_fly_batter_retired', 'infield_fly_batter_retired', 'unresolved',
    ] as const) {
      const affected = createGeneralTeamTacticalCoordinator({
        ...source, physical: {
          ...source.physical,
          observation: {
            ...source.physical.observation,
            forceContext: { ...source.physical.observation.forceContext, status, forceState: null },
          },
        },
      });
      expect(affected.searchStatus).toBe('insufficient_force_context');
      expect(affected.opportunities).toEqual([]);
      expect(affected.execution.officialResult).toBeNull();
    }
    expect(() => createGeneralTeamTacticalCoordinator({
      ...source, physical: {
        ...source.physical,
        observation: {
          ...source.physical.observation,
          runners: source.physical.observation.runners.slice(1),
        },
      },
    })).toThrow('Every active runner');
  });

  it('fails closed on stale advisory/coverage revision, stale or future replan triggers and changed play', () => {
    const previous = createGeneralTeamTacticalCoordinator(fixture());
    const next = fixture({ time: START + 200_000, revision: 2, holder: 'third' });
    const cause = trigger(START + 120_000);
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 1, next, cause,
    })).toThrow('stale advisory revision');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0,
      next: { ...next, coverageSource: {
        ...next.coverageSource,
        evidence: { ...next.coverageSource.evidence, revision: 1 },
      } },
      cause,
    })).toThrow('fresh accepted team coverage source revision');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0,
      next: { ...next, physical: {
        ...next.physical,
        observation: {
          ...next.physical.observation,
          evidence: {
            ...next.physical.observation.evidence,
            sourceId: previous.physical.observation.evidence.sourceId,
            revision: previous.physical.observation.evidence.revision,
          },
        },
      } },
      cause,
    })).toThrow('fresh accepted physical source or revision');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next,
      cause: trigger(START),
    })).toThrow('newer than the previous decision');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next,
      cause: trigger(START + 250_000),
    })).toThrow('newer than the previous decision');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next: {
        ...next, physical: { ...next.physical, match: { ...next.physical.match, playId: PLAY + 1 } },
      },
      cause,
    })).toThrow('foreign');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next, cause: {
        ...cause, evidence: { ...cause.evidence, availableAtTick: cause.trigger.perceivedAt + 1 },
      },
    })).toThrow('future or unavailable evidence');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next,
      cause: { ...cause, reason: 'possession_changed' },
    })).toThrow('reason contradicts');
  });

  it('rejects regressed runner motion revisions and future candidate cues during team replan', () => {
    const previous = createGeneralTeamTacticalCoordinator(fixture());
    const next = fixture({ time: START + 200_000, revision: 2, holder: 'third' });
    const cause = trigger(START + 120_000);
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next: {
        ...next, physical: {
          ...next.physical,
          observation: {
            ...next.physical.observation,
            runners: next.physical.observation.runners.map(runner =>
              runner.playerId === 'batter'
                ? { ...runner, motionRevision: runner.motionRevision - 1,
                    arrivals: runner.arrivals.map(arrival =>
                      ({ ...arrival, motionRevision: arrival.motionRevision - 1 })) }
                : runner),
          },
        },
      }, cause,
    })).toThrow('runner motion revision regressed');
    expect(() => replanGeneralTeamTacticalCoordinator({
      previous, expectedRevision: 0, next: {
        ...next, coverageInput: {
          ...next.coverageInput,
          defenders: next.coverageInput.defenders.map(defender =>
            defender.playerId === 'third'
              ? { ...defender, candidates: [{
                  ...defender.candidates[0], evidenceAvailableAt: START + 200_001,
                }] }
              : defender),
        },
      }, cause,
    })).toThrow('future evidence');
  });

  it('handles 8 pre-play occupancy patterns × outs 0..2 with the same nine roles and pending throw selection', () => {
    let cases = 0;
    for (let mask = 0; mask < 8; mask += 1) {
      for (const outs of [0, 1, 2]) {
        const source = fixture({ mask, outs });
        const result = createGeneralTeamTacticalCoordinator(source);
        verifyNineRoles(result, source);
        expect(result.opportunities.every(item =>
          item.hypothesis.steps.length <= 3 - outs
          && item.hypothesis.executionReadiness === 'requires_team_intent_owner_admission'
          && item.admission.officialResult === null)).toBe(true);
        expect(result.strategicSelection.selected).toBeNull();
        expect(result.execution.confirmedOuts).toBeNull();
        cases += 1;
      }
    }
    expect(cases).toBe(24);
  });
});
