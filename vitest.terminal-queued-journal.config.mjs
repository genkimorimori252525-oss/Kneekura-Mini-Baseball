import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('retained queued journal requires an absolute supervised cache');
export default { cacheDir, test: { cache: false, include: [
  'src/host/world/ActualFoulTerminalQueuedJournalRetained.acceptance.ts',
  'src/host/world/ActualFoulTerminalQueuedJournalRetryRetained.acceptance.ts',
  'src/host/world/ActualFoulTerminalQueuedJournalConflictRetained.acceptance.ts',
] } };
