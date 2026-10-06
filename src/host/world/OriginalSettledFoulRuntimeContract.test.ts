import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { deriveActualLiveRuntimeMembership } from './ActualLivePlayRuntime';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { nativeSettledFoulInputArchiveBytes } from './NativeSettledFoulPhysicalFixtures.test-support';
import { originalSettledFoulRuntimeFixture } from './ActualSettledFoulStopFixtures.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const proposed = 'causal_original_settled_foul_runtime_v1', legacy = 'causal_original_live_play_runtime_v1';
let directory: string, x: ReturnType<typeof originalSettledFoulRuntimeFixture> | undefined;
beforeEach(() => { x = undefined; directory = mkdtempSync(join(tmpdir(), 'foul-runtime-contract-'));
  x = originalSettledFoulRuntimeFixture(join(directory, 'world.sqlite')); });
afterEach(() => { x?.f.close(); x = undefined; if (directory) rmSync(directory, { recursive: true, force: true }); });
const originalMembership = () => deriveActualLiveRuntimeMembership(actualLivePlayEvidenceFromSqlite(x!.f.db).derive({
  sourceId: 'membership-proof', sourceVersion: 'explicit-test-v1', capability: 'actual_live_play_scope_v1',
  physicalPitchSourceId: x!.physical.source.sourceId, cut: { kind: 'original_pitch' },
}).scope);

it('registers the explicit foul capability before field work with all seventy original producers plus the owned stop domain', () => {
  const baseline = originalMembership();
  expect(baseline.producers).toHaveLength(70); expect(baseline.participants).toHaveLength(10);
  expect(x!.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
  const runtime = x!.register(proposed);
  expect(runtime.source).toEqual(x!.runtimeSource(proposed));
  expect(new Set(runtime.membership.producers.map(value => value.producerId)).size).toBe(71);
  expect(runtime.membership).toEqual({ ...baseline, version: 'original_settled_foul_membership_v1',
    liveRulePolicy: 'untouched_settled_foul_producer_only_v1', producers: [...baseline.producers, {
      producerId: JSON.stringify(['actual_settled_foul_stop_producer_v1', baseline.scopeId]), domain: 'settled_foul_stop', playerId: null,
    }] });
  expect(x!.inputArchiveBytes()).toBe(x!.beforePhysicalBytes);
  expect(x!.f.db.prepare('SELECT count(*) AS n FROM actual_live_play_admissions').get()!.n).toBe(0);
});
it('retains a genuine new-runtime foul, exact retry and immutable admissions across complete disk close and reopen', () => {
  const runtime = x!.register(proposed), foul = x!.advanceToFoul();
  const admissions = x!.f.db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all();
  expect(admissions.filter(row => row.owner === 'batted_world_field_actions').map(row => row.source_id))
    .toEqual(foul.fields.map(field => field.source.sourceId));
  expect(x!.runtimes.accept(runtime.source.sourceId)).toEqual(runtime);
  expect(x!.inputArchiveBytes()).toBe(x!.beforePhysicalBytes);
  expect(JSON.stringify(x!.f.official.getMatch('game-1'))).toBe(x!.originalMatchBytes);
  const file = x!.f.path, bytes = x!.inputArchiveBytes(), old = x!;
  old.f.close(); x = undefined;
  expect(() => old.f.db.prepare('SELECT 1').get()).toThrow();
  expect(() => old.runtimes.read(runtime.source.sourceId)).toThrow();
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    expect(actualLiveRuntimeEvidenceFromSqlite(db).read(runtime.source.sourceId)).toEqual(runtime);
    expect(db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all()).toEqual(admissions);
    expect(nativeSettledFoulInputArchiveBytes(db)).toBe(bytes);
  } finally { db.close(); }
}, 90_000);
it('freezes the accepted foul capability against later same-Source conversion to the legacy runtime', () => {
  const runtime = x!.register(proposed), bytes = JSON.stringify(x!.f.db.prepare('SELECT * FROM actual_live_play_runtimes').all());
  x!.runtimeSources.set(runtime.source.sourceId, x!.runtimeSource(legacy));
  expect(() => x!.runtimes.accept(runtime.source.sourceId)).toThrow(/frozen differently/);
  expect(JSON.stringify(x!.f.db.prepare('SELECT * FROM actual_live_play_runtimes').all())).toBe(bytes);
});
it('rejects late new-capability registration after the real original foul work', () => {
  x!.advanceToFoul();
  expect(() => x!.register(proposed)).toThrow(/registered before governed work/);
}, 90_000);
it('preserves exact legacy membership and admission of the same genuine original physical fixture', () => {
  const expected = originalMembership(), runtime = x!.register(legacy), foul = x!.advanceToFoul();
  expect(runtime.membership).toEqual(expected); expect(runtime.membership).not.toHaveProperty('version');
  expect(runtime.membership.producers).toHaveLength(70);
  expect(runtime.source).toEqual(x!.runtimeSource(legacy));
  expect(foul.physical.field.evidence.contacts.at(-1)!.contacts[0].kind).toBe('rolling_stop');
  expect(x!.inputArchiveBytes()).toBe(x!.beforePhysicalBytes);
}, 90_000);
it('preserves the legacy late-registration fence after actual original field work', () => {
  x!.advanceToFoul();
  expect(() => x!.register(legacy)).toThrow(/registered before governed work/);
}, 90_000);
