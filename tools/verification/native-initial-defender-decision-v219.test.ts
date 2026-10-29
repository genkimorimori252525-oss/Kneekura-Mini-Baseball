import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { it } from 'vitest';
import { createInitialDefenderDecisionModelV219, validateInitialDefenderDecisionModelV219,
  acceptNativeInitialDefenderDecisionV219, type NativeInitialDefenderDecisionInputV219 } from './native-initial-defender-decision-v219';

it('NID219-P01 declares only the existing nominal pursuit/hold policy, without an observed result', () => {
  const model = createInitialDefenderDecisionModelV219();
  assert.deepEqual(model.priorities, { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0,
    backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 });
  assert.equal(model.evidenceAuthority, 'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_PREPLAY_PLAN');
  assert.equal(model.empiricallyCalibrated, false); assert.equal(model.scope, 'FIRST_RETAINED_DEFENDER_DECISION_ONLY');
  assert.equal(model.actorSelection, 'INITIAL_VIEW_ORDER_FIRST_ACTOR');
  assert(Object.isFrozen(model.priorities.baseCoverPriorities)); assert(Object.isFrozen(model.priorities)); assert(Object.isFrozen(model));
});
it('NID219-P02 rejects retuning and extra authority instead of silently normalizing them', () => {
  const model = createInitialDefenderDecisionModelV219();
  for (const patch of [{ empiricallyCalibrated: true }, { actorSelection: 'NEAREST_FIELDER' }, { officialPolicy: true },
    { priorities: { ...model.priorities, ballPursuitPriority: 0.9 } }])
    assert.throws(() => validateInitialDefenderDecisionModelV219({ ...model, ...patch }), /V219/);
});
it('NID219-P03 clones declarations and refuses executable or future inputs without invoking them', () => {
  const model = createInitialDefenderDecisionModelV219(), copy = structuredClone(model), before = JSON.stringify(copy);
  const accepted = validateInitialDefenderDecisionModelV219(copy); assert.deepEqual(accepted, model);
  assert.notEqual(accepted, copy); assert.notEqual(accepted.priorities, copy.priorities); assert.equal(JSON.stringify(copy), before);
  let reads = 0;
  const getter = Object.defineProperty({ ...copy }, 'priorities', { enumerable: true, get() { reads++; throw Error('future input'); } });
  assert.throws(() => validateInitialDefenderDecisionModelV219(getter)); assert.equal(reads, 0);
});

const databasePath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_DECISION_V219_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_DECISION_V219_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_INITIAL_DEFENDER_DECISION_V219_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NID219-S01 accepts one normally derived decision and admits cut23 without preparing its next calibration', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeInitialDefenderDecisionInputV219; stringifyDebugRecord(value: unknown): string;
  };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec.stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  let count = 0;
  const emit = (name: string, value?: unknown) => { appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify({ index: ++count, name, at: new Date().toISOString() }) + '\n');
    if (value !== undefined) save('checkpoint-' + count + '-' + name + '.lossless.json', value); };
  try {
    const frontier = acceptNativeInitialDefenderDecisionV219(databasePath!, input, emit);
    assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut23:view');
    assert.equal(frontier.currentPhysicalOperation.record.operationOrdinal, 17); assert.equal(frontier.eventReferences.length, 23);
    assert.equal(Object.keys(frontier.resumePins).length, 27); assert.equal(frontier.calibrations.length, 0);
    assert.equal(frontier.initialDefenderDecisionAccepted, true); assert.equal(frontier.normalLifecycleAdvances, 1);
    assert(['hold', 'ball_handler'].includes(frontier.actionResult.calculation.selected.intent.kind));
    for (const value of [frontier.defensiveAiAccepted, frontier.movementAccepted, frontier.assignmentProven, frontier.legalOutcomeProven,
      frontier.officialTerminalProven, frontier.resumeReady, frontier.fullContinuationComplete, frontier.performancePass, frontier.wholeRngConsumptionProven]) assert.equal(value, false);
    save('frontier.lossless.json', frontier); save('summary.json', { pass: true, boundary: frontier.boundary,
      initialDefenderDecisionAccepted: true, normalLifecycleAdvances: 1, currentCalibrationCount: 0, performancePass: false, fullContinuationComplete: false });
  } catch (error) { save('failure.json', { pass: false, error: String((error as Error).stack ?? error) }); throw error; }
}, 885_000);
