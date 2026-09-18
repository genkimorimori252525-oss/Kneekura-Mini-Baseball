import { describe, expect, it } from 'vitest';
import {
  createControlledBaseContactFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { resolveGroundBallFirstBaseRule } from './RuleEngine';

describe('RuleEngine ground-ball first-base vertical slice', () => {
  it('suppresses a run that touched home before a batter-runner first-base third out', () => {
    const home = createRunnerBaseTouchFact(
      'runner-from-third',
      4,
      1_100_000,
    );
    const input = {
      outsAtStart: 2,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_120_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_150_000,
      ),
      homeTouches: [home],
    } as const;

    const result = resolveGroundBallFirstBaseRule(input);

    expect(result.physicalFacts).toEqual(input);
    expect(result.correctRuleResult).toEqual({
      kind: 'resolved',
      batterRunnerFirstBase: {
        kind: 'out',
        runnerId: 'batter',
        reason: 'batter_runner_before_first',
        outTick: 1_120_000,
        defenderControlTick: 1_120_000,
        runnerTouchTick: 1_150_000,
      },
      outsAfter: 3,
      thirdOut: true,
      runsScored: [],
      runsSuppressed: [home],
      thirdOutScoring: {
        kind: 'resolved',
        createsThirdOut: true,
        thirdOutTick: 1_120_000,
        classification: 'batter_runner_before_first',
        scored: [],
        suppressed: [home],
        simultaneous: [],
      },
    });
  });

  it('does not invoke third-out suppression when the same out is only the second out', () => {
    const home = createRunnerBaseTouchFact(
      'runner-from-third',
      4,
      1_100_000,
    );

    const result = resolveGroundBallFirstBaseRule({
      outsAtStart: 1,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_120_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_150_000,
      ),
      homeTouches: [home],
    });

    expect(result.correctRuleResult).toMatchObject({
      kind: 'resolved',
      outsAfter: 2,
      thirdOut: false,
      runsScored: [home],
      runsSuppressed: [],
      thirdOutScoring: null,
    });
  });

  it('keeps the batter-runner safe when first base was touched before defender control', () => {
    const home = createRunnerBaseTouchFact(
      'runner-from-third',
      4,
      1_090_000,
    );

    const result = resolveGroundBallFirstBaseRule({
      outsAtStart: 2,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_120_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_100_000,
      ),
      homeTouches: [home],
    });

    expect(result.correctRuleResult).toMatchObject({
      kind: 'resolved',
      batterRunnerFirstBase: {
        kind: 'safe',
        runnerId: 'batter',
        base: 1,
        touchTick: 1_100_000,
        defenderControlTick: 1_120_000,
      },
      outsAfter: 2,
      thirdOut: false,
      runsScored: [home],
      runsSuppressed: [],
      thirdOutScoring: null,
    });
  });

  it('preserves a simultaneous first-base play as unresolved correct-rule state', () => {
    const input = {
      outsAtStart: 2,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_100_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_100_000,
      ),
      homeTouches: [
        createRunnerBaseTouchFact(
          'runner-from-third',
          4,
          1_090_000,
        ),
      ],
    } as const;

    const result = resolveGroundBallFirstBaseRule(input);

    expect(result.physicalFacts).toEqual(input);
    expect(result.correctRuleResult).toEqual({
      kind: 'unresolved',
      batterRunnerFirstBase: {
        kind: 'simultaneous',
        runnerId: 'batter',
        base: 1,
        tick: 1_100_000,
      },
      outsAfter: 2,
      pendingHomeTouches: input.homeTouches,
    });
  });
});
