// Opt-in diagnostics only. No environment, argv, input JSON or process dump is
// recorded. Logging must not change the original exit/error behavior.
const fs = require('node:fs');
const { ChildProcess } = require('node:child_process');
const destination = process.env.BASEBALL_WORKER_EXIT_TRACE_V139;
if (destination) {
  const record = (event, data = {}) => {
    try {
      fs.appendFileSync(destination, JSON.stringify({ at: new Date().toISOString(), pid: process.pid, ppid: process.ppid,
        event, ...data }) + '\n');
    } catch { /* A failed diagnostic write must not replace the real failure. */ }
  };
  record('process-start', { node: process.version });
  const originalEmit = ChildProcess.prototype.emit;
  ChildProcess.prototype.emit = function (event, ...args) {
    if (event === 'exit' || event === 'close') record('child-' + event, { childPid: this.pid, code: args[0], signal: args[1] });
    return originalEmit.call(this, event, ...args);
  };
  process.on('uncaughtExceptionMonitor', error => record('uncaught-exception', { name: error.name, message: error.message, stack: error.stack }));
  process.on('exit', code => record('process-exit', { code, memory: process.memoryUsage() }));
}
