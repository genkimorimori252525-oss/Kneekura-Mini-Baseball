import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { ownedScheduledWholeHistoryArchiveEncoding, ownedScheduledMotionArchiveJson as archiveJson, ownedScheduledMotionArchiveHash as archiveHash } from './OwnedScheduledMotionArchive';

// Synthetic inert records exercise the storage codec only. Native integration tests
// separately establish domain validity and rederive these records from original rows.
const source = (index: number, kind = 'owned_motion_v2', width = 0) => ({ sourceId: `execution-${index}`,
  sourceVersion: 'synthetic-v1', baseFieldSourceId: 'field-1', previousExecutionSourceId: index ? `execution-${index - 1}` : null,
  action: { kind, ...(width ? { syntheticPayload: Array.from({ length: width }, (_, i) => i) } : {}) } });
const ref = (index: number, owner: 'field_action' | 'field_execution' = 'field_execution') => ({ owner,
  sourceId: owner === 'field_action' ? 'field-1' : `execution-${index}`, revision: index + 1, physicalPitchSourceId: 'pitch-1' });
const baseField = () => ({ source: { sourceId: 'field-1', sourceVersion: 'synthetic-v1' }, revision: 1,
  response: { model: { gameId: 'game-1' }, touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'pitch-1' } } } } }, field: {} });
const snapshot = (count = 1, kind = 'owned_motion_v2', width = 0): DurableBattedWorldFieldExecution => {
  const history = Array.from({ length: count }, (_, i) => source(i, kind, width));
  return { source: history[count - 1], history, revision: count, baseField: baseField(),
    execution: { kind, field: {}, syntheticCurrent: [1, 2, 3] } } as unknown as DurableBattedWorldFieldExecution;
};
const wholeSnapshot = (count = 30): DurableBattedWorldFieldExecution => {
  const value = snapshot(count), current = source(count, 'whole_play_history');
  const physicalHistory = { scope: { gameId: 'game-1', playId: 1, physicalPitchSourceId: 'pitch-1' },
    originalPitch: { owner: 'physical_pitch', sourceId: 'pitch-1' }, originalTimeline: { synthetic: [1, 2, 3] }, origin: { synthetic: [4, 5] },
    physicalSteps: Array.from({ length: count }, (_, i) => ({ source: ref(i), previousSourceId: i ? `execution-${i - 1}` : null,
      kind: 'owned_motion_v2', field: { synthetic: Array.from({ length: 5000 }, (_, j) => j) } })),
    observations: [{ source: ref(0), previousSourceId: null, kind: 'observation', observationKind: 'whole_play_history', basis: ref(0, 'field_action'), horizon: {} }],
    ownedScheduledPlans: [{ source: ref(0), previousSourceId: null, kind: 'owned_acquisition_plan_v1', basis: ref(0, 'field_action'), horizon: {}, plan: {} }],
    scheduledAcquisitionPlans: [], scheduledThrowPlans: [],
    frames: [{ originTick: 1, elapsedSeconds: 0, tick: 1, occurrences: [{ source: ref(0), phase: 'motion_horizon' }] }],
    horizon: {}, cursor: null, carrierPlayerId: null, end: { kind: 'unestablished' } };
  return { ...value, source: current, history: [...value.history, current], revision: count + 1,
    execution: { kind: 'whole_play_history', field: {}, physicalHistory } } as unknown as DurableBattedWorldFieldExecution;
};
const wire = (value: DurableBattedWorldFieldExecution) => JSON.parse(archiveJson(value));
const mutable = (value: DurableBattedWorldFieldExecution) => value as unknown as Record<string, any>;

