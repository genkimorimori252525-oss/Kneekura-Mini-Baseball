import { describe, expect, it } from 'vitest';
import { findFirstTrueTick, quantizeEventTick } from './ExactEventTime';

describe('findFirstTrueTick', () => {
  it('finds the first authoritative integer tick inside a coarse simulation step', () => {
    const eventTick = 5_237;

    const result = findFirstTrueTick(4_000, 6_000, (tick) => tick >= eventTick);

    expect(result).toBe(eventTick);
  });

  it('preserves an event that occurs exactly at the interval start', () => {
    const result = findFirstTrueTick(5_237, 6_000, (tick) => tick >= 5_237);

    expect(result).toBe(5_237);
  });

  it('returns null when the event never occurs inside the interval', () => {
    const result = findFirstTrueTick(4_000, 6_000, () => false);

    expect(result).toBeNull();
  });

  it('rejects non-integer or reversed authoritative intervals', () => {
    expect(() => findFirstTrueTick(4_000.5, 6_000, () => true)).toThrow();
    expect(() => findFirstTrueTick(6_000, 4_000, () => true)).toThrow();
  });
});

describe('quantizeEventTick', () => {
  it('rounds a continuous event up to the first authoritative integer tick', () => {
    const elapsedSeconds = (0.2 - 0.07) / 60;

    expect(quantizeEventTick(2_000_000, elapsedSeconds, 1_000_000)).toBe(2_002_167);
  });

  it('preserves an event that already lands exactly on an integer tick', () => {
    expect(quantizeEventTick(2_000_000, 0.002, 1_000_000)).toBe(2_002_000);
  });

  it('rejects invalid elapsed time or clock rates', () => {
    expect(() => quantizeEventTick(0, -0.001, 1_000_000)).toThrow();
    expect(() => quantizeEventTick(0, Number.NaN, 1_000_000)).toThrow();
    expect(() => quantizeEventTick(0, 0.001, 0)).toThrow();
  });
});
