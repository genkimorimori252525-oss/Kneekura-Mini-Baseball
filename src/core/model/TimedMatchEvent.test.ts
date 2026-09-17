import { describe, expect, it } from 'vitest';
import {
  comparePhysicalEventTimes,
  type TimedMatchEvent,
} from './TimedMatchEvent';

const event = (tick: number, sequence: number, kind: string): TimedMatchEvent => ({
  tick,
  sequence,
  kind,
  payload: null,
});

describe('comparePhysicalEventTimes', () => {
  it('preserves the true ordering of distinct authoritative event ticks', () => {
    const secureCatch = event(4_281_732, 8, 'secure-catch');
    const baseTouch = event(4_284_091, 9, 'base-touch');

    expect(comparePhysicalEventTimes(secureCatch, baseTouch)).toBe('before');
    expect(comparePhysicalEventTimes(baseTouch, secureCatch)).toBe('after');
  });

  it('treats equal authoritative ticks as physically simultaneous regardless of sequence', () => {
    const secureCatch = event(4_284_091, 4, 'secure-catch');
    const baseTouch = event(4_284_091, 17, 'base-touch');

    expect(comparePhysicalEventTimes(secureCatch, baseTouch)).toBe('simultaneous');
    expect(comparePhysicalEventTimes(baseTouch, secureCatch)).toBe('simultaneous');
  });
});
