import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Standalone child stages resume an explicitly chosen boundary. A failed stage
// stops the suffix; no stale view is skipped and no Native claim is synthesized.
const [entryArgument, directoryArgument, startAt = 'resolution', endAt = 'declare-cut11-calibrations'] = process.argv.slice(2);
assert.ok(entryArgument && directoryArgument);
const entry = resolve(entryArgument), directory = resolve(directoryArgument);
const stages = ['declare-cut5-calibrations','delivery','advance-delivery','declare-cut6-calibrations','forecast','advance-forecast','declare-cut7-calibrations','score','emotion','advance-emotion','declare-cut8-calibrations','decision-cut','advance-decision-cut','declare-cut9-calibrations','input','commitment','advance-commitment','declare-cut10-calibrations','resolution','advance-resolution','declare-cut11-calibrations','field-root','advance-field-root','declare-cut12-calibrations','field-step'];
const start = stages.indexOf(startAt); assert.ok(start >= 0, 'choose an exact implemented stage');
const logs = join(directory, 'retained-resume', 'stage-child-logs-v4'); mkdirSync(logs, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bundleHash = sha(readFileSync(entry));
const end = stages.indexOf(endAt); assert.ok(end >= start, 'choose an exact final stage');
for (const mode of stages.slice(start, end + 1)) {
  const logPath = join(logs, mode + '.json');
  assert.ok(!existsSync(logPath), 'prior stage log exists; inspect it and choose a later explicit start rather than overwriting');
  console.log(JSON.stringify({ stage: mode, status: 'START', at: Date.now(), bundleHash }));
  const started = Date.now();
  const child = spawnSync(process.execPath, [entry, directory, mode], { encoding: 'utf8', windowsHide: true,
    timeout: 240_000, maxBuffer: 8 * 1024 * 1024 });
  const log = { mode, bundleHash, started, elapsedMilliseconds: Date.now() - started, exitCode: child.status,
    signal: child.signal, error: child.error?.message ?? null, stdout: child.stdout, stderr: child.stderr };
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  appendFileSync(join(logs, 'progress.jsonl'), JSON.stringify({ mode, exitCode: log.exitCode,
    elapsedMilliseconds: log.elapsedMilliseconds, signal: log.signal, error: log.error }) + '\n');
  if (child.status !== 0 || child.error || child.signal) {
    console.error(JSON.stringify({ stage: mode, status: 'FAIL_OR_UNKNOWN_NATIVE_SUFFIX_STOPPED', logPath,
      elapsedMilliseconds: log.elapsedMilliseconds, exitCode: child.status, signal: child.signal,
      error: log.error, teamExecutionCredit: 0, officialResult: null }));
    console.error(child.stderr); process.exitCode = 1; break;
  }
  const receipts = child.stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const receipt = receipts.at(-1); assert.ok(receipt?.status?.startsWith('PASS_'), 'stage needs its original-owner receipt');
  console.log(JSON.stringify({ stage: mode, status: receipt.status, elapsedMilliseconds: log.elapsedMilliseconds,
    reference: receipt.stepReference ?? receipt.viewReference ?? receipt.originalViewReference,
    teamExecutionCredit: receipt.teamExecutionCredit, officialResult: receipt.officialResult }));
}
