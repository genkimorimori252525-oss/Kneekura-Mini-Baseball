import { describe, expect, it } from 'vitest';
import { assertNationalOriginalScoringSubmitEntered } from './NationalBattedFoulOriginalStatisticsBoundary.test-support';

// Execution-metadata guards only. These synthetic journals are not domain proof
// and cannot satisfy the separately pinned original source/observer boundary.
describe('original National missing-scoring assertion boundary', () => {
  const row = (owner: string, method: string, argument: string, name = 'owner-call') => JSON.stringify({
    entry: { name, owner, method, argument },
  });
  it('recognizes the subsequent original scorer entry even when no return was captured', () => {
    expect(() => assertNationalOriginalScoringSubmitEntered(row('ActualLiveScoring', 'submit', 'national-live:ground-out'))).not.toThrow();
  });
  it('does not infer the assertion from another owner, source, retry, or returned snapshot', () => {
    for (const line of [row('ActualLiveClosure', 'submit', 'national-live:ground-out'),
      row('ActualLiveScoring', 'submit', 'other'), row('ActualLiveScoring', 'resume', 'national-live:ground-out'),
      row('ActualLiveScoring', 'submit', 'national-live:ground-out', 'owner-returned'), '']) {
      expect(() => assertNationalOriginalScoringSubmitEntered(line)).toThrow('no subsequent scoring-entry witness');
    }
  });
});
