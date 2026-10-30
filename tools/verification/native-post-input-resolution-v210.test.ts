import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { resumeNativePostInputResolutionV210, type NativePostInputResolutionV210Input } from './native-post-input-resolution-v210';

it('NP210-S00 imports the bounded Native post-input resolution continuation without invoking a Native operation', () => {
  assert.equal(typeof resumeNativePostInputResolutionV210, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_POST_INPUT_RESOLUTION_V210_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_POST_INPUT_RESOLUTION_V210_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_POST_INPUT_RESOLUTION_V210_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NP210-S01 continues current cut9 input through normal commitment and resolved cut11', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativePostInputResolutionV210Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = resumeNativePostInputResolutionV210(databasePath!, input, emit);
    assert(frontier.postInputEntryAuthenticated && frontier.nativeBattingSuffixResolved && frontier.lifecycleResolvedProven && frontier.finalLifecycleCurrentProven);
    assert(frontier.commitmentAccepted && frontier.resolutionAccepted);
    assert(!frontier.nativePostResolvedConsumerProven && frontier.nativeResumeAdapterRequired && !frontier.resumeReady && !frontier.fullContinuationComplete);
    assert(!frontier.wholeRngConsumptionProven && !frontier.fieldRootAccepted && !frontier.officialTerminalProven && !frontier.performancePass);
    assert.equal(frontier.normalLifecycleAdvances, 2); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut11:view');
    assert.equal(frontier.eventReferences.length, 11); assert.equal(Object.keys(frontier.resumePins).length, 14);
    assert.equal(frontier.worldBefore.head.worldRevision, 1); assert.equal(frontier.worldAfter.head.worldRevision, 2);
    assert.equal(frontier.calibrations.length, 32); assert.equal(frontier.currentPhysicalOperation.record.stage, 'resolved');
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, postInputEntryAuthenticated: frontier.postInputEntryAuthenticated,
      nativeBattingSuffixResolved: frontier.nativeBattingSuffixResolved, lifecycleResolvedProven: frontier.lifecycleResolvedProven,
      finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven, commitmentAccepted: frontier.commitmentAccepted, resolutionAccepted: frontier.resolutionAccepted,
      nativePostResolvedConsumerProven: frontier.nativePostResolvedConsumerProven, nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired,
      resumeReady: frontier.resumeReady, normalLifecycleAdvances: frontier.normalLifecycleAdvances, wholeRngConsumptionProven: frontier.wholeRngConsumptionProven,
      fullContinuationComplete: frontier.fullContinuationComplete, fieldRootAccepted: frontier.fieldRootAccepted,
      officialTerminalProven: frontier.officialTerminalProven, performancePass: frontier.performancePass });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
  finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 285_000);
