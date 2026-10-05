import assert from 'node:assert/strict';
/** Require this exact current-head guard; an unrelated early rejection is not proof. */
export const assertActualRoleStaleSettlementRejected = (attempt: () => unknown): void => {
  assert.throws(attempt, { message: 'actual role workload participant current head differs from frozen effects' });
};
