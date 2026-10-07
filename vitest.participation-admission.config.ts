import { defineConfig } from 'vitest/config';
import { isAbsolute } from 'node:path';

const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('absolute task cache path required');

export default defineConfig({
  cacheDir,
  test: {
    cache: false,
    include: ['src/host/world/ActualLiveParticipationAdmission.acceptance.ts'],
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    testTimeout: 900_000,
  },
});
