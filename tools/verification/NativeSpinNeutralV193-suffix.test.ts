import { createRequire } from 'node:module';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { expect, it } from 'vitest';
import { continueNativeSpinNeutralV193PostObservation } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { runNativeSpinNeutralV193RetainedSuffix } from './NativeSpinNeutralV193-suffix.test-support';

it('NSN193-S00 rejects missing Native post-observation owners before any new acceptance', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const ref = <O extends string>(owner: O, sourceId: string) => ({ owner, sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
  // A rejection fixture only; this object supplies no accepted Native evidence.
  const h = { f: { db } } as Parameters<typeof continueNativeSpinNeutralV193PostObservation>[0];
  try {
    const before = db.prepare('SELECT total_changes() n').get()!.n;
    expect(() => continueNativeSpinNeutralV193PostObservation(h, 'native-spin-neutral-v193:pitch3', {
      postureReference: ref('batting_observation_v1_postures', 'native-spin-neutral-v193:pitch3:posture'),
      intentReference: ref('batting_execution_v1_intents', 'native-spin-neutral-v193:pitch3:intent'),
      launchReference: ref('pa_physical_v1_launches', 'native-spin-neutral-v193:pitch3:launch'),
      captureCutReference: ref('pa_physical_v1_cuts', 'native-spin-neutral-v193:pitch3:capture-cut'),
      observationReference: ref('batting_observation_v1_observations', 'native-spin-neutral-v193:pitch3:capture'),
    })).toThrow(/physical|storage|namespace/i);
    expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before);
    expect(db.isTransaction).toBe(false);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { db.close(); }
});

const retainedPath = process.env.BASEBALL_NATIVE_SPIN_NEUTRAL_V193_SUFFIX_DATABASE;
const outputPath = process.env.BASEBALL_NATIVE_SPIN_NEUTRAL_V193_SUFFIX_OUTPUT;
it.skipIf(!retainedPath || !outputPath)('NSN193-S01 continues a genuine retained Native Gold2 capture through NO_SPIN_TARGET to actual contact', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const stringify = (createRequire(import.meta.url)('./live-debug-record.mjs') as { stringifyDebugRecord(value: unknown): string }).stringifyDebugRecord;
  const prior = process.report ? { directory: process.report.directory, reportOnFatalError: process.report.reportOnFatalError, excludeEnv: process.report.excludeEnv } : null;
  if (process.report) { process.report.directory = output; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
  let count = 0;
  const emit = (name: string, value?: unknown) => {
    const stage = { index: ++count, name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
    appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify(stage) + '\n');
    if (value !== undefined) writeFileSync(resolve(output, 'checkpoint-' + count + '-' + name + '.lossless.json'), stringify(value) + '\n', { flag: 'wx' });
  };
  try {
    const result = runNativeSpinNeutralV193RetainedSuffix(retainedPath!, emit);
    expect(result.summary.consumerAdoptionProven).toBe(true);
    expect(result.summary.actualContactCount).toBe(1);
    expect(result.summary.consumerTechniqueCount).toBe(2);
    expect(result.summary.ordinaryExecutionEqual).toBe(true);
    writeFileSync(resolve(output, 'actual-native-records.lossless.json'), stringify(result.records) + '\n', { flag: 'wx' });
    writeFileSync(resolve(output, 'summary.json'), JSON.stringify({ pass: true, ...result.summary }) + '\n', { flag: 'wx' });
  } catch (error) {
    writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ pass: false, error: String((error as Error).stack ?? error) }) + '\n', { flag: 'wx' });
    throw error;
  } finally { if (process.report && prior) Object.assign(process.report, prior); }
}, 600_000);
