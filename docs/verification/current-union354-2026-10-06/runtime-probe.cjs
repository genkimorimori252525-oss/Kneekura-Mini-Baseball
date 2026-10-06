const fs = require('node:fs');
const v8 = require('node:v8');
const record = { pid: process.pid, ppid: process.ppid, nodeVersion: process.versions.node,
  heapLimitMiB: v8.getHeapStatistics().heap_size_limit / 1024 / 1024,
  nodePathAbsent: !Object.hasOwn(process.env, 'NODE_PATH'),
  optionalWsExtensionsDisabled: process.env.WS_NO_BUFFER_UTIL === '1' && process.env.WS_NO_UTF_8_VALIDATE === '1',
  worker: process.env.TINYPOOL_WORKER_ID !== undefined, stage: process.env.BASEBALL_STAGE };
fs.appendFileSync(process.env.BASEBALL_RUNTIME_LOG, JSON.stringify(record) + '\n');
if (!record.nodePathAbsent || !record.optionalWsExtensionsDisabled) throw new Error('optional dependency lookup is not isolated');
if (record.nodeVersion !== '26.10.0' || record.heapLimitMiB !== Number(process.env.BASEBALL_EXPECTED_HEAP)) {
  throw new Error('executing Node identity or heap differs from the pinned contract');
}
