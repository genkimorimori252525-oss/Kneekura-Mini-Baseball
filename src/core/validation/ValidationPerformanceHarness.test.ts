import { describe, expect, it } from 'vitest';
import {
  measureValidationBatchPerformance,
} from './ValidationPerformanceHarness';

describe('ValidationPerformanceHarness', () => {
  it('measures batch duration without exposing wall-clock values to scenario execution', () => {
    const seenIndexes: number[] = [];
    const clockValues = [100, 160];

    const result = measureValidationBatchPerformance({
      iterations: 3,
      execute: (index) => {
        seenIndexes.push(index);
        return {
          index,
          tick: index * 1_000_000,
        };
      },
      readClockMilliseconds: () => {
        const value = clockValues.shift();
        if (value === undefined) {
          throw new Error('fixture clock exhausted');
        }
        return value;
      },
    });

    expect(seenIndexes).toEqual([0, 1, 2]);
    expect(result.durationMilliseconds).toBe(60);
    expect(result.iterations).toBe(3);
    expect(result.averageMillisecondsPerIteration)
      .toBe(20);
    expect(result.evidenceFingerprint)
      .toMatch(/^[0-9a-f]{16}$/);
  });

  it('keeps canonical evidence fingerprint identical when only measured wall-clock duration changes', () => {
    const run = (
      start: number,
      end: number,
    ) => {
      const times = [start, end];

      return measureValidationBatchPerformance({
        iterations: 4,
        execute: (index) => ({
          index,
          result: index % 2 === 0
            ? 'out'
            : 'single',
        }),
        readClockMilliseconds: () => {
          const value = times.shift();
          if (value === undefined) {
            throw new Error('fixture clock exhausted');
          }
          return value;
        },
      });
    };

    const fast = run(0, 10);
    const slow = run(100, 900);

    expect(fast.durationMilliseconds).toBe(10);
    expect(slow.durationMilliseconds).toBe(800);
    expect(fast.evidenceFingerprint)
      .toBe(slow.evidenceFingerprint);
    expect(fast.evidence).toEqual(slow.evidence);
  });

  it('rejects a clock that moves backwards without changing simulation evidence semantics', () => {
    const times = [20, 10];

    expect(() => measureValidationBatchPerformance({
      iterations: 1,
      execute: () => ({ result: 'out' }),
      readClockMilliseconds: () => {
        const value = times.shift();
        if (value === undefined) {
          throw new Error('fixture clock exhausted');
        }
        return value;
      },
    })).toThrow(
      'performance clock must not move backwards',
    );
  });

  it('requires a positive iteration count', () => {
    expect(() => measureValidationBatchPerformance({
      iterations: 0,
      execute: () => ({}),
      readClockMilliseconds: () => 0,
    })).toThrow(
      'iterations must be a positive safe integer',
    );
  });
});
