import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { deriveActualLiveRuntimeMembership, deriveOriginalSettledFoulRuntimeMembership,
  deriveOriginalSettledFoulCountRuntimeMembership } from './ActualLivePlayRuntime';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { originalSettledFoulRuntimeFixture } from './ActualSettledFoulStopFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteActualSettledFoulStopProducerStore } from './SqliteActualSettledFoulStopProducerStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite, openSqliteActualFoulRuleConsumptionStore } from './SqliteActualFoulRuleConsumptionStore';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';

const endCapability = 'causal_original_settled_foul_end_runtime_v1';
const oldCapabilities = ['causal_original_live_play_runtime_v1', 'causal_original_settled_foul_runtime_v1',
  'causal_original_settled_foul_count_runtime_v1'] as const;
let directory: string, fixture: ReturnType<typeof originalSettledFoulRuntimeFixture> | undefined;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'foul-end-runtime-'));
  fixture = originalSettledFoulRuntimeFixture(join(directory, 'runtime.sqlite')); }, 60_000);
afterEach(() => { fixture?.f.close(); fixture = undefined; if (directory) rmSync(directory, { recursive: true, force: true }); });
const current = () => { if (!fixture) throw new Error('original foul runtime fixture unavailable'); return fixture; };
const scope = () => { const x = current(); return actualLivePlayEvidenceFromSqlite(x.f.db).derive({ sourceId: 'original-foul-end-scope',
  sourceVersion: 'contract-v1', capability: 'actual_live_play_scope_v1', physicalPitchSourceId: x.physical.source.sourceId,
  cut: { kind: 'original_pitch' } }).scope; };
const logicalBytes = (excludeRuntime = false) => {
  const db = current().f.db;
  return json(db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
    .filter(row => !excludeRuntime || row.name !== 'actual_live_play_runtimes')
    .map(row => ({ table: row.name, rows: db.prepare('SELECT * FROM main."' + String(row.name).replaceAll('"', '""') + '"').all() })));
};
const source = () => ({ sourceId: 'original-foul-end-runtime', sourceVersion: 'contract-v1', capability: endCapability,
  physicalPitchSourceId: current().physical.source.sourceId });
const register = () => { const x = current(), proposed = source();
  // The accepted parser must first demonstrate its actual missing-capability
  // rejection. This test-only cast does not extend the production input union.
  x.runtimeSources.set(proposed.sourceId, proposed as never); return x.runtimes.accept(proposed.sourceId); };

it('registers an explicit original-foul end policy before field work with the same seventy-one producer identities', () => {
  const x = current(), originalScope = scope(), countMembership = deriveOriginalSettledFoulCountRuntimeMembership(originalScope);
  expect(x.physical.frame.match.ruleProfileId).toBe('npb-2026');
  expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
  const before = logicalBytes(true), runtime = register();
  expect(runtime.source).toEqual(source());
  expect(runtime.membership).toEqual({ ...countMembership, version: 'original_settled_foul_end_membership_v1',
    liveRulePolicy: 'untouched_settled_foul_end_v1' });
  expect(runtime.membership.producers).toEqual(countMembership.producers);
  expect(runtime.membership.producers).toHaveLength(71); expect(runtime.membership.participants).toHaveLength(10);
  expect(runtime.membership.producers.filter(p => p.domain === 'settled_foul_stop')).toHaveLength(1);
  expect(runtime.membership.producers.filter(p => p.domain === 'closure_fence')).toHaveLength(1);
  expect(runtime.membership.producers.filter(p => p.domain === 'event_generation_consumption')).toHaveLength(1);
  expect(x.f.db.prepare('SELECT * FROM actual_live_play_admissions').all()).toEqual([]);
  expect(logicalBytes(true)).toBe(before);
  const saved = logicalBytes(); expect(x.runtimes.read(runtime.source.sourceId)).toEqual(runtime);
  expect(x.runtimes.accept(runtime.source.sourceId)).toEqual(runtime); expect(logicalBytes()).toBe(saved);
  expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
  expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
  for (const key of ['playEnd', 'physicalEnd', 'officialClosure', 'actorSettlement', 'samePaResume']) expect(runtime).not.toHaveProperty(key);
}, 30_000);

