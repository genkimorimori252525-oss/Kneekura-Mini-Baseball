import { describe, expect, it } from 'vitest';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
  retireForceParticipant,
} from './ForceObligation';

describe('ForceObligation', () => {
  it('always gives an active batter-runner the first-base obligation', () => {
    const state = createInitialForceObligationState(
      { first: null, second: null, third: null },
      'batter',
    );

    expect(deriveCurrentForceObligations(state)).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
    ]);
  });

  it('derives a contiguous force chain from occupied first base', () => {
    const one = createInitialForceObligationState(
      { first: 'r1', second: null, third: null },
      'batter',
    );
    expect(deriveCurrentForceObligations(one)).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
      {
        runnerId: 'r1',
        fromBase: 1,
        targetBase: 2,
        classification: 'force',
      },
    ]);

    const two = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: null },
      'batter',
    );
    expect(deriveCurrentForceObligations(two)).toHaveLength(3);

    const loaded = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: 'r3' },
      'batter',
    );
    expect(deriveCurrentForceObligations(loaded)).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
      {
        runnerId: 'r1',
        fromBase: 1,
        targetBase: 2,
        classification: 'force',
      },
      {
        runnerId: 'r2',
        fromBase: 2,
        targetBase: 3,
        classification: 'force',
      },
      {
        runnerId: 'r3',
        fromBase: 3,
        targetBase: 4,
        classification: 'force',
      },
    ]);
  });

  it('does not force a runner on second when first base is empty', () => {
    const state = createInitialForceObligationState(
      { first: null, second: 'r2', third: null },
      'batter',
    );

    expect(deriveCurrentForceObligations(state)).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
    ]);
  });

  it('dissolves every pre-existing runner force when the batter-runner is retired', () => {
    const state = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: 'r3' },
      'batter',
    );
    const after = retireForceParticipant(state, 'batter');

    expect(deriveCurrentForceObligations(after)).toEqual([]);
    expect(state.participants.find((p) => p.runnerId === 'batter')?.active)
      .toBe(true);
  });

  it('breaks the force chain ahead of a retired runner while leaving the batter active', () => {
    const state = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: 'r3' },
      'batter',
    );
    const after = retireForceParticipant(state, 'r1');

    expect(deriveCurrentForceObligations(after)).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
    ]);
  });

  it('rejects duplicate participant ids and unknown retirements', () => {
    expect(() => createInitialForceObligationState(
      { first: 'same', second: 'same', third: null },
      'batter',
    )).toThrow('force participants must have unique runner ids');

    expect(() => retireForceParticipant(
      createInitialForceObligationState(
        { first: 'r1', second: null, third: null },
        'batter',
      ),
      'missing',
    )).toThrow('cannot retire unknown force participant');
  });
});
