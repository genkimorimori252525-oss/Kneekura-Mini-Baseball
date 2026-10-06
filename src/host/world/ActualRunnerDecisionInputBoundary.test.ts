import { expect, it } from 'vitest';
import * as locomotion from './SqliteActualLocomotionStore';
import type { RunnerDecisionInputModule } from './ActualRunnerDecisionInputContracts.test-support';

// This namespace already exists on the audited source. No new production import,
// database, fixture setup, fake implementation, skip, or expected-error success.
it('exposes the missing Native runner decision-input consumer', () => {
  const adapter = (locomotion as unknown as Partial<RunnerDecisionInputModule>).actualRunnerDecisionInputEvidenceFromSqlite;
  expect(adapter, 'missing Native runner decision-input consumer; retained history and explicit model are not an action').toBeTypeOf('function');
});
