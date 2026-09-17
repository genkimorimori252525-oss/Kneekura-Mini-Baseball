import { describe, expect, it } from 'vitest';
import { findThrowReleaseTick } from './ThrowRelease';

describe('findThrowReleaseTick', () => {
  it('finds the authoritative tick where the ball-hand constraint first ends', () => {
    const releaseTick = findThrowReleaseTick(
      5_000_000,
      5_005_000,
      (tick) => tick < 5_002_341,
    );

    expect(releaseTick).toBe(5_002_341);
  });

  it('preserves release at the interval start without rounding it forward', () => {
    expect(
      findThrowReleaseTick(5_002_341, 5_005_000, () => false),
    ).toBe(5_002_341);
  });

  it('returns null while the throwing model still reports ball-hand constraint', () => {
    expect(
      findThrowReleaseTick(5_000_000, 5_005_000, () => true),
    ).toBeNull();
  });
});
