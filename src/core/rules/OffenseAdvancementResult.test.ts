import { describe, expect, it } from 'vitest';
import {
  createNaturalPlayAdvancementResult,
  satisfiesAlignmentPenaltyAdvanceException,
} from './OffenseAdvancementResult';

const bases = {
  first: 'r1',
  second: null,
  third: 'r3',
} as const;

describe('OffenseAdvancementResult', () => {
  it('satisfies the exception when batter reaches first and every pre-pitch runner advances safely at least one base', () => {
    const result = createNaturalPlayAdvancementResult(
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

    expect(satisfiesAlignmentPenaltyAdvanceException(
      bases,
      result,
    )).toBe(true);
  });

  it('counts a runner from third scoring as one safely advanced base', () => {
    const result = createNaturalPlayAdvancementResult(
      { first: null, second: null, third: 'r3' },
      'batter',
      true,
      [{
        runnerId: 'r3',
        outcome: 'safe_advance',
        safelyAdvancedBases: 1,
      }],
    );

    expect(satisfiesAlignmentPenaltyAdvanceException(
      { first: null, second: null, third: 'r3' },
      result,
    )).toBe(true);
  });

  it('fails the exception if the batter is retired before first', () => {
    const result = createNaturalPlayAdvancementResult(
      bases,
      'batter',
      false,
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

    expect(satisfiesAlignmentPenaltyAdvanceException(
      bases,
      result,
    )).toBe(false);
  });

  it('fails the exception if any pre-pitch runner is retired or advances zero bases', () => {
    const retired = createNaturalPlayAdvancementResult(
      bases,
      'batter',
      true,
      [
        { runnerId: 'r1', outcome: 'retired' },
        {
          runnerId: 'r3',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
      ],
    );

    expect(satisfiesAlignmentPenaltyAdvanceException(
      bases,
      retired,
    )).toBe(false);

    const held = createNaturalPlayAdvancementResult(
      bases,
      'batter',
      true,
      [
        {
          runnerId: 'r1',
          outcome: 'safe_advance',
          safelyAdvancedBases: 0,
        },
        {
          runnerId: 'r3',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
      ],
    );

    expect(satisfiesAlignmentPenaltyAdvanceException(
      bases,
      held,
    )).toBe(false);
  });

  it('requires exactly one natural result for every pre-pitch runner', () => {
    expect(() => createNaturalPlayAdvancementResult(
      bases,
      'batter',
      true,
      [{
        runnerId: 'r1',
        outcome: 'safe_advance',
        safelyAdvancedBases: 1,
      }],
    )).toThrow(
      'natural advancement must include exactly every pre-pitch runner',
    );

    expect(() => createNaturalPlayAdvancementResult(
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
        {
          runnerId: 'extra',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
      ],
    )).toThrow(
      'natural advancement must include exactly every pre-pitch runner',
    );
  });

  it('rejects invalid advancement counts and duplicate runner ids', () => {
    expect(() => createNaturalPlayAdvancementResult(
      { first: 'r1', second: null, third: null },
      'batter',
      true,
      [{
        runnerId: 'r1',
        outcome: 'safe_advance',
        safelyAdvancedBases: -1,
      }],
    )).toThrow(
      'safelyAdvancedBases must be a non-negative integer',
    );

    expect(() => createNaturalPlayAdvancementResult(
      { first: 'r1', second: 'r2', third: null },
      'batter',
      true,
      [
        {
          runnerId: 'r1',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
        {
          runnerId: 'r1',
          outcome: 'safe_advance',
          safelyAdvancedBases: 1,
        },
      ],
    )).toThrow(
      'natural advancement runner ids must be unique',
    );
  });
});
