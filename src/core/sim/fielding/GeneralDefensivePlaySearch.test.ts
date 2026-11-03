import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { DefensivePosition } from '../../model/CanonicalWorldSnapshot';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
  retireForceParticipant,
} from '../../rules/ForceObligation';
import {
  assessGeneralDefensivePlanAdmission,
  searchGeneralDefensivePlay,
  type DefensiveSearchDefender,
  type DefensiveSearchEvidenceReference,
  type DefensiveSearchInput,
  type DefensiveSearchRunner,
  type GeneralDefensiveNativeOwnerCapabilities,
} from './GeneralDefensivePlaySearch';

const NOW = 1_000_000;
const TICKS = 1_000_000;
const BASES = {
  1: { x: 25, z: 0 },
  2: { x: 25, z: 25 },
  3: { x: 0, z: 25 },
  4: { x: 0, z: 0 },
} as const;
const PLAY = 401;
const proof = (
  sourceId: string,
  observedAtTick = NOW,
  availableAtTick = NOW,
): DefensiveSearchEvidenceReference => ({
  playId: PLAY, sourceId, sourceHash: 'a'.repeat(64), revision: 8,
  observedAtTick, availableAtTick,
});
const POSITIONS = [
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

function defenders(): DefensiveSearchDefender[] {
  return POSITIONS.map(([registeredPosition, playerId, x, z]) => ({
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
      maximumDecisionDelayTicks: 1_600_000,
      fixedProcessingOffsetTicks: 0,
    },
  }));
}

function match(mask: number, outs = 0): CanonicalMatchState {
  return {
    ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 5, half: 'top', outs, balls: 0, strikes: 0,
    bases: {
      first: mask & 1 ? 'runner-first' : null,
      second: mask & 2 ? 'runner-second' : null,
      third: mask & 4 ? 'runner-third' : null,
    },
    score: { home: 0, away: 0 }, playId: PLAY,
  };
}

const ARRIVAL_DEFAULT = {
  batter: NOW + 4_500_000,
  2: NOW + 2_300_000,
  3: NOW + 2_300_000,
  4: NOW + 2_300_000,
} as const;

function runners(
  m: CanonicalMatchState,
  arrivals: Readonly<Record<'batter' | 2 | 3 | 4, number>> = ARRIVAL_DEFAULT,
): DefensiveSearchRunner[] {
  const items: Array<readonly [string, number, { x: number; z: number }]> = [
    ['batter', 1, { x: 0, z: 0 }],
  ];
  if (m.bases.first !== null) items.push([m.bases.first, 2, BASES[1]]);
  if (m.bases.second !== null) items.push([m.bases.second, 3, BASES[2]]);
  if (m.bases.third !== null) items.push([m.bases.third, 4, BASES[3]]);
  return items.map(([playerId, base, position], i) => ({
    playerId, position, velocity: { x: 0, z: 0 }, motionRevision: 10 + i,
    arrivals: [{
      targetBase: base as 1 | 2 | 3 | 4,
      earliestArrivalNotBeforeTick: base === 1 ? arrivals.batter
        : arrivals[base as 2 | 3 | 4],
      motionRevision: 10 + i,
      evidence: proof('runner-controller:' + playerId),
    }],
  }));
}

function fixture(opts: Readonly<{
  mask?: number;
  outs?: number;
  holderId?: string;
  arrivals?: Readonly<Record<'batter' | 2 | 3 | 4, number>>;
  beamWidth?: number;
  maxSteps?: number;
}> = {}): DefensiveSearchInput {
  const m = match(opts.mask ?? 1, opts.outs ?? 0);
  return {
    match: m, batterRunnerId: 'batter',
    observation: {
      evidence: proof('world:game-401'),
      forceContext: {
        status: 'live_batted_ball_batter_active',
        forceState: createInitialForceObligationState(m.bases, 'batter'),
        evidence: proof('native-rule-force-context:game-401', NOW - 2_000, NOW - 1_000),
      },
      ballCustody: {
        holderId: opts.holderId ?? 'shortstop',
        securedAtTick: NOW - 50_000,
        evidence: proof('physical-custody:game-401', NOW - 50_000, NOW - 20_000),
      },
      defenders: defenders(),
      runners: runners(m, opts.arrivals),
    },
    baseCoverTargets: BASES,
    ticksPerSecond: TICKS,
    search: {
      maxSteps: opts.maxSteps ?? 2,
      beamWidth: opts.beamWidth ?? 64,
      horizonThroughTick: NOW + 5_000_000,
    },
  };
}

