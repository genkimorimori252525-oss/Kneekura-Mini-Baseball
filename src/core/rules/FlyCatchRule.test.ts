import { describe, expect, it } from 'vitest';
import {
  createFlyBallFirstFielderTouchFact,
} from './PhysicalRuleFacts';
import { resolveFlyCatch } from './FlyCatchRule';

describe('FlyCatchRule', () => {
  it('rules the batter out only after secure possession before any ground contact', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'left-fielder',
      1_000_000,
    );

    expect(resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch,
      secureCatchTick: 1_150_000,
      firstGroundContactTick: null,
    })).toEqual({
      kind: 'caught',
      batterRunnerId: 'batter',
      firstFielderTouchTick: 1_000_000,
      outTick: 1_150_000,
      secureCatchTick: 1_150_000,
    });
  });

  it('does not create a fly out when the ball grounds before secure possession', () => {
    expect(resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch: createFlyBallFirstFielderTouchFact(
        'left-fielder',
        1_000_000,
      ),
      secureCatchTick: 1_150_000,
      firstGroundContactTick: 1_100_000,
    })).toEqual({
      kind: 'not_caught',
      batterRunnerId: 'batter',
      firstFielderTouchTick: 1_000_000,
      firstGroundContactTick: 1_100_000,
      secureCatchTick: 1_150_000,
    });
  });

  it('treats ground contact on the same authoritative tick as secure possession as not caught', () => {
    expect(resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch: createFlyBallFirstFielderTouchFact(
        'center-fielder',
        1_000_000,
      ),
      secureCatchTick: 1_150_000,
      firstGroundContactTick: 1_150_000,
    }).kind).toBe('not_caught');
  });

  it('remains unresolved while secure possession has not been established', () => {
    expect(resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch: createFlyBallFirstFielderTouchFact(
        'right-fielder',
        1_000_000,
      ),
      secureCatchTick: null,
      firstGroundContactTick: null,
    })).toEqual({
      kind: 'unresolved',
      batterRunnerId: 'batter',
      firstFielderTouchTick: 1_000_000,
    });
  });

  it('rejects impossible chronology where secure possession predates first fielder touch', () => {
    expect(() => resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch: createFlyBallFirstFielderTouchFact(
        'right-fielder',
        1_100_000,
      ),
      secureCatchTick: 1_000_000,
      firstGroundContactTick: null,
    })).toThrow(
      'secureCatchTick must be at or after first fielder touch',
    );
  });
});
