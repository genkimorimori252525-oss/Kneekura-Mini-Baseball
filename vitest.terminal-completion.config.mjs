import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (cacheDir && !isAbsolute(cacheDir)) throw new Error('terminal completion cache must be absolute');
export default { ...(cacheDir ? { cacheDir } : {}), test: { cache: false, include: [
  'src/host/world/ActualFoulTerminalPostPlaySetup.test.ts',
  'src/host/OfficialTerminalCompletionMatch.test.ts',
  'src/host/world/ActualFoulTerminalSettledCheckpoint.acceptance.ts',
  'src/host/world/ActualFoulTerminalCompletionPrerequisite.acceptance.ts',
  'src/host/world/ActualFoulTerminalPostPlayCompletion.acceptance.ts',
  'src/host/world/ActualFoulTerminalCompletionReview.acceptance.ts',
  'src/host/world/ActualFoulTerminalCommitDurability.acceptance.ts',
  'src/host/world/ActualFoulTerminalScoringHistory.acceptance.ts',
  'src/host/world/ActualFoulTerminalScoringHistoryBoundary.acceptance.ts',
  'src/host/world/ActualFoulTerminalLocalMatch.acceptance.ts',
  'src/host/world/ActualFoulTerminalCompletionAdversarial.acceptance.ts',
  'src/host/world/ActualFoulTerminalCompletionWriteGuards.acceptance.ts',
] } };
