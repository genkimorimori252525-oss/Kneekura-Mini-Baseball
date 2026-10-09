import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it } from 'vitest';
import * as ts from 'typescript';
import { beginFieldDiagnostic, endFieldDiagnostic, fieldDiagnosticPhase, fieldDiagnosticInput, fieldDiagnosticCoreInput } from './BattedFieldDiagnosticTrace.test-support';
import { instrumentFieldDiagnostic } from './BattedFieldDiagnosticTransform.test-support';
import { fieldDiagnosticTargets, fieldDiagnosticPlugin } from './BattedFieldDiagnosticPlugin.test-support';
import { battedWorldFieldSourceRootIdentity } from './BattedWorldFieldRoot';

const directories: string[] = []; let active = false;
const trace = (maxEvents = 6000) => {
  const directory = mkdtempSync(join(tmpdir(), 'field-diagnostic-contract-')); directories.push(directory);
  const path = join(directory, 'events.jsonl'); beginFieldDiagnostic(path, { test: true }, maxEvents); active = true; return path;
};
const finish = () => { const value = endFieldDiagnostic(); active = false; return value; };
const events = (path: string) => readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line));
afterEach(() => { if (active) finish(); for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
const load = (source: string) => {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, (input: any) => unknown> = {};
  runInNewContext(output, { exports, require: (name: string) => {
    expect(name).toBe('probe'); return { fieldDiagnosticPhase, fieldDiagnosticInput, fieldDiagnosticCoreInput };
  } });
  return exports;
};
it('preserves original block and expression results and executes each body once', () => {
  const path = trace(), code = `export const block = (input: any) => { input.calls++; return input.value; };
    export const expression = (input: any) => (input.calls++, input.value);`;
  const target = load(instrumentFieldDiagnostic(code, 'fixture.ts', 'probe', [
    { variable: 'block', label: 'block', metadata: '({tag:input.tag})' }, { variable: 'expression', label: 'expression', metadata: '({})' }]));
  const value = {}, input = { calls: 0, value, tag: 'actual' };
  expect(target.block(input)).toBe(value); expect(target.expression(input)).toBe(value); expect(input.calls).toBe(2);
  const result = finish(); expect(result.counts).toEqual({ block: 1, expression: 1 });
  expect(events(path).filter(e => e.event === 'return')).toHaveLength(2);
});
it('rethrows the identical original error after the original finally block', () => {
  const path = trace(), code = 'export const target = (input: any) => { try { throw input.error; } finally { input.calls++; } };';
  const target = load(instrumentFieldDiagnostic(code, 'fixture.ts', 'probe', [{ variable: 'target', label: 'throwing', metadata: '({})' }]));
  const error = new Error('actual owner error'), input = { error, calls: 0 }; let caught: unknown;
  try { target.target(input); } catch (value) { caught = value; }
  expect(caught).toBe(error); expect(input.calls).toBe(1); finish();
  expect(events(path).find(e => e.event === 'throw').error).toBe(error.message);
});
it('keeps metadata failure observational and leaves inactive calls untouched', () => {
  let calls = 0; const value = {};
  expect(fieldDiagnosticPhase('inactive', () => { throw new Error('must not run'); }, () => { calls++; return value; })).toBe(value);
  const path = trace();
  expect(fieldDiagnosticPhase('active', () => { throw new Error('metadata only'); }, () => { calls++; return value; })).toBe(value);
  expect(calls).toBe(2); finish(); expect(events(path).find(e => e.event === 'begin').metadata.metadataError).toBe('metadata only');
});
it('preserves thrown identity even when error metadata itself throws', () => {
  trace(); const error = Object.defineProperty(new Error(), 'message', { get() { throw new Error('metadata getter'); } });
  let caught: unknown; try { fieldDiagnosticPhase('opaque-error', () => ({}), () => { throw error; }); } catch (value) { caught = value; }
  expect(caught).toBe(error); finish();
});
it('bounds durable span events and still calls every original body', () => {
  const path = trace(1); let calls = 0;
  for (let i = 0; i < 10; i++) fieldDiagnosticPhase('bounded', () => ({}), () => { calls++; });
  const result = finish(); expect(calls).toBe(10); expect(result.counts.bounded).toBe(10); expect(result.suppressed).toBe(true);
  expect(events(path)).toHaveLength(5); expect(events(path).filter(e => e.event === 'event-budget-summary')).toHaveLength(1);
});
it('records the actual two-millisecond Core duration and exact-time alternatives', () => {
  const raw = { moment: { originTick: 35_470_251, elapsedSeconds: 0, ball: { tick: 35_470_251 } }, throughTick: 35_472_251,
    parameters: { ticksPerSecond: 1_000_000 }, actors: Array.from({ length: 50 }, () => ({})) };
  expect(fieldDiagnosticCoreInput(raw)).toMatchObject({ originTick: 35_470_251, throughTick: 35_472_251,
    effectiveHorizonSeconds: 0.002, coreDurationSeconds: 0.002, actorCount: 50 });
  expect(fieldDiagnosticCoreInput(raw, { throughElapsedSeconds: 0.002 }).coreDurationSeconds).toBe(0.002);
  expect(fieldDiagnosticCoreInput(raw, undefined, 0.002).coreDurationSeconds).toBe(0.002);
});
it('rejects missing duplicate asynchronous and colliding instrumentation targets', () => {
  const target = [{ variable: 'target', label: 'target', metadata: '({})' }];
  expect(() => instrumentFieldDiagnostic('const other = () => 1;', 'fixture.ts', 'probe', target)).toThrow('diagnostic target count differs');
  expect(() => instrumentFieldDiagnostic('const target = () => 1; function nested() { const target = () => 2; }', 'fixture.ts', 'probe', target)).toThrow('diagnostic target count differs');
  expect(() => instrumentFieldDiagnostic('const target = async () => 1;', 'fixture.ts', 'probe', target)).toThrow('asynchronous diagnostic target');
  expect(() => instrumentFieldDiagnostic('const __epbDiagnosticInput = 1;', 'fixture.ts', 'probe', [])).toThrow('diagnostic import collision');
});
it('resolves every exact production target and emits syntactically valid TypeScript', () => {
  const root = process.cwd(), plugin = fieldDiagnosticPlugin(root);
  for (const [file, targets] of Object.entries(fieldDiagnosticTargets)) {
    const path = resolve(root, file), before = readFileSync(path, 'utf8'), transformed = plugin.transform(before, path); expect(transformed).not.toBeNull();
    const parsed = ts.createSourceFile(path, transformed!.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect((parsed as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics).toEqual([]);
    expect(transformed!.code.match(/__epbDiagnosticPhase\(/g)).toHaveLength(targets.length);
    expect(readFileSync(path, 'utf8')).toBe(before);
  }
  expect(plugin.transform('const unrelated = 1;', resolve(root, 'src/unrelated.ts'))).toBeNull();
});
it('loads the actual production graph and preserves explicit v2 Source discrimination', () => {
  expect(battedWorldFieldSourceRootIdentity({ responseSourceId: 'response', geometrySourceId: 'geometry',
    episodeFieldBinding: { version: 'batted_episode_field_binding_v2', sourceId: 'binding' } })).toBe('["episode_field_binding_v2","binding"]');
  expect(() => battedWorldFieldSourceRootIdentity({ responseSourceId: 'response', geometrySourceId: 'geometry',
    episodeFieldBinding: { version: 'unknown', sourceId: 'binding' } } as never)).toThrow('invalid episode field binding opt-in');
});
