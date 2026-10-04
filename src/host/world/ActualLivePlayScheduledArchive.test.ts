import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
const archive = await import('./ActualLivePlayArchive').catch(() => null);
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableActualLivePlayScope } from './ActualLivePlayScope';
import type { DurableActualLivePlayQueue } from './SqliteActualLivePlayQueueStore';
import { actualLiveEventKey, actualLiveSuccessorKey } from './ActualLivePlayQueueEvidenceFromSqlite';

// Synthetic inert codec fixtures only. Domain validity and Native reconstruction
// are separate gates; these records never claim admission to a physical owner.
const scope = (count = 40): DurableActualLivePlayScope => {
  const at = { originTick: 0, elapsedSeconds: 1, tick: 1 };
  const source = { sourceId: 'scope', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1', physicalPitchSourceId: 'pitch',
    cut: { kind: 'field_execution', baseFieldSourceId: 'field', executionSourceId: `step-${count}` } };
  const physicalReferences = Array.from({ length: count }, (_, i) => ({ owner: 'batted_world_field_executions', sourceId: `step-${i + 1}`, hash: `physical-${i + 1}` }));
  const physicalLocalHistory = physicalReferences.map((r, i) => ({ owner: r.owner, sourceId: r.sourceId, revision: i + 1,
    work: { version: 'owned_scheduled_motion_live_work_v1', executionSourceId: r.sourceId, executionRevision: i + 1, physicalPitchSourceId: 'pitch',
      at, sourceCoverage: 'explicit_known_sources_only', queue: null, contributors: [{ synthetic: Array.from({ length: 3000 }, (_, i) => i) }],
      pendingDecisionHandoffs: [], unresolvedSuccessor: null, operation: null } }));
  return { source, revision: 1, history: [source], scope: { version: 'actual_live_play_scope_v1', scopeId: 'scope-id',
    physicalPitchSourceId: 'pitch', cut: source.cut, at, physicalReferences }, physicalLocalHistory } as unknown as DurableActualLivePlayScope;
};
const queue = (value = scope()): DurableActualLivePlayQueue => {
  const source = { ...value.source, capability: 'actual_live_play_queue_v1' };
  return { source, revision: 1, history: [source], ownershipKey: json(['actual_live_play_queue_v1', source.sourceId]), queue: {
    version: 'actual_live_play_queue_evidence_v1', scope: value, coverage: 'represented_sources_only', generation: 'event_generation_coverage_pending',
    closureFence: 'not_installed', playEnd: null,
    represented: value.physicalLocalHistory.map((v, i) => ({ owner: { owner: v.owner, sourceId: v.sourceId, snapshotHash: value.scope.physicalReferences[i].hash }, localWork: v.work })),
    events: [], successors: [], consumptions: [] } } as unknown as DurableActualLivePlayQueue;
};
const mutable = (value: unknown) => value as Record<string, any>;
it('encodes long owned local histories by independently bounded records without raising generic limits', () => {
  expect(archive, 'owner-specific live archive codec').not.toBeNull();
  const value = scope(); expect(() => json(value)).toThrow(/size limits/);
  const encoded = archive!.actualLivePlayScopeArchiveEncoding(value), wire = JSON.parse(encoded.json);
  expect(wire.snapshotFormat).toBe('actual_live_play_scope_manifest_v1');
  expect(wire.source).toEqual(value.source); expect(wire.history).toEqual(value.history); expect(wire.scope).toEqual(value.scope);
  expect(wire.physicalLocalHistory).toEqual(value.physicalLocalHistory.map(v => ({ owner: v.owner, sourceId: v.sourceId, revision: v.revision, workHash: hash(v.work) })));
  expect(encoded.hash).toBe(createHash('sha256').update(encoded.json).digest('hex'));
  expect(() => json(value)).toThrow(/size limits/);
});
it('preserves every legacy and v1-only JSON/hash byte, including empty physical cuts', () => {
  for (const count of [0, 1]) {
    const value = scope(count);
    for (const entry of value.physicalLocalHistory) mutable(entry).work = { version: 'owned_motion_live_work_v1', retained: [1, 2, 3] };
    const checkpoint = queue(value);
    expect(archive!.actualLivePlayScopeArchiveEncoding(value)).toEqual({ json: json(value), hash: hash(value) });
    expect(archive!.actualLivePlayQueueArchiveEncoding(checkpoint)).toEqual({ json: json(checkpoint), hash: hash(checkpoint) });
  }
});
it('binds queue represented work to the embedded scope and preserves explicit projection ownership', () => {
  const value = queue(), encoded = archive!.actualLivePlayQueueArchiveEncoding(value), wire = JSON.parse(encoded.json);
  expect(wire.snapshotFormat).toBe('actual_live_play_queue_manifest_v1');
  expect(wire.queue.scope.source).toEqual({ ...value.source, capability: 'actual_live_play_scope_v1' });
  expect(wire.queue.scope.snapshotFormat).toBe('actual_live_play_scope_manifest_v1');
  expect(wire.queue.scope).not.toHaveProperty('scopeRowReference');
  expect(wire.queue.represented[0]).toEqual({ owner: value.queue.represented[0].owner, localWorkHash: hash(value.queue.represented[0].localWork) });
  expect(encoded.hash).toBe(createHash('sha256').update(encoded.json).digest('hex'));
  mutable(value.queue.represented[0]).localWork = { changed: true };
  expect(() => archive!.actualLivePlayQueueArchiveEncoding(value)).toThrow(/work|identity|archive/);
});
it('rejects mismatched scheduled identities, physical refs, ordering, duplicate owners and active descriptors', () => {
  for (const change of [
    (v: any) => v.physicalLocalHistory[0].work.executionSourceId = 'foreign',
    (v: any) => v.physicalLocalHistory[0].work.executionRevision = 99,
    (v: any) => v.physicalLocalHistory[0].work.physicalPitchSourceId = 'foreign',
    (v: any) => v.physicalLocalHistory[0].work.extra = true,
    (v: any) => v.physicalLocalHistory[0].sourceId = 'missing',
    (v: any) => v.physicalLocalHistory.reverse(),
    (v: any) => v.physicalLocalHistory.push(v.physicalLocalHistory[0]),
    (v: any) => v.scope.physicalReferences.push(v.scope.physicalReferences[0]),
  ]) {
    const value = scope(2); change(value); expect(() => archive!.actualLivePlayScopeArchiveEncoding(value)).toThrow();
  }
  let called = false;
  const value = scope(1); Object.defineProperty(value.physicalLocalHistory[0], 'work', { enumerable: true, get() { called = true; return {}; } });
  expect(() => archive!.actualLivePlayScopeArchiveEncoding(value)).toThrow(); expect(called).toBe(false);
});
it('binds physical event owners, exact moments and successor bases without consuming their work', () => {
  const value = queue(scope(1)), q = mutable(value.queue), owner = q.represented[0].owner;
  const eventKey = actualLiveEventKey(owner.owner, owner.sourceId, 'event'), at = { originTick: 0, elapsedSeconds: 1, tick: 1 };
  q.events = [{ eventKey, eventId: 'event', kind: 'acquisition_confirmed', owner, occurredAt: at, availableAt: at, originalReceipt: { eventId: 'event' } }];
  q.successors = [{ successorKey: actualLiveSuccessorKey(owner.owner, owner.sourceId, 'rule'), basisEventKey: eventKey,
    kind: 'rule_evidence', owner, localSourceId: 'rule', status: 'pending', originalHandoff: { basisEventId: 'event' } }];
  q.consumptions = [{ eventKey, consumerKind: 'physical_execution', consumer: owner, availableAt: at, status: 'consumed', successorKey: null }];
  const encoded = archive!.actualLivePlayQueueArchiveEncoding(value), wire = JSON.parse(encoded.json);
  expect(wire.queue.events[0].receiptHash).toBe(hash(q.events[0].originalReceipt));
  expect(wire.queue.successors[0].handoffHash).toBe(hash(q.successors[0].originalHandoff));
  expect(wire.queue.successors[0].status).toBe('pending'); expect(wire.queue.consumptions).toEqual(q.consumptions);
  q.events[0].owner = { ...owner, snapshotHash: 'wrong' }; expect(() => archive!.actualLivePlayQueueArchiveEncoding(value)).toThrow();
  q.events[0].owner = owner; q.successors[0].basisEventKey = 'missing'; expect(() => archive!.actualLivePlayQueueArchiveEncoding(value)).toThrow();
});
it.each(['duplicate owner', 'future event', 'early consumer', 'future consumer'] as const)('rejects %s outside the represented cut', change => {
  const value = queue(scope(1)), q = mutable(value.queue), owner = q.represented[0].owner;
  const eventKey = actualLiveEventKey(owner.owner, owner.sourceId, 'event'), at = { originTick: 0, elapsedSeconds: 1, tick: 1 };
  q.events = [{ eventKey, eventId: 'event', kind: 'acquisition_confirmed', owner, occurredAt: at, availableAt: at, originalReceipt: { eventId: 'event' } }];
  q.consumptions = [{ eventKey, consumerKind: 'physical_execution', consumer: owner, availableAt: at, status: 'consumed', successorKey: null }];
  if (change === 'duplicate owner') q.represented.push(q.represented[0]);
  else if (change === 'future event') q.events[0].availableAt = { ...at, elapsedSeconds: 2 };
  else q.consumptions[0].availableAt = { ...at, elapsedSeconds: change === 'early consumer' ? .5 : 2 };
  expect(() => archive!.actualLivePlayQueueArchiveEncoding(value)).toThrow();
});
