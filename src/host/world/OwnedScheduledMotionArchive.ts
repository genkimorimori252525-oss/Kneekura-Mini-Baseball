import { createHash } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export const ownedScheduledMotionSnapshotFormat = 'owned_scheduled_field_execution_manifest_v1' as const;
const historyFormat = 'owned_scheduled_whole_history_manifest_v1' as const;
const family = new Set(['owned_motion_v2', 'owned_acquisition_plan_v1', 'owned_throw_plan_v1']);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
function fail(): never { throw new Error('owned scheduled execution archive shape or ownership differs'); }

// Private to this projection: inputs must already be newly allocated, cloneInert-
// validated components or the manifest assembled from them. Raw roots still use
// actorHash below so their original per-component inert budgets remain enforced.
const inertJson = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const inertHash = (value: unknown): string => createHash('sha256').update(inertJson(value)).digest('hex');

/** Inspect container descriptors before reading any property. Split only this owner's
 * explicit schema, never a general shape-dispatch escape from cloneInert's budgets. */
const object = (value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail();
  const keys = Reflect.ownKeys(value);
  if (required.some(key => !keys.includes(key)) || keys.some(key => typeof key !== 'string' || !required.includes(key) && !optional.includes(key))) fail();
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !descriptor.enumerable || !('value' in descriptor)) fail();
    result[key] = descriptor.value;
  }
  return result;
};
const array = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value) || value.length > 100_000 || Reflect.ownKeys(value).length !== value.length + 1) fail();
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) fail();
    result.push(descriptor.value);
  }
  return result;
};
const source = (raw: unknown): AcceptedBattedWorldFieldExecution => {
  object(raw, ['sourceId', 'sourceVersion', 'baseFieldSourceId', 'previousExecutionSourceId', 'action']);
  const value = cloneInert(raw) as AcceptedBattedWorldFieldExecution;
  if (![value.sourceId, value.sourceVersion, value.baseFieldSourceId].every(id)
    || value.previousExecutionSourceId !== null && !id(value.previousExecutionSourceId)
    || !value.action || typeof value.action !== 'object' || !id(value.action.kind)) fail();
  return value;
};
const reference = (raw: unknown, physicalPitchSourceId: string, owner?: 'field_execution') => {
  const value = object(raw, ['owner', 'sourceId', 'revision', 'physicalPitchSourceId']);
  if (!['field_action', 'field_execution'].includes(value.owner as string) || owner && value.owner !== owner
    || !id(value.sourceId) || !positiveInteger(value.revision) || value.physicalPitchSourceId !== physicalPitchSourceId) fail();
  return value;
};
const wholeHistory = (raw: unknown, physicalPitchSourceId: string, gameId: string) => {
  const planNames = ['ownedScheduledPlans', 'scheduledAcquisitionPlans', 'scheduledThrowPlans'];
  const value = object(raw, ['scope', 'originalPitch', 'originalTimeline', 'origin', 'physicalSteps', 'observations',
    'frames', 'horizon', 'cursor', 'carrierPlayerId', 'end'], planNames);
  const scope = cloneInert(value.scope), originalPitch = cloneInert(value.originalPitch);
  const scoped = object(scope, ['gameId', 'playId', 'physicalPitchSourceId']);
  const pitch = object(originalPitch, ['owner', 'sourceId']);
  if (scoped.gameId !== gameId || scoped.physicalPitchSourceId !== physicalPitchSourceId
    || pitch.owner !== 'physical_pitch' || pitch.sourceId !== physicalPitchSourceId) fail();
  const records = (rawRecords: unknown, owner?: 'field_execution') => array(rawRecords).map(rawRecord => {
    const record = cloneInert(rawRecord) as { source?: unknown };
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail();
    return { source: reference(record.source, physicalPitchSourceId, owner), recordHash: inertHash(record) };
  });
  const plans = Object.fromEntries(planNames.filter(name => Object.hasOwn(value, name))
    .map(name => [name, records(value[name], 'field_execution')]));
  const frames = array(value.frames).map(rawFrame => {
    const frame = cloneInert(rawFrame);
    const data = object(frame, ['originTick', 'elapsedSeconds', 'tick', 'occurrences']);
    const occurrences = array(data.occurrences).map(rawOccurrence => {
      const occurrence = object(rawOccurrence, ['source', 'phase']);
      const pitchOccurrence = occurrence.source as { owner?: unknown } | null;
      if (pitchOccurrence?.owner === 'physical_pitch') {
        const ref = object(pitchOccurrence, ['owner', 'sourceId']);
        if (ref.sourceId !== physicalPitchSourceId) fail();
      } else reference(occurrence.source, physicalPitchSourceId);
      return occurrence;
    });
    return { occurrences, recordHash: inertHash(frame) };
  });
  return { format: historyFormat, scope, originalPitch,
    originalTimelineHash: actorHash(value.originalTimeline), originHash: actorHash(value.origin),
    physicalSteps: records(value.physicalSteps), observations: records(value.observations, 'field_execution'), ...plans, frames,
    horizon: cloneInert(value.horizon), cursor: cloneInert(value.cursor),
    carrierPlayerId: cloneInert(value.carrierPlayerId), end: cloneInert(value.end) };
};

