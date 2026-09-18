import { describe, expect, it } from 'vitest';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
  retireForceParticipant,
  satisfyForceParticipantObligation,
} from './ForceObligation';

describe('ForceObligation satisfaction', () => {
  it('removes the batter pending first-base obligation while preserving R1 force pressure', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: null, third: null },
      'batter',
    );
    const afterBatterSafe = satisfyForceParticipantObligation(
      initial,
      'batter',
    );

    expect(deriveCurrentForceObligations(afterBatterSafe)).toEqual([
      {
        runnerId: 'r1',
        fromBase: 1,
        targetBase: 2,
        classification: 'force',
      },
    ]);
  });

  it('removes R1 pending force after second-base arrival while preserving R2 force', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: null },
      'batter',
    );
    const afterR1Safe = satisfyForceParticipantObligation(
      initial,
      'r1',
    );

    expect(deriveCurrentForceObligations(afterR1Safe)).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
      {
        runnerId: 'r2',
        fromBase: 2,
        targetBase: 3,
        classification: 'force',
      },
    ]);
  });

  it('still breaks downstream force pressure when a satisfied R1 is later retired', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: 'r2', third: 'r3' },
      'batter',
    );
    const satisfied = satisfyForceParticipantObligation(
      initial,
      'r1',
    );
    const retired = retireForceParticipant(satisfied, 'r1');

    expect(deriveCurrentForceObligations(retired)).toEqual([
      {
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      },
    ]);
  });

  it('rejects satisfaction when that participant has no current obligation', () => {
    const state = createInitialForceObligationState(
      { first: null, second: 'r2', third: null },
      'batter',
    );

    expect(() => satisfyForceParticipantObligation(
      state,
      'r2',
    )).toThrow('cannot satisfy participant without a current obligation');
  });

  it('rejects applying satisfaction twice', () => {
    const initial = createInitialForceObligationState(
      { first: 'r1', second: null, third: null },
      'batter',
    );
    const once = satisfyForceParticipantObligation(initial, 'r1');

    expect(() => satisfyForceParticipantObligation(
      once,
      'r1',
    )).toThrow('force participant obligation is already satisfied');
  });
});
