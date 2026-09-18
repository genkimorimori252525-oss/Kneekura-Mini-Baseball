import { describe, expect, it } from 'vitest';
import type { ForceOutRuleResult } from './ForceOutRule';
import { createRunnerBaseTouchFact } from './PhysicalRuleFacts';
import { resolveForceOutScoringRule } from './RuleEngine';

const forceOut = (
  outTick: number,
): Extract<ForceOutRuleResult, { kind: 'out' }> => ({
  kind: 'out',
  runnerId: 'r1',
  classification: 'force',
  outTick,
  targetBase: 2,
  defenderControlTick: outTick,
  runnerTouchTick: outTick + 20_000,
});

describe('RuleEngine force-out scoring boundary', () => {
  it('classifies a third force out as force and suppresses an earlier home touch', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_090_000,
    );

    expect(resolveForceOutScoringRule({
      outsAtStart: 2,
      forceOut: forceOut(1_100_000),
      homeTouches: [home],
    })).toEqual({
      outsAfter: 3,
      thirdOut: true,
      pendingHomeTouches: [],
      thirdOutScoring: {
        kind: 'resolved',
        createsThirdOut: true,
        thirdOutTick: 1_100_000,
        classification: 'force',
        scored: [],
        suppressed: [home],
        simultaneous: [],
      },
    });
  });

  it('keeps home touches pending when the force out is not yet the third out', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_090_000,
    );

    expect(resolveForceOutScoringRule({
      outsAtStart: 1,
      forceOut: forceOut(1_100_000),
      homeTouches: [home],
    })).toEqual({
      outsAfter: 2,
      thirdOut: false,
      pendingHomeTouches: [home],
      thirdOutScoring: null,
    });
  });
});
