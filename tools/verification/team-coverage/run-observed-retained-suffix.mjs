import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Same original stages, with durable child identity before waiting. An observation
// deadline neither kills nor restarts the owner; only a real terminal event advances.
const [entryArgument, directoryArgument, startAt] = process.argv.slice(2);
assert.ok(entryArgument && directoryArgument && startAt);
const entry = resolve(entryArgument), directory = resolve(directoryArgument);
const stages = ['declare-cut12-calibrations', 'field-step', 'advance-field-step', 'declare-cut13-calibrations'];
for (let index = 0; index < 9; index++) for (const kind of ['observation', 'decision']) {
  const name = `defender-${kind}-${index}`, nextCut = 14 + index * 2 + (kind === 'decision' ? 1 : 0);
  stages.push(name, 'advance-' + name, `declare-cut${nextCut}-calibrations`);
}
stages.push('decision-checkpoint');
const start = stages.indexOf(startAt); assert.ok(start >= 0);
const logs = join(directory, 'retained-resume', 'stage-child-logs'); mkdirSync(logs, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), bundleHash = sha(readFileSync(entry));
for (const mode of stages.slice(start)) {
  const logPath = join(logs, mode + '.json'), attemptPath = join(logs, mode + '.attempt.json');
  assert.ok(!existsSync(logPath) && !existsSync(attemptPath), 'preserve previous terminal/running attempt; no automatic restart');
  assert.equal(sha(readFileSync(entry)), bundleHash, 'pinned bundle changed');
  const started = Date.now(), child = spawn(process.execPath, [entry, directory, mode], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const attempt = { mode, bundleHash, entry, runtime: process.execPath, parentPid: process.pid, childPid: child.pid, started };
  writeFileSync(attemptPath, JSON.stringify(attempt, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ ...attempt, status: 'START_OBSERVED_NO_RESTART' }));
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { appendFileSync(join(logs, mode + '.stdout.log'), bytes); stdout += bytes; });
  child.stderr.on('data', bytes => { appendFileSync(join(logs, mode + '.stderr.log'), bytes); stderr += bytes; });
  const timer = setTimeout(() => {
    const observation = { ...attempt, status: 'OBSERVATION_DEADLINE_RUNNING_NOT_KILLED_OR_RESTARTED', elapsedMilliseconds: Date.now() - started };
    writeFileSync(join(logs, mode + '.observation.json'), JSON.stringify(observation, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(observation));
  }, 900_000);
  const terminal = await new Promise(resolve => {
    child.once('error', error => resolve({ exitCode: null, signal: null, error: String(error) }));
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal, error: null }));
  });
  clearTimeout(timer);
  const log = { ...attempt, ...terminal, elapsedMilliseconds: Date.now() - started, stdout, stderr };
  writeFileSync(logPath, JSON.stringify(log, null, 2), { flag: 'wx' });
  appendFileSync(join(logs, 'progress.jsonl'), JSON.stringify({ mode, childPid: child.pid, exitCode: log.exitCode,
    elapsedMilliseconds: log.elapsedMilliseconds, signal: log.signal, error: log.error }) + '\n');
  if (log.exitCode !== 0 || log.error || log.signal) {
    console.error(JSON.stringify({ ...attempt, status: 'FAIL_OR_UNKNOWN_NATIVE_SUFFIX_STOPPED', logPath,
      elapsedMilliseconds: log.elapsedMilliseconds, exitCode: log.exitCode, signal: log.signal, error: log.error,
      teamExecutionCredit: 0, officialResult: null }));
    process.exitCode = 1; break;
  }
  const receipts = stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const receipt = receipts.at(-1); assert.ok(receipt?.status?.startsWith('PASS_'));
  console.log(JSON.stringify({ mode, childPid: child.pid, status: receipt.status, elapsedMilliseconds: log.elapsedMilliseconds,
    reference: receipt.stepReference ?? receipt.viewReference ?? receipt.originalViewReference,
    teamExecutionCredit: receipt.teamExecutionCredit, officialResult: receipt.officialResult }));
}
