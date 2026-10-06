import { expect, it } from 'vitest';
import * as decisions from './RunnerDecision';
import type { RunnerPartialTagUpWaitModule } from './RunnerPartialTagUpWaitContracts.test-support';

// An existing namespace, with no new production import or fixture. Staged/unrun.
it('exposes a versioned unavailable-force tag-up wait path on the existing Core decision engine', () => {
  const choose = (decisions as unknown as Partial<RunnerPartialTagUpWaitModule>).decideRunnerMotionIntentFromPartialContext;
  expect(choose, 'missing versioned partial tag-up wait entry; unavailable force is never a boolean or a completed threat scan').toBeTypeOf('function');
});
