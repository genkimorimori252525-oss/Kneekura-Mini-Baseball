import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';

test('V210 opt-in hooks reverse exactly to the separately retained pre-edit bytes', () => {
  const path = 'tools/verification/native-post-input-resolution-v210.ts';
  let source = readFileSync(path, 'utf8');
  const replacements: readonly (readonly [string, string])[] = [
    ["export type NativePostInputResolutionV210Hooks = Readonly<{\n  prepareCommitment: NonNullable<NonNullable<Parameters<typeof continueNativeSpinNeutralV193PostDelivery>[3]>['prepareCommitment']>;\n  verifyCommitment: (commitment: Extract<ReturnType<typeof readSamePaPhysicalOperationFromSqlite>['record'], { kind: 'same_pa_physical_commitment_v1' }>) => void;\n}>;\n", ''],
    ['emit: (name: string, value?: unknown) => void, hooks?: NativePostInputResolutionV210Hooks) {', 'emit: (name: string, value?: unknown) => void) {'],
    ['      if (hooks) hooks.verifyCommitment(commitment);\n      else {\n', ''],
    ["      assert.equal(commitment.source.spinBindingV123.intent.technique, 'NO_SPIN_TARGET');\n      }", "      assert.equal(commitment.source.spinBindingV123.intent.technique, 'NO_SPIN_TARGET');"],
    ['      prepareCommitment(source, executionInput) { if (hooks) return hooks.prepareCommitment(source, executionInput);\n        const { buntProfileBinding: _bunt, ...ordinary } = source;', '      prepareCommitment(source, executionInput) { const { buntProfileBinding: _bunt, ...ordinary } = source;'],
  ];
  for (const [updated, original] of replacements) { expect(source.split(updated)).toHaveLength(2); source = source.replace(updated, original); }
  expect(Buffer.from(source)).toEqual(readFileSync('work/v226-v210-baseline-c99b122e/worktree.ts'));
  expect(readFileSync('work/v226-v210-baseline-c99b122e/worktree.ts')).toEqual(readFileSync('work/v226-v210-baseline-c99b122e/git-parent.ts'));
});

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { classifyObservedSpinDirectionV226, originalBindingSourcesV226, runNativeObservedSpinAimTrialV226 } from './native-observed-spin-aim-trial-v226';
import { observeBattedBallSpinV123 } from '../../src/core/sim/contact/BattedBallSpinObservationV123';
import type { NativePostInputResolutionV210Input } from './native-post-input-resolution-v210';
const db = process.env.BASEBALL_V226_DATABASE, inputPath = process.env.BASEBALL_V226_INPUT, outputPath = process.env.BASEBALL_V226_OUTPUT;
test.skipIf(!db || !inputPath || !outputPath)('V226 actual trial on an owned copy only', () => {
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as { parseDebugRecord(value: string): { input: NativePostInputResolutionV210Input }; stringifyDebugRecord(value: unknown): string };
  const { input } = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec.stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  let index = 0;
  const emit = (name: string, value: unknown) => { const n = ++index; save('stage-' + n + '-' + name + '.lossless.json', value);
    appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify({ index: n, name }) + '\n'); };
  try { const result = runNativeObservedSpinAimTrialV226(db!, input, emit); save('result.lossless.json', result); }
  catch (error) { save('failure.json', { error: String((error as Error).stack ?? error) }); throw error; }
}, 480_000);

import { mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
test('V226 preflight rejects a missing freeze and records failure before opening a database', () => {
  const parent = mkdtempSync(resolve('work/v226-preflight-'));
  const out = join(parent, 'output');
  const child = spawnSync(process.execPath, ['tools/verification/check-native-observed-spin-aim-trial-v226.mjs', out, join(parent, 'missing-freeze.json')], { encoding: 'utf8' });
  expect(child.status).not.toBe(0);
  const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
  expect(report.pass).toBe(false); expect(report.originalDatabaseOpened).toBe(false);
  expect(report.phase).toBe('PREFLIGHT_OR_UNHANDLED_FAILURE');
});

test('V226 direction labels use the existing local flight basis', () => {
  const observe = (velocityMps: { x: number; y: number; z: number }, spinRadPerSecond: { x: number; y: number; z: number }) => observeBattedBallSpinV123({ velocityMps, spinRadPerSecond, bats: 'R' });
  const forward = { x: 0, y: 0, z: 10 };
  expect(classifyObservedSpinDirectionV226(null)).toBe('NO_CONTACT');
  expect(classifyObservedSpinDirectionV226(observe(forward, { x: 1, y: 0, z: 0 }))).toBe('TOPSPIN');
  expect(classifyObservedSpinDirectionV226(observe(forward, { x: -1, y: 0, z: 0 }))).toBe('REVERSE_BACKSPIN');
  expect(classifyObservedSpinDirectionV226(observe(forward, { x: 0, y: 0, z: 0 }))).toBe('ZERO_COMPONENT');
  expect(classifyObservedSpinDirectionV226(observe({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }))).toBe('UNCLASSIFIED');
});

test('V226 source reader seam needs actor and mastery refs but no prior resolution', () => {
  const ref = { owner: 'physical_plate_appearance_actors' as const, sourceId: 'actor', sourceHash: 'a', snapshotHash: 'b' };
  const mastery = { owner: 'world_spin_mastery_v123' as const, sourceId: 'mastery', sourceHash: 'c', snapshotHash: 'd' };
  const calls: string[] = [];
  expect(() => originalBindingSourcesV226({ actorReference: ref, qualificationReferences: [mastery] }, {
    actor: id => { calls.push('actor:' + id); return null; },
    mastery: id => { calls.push('mastery:' + id); return null; },
    evidence: () => { throw Error('unexpected evidence reader'); },
  })).toThrow('V226 original actor missing');
  expect(calls).toEqual(['actor:actor']);
});
