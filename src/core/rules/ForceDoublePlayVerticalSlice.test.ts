import { describe, expect, it } from 'vitest';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
} from './ForceObligation';
import { applyForceOutRuleResultToState } from './ForceObligationTransition';
import {
  createControlledBaseContactFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { resolveForceOutAtTarget } from './ForceOutRule';
import {
  resolveForceOutScoringRule,
  resolveGroundBallFirstBaseRule,
} from './RuleEngine';

describe('force double-play causal vertical slice', () => {
  it('dissolves upstream forces after the first out and still suppresses the run on batter-runner third out', () => {
    const initialState = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: 'r3' },
      'batter',
    );
    const initialObligations = deriveCurrentForceObligations(initialState);
    const r1Force = initialObligations.find(
      (item) => item.runnerId === 'r1',
    );
    expect(r1Force).toBeDefined();

    const secondOut = resolveForceOutAtTarget({
      obligation: r1Force!,
      defenderControl: createControlledBaseContactFact(
        'shortstop',
        2,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_120_000,
      ),
    });
    expect(secondOut.kind).toBe('out');
    if (secondOut.kind !== 'out') {
      throw new Error('fixture must produce the second out');
    }

    const afterSecondOut = applyForceOutRuleResultToState(
      initialState,
      secondOut,
    );
    const remaining = deriveCurrentForceObligations(afterSecondOut);

    expect(remaining).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
    ]);
    expect(remaining.some((item) => item.runnerId === 'r2')).toBe(false);
    expect(remaining.some((item) => item.runnerId === 'r3')).toBe(false);

    const afterSecondOutScoring = resolveForceOutScoringRule({
      outsAtStart: 1,
      forceOut: secondOut,
      homeTouches: [],
    });
    expect(afterSecondOutScoring).toMatchObject({
      outsAfter: 2,
      thirdOut: false,
      thirdOutScoring: null,
    });

    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      1_150_000,
    );

    const thirdOut = resolveGroundBallFirstBaseRule({
      outsAtStart: 2,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_200_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_230_000,
      ),
      homeTouches: [homeTouch],
    });

    expect(thirdOut.correctRuleResult).toMatchObject({
      kind: 'resolved',
      outsAfter: 3,
      thirdOut: true,
      runsScored: [],
      runsSuppressed: [homeTouch],
    });
  });
});