it.each(oldCapabilities)('retains the exact %s membership and policy bytes', capability => {
  const x = current(), originalScope = scope();
  const expected = capability === 'causal_original_live_play_runtime_v1' ? deriveActualLiveRuntimeMembership(originalScope)
    : capability === 'causal_original_settled_foul_runtime_v1' ? deriveOriginalSettledFoulRuntimeMembership(originalScope)
      : deriveOriginalSettledFoulCountRuntimeMembership(originalScope);
  const before = logicalBytes(true), runtime = x.register(capability);
  expect(runtime.membership).toEqual(expected);
  expect(runtime.membership.producers).toHaveLength(capability === 'causal_original_live_play_runtime_v1' ? 70 : 71);
  expect(logicalBytes(true)).toBe(before); const saved = logicalBytes();
  expect(x.runtimes.read(runtime.source.sourceId)).toEqual(runtime);
  expect(x.runtimes.accept(runtime.source.sourceId)).toEqual(runtime); expect(logicalBytes()).toBe(saved);
}, 30_000);

it.each(oldCapabilities)('rejects same-ID conversion from %s into end authority without writes', capability => {
  const x = current(), original = x.register(capability), before = logicalBytes();
  x.runtimeSources.set(original.source.sourceId, { ...original.source, capability: endCapability } as never);
  try { expect(() => x.runtimes.accept(original.source.sourceId)).toThrow(/frozen differently/);
    expect(logicalBytes()).toBe(before); }
  finally { x.runtimeSources.set(original.source.sourceId, original.source); }
  expect(x.runtimes.read(original.source.sourceId)).toEqual(original);
  expect(x.runtimes.accept(original.source.sourceId)).toEqual(original); expect(logicalBytes()).toBe(before);
}, 30_000);

it('rejects end-policy registration after genuine original foul field work without writes', () => {
  const x = current(); x.advanceToFoul(); const before = logicalBytes();
  expect(register).toThrow(/registered before governed work/);
  expect(logicalBytes()).toBe(before); expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
  expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
}, 90_000);

it('admits the existing original stop and count owners under the enrolled end policy while physical end stays pending', () => {
  const x = current(), runtime = register(), foul = x.advanceToFoul(), policy = x.acceptPolicy(foul.first);
  const stopSource = { sourceId: 'end-policy-original-stop', sourceVersion: 'contract-v1',
    capability: 'actual_original_settled_foul_stop_producer_v1' as const, physicalPitchSourceId: x.physical.source.sourceId,
    runtimeSourceId: runtime.source.sourceId, policySourceId: policy.policy.source.sourceId,
    baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null };
  const producer = x.f.track(openSqliteActualSettledFoulStopProducerStore(x.f.path, {
    readAcceptedProduction: id => id === stopSource.sourceId ? stopSource : null,
  }));
  const production = producer.accept(stopSource.sourceId);
  const countSource = { sourceId: 'end-policy-original-count', sourceVersion: 'contract-v1',
    capability: 'actual_original_settled_foul_rule_consumption_v1' as const, runtimeSourceId: runtime.source.sourceId,
    stopProductionSourceId: production.source.sourceId };
  const consumer = x.f.track(openSqliteActualFoulRuleConsumptionStore(x.f.path, {
    readAcceptedConsumption: id => id === countSource.sourceId ? countSource : null,
  }));
  const runtimeReader = actualLiveRuntimeEvidenceFromSqlite(x.f.db), before = runtimeReader.admissions(runtime);
  const count = consumer.accept(countSource.sourceId), after = runtimeReader.admissions(runtime);
  expect(count.runtimeReference.snapshotHash).toBe(hash(runtime));
  expect(count.producerReference.snapshotHash).toBe(hash(production)); expect(count.countEvidence.basis).toEqual(production.basis);
  expect(count.consumption).toMatchObject({ eventKey: production.event.eventKey,
    successorKey: production.successor.successorKey, status: 'consumed' });
  expect(after.slice(0, -1)).toEqual(before);
  expect(after.slice(-2).map(row => row.owner)).toEqual(['actual_settled_foul_stop_productions', 'actual_foul_rule_consumptions']);
  expect(after.at(-1)).toMatchObject({ sourceId: countSource.sourceId, sourceHash: hash(countSource), snapshotHash: hash(count) });
  expect(count.successor.status).toBe('pending');
  const census = actualFoulRuleConsumptionEvidenceFromSqlite(x.f.db).census({ version: 'actual_foul_rule_consumers_v1',
    runtimeSourceId: runtime.source.sourceId, cut: { kind: 'field_execution', baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null } });
  expect(census.acceptedConsumptions).toEqual([count]); expect(census.generation).toBe('event_generation_coverage_pending');
  expect(census.physicalEnd).toBeNull(); expect(census.officialClosure).toBeNull(); expect(census.samePaResume).toBeNull();
  const bytes = logicalBytes(); expect(producer.accept(stopSource.sourceId)).toEqual(production);
  expect(consumer.read(countSource.sourceId)).toEqual(count); expect(consumer.accept(countSource.sourceId)).toEqual(count);
  expect(logicalBytes()).toBe(bytes); expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
  expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
}, 120_000);
