import { describe, expect, it } from 'vitest';
import {
  createFirstPostPitchInfielderTouchFact,
} from './AlignmentPenaltyFacts';
import type {
  DefensiveAlignmentViolation,
} from './DefensiveAlignmentViolation';
import {
  createNaturalPlayAdvancementResult,
} from './OffenseAdvancementResult';
import {
  resolveNPB2026AlignmentViolationPenalty,
} from './NPB2026AlignmentViolationPenalty';

const bases = {
  first: 'r1',
  second: null,
  third: 'r3',
} as const;

const concreteViolation = (
  ids: readonly string[] = ['ss'],
): DefensiveAlignmentViolation => ({
  kind: 'violation',
  identity: 'concrete_players',
  violatingPlayerIds: ids,
});

describe('NPB2026AlignmentViolationPenalty', () => {
  it('lets the natural play stand when the violating first toucher is involved and everyone naturally advances enough', () => {
    const natural = createNaturalPlayAdvancementResult(
      bases,
      'batter',
      true,
      [
        {
          runnerId: 'r1',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
        {
          runnerId: 'r3',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
      ],
    );

    expect(resolveNPB2026AlignmentViolationPenalty({
      violation: concreteViolation(),
      firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
        'ss',
        'SS',
        2_100_000,
      ),
      prePitchBases: bases,
      naturalPlay: natural,
    })).toEqual({
      kind: 'play_stands',
      violatingFirstToucherId: 'ss',
      naturalPlay: natural,
    });
  });

  it('requires an offensive choice when the violating first toucher is involved but the natural play falls short', () => {
    const natural = createNaturalPlayAdvancementResult(
      bases,
      'batter',
      false,
      [
        { runnerId: 'r1', outcome: 'retired' },
        {
          runnerId: 'r3',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
      ],
    );

    expect(resolveNPB2026AlignmentViolationPenalty({
      violation: concreteViolation(),
      firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
        'ss',
        'SS',
        2_100_000,
      ),
      prePitchBases: bases,
      naturalPlay: natural,
    })).toEqual({
      kind: 'offense_choice_required',
      violatingFirstToucherId: 'ss',
      naturalPlay: natural,
      penaltyAward: {
        batterRunner: {
          runnerId: 'batter',
          targetBase: 1,
        },
        runners: [
          {
            runnerId: 'r1',
            fromBase: 1,
            targetBase: 2,
          },
          {
            runnerId: 'r3',
            fromBase: 3,
            targetBase: 4,
          },
        ],
      },
    });
  });

  it('calls ball and dead ball when a nonviolating infielder is the first infielder toucher', () => {
    const natural = createNaturalPlayAdvancementResult(
      bases,
      'batter',
      false,
      [
        { runnerId: 'r1', outcome: 'retired' },
        {
          runnerId: 'r3',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
      ],
    );

    expect(resolveNPB2026AlignmentViolationPenalty({
      violation: concreteViolation(['ss']),
      firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
        '2b',
        '2B',
        2_100_000,
      ),
      prePitchBases: bases,
      naturalPlay: natural,
    })).toEqual({
      kind: 'ball_and_dead_ball',
      firstInfielderToucherId: '2b',
    });
  });

  it('uses the ball/dead-ball branch when no infielder touches the ball after the pitch', () => {
    const natural = createNaturalPlayAdvancementResult(
      { first: null, second: null, third: null },
      'batter',
      false,
      [],
    );

    expect(resolveNPB2026AlignmentViolationPenalty({
      violation: concreteViolation(['ss']),
      firstInfielderTouch: null,
      prePitchBases: {
        first: null,
        second: null,
        third: null,
      },
      naturalPlay: natural,
    })).toEqual({
      kind: 'ball_and_dead_ball',
      firstInfielderToucherId: null,
    });
  });

  it('returns no violation without applying any penalty branch', () => {
    const natural = createNaturalPlayAdvancementResult(
      { first: null, second: null, third: null },
      'batter',
      false,
      [],
    );

    expect(resolveNPB2026AlignmentViolationPenalty({
      violation: { kind: 'no_violation' },
      firstInfielderTouch: null,
      prePitchBases: {
        first: null,
        second: null,
        third: null,
      },
      naturalPlay: natural,
    })).toEqual({
      kind: 'no_violation',
    });
  });

  it('refuses identity-sensitive penalty resolution for a team-only raw violation', () => {
    const natural = createNaturalPlayAdvancementResult(
      { first: null, second: null, third: null },
      'batter',
      false,
      [],
    );

    expect(() => resolveNPB2026AlignmentViolationPenalty({
      violation: {
        kind: 'violation',
        identity: 'team_only',
        violatingPlayerIds: [],
      },
      firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
        'ss',
        'SS',
        2_100_000,
      ),
      prePitchBases: {
        first: null,
        second: null,
        third: null,
      },
      naturalPlay: natural,
    })).toThrow(
      'alignment penalty requires concrete violating-player identity',
    );
  });

  it('rejects mismatched batter identity between the play and natural advancement result', () => {
    const natural = createNaturalPlayAdvancementResult(
      { first: null, second: null, third: null },
      'other-batter',
      false,
      [],
    );

    expect(() => resolveNPB2026AlignmentViolationPenalty({
      violation: concreteViolation(),
      firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
        'ss',
        'SS',
        2_100_000,
      ),
      prePitchBases: {
        first: null,
        second: null,
        third: null,
      },
      naturalPlay: natural,
      batterRunnerId: 'batter',
    })).toThrow(
      'natural play batterRunnerId does not match the evaluated batter-runner',
    );
  });
});
