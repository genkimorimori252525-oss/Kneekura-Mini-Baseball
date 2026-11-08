import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { admitNativeExecutionInputV208, type NativeExecutionInputV208Input } from './native-execution-input-v208';

it('NI208-S00 imports the bounded Native execution-input continuation without invoking a Native operation', () => {
  assert.equal(typeof admitNativeExecutionInputV208, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_EXECUTION_INPUT_V208_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_EXECUTION_INPUT_V208_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_EXECUTION_INPUT_V208_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NI208-S01 continues current cut7 through score emotion decision cut and accepted execution input', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeExecutionInputV208Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = admitNativeExecutionInputV208(databasePath!, input, emit);
    assert(frontier.admittedEntryAuthenticated && frontier.executionInputAccepted && frontier.finalLifecycleCurrentProven && frontier.inputAwaitingConsumerContinuation);
    assert(!frontier.nativePostInputConsumerProven && frontier.nativeResumeAdapterRequired && !frontier.resumeReady && !frontier.fullContinuationComplete);
    assert(!frontier.wholeRngConsumptionProven && !frontier.commitmentAccepted && !frontier.resolutionAccepted);
    assert.equal(frontier.normalLifecycleAdvances, 2); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut9:view');
    assert.equal(frontier.eventReferences.length, 9); assert.equal(Object.keys(frontier.resumePins).length, 12);
    assert.equal(frontier.worldBefore.head.worldRevision, 0); assert.equal(frontier.worldAfter.head.worldRevision, 1);
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, executionInputAccepted: frontier.executionInputAccepted,
      finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven, inputAwaitingConsumerContinuation: frontier.inputAwaitingConsumerContinuation,
      nativePostInputConsumerProven: frontier.nativePostInputConsumerProven, nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired,
      resumeReady: frontier.resumeReady, normalLifecycleAdvances: frontier.normalLifecycleAdvances, wholeRngConsumptionProven: frontier.wholeRngConsumptionProven,
      fullContinuationComplete: frontier.fullContinuationComplete, commitmentAccepted: frontier.commitmentAccepted, resolutionAccepted: frontier.resolutionAccepted });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
  finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 165_000);
