import { describe, expect, it } from 'vitest';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
  retireForceParticipant,
} from './ForceObligation';
import {
  createControlledBaseContactFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { resolveForceOutAtTarget } from './ForceOutRule';

describe('force obligation retirement vertical slice', () => {
  it('removes the runner-from-first force after the batter-runner is retired first', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: null, third: null },
      'batter',
    );
    const initialR1 = deriveCurrentForceObligations(initial).find(
      (obligation) => obligation.runnerId === 'r1',
    );
    expect(initialR1).toMatchObject({
      classification: 'force',
      targetBase: 2,
    });

    const afterBatterOut = retireForceParticipant(initial, 'batter');
    const laterR1 = deriveCurrentForceObligations(afterBatterOut).find(
      (obligation) => obligation.runnerId === 'r1',
    );

    expect(laterR1).toBeUndefined();

    // A later defender touch of second base is only a physical fact now.
    // Without a current obligation there is no valid ForceOutRule input.
    const laterControl = createControlledBaseContactFact(
      'shortstop',
      2,
      1_200_000,
    );
    const laterRunnerTouch = createRunnerBaseTouchFact(
      'r1',
      2,
      1_250_000,
    );
    expect(laterControl.base).toBe(2);
    expect(laterRunnerTouch.base).toBe(2);
  });

  it('breaks the force on runners from second and third after R1 is force-retired at second', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: 'r3' },
      'batter',
    );
    const initialObligations = deriveCurrentForceObligations(initial);
    const r1Force = initialObligations.find(
      (obligation) => obligation.runnerId === 'r1',
    );
    expect(r1Force).toBeDefined();

    const forceOut = resolveForceOutAtTarget({
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
    expect(forceOut.kind).toBe('out');

    const afterR1Out = retireForceParticipant(initial, 'r1');
    const obligations = deriveCurrentForceObligations(afterR1Out);

    expect(obligations).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
    ]);
    expect(obligations.some((item) => item.runnerId === 'r2')).toBe(false);
    expect(obligations.some((item) => item.runnerId === 'r3')).toBe(false);
  });
});
