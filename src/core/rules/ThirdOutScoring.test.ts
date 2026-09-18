import { describe, expect, it } from 'vitest';
import { createRunnerBaseTouchFact } from './PhysicalRuleFacts';
import { resolveThirdOutScoring } from './ThirdOutScoring';

describe('ThirdOutScoring', () => {
  it('suppresses an earlier home touch when the third out is a force out', () => {
    const home = createRunnerBaseTouchFact(
      'runner-from-third',
      4,
      1_100_000,
    );

    expect(resolveThirdOutScoring({
      outsAtStart: 2,
      thirdOutCandidate: {
        runnerId: 'runner-from-first',
        outTick: 1_120_000,
        classification: 'force',
      },
      homeTouches: [home],
    })).toEqual({
      kind: 'resolved',
      createsThirdOut: true,
      thirdOutTick: 1_120_000,
      classification: 'force',
      scored: [],
      suppressed: [home],
      simultaneous: [],
    });
  });

  it('suppresses an earlier home touch when the third out is the batter-runner before first', () => {
    const home = createRunnerBaseTouchFact(
      'runner-from-third',
      4,
      1_100_000,
    );

    const result = resolveThirdOutScoring({
      outsAtStart: 2,
      thirdOutCandidate: {
        runnerId: 'batter',
        outTick: 1_120_000,
        classification: 'batter_runner_before_first',
      },
      homeTouches: [home],
    });

    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') {
      throw new Error('fixture must resolve a third-out scoring result');
    }
    expect(result.scored).toEqual([]);
    expect(result.suppressed).toEqual([home]);
  });

  it('uses physical event time for a time-play third out', () => {
    const before = createRunnerBaseTouchFact(
      'runner-before',
      4,
      1_100_000,
    );
    const after = createRunnerBaseTouchFact(
      'runner-after',
      4,
      1_130_000,
    );

    expect(resolveThirdOutScoring({
      outsAtStart: 2,
      thirdOutCandidate: {
        runnerId: 'tagged-runner',
        outTick: 1_120_000,
        classification: 'time_play',
      },
      homeTouches: [before, after],
    })).toEqual({
      kind: 'resolved',
      createsThirdOut: true,
      thirdOutTick: 1_120_000,
      classification: 'time_play',
      scored: [before],
      suppressed: [after],
      simultaneous: [],
    });
  });

  it('preserves a home touch simultaneous with a time-play third out as unresolved', () => {
    const simultaneous = createRunnerBaseTouchFact(
      'runner-home',
      4,
      1_120_000,
    );

    expect(resolveThirdOutScoring({
      outsAtStart: 2,
      thirdOutCandidate: {
        runnerId: 'tagged-runner',
        outTick: 1_120_000,
        classification: 'time_play',
      },
      homeTouches: [simultaneous],
    })).toEqual({
      kind: 'simultaneous_unresolved',
      createsThirdOut: true,
      thirdOutTick: 1_120_000,
      classification: 'time_play',
      scored: [],
      suppressed: [],
      simultaneous: [simultaneous],
    });
  });

  it('does not apply third-out scoring suppression when the out is only the second out', () => {
    expect(resolveThirdOutScoring({
      outsAtStart: 1,
      thirdOutCandidate: {
        runnerId: 'batter',
        outTick: 1_120_000,
        classification: 'batter_runner_before_first',
      },
      homeTouches: [
        createRunnerBaseTouchFact(
          'runner-from-third',
          4,
          1_100_000,
        ),
      ],
    })).toEqual({
      kind: 'not_third_out',
      createsThirdOut: false,
    });
  });

  it('rejects non-home touch facts and invalid starting outs', () => {
    expect(() => resolveThirdOutScoring({
      outsAtStart: 2,
      thirdOutCandidate: {
        runnerId: 'batter',
        outTick: 1_120_000,
        classification: 'batter_runner_before_first',
      },
      homeTouches: [
        createRunnerBaseTouchFact(
          'runner',
          3,
          1_100_000,
        ),
      ],
    })).toThrow('third-out scoring requires base-4 home touch facts');

    expect(() => resolveThirdOutScoring({
      outsAtStart: 3,
      thirdOutCandidate: {
        runnerId: 'batter',
        outTick: 1_120_000,
        classification: 'batter_runner_before_first',
      },
      homeTouches: [],
    })).toThrow('outsAtStart must be an integer from 0 through 2');
  });
});
