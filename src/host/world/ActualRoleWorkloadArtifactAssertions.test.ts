import { expect, it } from 'vitest';
import { assertActualRoleStaleSettlementRejected } from './ActualRoleWorkloadArtifactAssertions.test-support';
it('recognizes the exact all-participant current-head guard on the stale workload copy', () => {
  expect(() => assertActualRoleStaleSettlementRejected(() => {
    throw new Error('actual role workload participant current head differs from frozen effects');
  })).not.toThrow();
});
it('does not accept an unrelated earlier revision failure as the intended stale-state rejection', () => {
  expect(() => assertActualRoleStaleSettlementRejected(() => { throw new Error('revision Source unavailable'); })).toThrow();
});
it('requires an actual rejection', () => {
  expect(() => assertActualRoleStaleSettlementRejected(() => undefined)).toThrow();
});
