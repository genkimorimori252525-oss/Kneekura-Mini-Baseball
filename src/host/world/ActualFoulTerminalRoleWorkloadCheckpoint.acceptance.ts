import { expect, it } from 'vitest';
import { cleanupTerminalWorkload } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { qualifyTerminalWorkloadCheckpoint } from './ActualFoulTerminalRoleWorkloadCheckpoint.test-support';
it('W09 qualifies an original-owner-produced pre-charge workload checkpoint without rewriting it', async () => {
  const { f, receipt } = await qualifyTerminalWorkloadCheckpoint();
  try { expect(receipt.noWrites).toBe(true); expect(receipt.originalUnchanged).toBe(true); }
  finally { cleanupTerminalWorkload(f); }
}, 2_400_000);
