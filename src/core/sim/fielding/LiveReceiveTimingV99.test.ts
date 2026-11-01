import { expect, it } from 'vitest';
import { decideLiveReceiveTimingV99, validateFieldRelationshipsV99 } from './LiveReceiveTimingV99';
const input = { seed: 77, opportunityId: 'held-1:SS:2B:2', flightSeconds: 1.2, receiverReadySeconds: 1.15,
  receiverDistanceMeters: 4, immediateReachMeters: 1.28, trust: 50, coordination: 50, aggression: 1 };
it('permits a receiver several metres away when the ball arrives after they can receive', () => {
  expect(decideLiveReceiveTimingV99({ ...input, receiverReadySeconds: .7 }).allow).toBe(true);
  expect(decideLiveReceiveTimingV99({ ...input, receiverReadySeconds: 1.3, trust: 100, coordination: 100 }).allow).toBe(false);
});
it('uses trust to change willingness while keeping the same stable opportunity draw', () => {
  let high = 0, low = 0;
  for (let seed = 0; seed < 200; seed++) {
    const a = decideLiveReceiveTimingV99({ ...input, seed, trust: 0 });
    const b = decideLiveReceiveTimingV99({ ...input, seed, trust: 100 });
    expect(a.draw).toBe(b.draw); expect(b.probability).toBeGreaterThan(a.probability);
    expect(decideLiveReceiveTimingV99({ ...input, seed, trust: 100 })).toEqual(b);
    low += Number(a.allow); high += Number(b.allow);
  }
  expect(high).toBeGreaterThan(low + 40);
  expect(decideLiveReceiveTimingV99({ ...input, trust: 0, receiverDistanceMeters: .1, receiverReadySeconds: 0 }).allow).toBe(true);
});
it('approaches full confidence continuously without counting trust twice', () => {
  for (const trust of [0, 50, 100]) {
    const boundary = decideLiveReceiveTimingV99({ ...input, trust }),
      reserve = boundary.reserveSeconds + boundary.uncertaintySeconds,
      before = decideLiveReceiveTimingV99({ ...input, trust, flightSeconds: input.receiverReadySeconds + reserve * (1 - 1e-7) }),
      at = decideLiveReceiveTimingV99({ ...input, trust, flightSeconds: input.receiverReadySeconds + reserve });
    expect(before.probability).toBeGreaterThan(.999999);
    expect(at.probability - before.probability).toBeLessThan(1e-6);
    expect(before.draw).toBe(boundary.draw);
    expect(decideLiveReceiveTimingV99({ ...input, trust, flightSeconds: input.receiverReadySeconds - .001 }).probability).toBe(0);
  }
});
it('retains stronger rejection for low trust at the same positive arrival margin', () => {
  // At the measured 50ms margin, the previous amplitude penalty yielded
  // .06849 at trust zero and .57143 at trust 100. Trust continues to change
  // the reserve; the fully trusted case has the same willingness as before.
  const low = decideLiveReceiveTimingV99({ ...input, trust: 0 }),
    high = decideLiveReceiveTimingV99({ ...input, trust: 100 });
  expect(low.probability).toBeCloseTo(.273972602739726, 12);
  expect(high.probability).toBeCloseTo(.5714285714285714, 12);
  expect(1 - low.probability).toBeGreaterThan(1 - high.probability);
  expect(low.draw).toBe(high.draw);
});
it('validates directional relationships without accepting silent duplicates or non-finite ratings', () => {
  expect(() => validateFieldRelationshipsV99([{ toPlayerId: 'A', trust: 20, coordination: 80 }])).not.toThrow();
  for (const bad of [[{ toPlayerId: 'A', trust: NaN, coordination: 80 }], [{ toPlayerId: 'A', trust: 101, coordination: 80 }],
    [{ toPlayerId: 'A', trust: 20, coordination: 80 }, { toPlayerId: 'A', trust: 10, coordination: 20 }]])
    expect(() => validateFieldRelationshipsV99(bad)).toThrow();
});
