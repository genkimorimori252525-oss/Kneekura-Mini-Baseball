const fs = require('node:fs');
const v8 = require('node:v8');
const oldSpaceMiB = Number(process.env.BASEBALL_PIPELINE_OLD_SPACE_MIB);
const expectedHeapLimitMiB = Number(process.env.BASEBALL_PIPELINE_EXPECTED_HEAP_MIB);
const receipt = { at: new Date().toISOString(), pid: process.pid, ppid: process.ppid,
  workerId: process.env.TINYPOOL_WORKER_ID ?? null, node: process.version, execArgv: process.execArgv,
  requestedOldSpaceMiB: oldSpaceMiB, heapLimitMiB: v8.getHeapStatistics().heap_size_limit / 1024 / 1024,
  memory: process.memoryUsage() };
if (process.env.BASEBALL_PIPELINE_RUNTIME_LOG) fs.appendFileSync(process.env.BASEBALL_PIPELINE_RUNTIME_LOG, JSON.stringify(receipt) + '\n');
if (!Number.isSafeInteger(oldSpaceMiB) || oldSpaceMiB <= 0 || !Number.isSafeInteger(expectedHeapLimitMiB)
  || receipt.heapLimitMiB !== expectedHeapLimitMiB) throw new Error('actual pipeline process heap limit differs from the explicit launch contract');
