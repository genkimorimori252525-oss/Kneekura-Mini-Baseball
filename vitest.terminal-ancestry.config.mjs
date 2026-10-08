import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (cacheDir && !isAbsolute(cacheDir)) throw new Error('terminal ancestry cache must be absolute');
export default { ...(cacheDir ? { cacheDir } : {}), test: { cache: false, include: [
  'src/host/world/ActualFoulTerminalAcknowledgementAncestry.test.ts',
  'src/host/world/ActualFoulTerminalAcknowledgementAncestry.acceptance.ts',
  'src/host/world/ActualFoulTerminalScoring.acceptance.ts',
] } };
