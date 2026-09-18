import { describe, expect, it } from 'vitest';
import type { BaseOccupancy } from '../../model/CanonicalMatchState';
import {
  createControlledBaseContactFact,
  createPlayEndFact,
  createRunnerBaseTouchFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveGroundBallFirstBaseRule,
} from '../../rules/RuleEngine';
import {
  createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule,
} from './GroundBallLiveBallResolution';

const basesAfter: BaseOccupancy = {
  first: 'batter',
  second: 'r1',
  third: null,
};

describe('GroundBallLiveBallResolution', () => {
  it('finalizes pending home touches at play end for a non-third-out first-base result', () => {
    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );
    const rule = resolveGroundBallFirstBaseRule({
      outsAtStart: 1,
      batterRunnerId: 'batter',
      defenderControl: createControlledBaseContactFact(
        'first-baseman',
        1,
        1_200_000,
      ),
      batterRunnerTouch: createRunnerBaseTouchFact(
        'batter',
        1,
        1_150_000,
      ),
      homeTouches: [homeTouch],
    });

    expect(createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule({
      rule,
      playEnd: createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
      basesAfter,
    })).toEqual({
      playEnd: createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
      outsAfter: 1,
      basesAfter,
      scoredRunnerIds: ['r3'],
    });
  });

  it('uses third-out scoring suppression instead of pending-run finalization', () => {
    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );
    const rule = resolveGroundBallFirstBaseRule({
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
      homeTouches: [homeTouch],
    });

    expect(createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule({
      rule,
      playEnd: createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
      basesAfter,
    })).toEqual({
      playEnd: createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
      outsAfter: 3,
      basesAfter,
      scoredRunnerIds: [],
    });
  });

  it('rejects unresolved first-base rule results rather than guessing the play result', () => {
    const rule = resolveGroundBallFirstBaseRule({
      outsAtStart: 1,
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
      homeTouches: [],
    });

    expect(() => createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule({
      rule,
      playEnd: createPlayEndFact(
        1_300_000,
        'live_action_complete',
      ),
      basesAfter,
    })).toThrow(
      'ground-ball first-base rule must be resolved before match-state application',
    );
  });
});