function routedThrough(
  input: DefensiveSearchInput,
  expected: readonly number[],
): boolean {
  return searchGeneralDefensivePlay(input).plans.some(plan =>
    JSON.stringify(plan.steps.map(step => step.targetBase)) === JSON.stringify(expected));
}

describe('generic bounded Native defensive force-opportunity search', () => {
  it('finds second-to-first in one graph without a situation-specific double-play branch', () => {
    const input = fixture({ mask: 1, holderId: 'shortstop' });
    const original = JSON.stringify(input);
    const result = searchGeneralDefensivePlay(input);
    expect(result.kind).toBe('candidates');
    expect(result.selected?.steps.map(step => step.targetBase)).toEqual([2, 1]);
    expect(result.selected?.steps.map(step => step.targetedRunnerId)).toEqual(['runner-first', 'batter']);
    expect(result.selected?.steps[0].method).toBe('carry_ball_to_base');
    expect(result.selected?.steps[1].method).toBe('throw_to_coverer');
    expect(result.selected?.remainingForceObligations).toEqual([]);
    expect(result.selected?.steps[1].earliestControlledBaseContactTick)
      .toBeGreaterThan(result.selected!.steps[0].earliestControlledBaseContactTick);
    expect(result.selected?.assumedOutsAfterForSearch).toBe(2);
    expect(result.selected?.executionReadiness).toBe('requires_team_intent_owner_admission');
    expect(result.outcomeAuthority).toBe('external_native_physics_rules_and_umpire');
    expect(JSON.stringify(input)).toBe(original);
    expect(result).toEqual(searchGeneralDefensivePlay(input));
  });

  it('finds HOME-to-first for a loaded situation by evidence/time, not a home-specific result branch', () => {
    const input = fixture({
      mask: 7, holderId: 'third',
      arrivals: {
        batter: NOW + 3_500_000,
        2: NOW + 1,
        3: NOW + 1,
        4: NOW + 2_500_000,
      },
    });
    expect(routedThrough(input, [4, 1])).toBe(true);
    const homeFirst = searchGeneralDefensivePlay(input).plans.find(plan =>
      plan.steps.map(step => step.targetBase).join(',') === '4,1');
    expect(homeFirst?.steps[0].throwerId).toBe('third');
    expect(homeFirst?.steps[0].receiverId).toBe('catcher');
    expect(homeFirst?.steps[0].forceClassification).toBe('force');
    expect(homeFirst?.steps[1].forceClassification).toBe('batter_runner_before_first');
    expect(homeFirst?.remainingForceObligations).toEqual([]);
    expect(homeFirst?.assumedRetiredRunnerIds).toEqual(['runner-third', 'batter']);
  });

  it('retiring the batter at first instantly dissolves ALL previous-runner forces', () => {
    const input = fixture({ mask: 7, holderId: 'first', maxSteps: 1 });
    const selected = searchGeneralDefensivePlay(input).selected!;
    expect(selected.steps).toHaveLength(1);
    expect(selected.steps[0].targetBase).toBe(1);
    expect(selected.steps[0].targetedRunnerId).toBe('batter');
    expect(selected.remainingForceObligations).toEqual([]);
    const original = createInitialForceObligationState(input.match.bases, 'batter');
    expect(deriveCurrentForceObligations(original)).toHaveLength(4);
    expect(deriveCurrentForceObligations(retireForceParticipant(original, 'batter'))).toEqual([]);
    expect(searchGeneralDefensivePlay({ ...input, search: { ...input.search, maxSteps: 3 } })
      .plans.every(plan => {
        const firstOut = plan.steps.findIndex(step => step.targetedRunnerId === 'batter');
        return firstOut < 0 || firstOut === plan.steps.length - 1;
      })).toBe(true);
  });

  it('resuming AFTER an accepted force retirement does not resurrect forces from the original occupied bases', () => {
    const first = fixture({ mask: 7, holderId: 'third' });
    const retired = retireForceParticipant(first.observation.forceContext.forceState!, 'runner-first');
    const continued: DefensiveSearchInput = {
      ...first,
      observation: {
        ...first.observation,
        forceContext: {
          status: 'live_batted_ball_batter_active',
          forceState: retired,
          evidence: proof('accepted-force-out:runner-first', NOW - 1_000, NOW),
        },
        runners: first.observation.runners.filter(runner => runner.playerId !== 'runner-first'),
      },
    };
    expect(deriveCurrentForceObligations(retired).map(x => x.runnerId)).toEqual(['batter']);
    const searched = searchGeneralDefensivePlay(continued);
    expect(searched.plans.every(plan =>
      plan.steps.every(step => step.targetedRunnerId === 'batter'))).toBe(true);
    expect(searched.plans.every(plan =>
      plan.steps.every(step => step.targetBase === 1))).toBe(true);
    expect(() => searchGeneralDefensivePlay({
      ...first,
      observation: {
        ...first.observation,
        forceContext: { ...first.observation.forceContext, forceState: null },
      },
    })).toThrow('Accepted current force state');
  });

  it('stops searching at the final one out with 2 outs already recorded', () => {
    const input = fixture({ mask: 7, outs: 2, maxSteps: 4 });
    const result = searchGeneralDefensivePlay(input);
    expect(result.kind).toBe('candidates');
    expect(result.plans.every(plan => plan.steps.length === 1)).toBe(true);
    expect(result.plans.every(plan => plan.assumedOutsAfterForSearch === 3)).toBe(true);
    expect(result.plans.every(plan => plan.kind === 'hypothetical_only')).toBe(true);
  });

  it('requires feasible defender cover time and physical flight bound; rejects short horizons', () => {
    const good = fixture({ mask: 1 });
    expect(searchGeneralDefensivePlay(good).selected?.steps.length).toBeGreaterThan(0);
    const constrained: DefensiveSearchInput = {
      ...good,
      search: { ...good.search, horizonThroughTick: NOW + 25_000 },
      observation: {
        ...good.observation,
        defenders: good.observation.defenders.map(defender => ({
          ...defender, position: { x: 200, z: 200 },
          velocity: { x: 0, z: 0 },
        })),
      },
    };
    expect(searchGeneralDefensivePlay(constrained)).toMatchObject({
      kind: 'no_reachable_force_opportunity', plans: [], selected: null,
    });
  });

  it('poor situational awareness delays throw action without changing the underlying runner motion', () => {
    const good = fixture({ mask: 1 });
    const slowInput: DefensiveSearchInput = {
      ...good,
      observation: {
        ...good.observation,
        defenders: good.observation.defenders.map(d => ({ ...d, situationalAwareness: 0 })),
      },
      search: { ...good.search, horizonThroughTick: NOW + 1_200_000 },
    };
    const poor = searchGeneralDefensivePlay(slowInput);
    const strong = searchGeneralDefensivePlay({
      ...good, search: { ...good.search, horizonThroughTick: NOW + 1_200_000 },
    });
    expect(poor.kind).toBe('no_reachable_force_opportunity');
    expect(strong.kind).toBe('candidates');
    expect(slowInput.observation.runners).toBe(good.observation.runners);
  });

  it('changed runner arrival evidence changes physical opportunity; revision mismatch fails closed', () => {
    const good = fixture({ mask: 1 });
    expect(searchGeneralDefensivePlay(good).selected).not.toBeNull();
    const suddenRunner: DefensiveSearchInput = {
      ...good,
      observation: {
        ...good.observation,
        runners: good.observation.runners.map(runner => ({
          ...runner,
          motionRevision: runner.motionRevision + 1,
          arrivals: runner.arrivals.map(bound => ({
            ...bound, motionRevision: bound.motionRevision + 1,
            earliestArrivalNotBeforeTick: NOW + 1,
            evidence: { ...bound.evidence, revision: bound.evidence.revision + 1 },
          })),
        })),
      },
    };
    const updated = searchGeneralDefensivePlay(suddenRunner);
    expect(updated.kind).toBe('no_reachable_force_opportunity');
    const staleRevision: DefensiveSearchInput = {
      ...suddenRunner,
      observation: {
        ...suddenRunner.observation,
        runners: suddenRunner.observation.runners.map((runner, index) =>
          index === 0 ? { ...runner, motionRevision: runner.motionRevision + 1 } : runner),
      },
    };
    expect(() => searchGeneralDefensivePlay(staleRevision)).toThrow('current motion revision');
  });

  it('a required runner without source-backed arrival leaves a documented unknown, never an automatic OUT', () => {
    const source = fixture({ mask: 0 });
    const missing = {
      ...source,
      observation: { ...source.observation, runners: source.observation.runners.map(r => ({
        ...r, arrivals: [],
      })) },
    };
    expect(searchGeneralDefensivePlay(missing)).toMatchObject({
      kind: 'insufficient_runner_evidence', plans: [], selected: null,
    });
    const partiallyMissing = fixture({ mask: 1 });
    expect(searchGeneralDefensivePlay({
      ...partiallyMissing,
      observation: {
        ...partiallyMissing.observation,
        runners: partiallyMissing.observation.runners.map(r =>
          r.playerId === 'runner-first' ? { ...r, arrivals: [] } : r),
      },
    }).kind).toBe('insufficient_runner_evidence');
    const invalidHolder = fixture({ mask: 1 });
    expect(() => searchGeneralDefensivePlay({
      ...invalidHolder,
      observation: {
        ...invalidHolder.observation,
        ballCustody: { ...invalidHolder.observation.ballCustody, holderId: 'unknown' },
      },
    })).toThrow('Confirmed ball holder');
  });

  it('preserves opaque accepted source identities and rejects forged scope/time/hash references', () => {
    const input = fixture({ mask: 1 });
    const selected = searchGeneralDefensivePlay(input).selected!;
    expect(selected.steps[0].worldEvidence).toBe(input.observation.evidence);
    expect(selected.steps[0].runnerEvidence.sourceHash).toBe('a'.repeat(64));
    const forgedInput = {
      ...input,
      observation: {
        ...input.observation,
        runners: input.observation.runners.map(r => ({
          ...r,
          arrivals: r.arrivals.map(arrival => ({
            ...arrival, evidence: { ...arrival.evidence, playId: PLAY + 1 },
          })),
        })),
      },
    };
    expect(() => searchGeneralDefensivePlay(forgedInput)).toThrow('foreign play');
    expect(() => searchGeneralDefensivePlay({
      ...input, observation: {
        ...input.observation,
        evidence: { ...input.observation.evidence, sourceHash: 'not-a-hash' },
      },
    })).toThrow('accepted Native source');
    expect(() => searchGeneralDefensivePlay({
      ...input, observation: {
        ...input.observation,
        forceContext: {
          ...input.observation.forceContext,
          evidence: { ...input.observation.forceContext.evidence, playId: PLAY + 1 },
        },
      },
    })).toThrow('foreign play');
    expect(() => searchGeneralDefensivePlay({
      ...input, observation: {
        ...input.observation,
        ballCustody: {
          ...input.observation.ballCustody,
          evidence: { ...input.observation.ballCustody.evidence, availableAtTick: NOW + 1 },
        },
      },
    })).toThrow('future');
  });

  it('fail-closes caught fly, infield-fly and unknown batter participation even with secured custody', () => {
    const input = fixture({ mask: 7, holderId: 'shortstop' });
    expect(searchGeneralDefensivePlay(input).selected).not.toBeNull();
    for (const status of [
      'caught_fly_batter_retired', 'infield_fly_batter_retired', 'unresolved',
    ] as const) {
      const outcome = searchGeneralDefensivePlay({
        ...input, observation: {
          ...input.observation,
          forceContext: { ...input.observation.forceContext, status },
        },
      });
      expect(outcome).toMatchObject({
        kind: 'insufficient_force_context',
        plans: [],
        selected: null,
        outcomeAuthority: 'external_native_physics_rules_and_umpire',
      });
    }
    expect(() => searchGeneralDefensivePlay({
      ...input,
      observation: { ...input.observation, forceContext: undefined! },
    })).toThrow('force context');
  });

  it('won\'t claim execution admission with the current Native owner (ball_handler/hold only)', () => {
    const selected = searchGeneralDefensivePlay(fixture({ mask: 1 })).selected!;
    const currentlySupportedOwner: GeneralDefensiveNativeOwnerCapabilities = {
      admittedIntentKinds: ['ball_handler', 'hold'],
      supportedPhysicalActions: [],
      supportsSequentialReplan: false,
    };
    const blocked = assessGeneralDefensivePlanAdmission(selected, currentlySupportedOwner);
    expect(blocked.kind).toBe('owner_capability_missing');
    expect(blocked.missingIntentKinds).toContain('base_cover');
    expect(blocked.missingPhysicalActions).toContain('throw_launch');
    expect(blocked.requiresSequentialReplan).toBe(true);
    expect(blocked.canExecute).toBe(false);
    expect(blocked.confirmedOuts).toBeNull();
    expect(blocked.officialResult).toBeNull();
    expect(assessGeneralDefensivePlanAdmission(selected, null).kind)
      .toBe('owner_capability_missing');
    const claimedFutureOwner: GeneralDefensiveNativeOwnerCapabilities = {
      admittedIntentKinds: ['ball_handler', 'base_cover'],
      supportedPhysicalActions: [
        'carry_ball_to_base', 'throw_launch', 'secured_reception', 'controlled_base_contact',
      ],
      supportsSequentialReplan: true,
    };
    const gated = assessGeneralDefensivePlanAdmission(selected, claimedFutureOwner);
    expect(gated.kind).toBe('requires_team_intent_owner_admission');
    expect(gated.missingIntentKinds).toEqual([]);
    expect(gated.missingPhysicalActions).toEqual([]);
    expect(gated.canExecute).toBe(false);
    expect(gated.officialResult).toBeNull();
    expect(JSON.stringify(selected)).not.toMatch(/"kind":"out"|"kind":"safe"|"kind":"completed"/);
  });

  it('uses the SAME algorithm for 8 initial occupancies × 3 outs × 2 defender geometry scales', () => {
    let scenarios = 0;
    for (let mask = 0; mask < 8; mask += 1) {
      for (const outs of [0, 1, 2]) {
        for (const scale of [1, 1.4]) {
          const original = fixture({ mask, outs, maxSteps: 4, beamWidth: 32 });
          const scenario: DefensiveSearchInput = {
            ...original,
            observation: {
              ...original.observation,
              defenders: original.observation.defenders.map(d => ({
                ...d, position: { x: d.position.x * scale, z: d.position.z * scale },
              })),
            },
          };
          const expectedRoot = createInitialForceObligationState(scenario.match.bases, 'batter');
          const actual = searchGeneralDefensivePlay(scenario);
          expect(actual).toEqual(searchGeneralDefensivePlay(scenario));
          expect(actual.plans.every(p => p.steps.length <= 3 - outs)).toBe(true);
          for (const plan of actual.plans) {
            let state = expectedRoot;
            let priorTime = NOW;
            for (const step of plan.steps) {
              const due = deriveCurrentForceObligations(state).find(force =>
                force.runnerId === step.targetedRunnerId && force.targetBase === step.targetBase);
              expect(due).toBeDefined();
              expect(step.earliestControlledBaseContactTick).toBeGreaterThanOrEqual(priorTime);
              expect(step.earliestControlledBaseContactTick)
                .toBeLessThan(step.runnerEarliestArrivalNotBeforeTick);
              expect(step.worldEvidence.sourceHash).toBe('a'.repeat(64));
              expect(step.condition).toContain('rule_engine_confirm');
              state = retireForceParticipant(state, step.targetedRunnerId);
              priorTime = step.earliestControlledBaseContactTick;
            }
            expect(plan.remainingForceObligations).toEqual(deriveCurrentForceObligations(state));
            expect(plan.assumedOutsAfterForSearch).toBe(outs + plan.steps.length);
            expect(plan.executionReadiness).toBe('requires_team_intent_owner_admission');
          }
          scenarios += 1;
        }
      }
    }
    expect(scenarios).toBe(48);
  });
});
