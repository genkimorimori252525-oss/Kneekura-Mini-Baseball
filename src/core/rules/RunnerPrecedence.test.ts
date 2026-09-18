import { describe, expect, it } from 'vitest';
import {
  compareRunnerPrecedence,
  createRunnerPrecedence,
  findRunnerOrigin,
} from './RunnerPrecedence';

describe('RunnerPrecedence', () => {
  it('orders play-start runners by how far they precede toward home', () => {
    const precedence = createRunnerPrecedence(
      {
        first: 'r1',
        second: 'r2',
        third: 'r3',
      },
      'batter',
    );

    expect(compareRunnerPrecedence(
      precedence,
      'r3',
      'r2',
    )).toBe('preceding');
    expect(compareRunnerPrecedence(
      precedence,
      'r3',
      'r1',
    )).toBe('preceding');
    expect(compareRunnerPrecedence(
      precedence,
      'r3',
      'batter',
    )).toBe('preceding');
    expect(compareRunnerPrecedence(
      precedence,
      'r1',
      'r3',
    )).toBe('following');
    expect(compareRunnerPrecedence(
      precedence,
      'r2',
      'r2',
    )).toBe('same');
  });

  it('records the batter as virtual origin zero and bases as origins one through three', () => {
    const precedence = createRunnerPrecedence(
      {
        first: 'r1',
        second: null,
        third: 'r3',
      },
      'batter',
    );

    expect(precedence.runners).toEqual([
      { runnerId: 'batter', originBase: 0 },
      { runnerId: 'r1', originBase: 1 },
      { runnerId: 'r3', originBase: 3 },
    ]);
    expect(findRunnerOrigin(precedence, 'r3')).toEqual({
      runnerId: 'r3',
      originBase: 3,
    });
  });

  it('rejects duplicate runner ids in play-start occupancy', () => {
    expect(() => createRunnerPrecedence(
      {
        first: 'same',
        second: 'same',
        third: null,
      },
      'batter',
    )).toThrow('runner precedence requires unique runner ids');

    expect(() => createRunnerPrecedence(
      {
        first: 'batter',
        second: null,
        third: null,
      },
      'batter',
    )).toThrow('runner precedence requires unique runner ids');
  });

  it('rejects comparison with an unknown runner', () => {
    const precedence = createRunnerPrecedence(
      {
        first: 'r1',
        second: null,
        third: null,
      },
      'batter',
    );

    expect(() => compareRunnerPrecedence(
      precedence,
      'r1',
      'missing',
    )).toThrow('unknown runner in precedence comparison');
  });
});
