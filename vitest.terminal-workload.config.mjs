import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (cacheDir && !isAbsolute(cacheDir)) throw new Error('terminal workload cache must be absolute');
export default { ...(cacheDir ? { cacheDir } : {}), test: { cache: false, include: [
  'src/host/world/ActualFoulTerminalRoleWorkload.acceptance.ts',
  'src/host/world/ActualFoulTerminalRoleWorkloadRollback.acceptance.ts',
  'src/host/world/ActualFoulTerminalRoleWorkloadIntegrity.acceptance.ts',
  'src/host/world/ActualFoulTerminalRoleWorkloadGuards.acceptance.ts',
  'src/host/world/ActualFoulTerminalRoleWorkloadCheckpoint.acceptance.ts',
  'src/host/world/ActualFoulTerminalRoleWorkloadReady.acceptance.ts',
  'src/host/world/ActualFoulTerminalRoleWorkloadMetadata.test.ts',
] } };