describe('owned scheduled execution archive', () => {
  it('stores long Source histories by original envelopes without raising the generic clone limit', () => {
    const value = snapshot(350, 'owned_motion_v2', 400);
    expect(() => actorJson(value)).toThrow(/size limits/);
    const archived = wire(value);
    expect(archived.snapshotFormat).toBe('owned_scheduled_field_execution_manifest_v1');
    expect(archived.source).toEqual(value.source);
    expect(archived.execution).toEqual(value.execution);
    expect(archived.history).toHaveLength(350);
    expect(archived.history[0]).toEqual({ sourceId: 'execution-0', sourceVersion: 'synthetic-v1', baseFieldSourceId: 'field-1',
      previousExecutionSourceId: null, sourceHash: actorHash(value.history[0]) });
    expect(archived.baseField).toEqual({ source: value.baseField.source, sourceHash: actorHash(value.baseField.source),
      snapshotHash: actorHash(value.baseField), physicalPitchSourceId: 'pitch-1', gameId: 'game-1' });
    expect(archiveHash(value)).toBe(createHash('sha256').update(archiveJson(value)).digest('hex'));
    expect(() => actorJson(value)).toThrow(/size limits/);
  });

  it('binds every long whole-history record, original root, frame, and current state independently', () => {
    const value = wholeSnapshot();
    expect(() => actorJson(value)).toThrow(/size limits/);
    const expected = mutable(value).execution.physicalHistory, result = wire(value).execution.physicalHistory;
    expect(result.format).toBe('owned_scheduled_whole_history_manifest_v1');
    expect(result.originalTimelineHash).toBe(actorHash(expected.originalTimeline));
    expect(result.originHash).toBe(actorHash(expected.origin));
    for (const name of ['physicalSteps', 'observations', 'ownedScheduledPlans', 'scheduledAcquisitionPlans', 'scheduledThrowPlans']) {
      expect(result[name]).toEqual(expected[name].map((record: any) => ({ source: record.source, recordHash: actorHash(record) })));
    }
    expect(result.frames).toEqual(expected.frames.map((record: any) => ({ occurrences: record.occurrences, recordHash: actorHash(record) })));
    for (const name of ['scope', 'originalPitch', 'horizon', 'cursor', 'carrierPlayerId', 'end']) expect(result[name]).toEqual(expected[name]);
  });

  it('keeps raw and v1-only bytes and hashes exact, including a bounded prefix before future opt-in', () => {
    for (const kind of ['motion', 'owned_motion_v1', 'whole_play_history']) {
      const value = snapshot(2, kind);
      const oldJson = actorJson(value), oldHash = actorHash(value);
      const future = { ...source(2), previousExecutionSourceId: value.source.sourceId };
      expect(future.action.kind).toBe('owned_motion_v2');
      expect(archiveJson(value)).toBe(oldJson);
      expect(archiveHash(value)).toBe(oldHash);
      expect(wire(value)).not.toHaveProperty('snapshotFormat');
    }
    const value = snapshot(2, 'owned_motion_v1');
    mutable(value).source.action.kind = 'owned_acquisition_plan_v1';
    expect(wire(value).snapshotFormat).toBe('owned_scheduled_field_execution_manifest_v1');
  });

  it('binds order, original body digest, qualified owner and identities rather than trusting saved digests', () => {
    const value = wholeSnapshot(3), initial = archiveHash(value), raw = mutable(value).execution.physicalHistory;
    raw.physicalSteps.reverse(); expect(archiveHash(value)).not.toBe(initial); raw.physicalSteps.reverse();
    raw.physicalSteps[0].field.synthetic[0] = -1; expect(archiveHash(value)).not.toBe(initial); raw.physicalSteps[0].field.synthetic[0] = 0;
    raw.physicalSteps[0].source.owner = 'field_action'; expect(archiveHash(value)).not.toBe(initial);
    raw.physicalSteps[0].source.sourceId = raw.physicalSteps[1].source.sourceId;
    const records = wire(value).execution.physicalHistory.physicalSteps;
    expect(records[0].source.sourceId).toBe(records[1].source.sourceId);
    expect(records[0].source.owner).not.toBe(records[1].source.owner);
    expect(records[0].recordHash).not.toBe(records[1].recordHash);
    raw.physicalSteps[0].source.physicalPitchSourceId = 'foreign'; expect(() => archiveJson(value)).toThrow();
  });

  it('rejects extra and wrong format fields rather than accepting an archived payload as logical authority', () => {
    const value = wholeSnapshot(1);
    for (const field of ['snapshotFormat', 'extra']) {
      const bad = { ...value, [field]: 'owned_scheduled_field_execution_manifest_v1' };
      expect(() => archiveJson(bad)).toThrow();
    }
    expect(() => archiveJson(wire(value))).toThrow();
    const raw = mutable(value).execution.physicalHistory;
    raw.format = 'owned_scheduled_whole_history_manifest_v1'; expect(() => archiveJson(value)).toThrow(); delete raw.format;
    raw.extra = 'ignored'; expect(() => archiveJson(value)).toThrow();
  });

  it('rejects active arrays, accessors, sparse arrays and cycles without running getters', () => {
    let calls = 0;
    const mutations: ((value: Record<string, any>) => void)[] = [
      value => { Object.defineProperty(value, 'source', { enumerable: true, get() { calls++; return source(0); } }); },
      value => { Object.defineProperty(value.history, 'map', { get() { calls++; return Array.prototype.map; } }); },
      value => { Object.defineProperty(value.history, '0', { enumerable: true, get() { calls++; return source(0); } }); },
      value => { delete value.history[0]; },
      value => { value.source.action.loop = value.source; },
      value => { Object.defineProperty(value.execution.physicalHistory.physicalSteps, 'map', { get() { calls++; return Array.prototype.map; } }); },
      value => { Object.defineProperty(value.execution.physicalHistory.physicalSteps[0], 'field', { enumerable: true, get() { calls++; return {}; } }); },
      value => { value.execution.physicalHistory.frames[0].cycle = value.execution.physicalHistory; },
    ];
    for (const mutate of mutations) { const value = wholeSnapshot(2); mutate(mutable(value)); expect(() => archiveJson(value)).toThrow(); }
    expect(calls).toBe(0);
  });

  it('retains each current Source, execution, and history record inert size budget', () => {
    const sourceTooLarge = snapshot(1, 'owned_motion_v2', 100_001);
    expect(() => archiveJson(sourceTooLarge)).toThrow(/size limits/);
    const currentTooLarge = snapshot(); mutable(currentTooLarge).execution.payload = Array(100_001).fill(0);
    expect(() => archiveJson(currentTooLarge)).toThrow(/size limits/);
    const recordTooLarge = wholeSnapshot(1); mutable(recordTooLarge).execution.physicalHistory.physicalSteps[0].field.synthetic = Array(100_001).fill(0);
    expect(() => archiveJson(recordTooLarge)).toThrow(/size limits/);
  });
});

