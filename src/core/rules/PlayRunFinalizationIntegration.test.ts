import { describe, expect, it } from 'vitest';
import {
  createControlledBaseContactFact,
  createPlayEndFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  finalizeRulePendingRuns,
  resolveGroundBallFirstBaseRule,
} from './RuleEngine';

describe('RuleEngine pending-run play-end finalization', () => {
  it('finalizes a home touch after the batter reaches first safely and live action ends', () => {
    const home = createRunnerBaseTouchFact(
      'runner-from-third',
      4,
      1_090_000,
    );
    const play = resolveGroundBallFirstBaseRule({
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

    expect(play.correctRuleResult).toMatchObject({
      kind: 'resolved',
      thirdOut: false,
      pendingHomeTouches: [home],
    });

    if (
      play.correctRuleResult.kind !== 'resolved'
      || play.correctRuleResult.thirdOut !== false
    ) {
      throw new Error('fixture must remain a non-third-out resolved play');
    }

    expect(finalizeRulePendingRuns(
      play.correctRuleResult,
      createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
    )).toEqual({
      finalizedAt: 1_300_000,
      playEnd: {
        kind: 'play_end',
        tick: 1_300_000,
        reason: 'live_action_complete',
      },
      scored: [home],
    });
  });
});
