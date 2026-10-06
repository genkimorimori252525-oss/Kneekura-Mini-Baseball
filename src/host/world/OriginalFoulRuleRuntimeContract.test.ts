import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { deriveActualLiveRuntimeMembership, deriveOriginalSettledFoulRuntimeMembership } from './ActualLivePlayRuntime';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { originalSettledFoulRuntimeFixture } from './ActualSettledFoulStopFixtures.test-support';
import { originalFoulRuleFixture } from './ActualFoulRuleFixtures.test-support';
import type { AcceptedOriginalFoulRuleRuntime } from './ActualFoulRuleConsumption';

const capability = 'causal_original_settled_foul_count_runtime_v1';
let directory: string, x: ReturnType<typeof originalSettledFoulRuntimeFixture> | undefined;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'foul-rule-runtime-')); x = originalSettledFoulRuntimeFixture(join(directory, 'runtime.sqlite')); });
afterEach(() => { x?.f.close(); x = undefined; if (directory) rmSync(directory, { recursive: true, force: true }); });
const originalScope = () => actualLivePlayEvidenceFromSqlite(x!.f.db).derive({ sourceId: 'scope', sourceVersion: 'contract-v1',
  capability: 'actual_live_play_scope_v1', physicalPitchSourceId: x!.physical.source.sourceId, cut: { kind: 'original_pitch' } }).scope;
const proposed = (): AcceptedOriginalFoulRuleRuntime => ({ sourceId: 'foul-rule-runtime', sourceVersion: 'contract-v1', capability,
  physicalPitchSourceId: x!.physical.source.sourceId });
const register = () => { const source = proposed(); x!.runtimeSources.set(source.sourceId, source as never); return x!.runtimes.accept(source.sourceId); };

it('registers the explicit foul-count policy before field work without changing the seventy-one producer identities', () => {
  const producerMembership = deriveOriginalSettledFoulRuntimeMembership(originalScope());
  expect(x!.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
  const runtime = register();
  expect(runtime.source).toEqual(proposed());
  expect(runtime.membership).toEqual({ ...producerMembership, version: 'original_settled_foul_count_membership_v1',
    liveRulePolicy: 'untouched_settled_foul_count_consumption_v1' });
  expect(runtime.membership.producers).toHaveLength(71);
  expect(runtime.membership.producers.filter(p => p.domain === 'physical_rule_consumption')).toHaveLength(1);
  expect(x!.runtimes.accept(runtime.source.sourceId)).toEqual(runtime);
  expect(x!.f.db.prepare('SELECT * FROM actual_live_play_admissions').all()).toEqual([]);
  expect(x!.inputArchiveBytes()).toBe(x!.beforePhysicalBytes);
});
it('admits the existing exact stop producer under the explicitly registered count policy', () => {
  const y = originalFoulRuleFixture(join(directory, 'declared.sqlite'), 'ordinary_0');
  try {
    expect(y.production.basis).toEqual(y.countEvidence.basis);
    expect(y.production.successor.kind).toBe('foul_rule_evidence');
    expect(y.production.successor.status).toBe('pending');
    expect(y.countEvidence.battingIntent.intent).toMatchObject({ kind: 'declared', attempt: 'ordinary_swing' });
    expect(y.inputArchiveBytes()).toBe(y.beforePhysicalBytes);
    expect(JSON.stringify(y.f.official.getMatch('game-1'))).toBe(y.originalMatchBytes);
  } finally { y.f.close(); }
}, 90_000);
it('does not convert a frozen producer-only runtime into count authority', () => {
  const original = x!.register('causal_original_settled_foul_runtime_v1');
  const rows = JSON.stringify(x!.f.db.prepare('SELECT * FROM actual_live_play_runtimes').all());
  x!.runtimeSources.set(original.source.sourceId, { ...proposed(), sourceId: original.source.sourceId } as never);
  expect(() => x!.runtimes.accept(original.source.sourceId)).toThrow(/frozen differently/);
  expect(JSON.stringify(x!.f.db.prepare('SELECT * FROM actual_live_play_runtimes').all())).toBe(rows);
});
it('rejects count-policy registration after actual governed foul work', () => {
  x!.advanceToFoul();
  expect(register).toThrow(/registered before governed work/);
}, 90_000);
it('retains the existing producer-only capability and its exact policy bytes', () => {
  const expected = deriveOriginalSettledFoulRuntimeMembership(originalScope());
  expect(x!.register('causal_original_settled_foul_runtime_v1').membership).toEqual(expected);
});
it('retains the existing seventy-member legacy runtime unchanged', () => {
  const expected = deriveActualLiveRuntimeMembership(originalScope());
  expect(x!.register('causal_original_live_play_runtime_v1').membership).toEqual(expected);
  expect(expected.producers).toHaveLength(70);
});
