import { describe, expect, it } from 'vitest';
import {
  createControlledRunnerTagFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { resolveTagArrival } from './TagArrivalRule';

describe('TagArrivalRule', () => {
  it('rules the runner out when a controlled tag occurs strictly before target-base touch', () => {
    expect(resolveTagArrival({
      runnerId: 'runner',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'runner',
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        3,
        1_120_000,
      ),
    })).toEqual({
      kind: 'out',
      runnerId: 'runner',
      classification: 'time_play',
      outTick: 1_100_000,
      targetBase: 3,
      tagTick: 1_100_000,
      runnerTouchTick: 1_120_000,
    });
  });

  it('rules the runner safe at arrival when target-base touch occurs strictly first', () => {
    expect(resolveTagArrival({
      runnerId: 'runner',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'runner',
        1_120_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        3,
        1_100_000,
      ),
    })).toEqual({
      kind: 'safe',
      runnerId: 'runner',
      targetBase: 3,
      touchTick: 1_100_000,
      tagTick: 1_120_000,
    });
  });

  it('preserves exact same-tick tag and base touch as simultaneous', () => {
    expect(resolveTagArrival({
      runnerId: 'runner',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'runner',
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        3,
        1_100_000,
      ),
    })).toEqual({
      kind: 'simultaneous',
      runnerId: 'runner',
      targetBase: 3,
      tick: 1_100_000,
    });
  });

  it('remains unresolved when either comparison fact is missing', () => {
    expect(resolveTagArrival({
      runnerId: 'runner',
      targetBase: 3,
      controlledTag: null,
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        3,
        1_100_000,
      ),
    })).toEqual({
      kind: 'unresolved',
      runnerId: 'runner',
      targetBase: 3,
      reason: 'missing_controlled_tag',
    });

    expect(resolveTagArrival({
      runnerId: 'runner',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'runner',
        1_100_000,
      ),
      runnerTouch: null,
    })).toEqual({
      kind: 'unresolved',
      runnerId: 'runner',
      targetBase: 3,
      reason: 'missing_runner_touch',
    });
  });

  it('rejects tag or touch facts that do not belong to this arrival play', () => {
    expect(() => resolveTagArrival({
      runnerId: 'runner',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'other-runner',
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        3,
        1_120_000,
      ),
    })).toThrow('controlled tag must belong to the evaluated runner');

    expect(() => resolveTagArrival({
      runnerId: 'runner',
      targetBase: 3,
      controlledTag: createControlledRunnerTagFact(
        'third-baseman',
        'runner',
        1_100_000,
      ),
      runnerTouch: createRunnerBaseTouchFact(
        'runner',
        2,
        1_120_000,
      ),
    })).toThrow('runner touch must match the evaluated target base');
  });
});
