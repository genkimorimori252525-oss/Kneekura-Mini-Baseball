import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const inputPath = process.env.LAN01_RETAINED_REVIEW_IMPORT_INPUT;
assert(inputPath && isAbsolute(inputPath), 'absolute prepared input path is required');
assert.equal(realpathSync(inputPath), inputPath, 'prepared input path must be canonical');
const input = JSON.parse(readFileSync(inputPath, 'utf8'));
assert.equal(input.nativeReleased, true, 'reviewed Native release is required');
const root = fileURLToPath(new URL('../../', import.meta.url));

export default {
  root,
  cacheDir: join(dirname(inputPath), 'cache'),
  test: {
    cache: false,
    include: ['tools/handoff/LAN01ReviewImportResume.acceptance.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 42_900_000,
    hookTimeout: 30_000,
  },
};
