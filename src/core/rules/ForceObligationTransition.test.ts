import { describe, expect, it } from 'vitest';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
} from './ForceObligation';
import type { ForceOutRuleResult } from './ForceOutRule';
import { applyForceOutRuleResultToState } from './ForceObligationTransition';

const state = () => createInitialForceObligationState(
  { first: 'r1', second: 'r2', third: null },
  'batter',
);

describe('ForceObligationTransition', () => {
  it('marks a safe forced runner obligation satisfied', () => {
    const result: ForceOutRuleResult = {
      kind: 'safe',
      runnerId: 'r1',
      targetBase: 2,
      touchTick: 1_100_000,
      defenderControlTick: 1_120_000,
    };

    const after = applyForceOutRuleResultToState(state(), result);

    expect(deriveCurrentForceObligations(after).map((item) => item.runnerId))
      .toEqual(['batter', 'r2']);
    expect(after.participants.find((item) => item.runnerId === 'r1'))
      .toMatchObject({ active: true, obligationSatisfied: true });
  });

  it('retires a forced runner on a force out and breaks the downstream chain', () => {
    const result: ForceOutRuleResult = {
      kind: 'out',
      runnerId: 'r1',
      classification: 'force',
      outTick: 1_100_000,
      targetBase: 2,
      defenderControlTick: 1_100_000,
      runnerTouchTick: 1_120_000,
    };

    const after = applyForceOutRuleResultToState(state(), result);

    expect(deriveCurrentForceObligations(after).map((item) => item.runnerId))
      .toEqual(['batter']);
    expect(after.participants.find((item) => item.runnerId === 'r1'))
      .toMatchObject({ active: false });
  });

  it('does not mutate force state for simultaneous or unresolved physical comparisons', () => {
    const initial = state();
    const simultaneous: ForceOutRuleResult = {
      kind: 'simultaneous',
      runnerId: 'r1',
      targetBase: 2,
      tick: 1_100_000,
    };
    const unresolved: ForceOutRuleResult = {
      kind: 'unresolved',
      runnerId: 'r1',
      targetBase: 2,
      reason: 'missing_defender_control',
    };

    expect(applyForceOutRuleResultToState(initial, simultaneous)).toBe(initial);
    expect(applyForceOutRuleResultToState(initial, unresolved)).toBe(initial);
  });
});
