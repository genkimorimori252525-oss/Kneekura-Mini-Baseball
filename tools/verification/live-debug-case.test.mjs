import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { replaceDebugPageCore, replaceDebugPageRuntime, debugTransport, debugDeadline,
  captureDebugHarness, verifyDebugHarness } from './live-debug-case.mjs';

test('replaces the embedded Core before startup and preserves every other page byte', () => {
  const old = 'var KneekuraNativeMatchCore = (()=>{ var __toCommonJS = 1; })();';
  const html = '<!doctype html>\r\n<script id="core">' + old + '\n</script><script>startGame();</script>';
  const result = replaceDebugPageCore(html, 'new-core');
  assert.equal(result.html, html.replace(old + '\n', 'new-core\n'));
  assert.equal(result.previousCore, old);
  assert.throws(() => replaceDebugPageCore('<script>startGame();</script>', 'new-core'), /one embedded Native Core/);
  assert.throws(() => replaceDebugPageCore(html + html, 'new-core'), /one embedded Native Core/);
});

test('pins the actual embedded Worker runtime before startup', () => {
  const html = '<script id="background-match-v116">old-worker</script><script>start();</script>';
  const result = replaceDebugPageRuntime(html, 'current-worker\n');
  assert.equal(result.previousRuntime, 'old-worker');
  assert.equal(result.html, '<script id="background-match-v116">current-worker\n</script><script>start();</script>');
  assert.throws(() => replaceDebugPageRuntime(html + html, 'new'), /one embedded background runtime/);
});

test('large record graphs cross browser automation as strings, without per-node protocol expansion', () => {
  const configuration = ['object', [['minusZero', ['number', '-0']]]], commands = ['array', []];
  const transport = debugTransport({ configuration, commands });
  assert.equal(typeof transport.configurationText, 'string');
  assert.equal(typeof transport.commandsText, 'string');
  assert.deepEqual(JSON.parse(transport.configurationText), configuration);
  assert.deepEqual(JSON.parse(transport.commandsText), commands);
});

test('a stuck browser operation has a deadline and completed work is returned unchanged', async () => {
  assert.equal(await debugDeadline(Promise.resolve(7), 100, 'ready'), 7);
  await assert.rejects(debugDeadline(new Promise(() => {}), 5, 'stuck-worker'), /stuck-worker.*deadline/);
});

test('a changed harness during execution rejects its original pinned identity', async () => {
  const area = resolve('docs/verification/realism-debug-20261027');
  await mkdir(area, { recursive: true });
  const root = await mkdtemp(resolve(area, 'harness-test-'));
  try {
    await writeFile(resolve(root, 'runner.mjs'), 'original runner');
    const pins = await captureDebugHarness({ root, paths: ['runner.mjs'] });
    await verifyDebugHarness({ root, pins });
    await writeFile(resolve(root, 'runner.mjs'), 'changed runner');
    await assert.rejects(verifyDebugHarness({ root, pins }), /harness changed during execution/);
    assert.equal(await readFile(resolve(root, 'runner.mjs'), 'utf8'), 'changed runner');
  } finally {
    assert(root.startsWith(area + sep));
    await rm(root, { recursive: true });
  }
});
