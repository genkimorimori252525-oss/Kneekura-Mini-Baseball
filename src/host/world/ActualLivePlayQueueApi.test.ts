import { expect, it } from 'vitest';
import * as queue from './ActualLivePlayQueueEvidenceFromSqlite';
it('exposes the same-connection source-derived queue reader', () => {
  expect(queue).toHaveProperty('actualLivePlayQueueEvidenceFromSqlite');
});
import * as store from './SqliteActualLivePlayQueueStore';
it('exposes the immutable source-owned checkpoint store', () => {
  expect(store).toHaveProperty('openSqliteActualLivePlayQueueStore');
});
import * as rule from './SqliteActualLiveRuleConsumptionStore';
it('exposes source-owned physical-rule acknowledgement', () => {
  expect(rule).toHaveProperty('openSqliteActualLiveRuleConsumptionStore');
});