/** The caller must first rederive the bounded logical snapshot from original rows on
 * its own connection. This projection is storage identity, never replay authority.
 * Omitted bodies remain bound by fresh digests and qualified record identities. */
const archive = (snapshot: DurableBattedWorldFieldExecution): unknown => {
  const raw = object(snapshot, ['source', 'baseField', 'revision', 'history', 'execution']);
  const current = source(raw.source), history = array(raw.history).map(source);
  if (!family.has(current.action.kind) && !history.some(value => family.has(value.action.kind))) return cloneInert(snapshot);
  if (!positiveInteger(raw.revision) || raw.revision !== history.length || !history.length
    || inertJson(current) !== inertJson(history[history.length - 1])) fail();
  const baseField = cloneInert(raw.baseField) as DurableBattedWorldFieldExecution['baseField'];
  const physicalPitchSourceId = baseField.response.touch.worldContact.flight.source.physicalPitchSourceId;
  const gameId = baseField.response.model.gameId;
  if (![physicalPitchSourceId, gameId, baseField.source.sourceId, baseField.source.sourceVersion].every(id)
    || current.baseFieldSourceId !== baseField.source.sourceId) fail();
  const seen = new Set<string>();
  const envelopes = history.map((value, index) => {
    if (value.baseFieldSourceId !== baseField.source.sourceId || seen.has(value.sourceId)
      || value.previousExecutionSourceId !== (history[index - 1]?.sourceId ?? null)) fail();
    seen.add(value.sourceId);
    return { sourceId: value.sourceId, sourceVersion: value.sourceVersion, baseFieldSourceId: value.baseFieldSourceId,
      previousExecutionSourceId: value.previousExecutionSourceId, sourceHash: inertHash(value) };
  });
  let execution: unknown;
  if (current.action.kind === 'whole_play_history') {
    const body = object(raw.execution, ['kind', 'field', 'physicalHistory']);
    if (body.kind !== 'whole_play_history') fail();
    execution = { kind: body.kind, field: cloneInert(body.field), physicalHistory: wholeHistory(body.physicalHistory, physicalPitchSourceId, gameId) };
  } else execution = cloneInert(raw.execution);
  return { snapshotFormat: ownedScheduledMotionSnapshotFormat, source: current, revision: raw.revision,
    baseField: { source: { sourceId: baseField.source.sourceId, sourceVersion: baseField.source.sourceVersion },
      sourceHash: inertHash(baseField.source), snapshotHash: inertHash(baseField), physicalPitchSourceId, gameId },
    history: envelopes, execution };
};

/** Every projected component is newly allocated inert data checked under its original
 * per-record clone limit. Canonicalize the explicit manifest without reimposing a
 * repeated-root aggregate budget. Generic actorJson/actorHash remain unchanged. */
export const ownedScheduledMotionArchiveJson = (snapshot: DurableBattedWorldFieldExecution): string =>
  inertJson(archive(snapshot));

/** Project once and bind the hash to these exact canonical bytes. This pair is
 * call-local storage identity, never a cache or a substitute for rederivation. */
export const ownedScheduledMotionArchiveEncoding = (snapshot: DurableBattedWorldFieldExecution): Readonly<{ json: string; hash: string }> => {
  const json = ownedScheduledMotionArchiveJson(snapshot);
  return { json, hash: createHash('sha256').update(json).digest('hex') };
};
export const ownedScheduledMotionArchiveHash = (snapshot: DurableBattedWorldFieldExecution): string =>
  ownedScheduledMotionArchiveEncoding(snapshot).hash;
