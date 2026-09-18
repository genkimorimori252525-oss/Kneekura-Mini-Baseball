import { describe, expect, it } from 'vitest';
import {
  createControlledBaseContactFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import type { ForceObligation } from './ForceObligation';
import { resolveForceOutAtTarget } from './ForceOutRule';

const obligation = (
  overrides: Partial<ForceObligation> = {},
): ForceObligation => ({
  runnerId: 'r1',
  fromBase: 1,
  targetBase: 2,
  classification: 'force',
  ...overrides,
});

describe('ForceOutRule', () => {
  it('rules a force out when controlled target base occurs strictly first', () => {
    expect(resolveForceOutAtTarget({
      obligation: obligation(),
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
    })).toEqual({
      kind: 'out',
      runnerId: 'r1',
      classification: 'force',
      outTick: 1_100_000,
      targetBase: 2,
      defenderControlTick: 1_100_000,
      runnerTouchTick: 1_120_000,
    });
  });

  it('rules the forced runner safe at the target when the runner touches strictly first', () => {
    expect(resolveForceOutAtTarget({
      obligation: obligation(),
      defenderControl: createControlledBaseContactFact(
        'shortstop',
        2,
        1_120_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_100_000,
      ),
    })).toEqual({
      kind: 'safe',
      runnerId: 'r1',
      targetBase: 2,
      touchTick: 1_100_000,
      defenderControlTick: 1_120_000,
    });
  });

  it('preserves an exact same-tick force play as simultaneous', () => {
    expect(resolveForceOutAtTarget({
      obligation: obligation(),
      defenderControl: createControlledBaseContactFact(
        'shortstop',
        2,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_100_000,
      ),
    })).toEqual({
      kind: 'simultaneous',
      runnerId: 'r1',
      targetBase: 2,
      tick: 1_100_000,
    });
  });

  it('remains unresolved when either physical comparison fact is absent', () => {
    expect(resolveForceOutAtTarget({
      obligation: obligation(),
      defenderControl: null,
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_100_000,
      ),
    })).toEqual({
      kind: 'unresolved',
      runnerId: 'r1',
      targetBase: 2,
      reason: 'missing_defender_control',
    });

    expect(resolveForceOutAtTarget({
      obligation: obligation(),
      defenderControl: createControlledBaseContactFact(
        'shortstop',
        2,
        1_100_000,
      ),
      runnerTouch: null,
    })).toEqual({
      kind: 'unresolved',
      runnerId: 'r1',
      targetBase: 2,
      reason: 'missing_runner_touch',
    });
  });

  it('rejects batter-runner-before-first and mismatched physical facts', () => {
    expect(() => resolveForceOutAtTarget({
      obligation: obligation({
        runnerId: 'batter',
        fromBase: 0,
        targetBase: 1,
        classification: 'batter_runner_before_first',
      }),
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_120_000,
      ),
    })).toThrow('force-out rule requires a current force obligation');

    expect(() => resolveForceOutAtTarget({
      obligation: obligation(),
      defenderControl: createControlledBaseContactFact(
        'third-baseman',
        3,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'r1',
        2,
        1_120_000,
      ),
    })).toThrow('defender control must match the force target base');

    expect(() => resolveForceOutAtTarget({
      obligation: obligation(),
      defenderControl: createControlledBaseContactFact(
        'shortstop',
        2,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'other-runner',
        2,
        1_120_000,
      ),
    })).toThrow('runner touch must belong to the forced runner');
  });
});
