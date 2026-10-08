import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (cacheDir && !isAbsolute(cacheDir)) throw new Error('terminal scoring cache must be absolute');
export default { ...(cacheDir ? { cacheDir } : {}), test: { cache: false, include: [
  'src/host/world/ActualFoulTerminalScoring.acceptance.ts',
  'src/host/world/ActualFoulTerminalScoringRollback.acceptance.ts',
  'src/host/world/ActualFoulTerminalScoringIntegrity.acceptance.ts',
] } };
