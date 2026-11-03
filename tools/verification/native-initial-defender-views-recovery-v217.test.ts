import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { it } from 'vitest';
import { planRemainingInitialDefenderViewsV217, recoverNativeInitialDefenderViewsV217,
  type NativeInitialDefenderViewsRecoveryInputV217 } from './native-initial-defender-views-recovery-v217';

const state = { phase: 'SCOPED_CALIBRATION_PENDING', nextIndex: 5, completedCount: 5, acceptedObservationCount: 6,
  acceptedPrefixCount: 6, acceptedTotalRows: 60, acceptedViewCount: 6, acceptedScopedCalibrationCount: 5, remainingAppendRows: 43 } as const;
it('NIR217-P01 never schedules the six committed observations or admitted lifecycle stages again', () => {
  const plan = planRemainingInitialDefenderViewsV217(state);
  assert.deepEqual(plan.observationIndices, [6, 7, 8]); assert.equal(plan.recoverCalibrationOnlyCut, 19);
  assert.deepEqual(plan.appendCounts, { pa_physical_v1_field_steps: 3, pa_lifecycle_v1_work_prefixes: 3,
    pa_lifecycle_v1_total_assessments: 30, pa_lifecycle_v1_execution_views: 3, pa_lifecycle_v1_execution_calibrations: 4 });
  assert.equal(plan.retainedStageReacceptCount, 0); assert.equal(plan.physicalHeadCasCount, 3);
});
it('NIR217-P02 refuses a different or partially accepted retained frontier', () => {
  for (const patch of [{ acceptedObservationCount: 5 }, { acceptedScopedCalibrationCount: 6 }, { acceptedTotalRows: 59 }, { acceptedViewCount: 5 }])
    assert.throws(() => planRemainingInitialDefenderViewsV217({ ...state, ...patch }), /V217 retained phase/);
});
const databasePath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_V217_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_V217_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_V217_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NIR217-S01 recovers only cut19 calibration and the final three initial defender observations', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeInitialDefenderViewsRecoveryInputV217; stringifyDebugRecord(value: unknown): string;
  };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec.stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  let count = 0;
  const emit = (name: string, value?: unknown) => { appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify({ index: ++count, name, at: new Date().toISOString() }) + '\n');
    if (value !== undefined) save('checkpoint-' + count + '-' + name + '.lossless.json', value); };
  try {
    const frontier = recoverNativeInitialDefenderViewsV217(databasePath!, input, emit);
    assert.equal(frontier.initialDefenderObservationCount, 9); assert.equal(frontier.scopedDefenderCalibrationCount, 9);
    assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(frontier.currentPhysicalOperation.record.operationOrdinal, 16);
    assert.equal(frontier.eventReferences.length, 22); assert.equal(Object.keys(frontier.resumePins).length, 25); assert.equal(frontier.calibrations.length, 1);
    assert.equal(frontier.newObservationAcceptanceCount, 3); assert.equal(frontier.newScopedCalibrationAcceptanceCount, 4); assert.equal(frontier.retainedStageReacceptCount, 0);
    assert.equal(frontier.normalLifecycleAdvances, 3); assert.equal(frontier.finalLifecycleCurrentProven, true);
    for (const value of [frontier.rawGazeRestored, frontier.continuingGazeProven, frontier.empiricallyCalibrated, frontier.defensiveAiAccepted,
      frontier.legalOutcomeProven, frontier.officialTerminalProven, frontier.resumeReady, frontier.fullContinuationComplete, frontier.performancePass, frontier.wholeRngConsumptionProven]) assert.equal(value, false);
    save('frontier.lossless.json', frontier); save('summary.json', { pass: true, boundary: frontier.boundary, newObservationAcceptanceCount: frontier.newObservationAcceptanceCount,
      newScopedCalibrationAcceptanceCount: frontier.newScopedCalibrationAcceptanceCount, retainedStageReacceptCount: frontier.retainedStageReacceptCount,
      initialDefenderObservationCount: 9, normalLifecycleAdvances: 3, finalLifecycleCurrentProven: true, performancePass: false, fullContinuationComplete: false });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
}, 885_000);
