import { describe, expect, it } from 'vitest';
import { createRunnerBaseTouchFact } from './PhysicalRuleFacts';
import { createRunnerPrecedence } from './RunnerPrecedence';
import {
  evaluateSustainedTagUpAppealScoring,
} from './AppealOutScoring';
import type { TagUpAppealResult } from './TagUpAppealRule';
import {
  createAppealScoringOption,
  selectAdvantageousInningEndingOut,
} from './AdvantageousFourthOut';

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
  appealedBase: 1 | 3,
  outTick: number,
): Extract<TagUpAppealResult, { kind: 'out' }> => ({
  kind: 'out',
  runnerId,
  classification: 'tag_up_appeal',
  appealedBase,
  outTick,
  appealTick: outTick,
});

describe('AdvantageousFourthOut', () => {
  it('prefers the later sustained appeal that removes an otherwise scoring run', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );

    const apparentThird = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [home],
    });
    const apparentFourth = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r3', 3, 1_300_000),
      homeTouches: [home],
    });

    const result = selectAdvantageousInningEndingOut([
      createAppealScoringOption(
        'appeal-r1-apparent-third',
        'apparent_third_out',
        apparentThird,
      ),
      createAppealScoringOption(
        'appeal-r3-apparent-fourth',
        'sustained_appeal',
        apparentFourth,
      ),
    ]);

    expect(result).toEqual({
      kind: 'resolved',
      minimumRuns: 0,
      advantageousOptions: [
        createAppealScoringOption(
          'appeal-r3-apparent-fourth',
          'sustained_appeal',
          apparentFourth,
        ),
      ],
    });
  });

  it('preserves all equally advantageous out options instead of inventing array-order precedence', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );
    const suppressingAppeal = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r3', 3, 1_300_000),
      homeTouches: [home],
    });

    const first = createAppealScoringOption(
      'first',
      'apparent_third_out',
      suppressingAppeal,
    );
    const second = createAppealScoringOption(
      'second',
      'sustained_appeal',
      suppressingAppeal,
    );

    expect(selectAdvantageousInningEndingOut([
      first,
      second,
    ])).toEqual({
      kind: 'resolved',
      minimumRuns: 0,
      advantageousOptions: [first, second],
    });
  });

  it('does not rank a same-tick unresolved scoring option against resolved options', () => {
    const sameTickHome = createRunnerBaseTouchFact(
      'r3',
      4,
      1_200_000,
    );
    const unresolved = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [sameTickHome],
    });
    const resolved = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r3', 3, 1_300_000),
      homeTouches: [sameTickHome],
    });

    const unresolvedOption = createAppealScoringOption(
      'unresolved',
      'apparent_third_out',
      unresolved,
    );

    expect(selectAdvantageousInningEndingOut([
      unresolvedOption,
      createAppealScoringOption(
        'resolved',
        'sustained_appeal',
        resolved,
      ),
    ])).toEqual({
      kind: 'unresolved',
      unresolvedOptions: [unresolvedOption],
    });
  });

  it('requires at least an apparent third-out option and one alternative', () => {
    const scoring = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [],
    });

    expect(() => selectAdvantageousInningEndingOut([
      createAppealScoringOption(
        'only',
        'apparent_third_out',
        scoring,
      ),
    ])).toThrow(
      'advantageous fourth-out evaluation requires at least two options',
    );
  });

  it('rejects duplicate scoring option ids', () => {
    const scoring = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [],
    });
    const duplicated = createAppealScoringOption(
      'same',
      'apparent_third_out',
      scoring,
    );

    expect(() => selectAdvantageousInningEndingOut([
      duplicated,
      {
        ...duplicated,
        source: 'sustained_appeal',
      },
    ])).toThrow('inning-ending scoring option ids must be unique');
  });
});
