import { describe, expect, it } from 'vitest';
import { liveExpectedRunsV1, liveOutcomeRunsV1, liveRaceWinProbabilityV1, liveRunExpectancyV1, validateLiveRunExpectancyTableV1,
  type LiveRunExpectancyTableV1 } from './LiveRunValueV1';

// A made-up table for arithmetic only: more runners and fewer outs are worth more.
const table: LiveRunExpectancyTableV1 = { sourceId: 'test', values: [
  [.5, .9, 1.1, 1.5, 1.4, 1.8, 2, 2.3], [.27, .53, .7, .93, .98, 1.2, 1.4, 1.6], [.1, .23, .33, .45, .37, .5, .6, .78]] };
const s = (b1: boolean, b2: boolean, b3: boolean, outs: number) => ({ bases: [b1, b2, b3] as const, outs });

describe('live run value V1', () => {
  it('validates the table shape', () => {
    expect(validateLiveRunExpectancyTableV1(table)).toBe(table);
    expect(() => validateLiveRunExpectancyTableV1({ sourceId: 'x', values: [[1]] })).toThrow();
    expect(() => validateLiveRunExpectancyTableV1({ sourceId: '', values: table.values })).toThrow();
  });
  it('reads the state by bags and outs, and a third out is worth nothing', () => {
    expect(liveRunExpectancyV1(table, s(false, false, false, 0))).toBe(.5);
    expect(liveRunExpectancyV1(table, s(true, false, true, 1))).toBe(1.2);
    expect(liveRunExpectancyV1(table, s(true, true, true, 3))).toBe(0);
  });
  it('adds the runs scored on the play to what the state still promises', () => {
    expect(liveOutcomeRunsV1(table, { runs: 1, state: s(false, true, false, 1) })).toBeCloseTo(1.7, 12);
  });
  it('prefers the lead runner at second over the batter at first with a runner on first and nobody out', () => {
    const lead = liveOutcomeRunsV1(table, { runs: 0, state: s(true, false, false, 1) }),
      batter = liveOutcomeRunsV1(table, { runs: 0, state: s(false, true, false, 1) });
    expect(lead).toBeLessThan(batter);
  });
  it('weights a close play by its chance, so a sure out can beat a likelier-to-fail better one', () => {
    const sure = liveExpectedRunsV1(table, [{ probability: 1, outcome: { runs: 0, state: s(false, true, false, 1) } }]),
      p = liveRaceWinProbabilityV1(-.2, .15),
      risky = liveExpectedRunsV1(table, [{ probability: p, outcome: { runs: 0, state: s(true, false, false, 1) } },
        { probability: 1 - p, outcome: { runs: 0, state: s(true, true, false, 0) } }]);
    expect(risky).toBeGreaterThan(sure);
  });
  it('turns a margin into a chance that is even at zero and rises with the margin', () => {
    expect(liveRaceWinProbabilityV1(0, .15)).toBeCloseTo(.5, 6);
    expect(liveRaceWinProbabilityV1(.15, .15)).toBeCloseTo(.8413, 3);
    expect(liveRaceWinProbabilityV1(-.3, .15)).toBeCloseTo(.0228, 3);
    expect(liveRaceWinProbabilityV1(.1, .15)).toBeGreaterThan(liveRaceWinProbabilityV1(.05, .15));
  });
  it('rejects branches that do not add up', () => {
    expect(() => liveExpectedRunsV1(table, [{ probability: .4, outcome: { runs: 0, state: s(false, false, false, 1) } }])).toThrow();
  });
});
