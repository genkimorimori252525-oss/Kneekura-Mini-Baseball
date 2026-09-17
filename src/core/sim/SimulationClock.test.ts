import { describe, expect, it } from 'vitest';
import { SimulationClock } from './SimulationClock';

describe('SimulationClock', () => {
  it('advances only in integer simulation ticks', () => {
    const clock = new SimulationClock(120);
    clock.advanceTicks(3);
    expect(clock.tick).toBe(3);
    expect(clock.timeSeconds).toBe(3 / 120);
  });

  it('rejects invalid tick rates and negative advances', () => {
    expect(() => new SimulationClock(0)).toThrow();
    const clock = new SimulationClock(120);
    expect(() => clock.advanceTicks(-1)).toThrow();
  });

  it('does not accumulate floating-point time as authoritative state', () => {
    const clock = new SimulationClock(120);
    clock.advanceTicks(120 * 60 * 9);
    expect(clock.tick).toBe(64800);
    expect(clock.timeSeconds).toBe(540);
  });
});
