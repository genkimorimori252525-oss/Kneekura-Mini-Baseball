import { describe, expect, it } from 'vitest';
import { createRunnerBaseTouchFact } from './PhysicalRuleFacts';
import { createRunnerPrecedence } from './RunnerPrecedence';
import {
  evaluateSustainedTagUpAppealScoring,
} from './AppealOutScoring';
import type { TagUpAppealResult } from './TagUpAppealRule';

const appealOut = (
  runnerId: string,
  appealedBase: 1 | 2 | 3,
  outTick: number,
): Extract<TagUpAppealResult, { kind: 'out' }> => ({
  kind: 'out',
  runnerId,
  classification: 'tag_up_appeal',
  appealedBase,
  outTick,
  appealTick: outTick,
});

const precedence = createRunnerPrecedence(
  {
    first: 'r1',
    second: 'r2',
    third: 'r3',
  },
  'batter',
);

describe('AppealOutScoring', () => {
  it('uses time-play ordering when the appealed runner follows the scoring runner', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );

    expect(evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [home],
    })).toEqual({
      kind: 'resolved',
      effectiveOut: appealOut('r1', 1, 1_200_000),
      scored: [home],
      suppressed: [],
      simultaneous: [],
    });
  });

  it('suppresses the appealed runner own run regardless of appeal timestamp', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_100_000,
    );

    expect(evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r3', 3, 1_300_000),
      homeTouches: [home],
    })).toEqual({
      kind: 'resolved',
      effectiveOut: appealOut('r3', 3, 1_300_000),
      scored: [],
      suppressed: [home],
      simultaneous: [],
    });
  });

  it('suppresses a following runner run when the appealed runner is preceding', () => {
    const followingHome = createRunnerBaseTouchFact(
      'r2',
      4,
      1_100_000,
    );

    expect(evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r3', 3, 1_300_000),
      homeTouches: [followingHome],
    })).toEqual({
      kind: 'resolved',
      effectiveOut: appealOut('r3', 3, 1_300_000),
      scored: [],
      suppressed: [followingHome],
      simultaneous: [],
    });
  });

  it('suppresses a preceding scorer when its home touch occurs after a following-runner appeal out', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_300_000,
    );

    const result = evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [home],
    });

    expect(result).toMatchObject({
      kind: 'resolved',
      scored: [],
      suppressed: [home],
      simultaneous: [],
    });
  });

  it('preserves same-tick time-play scoring as simultaneous unresolved', () => {
    const home = createRunnerBaseTouchFact(
      'r3',
      4,
      1_200_000,
    );

    expect(evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [home],
    })).toEqual({
      kind: 'simultaneous_unresolved',
      effectiveOut: appealOut('r1', 1, 1_200_000),
      scored: [],
      suppressed: [],
      simultaneous: [home],
    });
  });

  it('rejects non-home touches and runners absent from precedence metadata', () => {
    expect(() => evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [
        createRunnerBaseTouchFact('r3', 3, 1_100_000),
      ],
    })).toThrow('appeal scoring requires base-4 home touch facts');

    expect(() => evaluateSustainedTagUpAppealScoring({
      precedence,
      appealOut: appealOut('r1', 1, 1_200_000),
      homeTouches: [
        createRunnerBaseTouchFact('missing', 4, 1_100_000),
      ],
    })).toThrow('unknown runner in precedence comparison');
  });
});