it('exports the same bounded whole-history projection without changing the execution archive', () => {
  const value = wholeSnapshot(40), history = mutable(value).execution.physicalHistory;
  expect(() => actorJson(history)).toThrow(/size limits/);
  const result = ownedScheduledWholeHistoryArchiveEncoding(history, 'pitch-1', 'game-1');
  expect(JSON.parse(result.json)).toEqual(wire(value).execution.physicalHistory);
  expect(result.hash).toBe(createHash('sha256').update(result.json).digest('hex'));
});
it('rejects active and foreign whole-history inputs before exporting a completed-envelope identity', () => {
  const history = mutable(wholeSnapshot(1)).execution.physicalHistory; let touched = false;
  const active = Object.defineProperty({ ...history }, 'scope', { enumerable: true, get() { touched = true; return history.scope; } });
  expect(() => ownedScheduledWholeHistoryArchiveEncoding(active, 'pitch-1', 'game-1')).toThrow();
  expect(touched).toBe(false);
  expect(() => ownedScheduledWholeHistoryArchiveEncoding(history, 'foreign', 'game-1')).toThrow();
  const unscoped = { ...history, scope: { ...history.scope, gameId: '', physicalPitchSourceId: '' }, physicalSteps: [], observations: [], frames: [], ownedScheduledPlans: [], originalPitch: { owner: 'physical_pitch', sourceId: '' } };
  expect(() => ownedScheduledWholeHistoryArchiveEncoding(unscoped, '', '')).toThrow();
});
