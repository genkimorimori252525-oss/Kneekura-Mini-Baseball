import { describe, expect, it } from 'vitest';
import { createRunnerBaseTouchFact } from './PhysicalRuleFacts';
import { createRunnerPrecedence } from './RunnerPrecedence';
import type { TagUpAppealResult } from './TagUpAppealRule';
import { resolveThirdOutScoring } from './ThirdOutScoring';
import {
  createExistingThirdOutInningEndingOption,
  createTagUpAppealInningEndingOption,
  resolveAdvantageousAppealOutOptions,
} from './RuleEngine';

const precedence = createRunnerPrecedence(
  {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  'batter',
);

const appealOut = (
  runnerId: string,
  base: 1 | 3,
  tick: number,
): Extract<TagUpAppealResult, { kind: 'out' }> => ({
  kind: 'out',
  runnerId,
  classification: 'tag_up_appeal',
  appealedBase: base,
  outTick: tick,
  appealTick: tick,
});

describe('RuleEngine appeal fourth-out boundary', () => {
  it('builds scoring options only from already-sustained appeal outs', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );

    expect(createTagUpAppealInningEndingOption({
      optionId: 'appeal-r1',
      source: 'apparent_third_out',
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [home],
    })).toMatchObject({
      optionId: 'appeal-r1',
      source: 'apparent_third_out',
      scoring: {
        kind: 'resolved',
        scored: [home],
        suppressed: [],
      },
    });
  });

  it('selects the scoring consequence of a sustained advantageous fourth-out appeal', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );
    const apparent = createTagUpAppealInningEndingOption({
      optionId: 'appeal-r1',
      source: 'apparent_third_out',
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [home],
    });
    const fourth = createTagUpAppealInningEndingOption({
      optionId: 'appeal-r3',
      source: 'sustained_appeal',
      precedence,
      appealOut: appealOut('r3', 3, 1_300_000),
      homeTouches: [home],
    });

    expect(resolveAdvantageousAppealOutOptions([
      apparent,
      fourth,
    ])).toEqual({
      kind: 'resolved',
      minimumRuns: 0,
      advantageousOptions: [fourth],
    });
  });

  it('compares a normal apparent third out with a later sustained appeal option', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );
    const normalThird = resolveThirdOutScoring({
      outsAtStart: 2,
      thirdOutCandidate: {
        runnerId: 'r2',
        outTick: 1_200_000,
        classification: 'time_play',
      },
      homeTouches: [home],
    });
    expect(normalThird.kind).toBe('resolved');
    if (normalThird.kind !== 'resolved') {
      throw new Error('fixture must resolve a normal third out');
    }

    const apparent = createExistingThirdOutInningEndingOption(
      'normal-third',
      normalThird,
    );
    const fourth = createTagUpAppealInningEndingOption({
      optionId: 'appeal-r3',
      source: 'sustained_appeal',
      precedence,
      appealOut: appealOut('r3', 3, 1_300_000),
      homeTouches: [home],
    });

    expect(resolveAdvantageousAppealOutOptions([
      apparent,
      fourth,
    ])).toEqual({
      kind: 'resolved',
      minimumRuns: 0,
      advantageousOptions: [fourth],
    });
  });

});
