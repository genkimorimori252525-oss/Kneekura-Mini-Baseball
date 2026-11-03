import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { continueNativeFieldV199, prepareNativeFieldCaptureV199, type NativeFieldContinuationV199Input } from './native-field-continuation-v199';

it('NF199-S00 imports the original continuation without invoking a Native operation', () => {
  assert.equal(typeof continueNativeFieldV199, 'function');
  assert.equal(typeof prepareNativeFieldCaptureV199, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_FIELD_V199_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_FIELD_V199_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_FIELD_V199_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NF199-S02 prepares an authenticated first capture checkpoint from accepted prelaunch preparation', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeFieldContinuationV199Input; stringifyDebugRecord(value: unknown): string;
  };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec.stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  const prior = process.report ? { directory: process.report.directory, reportOnFatalError: process.report.reportOnFatalError, excludeEnv: process.report.excludeEnv } : null;
  if (process.report) { process.report.directory = output; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
  let count = 0;
  const emit = (name: string, value?: unknown) => {
    const stage = { index: ++count, name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
    appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify(stage) + '\n');
    if (value !== undefined) save('checkpoint-' + count + '-' + name + '.lossless.json', value);
  };
  try {
    const frontier = prepareNativeFieldCaptureV199(databasePath!, input, emit);
    assert(frontier.currentCaptureProven && frontier.resumeReady && !frontier.fullContinuationComplete);
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, currentCaptureProven: frontier.currentCaptureProven,
      resumeReady: frontier.resumeReady, fullContinuationComplete: frontier.fullContinuationComplete, fieldRootAccepted: frontier.fieldRootAccepted });
  } catch (error) {
    save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error;
  } finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 160_000);
