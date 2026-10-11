const cacheDir = process.env.BASEBALL_GATE_CACHE;
export default { ...(cacheDir ? { cacheDir } : {}), test: {
  cache: false, include: ['src/host/world/LAN01RetainedOriginalSuffix.acceptance.ts'],
  maxWorkers: 1, minWorkers: 1,
} };
