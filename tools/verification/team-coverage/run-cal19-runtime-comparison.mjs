import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
const [nodeArgument, bundleArgument, parentArgument, destinationArgument] = process.argv.slice(2);
assert.ok(nodeArgument && bundleArgument && parentArgument && destinationArgument);
const runtime = resolve(nodeArgument), bundle = resolve(bundleArgument), parent = resolve(parentArgument), destination = resolve(destinationArgument);
assert.ok(!existsSync(destination)); mkdirSync(destination); mkdirSync(join(destination, 'retained-resume'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const copy = (a, b) => { copyFileSync(a, b, constants.COPYFILE_EXCL); assert.equal(sha(a), sha(b)); };
const manifest = JSON.parse(readFileSync(join(parent, 'manifest.json'), 'utf8'));
// The retained source-only delivery prefix is unchanged in the first continuation.
const originalRoot = process.env.TEAM_RETAINED_ORIGINAL_ROOT; assert.ok(originalRoot);
copy(join(originalRoot, 'retained-prefix.sqlite'), join(destination, 'retained-prefix.sqlite'));
copy(join(originalRoot, 'accepted-sources-0.json'), join(destination, 'accepted-sources-0.json'));
copy(manifest.closedPath, join(destination, 'retained-resume', 'resume.sqlite'));
copy(manifest.sourceMapPath, join(destination, 'retained-resume', 'accepted-sources.json'));
copy(join(parent, 'original-files', 'selected-policy.json'), join(destination, 'retained-resume', 'selected-policy.json'));
const started = Date.now(), child = spawn(runtime, [bundle, destination, 'declare-cut19-calibrations'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const receipt = { status: 'ONE_BOUND_CAL19_RUNTIME_COMPARISON_RUNNING', runtime, runtimeHash: sha(runtime), bundle, bundleHash: sha(bundle),
  childPid: child.pid, parentPid: process.pid, started, parentDatabaseHash: manifest.closedDatabaseHash,
  parentSourceMapHash: manifest.sourceMapHash, selectionScope: 'accepted_individual_selected_only', teamExecutionCredit: 0 };
writeFileSync(join(destination, 'runtime-attempt.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
child.stdout.on('data', bytes => appendFileSync(join(destination, 'child.stdout.log'), bytes));
child.stderr.on('data', bytes => appendFileSync(join(destination, 'child.stderr.log'), bytes));
const timer = setTimeout(() => {
  writeFileSync(join(destination, 'observation-deadline.json'), JSON.stringify({ status: 'OBSERVATION_DEADLINE_RUNNING_NOT_RESTARTED', childPid: child.pid, elapsedMilliseconds: Date.now() - started }));
  console.log(JSON.stringify({ status: 'OBSERVATION_DEADLINE_RUNNING_NOT_RESTARTED', childPid: child.pid }));
}, 900_000);
const result = await new Promise(resolve => child.once('exit', (exitCode, signal) => resolve({ exitCode, signal })));
clearTimeout(timer);
const completed = { ...receipt, status: result.exitCode === 0 ? 'CHILD_EXIT_ZERO_REQUIRES_READONLY_REAUTHENTICATION' : 'FAIL_RUNTIME_COMPARISON_CAUSE_UNKNOWN',
  ...result, elapsedMilliseconds: Date.now() - started };
writeFileSync(join(destination, 'runtime-result.json'), JSON.stringify(completed, null, 2)); console.log(JSON.stringify(completed));
