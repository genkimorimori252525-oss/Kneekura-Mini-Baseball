import { expect, it } from 'vitest';
import * as locomotion from './SqliteActualLocomotionStore';
import type { RunnerContactWaitPolicyViewModule } from './RunnerNativeContactWaitContracts.test-support';

it('exposes prospective policy/view ownership for recipient contact wait', () => {
  const factory = (locomotion as unknown as Partial<RunnerContactWaitPolicyViewModule>)
    .openSqliteRunnerContactWaitStore;
  expect(typeof factory).toBe('function');
});
