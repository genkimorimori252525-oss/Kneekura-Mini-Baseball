import { describe, expect, it } from 'vitest';
import {
  createObservationSample,
  isObservationRefreshDue,
  type AttentionState,
  type ObservationRefreshPolicy,
  type PerceptionTarget,
} from './Observation';

const policy: ObservationRefreshPolicy = {
  attendedIntervalTicks: 20_000,
  peripheralIntervalTicks: 100_000,
};

const ball: PerceptionTarget = { kind: 'ball' };
const shortstop: PerceptionTarget = { kind: 'player', playerId: 'ss-6' };

const attention: AttentionState = {
  target: ball,
  focusedSinceTick: 900_000,
};

describe('Observation', () => {
  it('records estimate, authoritative observation tick, and confidence', () => {
    expect(createObservationSample(
      { x: 4, z: -2 },
      1_234_567,
      0.82,
    )).toEqual({
      estimate: { x: 4, z: -2 },
      observedAt: 1_234_567,
      confidence: 0.82,
    });
  });

  it('rejects confidence outside [0, 1] and invalid observation ticks', () => {
    expect(() => createObservationSample('ball', 10, -0.01)).toThrow();
    expect(() => createObservationSample('ball', 10, 1.01)).toThrow();
    expect(() => createObservationSample('ball', 1.5, 0.5)).toThrow();
  });

  it('refreshes the attended target at the faster interval', () => {
    expect(isObservationRefreshDue({
      target: ball,
      attention,
      lastObservedAt: 1_000_000,
      currentTick: 1_019_999,
      policy,
    })).toBe(false);

    expect(isObservationRefreshDue({
      target: ball,
      attention,
      lastObservedAt: 1_000_000,
      currentTick: 1_020_000,
      policy,
    })).toBe(true);
  });

  it('refreshes a non-attended target only at the peripheral interval', () => {
    expect(isObservationRefreshDue({
      target: shortstop,
      attention,
      lastObservedAt: 1_000_000,
      currentTick: 1_020_000,
      policy,
    })).toBe(false);

    expect(isObservationRefreshDue({
      target: shortstop,
      attention,
      lastObservedAt: 1_000_000,
      currentTick: 1_100_000,
      policy,
    })).toBe(true);
  });

  it('allows a never-observed target to be sampled immediately', () => {
    expect(isObservationRefreshDue({
      target: shortstop,
      attention,
      lastObservedAt: null,
      currentTick: 1_000_000,
      policy,
    })).toBe(true);
  });
});
