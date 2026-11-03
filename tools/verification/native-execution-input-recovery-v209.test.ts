import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { resumeNativeExecutionInputV209, type NativeExecutionInputRecoveryV209Input } from './native-execution-input-recovery-v209';

it('NR209-S00 imports the bounded Native cut9 execution-input recovery without invoking a Native operation', () => {
  assert.equal(typeof resumeNativeExecutionInputV209, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_EXECUTION_INPUT_RECOVERY_V209_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_EXECUTION_INPUT_RECOVERY_V209_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_EXECUTION_INPUT_RECOVERY_V209_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NR209-S01 recovers only current cut9 calibrations and accepted execution input', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeExecutionInputRecoveryV209Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = resumeNativeExecutionInputV209(databasePath!, input, emit);
    assert(frontier.recoveredCurrentCut9Proven && frontier.executionInputAccepted && frontier.finalLifecycleCurrentProven && frontier.inputAwaitingConsumerContinuation);
    assert(!frontier.nativePostInputConsumerProven && frontier.nativeResumeAdapterRequired && !frontier.resumeReady && !frontier.fullContinuationComplete);
    assert(!frontier.wholeRngConsumptionProven && !frontier.commitmentAccepted && !frontier.resolutionAccepted);
    assert.equal(frontier.normalLifecycleAdvances, 0); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut9:view');
    assert.equal(frontier.eventReferences.length, 9); assert.equal(Object.keys(frontier.resumePins).length, 12);
    assert.equal(frontier.worldBefore.head.worldRevision, 1); assert.equal(frontier.worldAfter.head.worldRevision, 1);
    assert.equal(frontier.calibrations.length, 32); assert.equal(frontier.calibrationReaccepted, false);
    assert.equal(frontier.calibrationAcceptanceCount, input.inventory.calibrationCount === 0 ? 1 : 0);
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, executionInputAccepted: frontier.executionInputAccepted,
      finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven, calibrationAcceptanceCount: frontier.calibrationAcceptanceCount,
      calibrationReaccepted: frontier.calibrationReaccepted, inputAwaitingConsumerContinuation: frontier.inputAwaitingConsumerContinuation,
      nativePostInputConsumerProven: frontier.nativePostInputConsumerProven, nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired,
      resumeReady: frontier.resumeReady, normalLifecycleAdvances: frontier.normalLifecycleAdvances, wholeRngConsumptionProven: frontier.wholeRngConsumptionProven,
      fullContinuationComplete: frontier.fullContinuationComplete, commitmentAccepted: frontier.commitmentAccepted, resolutionAccepted: frontier.resolutionAccepted });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
  finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 165_000);
