import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { advanceNativeFieldClockV212, type NativeFieldClockV212Input } from './native-field-clock-v212';

it('NF212-S00 imports the bounded Native fresh observation-clock continuation without invoking a Native operation', () => {
  assert.equal(typeof advanceNativeFieldClockV212, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_FIELD_CLOCK_V212_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_FIELD_CLOCK_V212_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_FIELD_CLOCK_V212_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NF212-S01 accepts one free field step and nine normal clock projections in fresh current cut13', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeFieldClockV212Input; stringifyDebugRecord(value: unknown): string;
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
    const frontier = advanceNativeFieldClockV212(databasePath!, input, emit);
    assert(frontier.fieldStepAccepted && frontier.finalLifecycleCurrentProven && frontier.observationClockProjected && frontier.clockProjectionApplicable);
    assert.equal(frontier.observationClockProjectionCount, 9); assert.equal(frontier.projectionProofs.length, 9);
    assert(!frontier.nativePostFieldClockConsumerProven && frontier.nativeResumeAdapterRequired && !frontier.resumeReady && !frontier.fullContinuationComplete);
    assert(!frontier.wholeRngConsumptionProven && !frontier.officialTerminalProven && !frontier.performancePass && !frontier.defensiveAiAccepted && !frontier.legalOutcomeProven);
    assert.equal(frontier.executedObservationClockProbeStatus, 'UNKNOWN'); assert.equal(frontier.executedObservationClockProbeProven, false);
    assert.equal(frontier.executedObservationClockProbeReason, 'NO_RETAINED_ACTUAL_DEFENDER_OBSERVATION_SOURCE');
    assert.equal(frontier.normalLifecycleAdvances, 1); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut13:view');
    assert.equal(frontier.eventReferences.length, 13); assert.equal(Object.keys(frontier.resumePins).length, 16);
    assert.equal(frontier.worldBefore.head.worldRevision, 2); assert.equal(frontier.worldAfter.head.worldRevision, 2);
    assert.equal(frontier.calibrations.length, 32); assert.equal(frontier.currentPhysicalOperation.record.stage, 'field');
    assert.equal(frontier.fieldStep.operationOrdinal, 7); assert.equal(frontier.finalCurrent.view.cut.stage, 'field_active');
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, fieldStepAccepted: frontier.fieldStepAccepted,
      observationClockProjected: frontier.observationClockProjected, observationClockProjectionCount: frontier.observationClockProjectionCount,
      finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven, nativePostFieldClockConsumerProven: frontier.nativePostFieldClockConsumerProven,
      nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired, resumeReady: frontier.resumeReady,
      normalLifecycleAdvances: frontier.normalLifecycleAdvances, wholeRngConsumptionProven: frontier.wholeRngConsumptionProven,
      executedObservationClockProbeProven: frontier.executedObservationClockProbeProven, executedObservationClockProbeStatus: frontier.executedObservationClockProbeStatus,
      executedObservationClockProbeReason: frontier.executedObservationClockProbeReason, fullContinuationComplete: frontier.fullContinuationComplete,
      officialTerminalProven: frontier.officialTerminalProven, legalOutcomeProven: frontier.legalOutcomeProven, performancePass: frontier.performancePass, defensiveAiAccepted: frontier.defensiveAiAccepted });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
  finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 285_000);
