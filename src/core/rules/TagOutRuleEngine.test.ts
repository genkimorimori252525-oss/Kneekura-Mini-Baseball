import { describe, expect, it } from 'vitest';
import type { TagArrivalResult } from './TagArrivalRule';
import { createRunnerBaseTouchFact } from './PhysicalRuleFacts';
import { resolveTagOutScoringRule } from './RuleEngine';

const tagOut = (
  outTick: number,
): Extract<TagArrivalResult, { kind: 'out' }> => ({
  kind: 'out',
  runnerId: 'tagged-runner',
  classification: 'time_play',
  outTick,
  targetBase: 3,
  tagTick: outTick,
  runnerTouchTick: outTick + 10_000,
});

describe('RuleEngine tag-out time-play scoring', () => {
  it('scores an earlier home touch and suppresses a later one on the third out', () => {
    const before = createRunnerBaseTouchFact(
      'runner-before',
      4,
      1_090_000,
    );
    const after = createRunnerBaseTouchFact(
      'runner-after',
      4,
      1_110_000,
    );

    expect(resolveTagOutScoringRule({
      outsAtStart: 2,
      tagOut: tagOut(1_100_000),
      homeTouches: [before, after],
    })).toEqual({
      outsAfter: 3,
      thirdOut: true,
      pendingHomeTouches: [],
      thirdOutScoring: {
        kind: 'resolved',
        createsThirdOut: true,
        thirdOutTick: 1_100_000,
        classification: 'time_play',
        scored: [before],
        suppressed: [after],
        simultaneous: [],
      },
    });
  });

  it('preserves same-tick home touch as simultaneous unresolved', () => {
    const same = createRunnerBaseTouchFact(
      'runner-home',
      4,
      1_100_000,
    );

    expect(resolveTagOutScoringRule({
      outsAtStart: 2,
      tagOut: tagOut(1_100_000),
      homeTouches: [same],
    })).toEqual({
      outsAfter: 3,
      thirdOut: true,
      pendingHomeTouches: [],
      thirdOutScoring: {
        kind: 'simultaneous_unresolved',
        createsThirdOut: true,
        thirdOutTick: 1_100_000,
        classification: 'time_play',
        scored: [],
        suppressed: [],
        simultaneous: [same],
      },
    });
  });

  it('keeps home touches pending when the tag out is only the second out', () => {
    const home = createRunnerBaseTouchFact(
      'runner-home',
      4,
      1_090_000,
    );

    expect(resolveTagOutScoringRule({
      outsAtStart: 1,
      tagOut: tagOut(1_100_000),
      homeTouches: [home],
    })).toEqual({
      outsAfter: 2,
      thirdOut: false,
      pendingHomeTouches: [home],
      thirdOutScoring: null,
    });
  });
});
