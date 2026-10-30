import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { it } from 'vitest';
import { observeNativeInitialDefenderViewsV214, type NativeInitialDefenderViewsV214Input } from './native-initial-defender-views-v214';

it('NI214-S00 imports initial defender view continuation without invoking a Native operation', () => {
  assert.equal(typeof observeNativeInitialDefenderViewsV214, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_V214_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_V214_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_V214_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NI214-S01 accepts nine normal initial defender observations and one scoped calibration per fresh cut', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeInitialDefenderViewsV214Input; stringifyDebugRecord(value: unknown): string;
  };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec.stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  const prior = process.report ? { directory: process.report.directory, reportOnFatalError: process.report.reportOnFatalError, excludeEnv: process.report.excludeEnv } : null;
  if (process.report) { process.report.directory = output; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
  let count = 0;
  const emit = (name: string, value?: unknown) => {
    appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify({ index: ++count, name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit }) + '\n');
    if (value !== undefined) save('checkpoint-' + count + '-' + name + '.lossless.json', value);
  };
  try {
    const frontier = observeNativeInitialDefenderViewsV214(databasePath!, input, emit);
    assert(frontier.initialDefenderObservationsAccepted && frontier.finalLifecycleCurrentProven && frontier.firstObservationHistoryProven);
    assert.equal(frontier.initialDefenderObservationCount, 9); assert.equal(frontier.scopedDefenderCalibrationCount, 9); assert.equal(frontier.normalLifecycleAdvances, 9);
    assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(frontier.eventReferences.length, 22); assert.equal(Object.keys(frontier.resumePins).length, 25);
    assert.equal(frontier.currentPhysicalOperation.record.operationOrdinal, 16); assert.equal(frontier.calibrations.length, 1);
    assert.equal(frontier.observations.length, 9); assert.equal(new Set(frontier.observations.map(o => o.playerId)).size, 9);
    assert(!frontier.otherRoutesFullReady && !frontier.allRoutesReady && !frontier.rawGazeRestored && !frontier.continuingGazeProven && !frontier.empiricallyCalibrated);
    assert(!frontier.nativePostInitialDefenderObservationConsumerProven && frontier.nativeResumeAdapterRequired && !frontier.resumeReady);
    assert(!frontier.fullContinuationComplete && !frontier.performancePass && !frontier.wholeRngConsumptionProven && !frontier.officialTerminalProven && !frontier.legalOutcomeProven && !frontier.defensiveAiAccepted);
    assert.equal(frontier.worldBefore.head.worldRevision, 2); assert.equal(frontier.worldAfter.head.worldRevision, 2);
    save('frontier.lossless.json', frontier);
    save('summary.json', { pass: true, boundary: frontier.boundary, initialDefenderObservationsAccepted: frontier.initialDefenderObservationsAccepted,
      initialDefenderObservationCount: frontier.initialDefenderObservationCount, scopedDefenderCalibrationCount: frontier.scopedDefenderCalibrationCount,
      normalLifecycleAdvances: frontier.normalLifecycleAdvances, finalLifecycleCurrentProven: frontier.finalLifecycleCurrentProven,
      otherRoutesFullReady: frontier.otherRoutesFullReady, allRoutesReady: frontier.allRoutesReady, rawGazeRestored: frontier.rawGazeRestored,
      continuingGazeProven: frontier.continuingGazeProven, empiricallyCalibrated: frontier.empiricallyCalibrated,
      nativePostInitialDefenderObservationConsumerProven: frontier.nativePostInitialDefenderObservationConsumerProven,
      nativeResumeAdapterRequired: frontier.nativeResumeAdapterRequired, resumeReady: frontier.resumeReady,
      fullContinuationComplete: frontier.fullContinuationComplete, performancePass: frontier.performancePass, wholeRngConsumptionProven: frontier.wholeRngConsumptionProven,
      defensiveAiAccepted: frontier.defensiveAiAccepted, legalOutcomeProven: frontier.legalOutcomeProven, officialTerminalProven: frontier.officialTerminalProven });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
  finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 1_185_000);
