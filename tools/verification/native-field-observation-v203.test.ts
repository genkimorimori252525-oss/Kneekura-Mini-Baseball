import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { admitNativeFieldObservationV203, type NativeFieldObservationV203Input } from './native-field-observation-v203';

it('NF203-S00 imports the bounded observation continuation without invoking a Native operation', () => {
  assert.equal(typeof admitNativeFieldObservationV203, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_FIELD_OBSERVATION_V203_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_FIELD_OBSERVATION_V203_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_FIELD_OBSERVATION_V203_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NF203-S01 admits the retained capture and observation and stops at the normal post-observation cut4 entry', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeFieldObservationV203Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = admitNativeFieldObservationV203(databasePath!, input, emit);
    assert(frontier.wrongTimeRejected && frontier.postObservationCurrentProven && !frontier.fullContinuationComplete);
    assert.equal(frontier.normalLifecycleAdvances, 2); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut4:view');
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, postObservationCurrentProven: frontier.postObservationCurrentProven,
      wrongTimeRejected: frontier.wrongTimeRejected, wrongTimeSourceRows: frontier.wrongTimeSourceRows,
      normalLifecycleAdvances: frontier.normalLifecycleAdvances, fullContinuationComplete: frontier.fullContinuationComplete, fieldRootAccepted: frontier.fieldRootAccepted });
  } catch (error) {
    save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error;
  } finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 165_000);
