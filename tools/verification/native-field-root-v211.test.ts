import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { admitNativeFieldRootV211, type NativeFieldRootV211Input } from './native-field-root-v211';

it('NF211-S00 imports the bounded Native fresh field-root acceptance without invoking a Native operation', () => {
  assert.equal(typeof admitNativeFieldRootV211, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_FIELD_ROOT_V211_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_FIELD_ROOT_V211_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_FIELD_ROOT_V211_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NF211-S01 accepts one fresh field root and normal current cut12 without issuing a field step', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeFieldRootV211Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = admitNativeFieldRootV211(databasePath!, input, emit);
    assert(frontier.fieldRootAccepted && frontier.finalLifecycleCurrentProven);
    assert(!frontier.nativePostFieldRootConsumerProven && frontier.nativeResumeAdapterRequired && !frontier.resumeReady && !frontier.fullContinuationComplete);
    assert(!frontier.wholeRngConsumptionProven && !frontier.fieldStepAccepted && !frontier.officialTerminalProven && !frontier.performancePass);
    assert(!frontier.flightAdvanceProven && !frontier.ballRunAccepted && !frontier.contactFieldingAccepted && !frontier.defensiveAiAccepted);
    assert.equal(frontier.normalLifecycleAdvances, 1); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut12:view');
    assert.equal(frontier.eventReferences.length, 12); assert.equal(Object.keys(frontier.resumePins).length, 15);
    assert.equal(frontier.worldBefore.head.worldRevision, 2); assert.equal(frontier.worldAfter.head.worldRevision, 2);
    assert.equal(frontier.calibrations.length, 32); assert.equal(frontier.currentPhysicalOperation.record.stage, 'field');
    assert.equal(frontier.fieldRoot.operationOrdinal, 6); assert.equal(frontier.finalCurrent.view.cut.stage, 'field_active');
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, fieldRootAccepted: frontier.fieldRootAccepted,
      finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven, nativePostFieldRootConsumerProven: frontier.nativePostFieldRootConsumerProven,
      nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired, resumeReady: frontier.resumeReady,
      normalLifecycleAdvances: frontier.normalLifecycleAdvances, fieldStepAccepted: frontier.fieldStepAccepted,
      wholeRngConsumptionProven: frontier.wholeRngConsumptionProven, fullContinuationComplete: frontier.fullContinuationComplete,
      officialTerminalProven: frontier.officialTerminalProven, performancePass: frontier.performancePass,
      flightAdvanceProven: frontier.flightAdvanceProven, ballRunAccepted: frontier.ballRunAccepted,
      contactFieldingAccepted: frontier.contactFieldingAccepted, defensiveAiAccepted: frontier.defensiveAiAccepted });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
  finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 225_000);
