import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { admitNativeForecastAdmissionV207, compareNativeOriginalInputsV207, type NativeForecastAdmissionV207Input } from './native-forecast-admission-v207';
import type { NativeDeliveryForecastV206Input } from './native-delivery-forecast-v206';

it('NF207-S00 imports the Native forecast admission and original-input comparison without invoking Native operations', () => {
  assert.equal(typeof admitNativeForecastAdmissionV207, 'function'); assert.equal(typeof compareNativeOriginalInputsV207, 'function');
});

const codec = () => createRequire(import.meta.url)('./live-debug-record.mjs') as {
  parseDebugRecord<T>(value: string): T; stringifyDebugRecord(value: unknown): string;
};
const outputWriter = (output: string) => {
  mkdirSync(output, { recursive: false });
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec().stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  let count = 0;
  const emit = (name: string, value?: unknown) => {
    const stage = { index: ++count, name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
    appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify(stage) + '\n');
    if (value !== undefined) save('checkpoint-' + count + '-' + name + '.lossless.json', value);
  };
  return { save, emit };
};
const databasePath = process.env.BASEBALL_NATIVE_FORECAST_ADMISSION_V207_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_FORECAST_ADMISSION_V207_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_FORECAST_ADMISSION_V207_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NF207-S01 admits the retained forecast then authenticates current cut7 through the same Native entry', () => {
  const output = resolve(outputPath!), { save, emit } = outputWriter(output);
  const input = codec().parseDebugRecord<NativeForecastAdmissionV207Input>(readFileSync(inputPath!, 'utf8'));
  const prior = process.report ? { directory: process.report.directory, reportOnFatalError: process.report.reportOnFatalError, excludeEnv: process.report.excludeEnv } : null;
  if (process.report) { process.report.directory = output; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
  try {
    const frontier = admitNativeForecastAdmissionV207(databasePath!, input, emit);
    assert(frontier.missingCalibrationRejected);
    assert(frontier.predictionAdmissionProven && frontier.postAdmissionEntryReauthenticated && frontier.finalLifecycleCurrentProven && frontier.nativePostForecastConsumerProven && frontier.resumeReady);
    assert(!frontier.nativeResumeAdapterRequired && !frontier.fullContinuationComplete && !frontier.scoreAccepted);
    assert.equal(frontier.normalLifecycleAdvances, frontier.recoveredFromCurrentCut7 ? 0 : 1);
    assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut7:view'); assert.equal(frontier.eventReferences.length, 7);
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, predictionAdmissionProven: frontier.predictionAdmissionProven,
      postAdmissionEntryReauthenticated: frontier.postAdmissionEntryReauthenticated, missingCalibrationRejected: frontier.missingCalibrationRejected, finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven, nativePostForecastConsumerProven: frontier.nativePostForecastConsumerProven,
      nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired, resumeReady: frontier.resumeReady,
      normalLifecycleAdvances: frontier.normalLifecycleAdvances, recoveredFromCurrentCut7: frontier.recoveredFromCurrentCut7,
      fullContinuationComplete: frontier.fullContinuationComplete, fieldRootAccepted: frontier.fieldRootAccepted });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
  finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 165_000);

const compatibilityDatabase = process.env.BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_DATABASE;
const compatibilityInput = process.env.BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_INPUT;
const compatibilityBaseline = process.env.BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_BASELINE;
const compatibilityOutput = process.env.BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_OUTPUT;
it.skipIf(!compatibilityDatabase || !compatibilityInput || !compatibilityBaseline || !compatibilityOutput)('NF207-S02 compares every common original-input field with the saved V206 facts without new accepts', () => {
  const { save, emit } = outputWriter(resolve(compatibilityOutput!));
  try {
    const input = codec().parseDebugRecord<NativeDeliveryForecastV206Input>(readFileSync(compatibilityInput!, 'utf8'));
    const baseline = codec().parseDebugRecord<{ originalInputs: Record<string, unknown> }>(readFileSync(compatibilityBaseline!, 'utf8'));
    const result = compareNativeOriginalInputsV207(compatibilityDatabase!, input, baseline, emit);
    assert(result.allExtractedFieldsExact && result.comparedFieldNames.length > 0); assert.equal(result.newAcceptedOperations, 0);
    save('original-inputs-common-reader.lossless.json', result.originalInputs); save('summary.json', { pass: true, boundary: result.boundary, comparedFieldNames: result.comparedFieldNames, allExtractedFieldsExact: result.allExtractedFieldsExact, newAcceptedOperations: result.newAcceptedOperations });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
}, 165_000);
