import { describe, expect, it } from 'vitest';
import { findSecureCatchTick } from './SecureCatch';

describe('findSecureCatchTick', () => {
  it('keeps physical glove contact and secure possession as different authoritative times', () => {
    const secureTick = findSecureCatchTick(
      2_002_167,
      2_020_000,
      (tick: number) => tick >= 2_014_731,
    );

    expect(secureTick).toBe(2_014_731);
  });

  it('returns the contact tick when possession is already secure at contact', () => {
    const secureTick = findSecureCatchTick(
      2_002_167,
      2_020_000,
      () => true,
    );

    expect(secureTick).toBe(2_002_167);
  });

  it('returns null when contact never becomes secure in the search interval', () => {
    const secureTick = findSecureCatchTick(
      2_002_167,
      2_020_000,
      () => false,
    );

    expect(secureTick).toBeNull();
  });
});
