import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (cacheDir && !isAbsolute(cacheDir)) throw new Error('terminal pending cache must be absolute');
export default { ...(cacheDir ? { cacheDir } : {}), test: { cache: false, include: [
  'src/host/world/ActualFoulTerminalPendingApplication.acceptance.ts',
  'src/host/world/ActualFoulTerminalPendingRollback.acceptance.ts',
] } };
