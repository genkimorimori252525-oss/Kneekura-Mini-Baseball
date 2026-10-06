// Exact single-file selection. The released controller and inventory own the path.
const file = process.env.BASEBALL_SELECTED_FILE;
const cache = process.env.BASEBALL_CACHE_DIR;
if (!file?.startsWith('src/') || !file.endsWith('.test.ts') || !cache) throw new Error('missing exact cumulative file selection');
export default { cacheDir: cache, test: { include: [file], exclude: [], environment: 'node',
  pool: 'forks', minWorkers: 1, maxWorkers: 1, fileParallelism: false, isolate: true,
  allowOnly: false, passWithNoTests: false, retry: 0, bail: 0, update: false,
  testTimeout: 5000, hookTimeout: 10000 } };
