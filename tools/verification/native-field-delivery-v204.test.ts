import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { admitNativeFieldDeliveryV204, type NativeFieldDeliveryV204Input } from './native-field-delivery-v204';

it('NF204-S00 imports the bounded delivery continuation without invoking a Native operation', () => {
  assert.equal(typeof admitNativeFieldDeliveryV204, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_FIELD_DELIVERY_V204_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_FIELD_DELIVERY_V204_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_FIELD_DELIVERY_V204_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NF204-S01 accepts the original delivery and stops before its lifecycle admission', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeFieldDeliveryV204Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = admitNativeFieldDeliveryV204(databasePath!, input, emit);
    assert(frontier.deliveryCheckpointProven && frontier.deliveryAfterFenceProven && frontier.deliveryAwaitingLifecycleAdmission && !frontier.fullContinuationComplete);
    assert(!frontier.resumeReady && !frontier.nativePostDeliveryConsumerProven && frontier.nativeResumeAdapterRequired);
    assert.equal(frontier.normalLifecycleAdvances, 1); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut5:view');
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, postObservationCurrentProven: frontier.postObservationCurrentProven,
      deliveryCheckpointProven: frontier.deliveryCheckpointProven, deliveryAfterFenceProven: frontier.deliveryAfterFenceProven,
      deliveryAwaitingLifecycleAdmission: frontier.deliveryAwaitingLifecycleAdmission, finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven,
      resumeReady: frontier.resumeReady, nativePostDeliveryConsumerProven: frontier.nativePostDeliveryConsumerProven, nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired,
      normalLifecycleAdvances: frontier.normalLifecycleAdvances, fullContinuationComplete: frontier.fullContinuationComplete, fieldRootAccepted: frontier.fieldRootAccepted });
  } catch (error) {
    save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error;
  } finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 165_000);
