const cacheDir = process.env.BASEBALL_GATE_CACHE;
export default { ...(cacheDir ? { cacheDir } : {}), test: {
  cache: false, include: ['src/host/world/PL01RetainedTerminalSuffix.acceptance.ts'],
  maxWorkers: 1, minWorkers: 1,
} };
