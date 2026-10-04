import { createHash } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DurableActualLivePlayScope } from './ActualLivePlayScope';
import type { DurableActualLivePlayQueue } from './SqliteActualLivePlayQueueStore';
import { actorJson, actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Reconstructed concrete-owner codecs. Only freshly rederived scheduled local
 * work selects these manifests. Generic inert limits and all legacy bytes remain. */
function fail(): never { throw new Error('actual live archive shape, work or ownership identity differs'); }
const id = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
const object = (value: unknown, keys?: readonly string[]): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail();
  const names = Reflect.ownKeys(value);
  if (keys && (names.length !== keys.length || keys.some(key => !names.includes(key)))) fail();
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of names) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !d || !d.enumerable || !('value' in d)) fail();
    result[key] = d.value;
  }
  return result;
};
const array = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value) || value.length > 100_000 || Reflect.ownKeys(value).length !== value.length + 1) fail();
  return Array.from({ length: value.length }, (_, index) => {
    const d = Object.getOwnPropertyDescriptor(value, String(index));
    if (!d || !d.enumerable || !('value' in d)) fail();
    return d.value as unknown;
  });
};
// Canonicalization is private and receives only per-record cloneInert-validated
// values or newly assembled manifests. It is never a general raw-input encoder.
const canonical = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const encode = (value: unknown) => { const json = canonical(value); return { json, hash: createHash('sha256').update(json).digest('hex') }; };
const legacy = (value: unknown) => { const json = actorJson(value); return { json, hash: createHash('sha256').update(json).digest('hex') }; };
const key = (owner: unknown, sourceId: unknown) => actorJson([owner, sourceId]);
const moment = (raw: unknown) => {
  const m = object(cloneInert(raw), ['originTick', 'elapsedSeconds', 'tick']);
  if (!Number.isSafeInteger(m.originTick) || (m.originTick as number) < 0 || !Number.isSafeInteger(m.tick) || (m.tick as number) < 0
    || typeof m.elapsedSeconds !== 'number' || !Number.isFinite(m.elapsedSeconds) || m.elapsedSeconds < 0) fail();
  return m as { originTick: number; elapsedSeconds: number; tick: number };
};
const scopeProjection = (value: DurableActualLivePlayScope) => {
  const raw = object(value, ['source', 'revision', 'history', 'scope', 'physicalLocalHistory']);
  const locals = array(raw.physicalLocalHistory).map(v => {
    const local = object(v, ['owner', 'sourceId', 'revision', 'work']);
    const work = object(local.work); // Detect active descriptors before inspecting version.
    return { local, work };
  });
  if (!locals.some(v => v.work.version === 'owned_scheduled_motion_live_work_v1')) return null;
  const source = cloneInert(raw.source) as DurableActualLivePlayScope['source'];
  const history = array(raw.history).map(v => cloneInert(v)), scope = cloneInert(raw.scope) as DurableActualLivePlayScope['scope'];
  if (raw.revision !== 1 || history.length !== 1 || actorJson(history[0]) !== actorJson(source)
    || source.capability !== 'actual_live_play_scope_v1' || scope.version !== 'actual_live_play_scope_v1'
    || !id(source.sourceId) || !id(source.sourceVersion) || !id(scope.scopeId) || !id(source.physicalPitchSourceId)
    || scope.physicalPitchSourceId !== source.physicalPitchSourceId || actorJson(scope.cut) !== actorJson(source.cut)) fail();
  const physical = new Map<string, { hash: string; index: number }>();
  for (const [index, r] of scope.physicalReferences.entries()) {
    object(r, ['owner', 'sourceId', 'hash']);
    const identity = key(r.owner, r.sourceId);
    if (!['batted_world_contacts', 'batted_world_field_actions', 'batted_world_field_executions'].includes(r.owner)
      || !id(r.sourceId) || !id(r.hash) || physical.has(identity)) fail();
    physical.set(identity, { hash: r.hash, index });
  }
  const localHashes = new Map<string, string>(); let lastIndex = -1, lastRevision = 0;
  const physicalLocalHistory = locals.map(({ local, work }) => {
    const identity = key(local.owner, local.sourceId), ref = physical.get(identity);
    if (local.owner !== 'batted_world_field_executions' || !id(local.sourceId) || !Number.isSafeInteger(local.revision)
      || (local.revision as number) <= lastRevision || !ref || ref.index <= lastIndex || localHashes.has(identity)) fail();
    lastIndex = ref.index; lastRevision = local.revision as number;
    const inert = cloneInert(work);
    if (work.version === 'owned_scheduled_motion_live_work_v1') {
      object(work, ['version', 'executionSourceId', 'executionRevision', 'physicalPitchSourceId', 'at', 'sourceCoverage', 'queue',
        'contributors', 'pendingDecisionHandoffs', 'unresolvedSuccessor', 'operation']);
      const at = moment(work.at), end = moment(scope.at);
      if (work.executionSourceId !== local.sourceId || work.executionRevision !== local.revision
        || work.physicalPitchSourceId !== scope.physicalPitchSourceId || work.sourceCoverage !== 'explicit_known_sources_only' || work.queue !== null
        || at.originTick !== end.originTick || at.elapsedSeconds > end.elapsedSeconds) fail();
      array(work.contributors); array(work.pendingDecisionHandoffs);
    }
    const workHash = actorHash(inert); localHashes.set(identity, workHash);
    return { owner: local.owner, sourceId: local.sourceId, revision: local.revision, workHash };
  });
  return { manifest: { snapshotFormat: 'actual_live_play_scope_manifest_v1' as const, source, revision: 1, history, scope, physicalLocalHistory }, physical, localHashes };
};
export const actualLivePlayScopeArchiveEncoding = (value: DurableActualLivePlayScope) => {
  const projected = scopeProjection(value);
  return projected ? encode(projected.manifest) : legacy(value);
};
export const actualLivePlayQueueArchiveEncoding = (value: DurableActualLivePlayQueue) => {
  const raw = object(value, ['source', 'revision', 'history', 'ownershipKey', 'queue']);
  const queue = object(raw.queue, ['version', 'scope', 'coverage', 'generation', 'closureFence', 'playEnd', 'represented', 'events', 'consumptions', 'successors']);
  const scope = scopeProjection(queue.scope as DurableActualLivePlayScope);
  if (!scope) return legacy(value);
  const source = cloneInert(raw.source) as DurableActualLivePlayQueue['source'], history = array(raw.history).map(v => cloneInert(v));
  if (raw.revision !== 1 || history.length !== 1 || actorJson(history[0]) !== actorJson(source)
    || source.capability !== 'actual_live_play_queue_v1'
    || actorJson({ ...source, capability: 'actual_live_play_scope_v1' }) !== actorJson(scope.manifest.source)
    || raw.ownershipKey !== actorJson(['actual_live_play_queue_v1', source.sourceId])
    || queue.version !== 'actual_live_play_queue_evidence_v1' || queue.coverage !== 'represented_sources_only'
    || queue.generation !== 'event_generation_coverage_pending' || queue.closureFence !== 'not_installed' || queue.playEnd !== null) fail();
  const owner = (value: unknown) => {
    const o = object(cloneInert(value), ['owner', 'sourceId', 'snapshotHash']);
    if (![o.owner, o.sourceId, o.snapshotHash].every(id)) fail();
    if (o.owner === 'batted_world_field_executions' && scope.physical.get(key(o.owner, o.sourceId))?.hash !== o.snapshotHash) fail();
    return o;
  };
  const representedOwners = new Set<string>(), horizon = moment(scope.manifest.scope.at);
  const represented = array(queue.represented).map(raw => {
    const r = object(raw, ['owner', 'localWork']), ref = owner(r.owner), localWorkHash = actorHash(cloneInert(r.localWork));
    const identity = key(ref.owner, ref.sourceId);
    if (representedOwners.has(identity) || ref.owner === 'batted_world_field_executions' && scope.localHashes.get(identity) !== localWorkHash) fail();
    representedOwners.add(identity);
    return { owner: ref, localWorkHash };
  });
  const eventKeys = new Set<string>();
  const events = array(queue.events).map(raw => {
    const e = object(raw, ['eventKey', 'eventId', 'kind', 'owner', 'occurredAt', 'availableAt', 'originalReceipt']);
    const ref = owner(e.owner), occurredAt = moment(e.occurredAt), availableAt = moment(e.availableAt);
    if (!id(e.eventKey) || !id(e.eventId) || !id(e.kind) || eventKeys.has(e.eventKey)
      || e.eventKey !== actorJson(['actual_live_event_v1', ref.owner, ref.sourceId, e.eventId])
      || occurredAt.originTick !== availableAt.originTick || occurredAt.elapsedSeconds > availableAt.elapsedSeconds
      || availableAt.originTick !== horizon.originTick || availableAt.elapsedSeconds > horizon.elapsedSeconds) fail();
    eventKeys.add(e.eventKey);
    return { eventKey: e.eventKey, eventId: e.eventId, kind: e.kind, owner: ref, occurredAt, availableAt, receiptHash: actorHash(cloneInert(e.originalReceipt)) };
  });
  const successorKeys = new Set<string>();
  const successors = array(queue.successors).map(raw => {
    const s = object(raw, ['successorKey', 'basisEventKey', 'kind', 'owner', 'localSourceId', 'status', 'originalHandoff']), ref = owner(s.owner);
    if (!id(s.successorKey) || !id(s.localSourceId) || !id(s.kind) || !id(s.basisEventKey) || successorKeys.has(s.successorKey)
      || s.successorKey !== actorJson(['actual_live_successor_v1', ref.owner, ref.sourceId, s.localSourceId])
      || !eventKeys.has(s.basisEventKey) || s.status !== 'pending') fail();
    successorKeys.add(s.successorKey);
    const basis = events.find(e => e.eventKey === s.basisEventKey)!;
    if (actorJson(basis.owner) !== actorJson(ref)) fail();
    return { successorKey: s.successorKey, basisEventKey: s.basisEventKey, kind: s.kind, owner: ref, localSourceId: s.localSourceId,
      status: s.status, handoffHash: actorHash(cloneInert(s.originalHandoff)) };
  });
  const consumptions = array(queue.consumptions).map(raw => {
    const c = object(cloneInert(raw), ['eventKey', 'consumerKind', 'consumer', 'availableAt', 'status', 'successorKey']);
    owner(c.consumer); const availableAt = moment(c.availableAt);
    if (!id(c.eventKey) || !eventKeys.has(c.eventKey) || !id(c.consumerKind) || c.status !== 'consumed'
      || c.successorKey !== null && (!id(c.successorKey) || !successorKeys.has(c.successorKey))) fail();
    const event = events.find(e => e.eventKey === c.eventKey)!;
    if (availableAt.originTick !== horizon.originTick || availableAt.elapsedSeconds > horizon.elapsedSeconds
      || availableAt.elapsedSeconds < event.availableAt.elapsedSeconds) fail();
    if (c.successorKey !== null && successors.find(s => s.successorKey === c.successorKey)!.basisEventKey !== c.eventKey) fail();
    return c;
  });
  return encode({ snapshotFormat: 'actual_live_play_queue_manifest_v1', source, revision: 1, history, ownershipKey: raw.ownershipKey,
    queue: { version: queue.version, scope: scope.manifest, coverage: queue.coverage, generation: queue.generation,
      closureFence: queue.closureFence, playEnd: null, represented, events, successors, consumptions } });
};
