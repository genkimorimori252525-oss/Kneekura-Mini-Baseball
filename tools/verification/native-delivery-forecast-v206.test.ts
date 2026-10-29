import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { admitNativeDeliveryForecastV206, type NativeDeliveryForecastV206Input } from './native-delivery-forecast-v206';

it('NF206-S00 imports the bounded Native delivery forecast without invoking a Native operation', () => {
  assert.equal(typeof admitNativeDeliveryForecastV206, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_DELIVERY_FORECAST_V206_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_DELIVERY_FORECAST_V206_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_DELIVERY_FORECAST_V206_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NF206-S01 admits delivery and accepts forecast before forecast lifecycle admission', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeDeliveryForecastV206Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = admitNativeDeliveryForecastV206(databasePath!, input, emit);
    assert(frontier.nativePostDeliveryEntryAuthenticated && frontier.deliveryAdmissionProven && frontier.forecastAccepted && frontier.forecastAfterFenceProven);
    assert(!frontier.resumeReady && !frontier.nativePostForecastConsumerProven && frontier.nativeResumeAdapterRequired && !frontier.fullContinuationComplete);
    assert.equal(frontier.normalLifecycleAdvances, 1); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut6:view');
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, nativePostDeliveryEntryAuthenticated: frontier.nativePostDeliveryEntryAuthenticated,
      deliveryAdmissionProven: frontier.deliveryAdmissionProven, forecastAccepted: frontier.forecastAccepted, forecastAfterFenceProven: frontier.forecastAfterFenceProven,
      forecastAwaitingLifecycleAdmission: frontier.forecastAwaitingLifecycleAdmission, finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven,
      resumeReady: frontier.resumeReady, nativePostForecastConsumerProven: frontier.nativePostForecastConsumerProven, nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired,
      normalLifecycleAdvances: frontier.normalLifecycleAdvances, fullContinuationComplete: frontier.fullContinuationComplete, fieldRootAccepted: frontier.fieldRootAccepted });
  } catch (error) {
    save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error;
  } finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 165_000);
