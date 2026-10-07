import { defineConfig } from 'vitest/config';
import { isAbsolute } from 'node:path';

const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('absolute task cache path required');

/** Private genuine-artifact leaves are excluded from ordinary *.test.ts discovery. */
export default defineConfig({
  cacheDir,
  test: {
    cache: false,
    include: ['src/host/world/ActualLiveParticipationGenuine*.acceptance.ts'],
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    testTimeout: 300_000,
  },
});
