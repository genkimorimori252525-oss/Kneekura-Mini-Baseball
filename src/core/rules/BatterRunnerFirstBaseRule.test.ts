import { describe, expect, it } from 'vitest';
import {
  createControlledBaseContactFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { resolveBatterRunnerFirstBase } from './BatterRunnerFirstBaseRule';

describe('BatterRunnerFirstBaseRule', () => {
  it('rules the batter-runner out when controlled first base occurs strictly first', () => {
    const result = resolveBatterRunnerFirstBase({
      batterRunnerId: 'batter',
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
    });

    expect(result).toEqual({
      kind: 'out',
      runnerId: 'batter',
      reason: 'batter_runner_before_first',
      outTick: 1_100_000,
      defenderControlTick: 1_100_000,
      runnerTouchTick: 1_120_000,
    });
  });

  it('rules the batter-runner safe when first-base touch occurs strictly first', () => {
    const result = resolveBatterRunnerFirstBase({
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_120_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_100_000,
      ),
    });

    expect(result).toEqual({
      kind: 'safe',
      runnerId: 'batter',
      base: 1,
      touchTick: 1_100_000,
      defenderControlTick: 1_120_000,
    });
  });

  it('preserves exact physical simultaneity instead of inventing precedence', () => {
    const result = resolveBatterRunnerFirstBase({
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_100_000,
      ),
    });

    expect(result).toEqual({
      kind: 'simultaneous',
      runnerId: 'batter',
      base: 1,
      tick: 1_100_000,
    });
  });

  it('remains unresolved when either required physical fact is missing', () => {
    expect(resolveBatterRunnerFirstBase({
      batterRunnerId: 'batter',
      defenderControl: null,
      runnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_100_000,
      ),
    })).toEqual({
      kind: 'unresolved',
      runnerId: 'batter',
      reason: 'missing_defender_control',
    });

    expect(resolveBatterRunnerFirstBase({
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_100_000,
      ),
      runnerTouch: null,
    })).toEqual({
      kind: 'unresolved',
      runnerId: 'batter',
      reason: 'missing_runner_touch',
    });
  });

  it('rejects physical facts for the wrong base or runner', () => {
    expect(() => resolveBatterRunnerFirstBase({
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'shortstop',
        2,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_120_000,
      ),
    })).toThrow('first-base rule requires defender control at base 1');

    expect(() => resolveBatterRunnerFirstBase({
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'other-runner',
        1,
        1_120_000,
      ),
    })).toThrow('runner touch must belong to the batter-runner');
  });
});
