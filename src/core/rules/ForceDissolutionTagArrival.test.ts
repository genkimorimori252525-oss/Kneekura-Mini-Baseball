import { describe, expect, it } from 'vitest';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
} from './ForceObligation';
import { applyForceOutRuleResultToState } from './ForceObligationTransition';
import {
  createControlledBaseContactFact,
  createControlledRunnerTagFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { resolveForceOutAtTarget } from './ForceOutRule';
import { resolveTagArrival } from './TagArrivalRule';

describe('force dissolution -> tag arrival vertical slice', () => {
  it('requires a physical tag after the runner loses force status', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: null },
      'batter',
    );
    const r1Force = deriveCurrentForceObligations(initial).find(
      (item) => item.runnerId === 'r1',
    );
    expect(r1Force).toBeDefined();

    const r1Out = resolveForceOutAtTarget({
      obligation: r1Force!,
      defenderControl: createControlledBaseContactFact(
        'second-baseman',
        2,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_120_000,
      ),
    });
    expect(r1Out.kind).toBe('out');
    if (r1Out.kind !== 'out') {
      throw new Error('fixture must retire r1');
    }

    const afterR1Out = applyForceOutRuleResultToState(initial, r1Out);
    const r2Force = deriveCurrentForceObligations(afterR1Out).find(
      (item) => item.runnerId === 'r2',
    );
    expect(r2Force).toBeUndefined();

    // Touching third base with controlled possession is now only a physical fact.
    // With no current force obligation it cannot be resolved by ForceOutRule.
    const thirdBaseControl = createControlledBaseContactFact(
      'third-baseman',
      3,
      1_200_000,
    );
    expect(thirdBaseControl).toEqual({
      kind: 'controlled_base_contact',
      defenderId: 'third-baseman',
      base: 3,
      tick: 1_200_000,
    });

    // A real tag on the runner is a different rule path and can produce an out.
    const tagResult = resolveTagArrival({
      runnerId: 'r2',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'r2',
        1_205_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r2',
        3,
        1_220_000,
      ),
    });

    expect(tagResult).toEqual({
      kind: 'out',
      runnerId: 'r2',
      classification: 'time_play',
      outTick: 1_205_000,
      targetBase: 3,
      tagTick: 1_205_000,
      runnerTouchTick: 1_220_000,
    });
  });
});
