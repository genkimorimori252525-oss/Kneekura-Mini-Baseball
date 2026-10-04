import { describe, expect, it, vi } from 'vitest';
import * as inert from '../../core/adjudication/OfficialWindowPolicy';
import * as archive from './OwnedScheduledMotionArchive';
import * as dependency from './OwnedScheduledMotionDependencyEncoding';
import { actorFreeze, actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

// Synthetic codec-only records. Native owner tests separately prove domain truth.
const snapshot = (kind = 'owned_motion_v2'): DurableBattedWorldFieldExecution => {
  const source = { sourceId: 'execution-1', sourceVersion: 'synthetic', baseFieldSourceId: 'field-1', previousExecutionSourceId: null,
    action: { kind } };
  return { source, history: [source], revision: 1, baseField: { source: { sourceId: 'field-1', sourceVersion: 'synthetic' },
    response: { model: { gameId: 'game-1' }, touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'pitch-1' } } } } }, field: {} },
    execution: { kind, field: {}, synthetic: { count: 1 } } } as unknown as DurableBattedWorldFieldExecution;
};
const mutable = (v: unknown) => v as Record<string, any>;

describe('private dependency encoding scope', () => {
  it('constructs a new internal encoder with three separate roles', () => {
    expect(dependency).toHaveProperty('createOwnedScheduledMotionDependencyEncoding', expect.any(Function));
  });
  it('encodes a deeply immutable exact snapshot once and returns a frozen pair without changing bytes', () => {
    const value = actorFreeze(snapshot()), expected = archive.ownedScheduledMotionArchiveEncoding(value);
    const calls = vi.spyOn(archive, 'ownedScheduledMotionArchiveEncoding'), encode = dependency.createOwnedScheduledMotionDependencyEncoding();
    try {
      const first = encode.snapshot(value), second = encode.snapshot(value);
      expect(first).toEqual(expected); expect(second).toBe(first); expect(Object.isFrozen(first)).toBe(true);
      expect(calls).toHaveBeenCalledTimes(1);
      expect(() => { (first as { hash: string }).hash = 'poison'; }).toThrow();
      expect(encode.snapshot(value)).toBe(first);
    } finally { calls.mockRestore(); }
  });
  it('binds exact identities rather than Source IDs and never shares maps between roles or scopes', () => {
    const first = actorFreeze(snapshot()), second = snapshot(); mutable(second).execution.synthetic.count = 2; actorFreeze(second);
    const calls = vi.spyOn(archive, 'ownedScheduledMotionArchiveEncoding');
    const outer = dependency.createOwnedScheduledMotionDependencyEncoding(), inner = dependency.createOwnedScheduledMotionDependencyEncoding();
    try {
      const before = outer.snapshot(first); expect(inner.snapshot(first)).toEqual(before);
      expect(inner.snapshot(first)).not.toBe(before); expect(outer.snapshot(first)).toBe(before);
      expect(outer.snapshot(second).hash).not.toBe(before.hash); expect(calls).toHaveBeenCalledTimes(3);
      // A value accepted by the generic role cannot bypass the stricter snapshot role.
      const wrong = actorFreeze({ sourceId: first.source.sourceId });
      outer.source(wrong as never); outer.baseField(wrong as never);
      expect(() => outer.snapshot(wrong as never)).toThrow();
    } finally { calls.mockRestore(); }
  });
  it('validates independently bounded Source and base-field encodings once per role', () => {
    const value = actorFreeze(snapshot()), encode = dependency.createOwnedScheduledMotionDependencyEncoding();
    const expectedSource = { json: actorJson(value.source), hash: actorHash(value.source) };
    const expectedBase = { json: actorJson(value.baseField), hash: actorHash(value.baseField) };
    const clones = vi.spyOn(inert, 'cloneInert');
    try {
      expect(encode.source(value.source)).toEqual(expectedSource); expect(encode.source(value.source)).toEqual(expectedSource);
      expect(encode.baseField(value.baseField)).toEqual(expectedBase); expect(encode.baseField(value.baseField)).toEqual(expectedBase);
      expect(clones).toHaveBeenCalledTimes(2);
      encode.source(value.baseField as never); expect(clones).toHaveBeenCalledTimes(3);
    } finally { clones.mockRestore(); }
  });
  it.each([false, true])('bypasses mutable descendants even with a frozen root=%s', shallow => {
    const value = snapshot(); if (shallow) Object.freeze(value);
    const calls = vi.spyOn(archive, 'ownedScheduledMotionArchiveEncoding'), encode = dependency.createOwnedScheduledMotionDependencyEncoding();
    try {
      const first = encode.snapshot(value); mutable(value).execution.synthetic.count++;
      expect(encode.snapshot(value).hash).not.toBe(first.hash); expect(calls).toHaveBeenCalledTimes(2);
    } finally { calls.mockRestore(); }
  });
  it('does not cache failed validation, invoke getters, or bypass cycles and limits', () => {
    const encode = dependency.createOwnedScheduledMotionDependencyEncoding(); let getterCalls = 0;
    const value = snapshot();
    Object.defineProperty(mutable(value).execution.synthetic, 'active', { configurable: true, enumerable: true,
      get() { getterCalls++; return 2; } });
    expect(() => encode.snapshot(value)).toThrow(); expect(() => encode.snapshot(value)).toThrow(); expect(getterCalls).toBe(0);
    delete mutable(value).execution.synthetic.active; actorFreeze(value);
    expect(encode.snapshot(value)).toEqual(archive.ownedScheduledMotionArchiveEncoding(value));
    const cycle: Record<string, unknown> = {}; cycle.self = cycle; Object.freeze(cycle);
    expect(() => encode.source(cycle as never)).toThrow(/cycles/);
    const large = actorFreeze({ sourceId: 'huge', values: Array.from({ length: 100_001 }, () => 1) });
    expect(() => encode.source(large as never)).toThrow(/size limits/);
    expect(() => encode.baseField(large as never)).toThrow(/size limits/);
    const broken = snapshot(); mutable(broken).execution.synthetic.value = NaN; actorFreeze(broken);
    expect(() => encode.snapshot(broken)).toThrow(/finite/);
  });
  it.each(['motion', 'owned_motion_v1', 'whole_play_history'])('retains legacy %s exact bytes and independent inert budget', kind => {
    const value = actorFreeze(snapshot(kind)), encode = dependency.createOwnedScheduledMotionDependencyEncoding();
    expect(encode.snapshot(value)).toEqual({ json: actorJson(value), hash: actorHash(value) });
    expect(encode.snapshot(value)).toEqual({ json: actorJson(value), hash: actorHash(value) });
  });
});

const freezeDescriptors = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value !== null && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if ('value' in descriptor) freezeDescriptors(descriptor.value, seen);
    }
    Object.freeze(value);
  }
  return value;
};
it('rejects deeply frozen active and non-inert values before cache eligibility', () => {
  let calls = 0;
  const cases: ((target: Record<string, any>) => void)[] = [
    target => Object.defineProperty(target, 'active', { enumerable: true, get() { calls++; return 1; } }),
    target => { target.toJSON = () => { calls++; return {}; }; },
    target => { target.cycle = target; },
    target => { target.value = Infinity; },
    target => { target.value = new Array(2); },
    target => { target.value = Object.create({ inherited: 1 }); },
    target => { Object.defineProperty(target, Symbol('hidden'), { enumerable: true, value: 1 }); },
    target => { target.value = Array.from({ length: 100_001 }, () => 1); },
    target => { let nested = target; for (let i = 0; i < 70; i++) nested = nested.next = {}; },
  ];
  const encode = dependency.createOwnedScheduledMotionDependencyEncoding();
  for (const change of cases) {
    const value = snapshot(); change(mutable(value).execution.synthetic); freezeDescriptors(value);
    expect(() => encode.snapshot(value)).toThrow(); expect(() => encode.snapshot(value)).toThrow();
  }
  expect(calls).toBe(0);
  const valid = freezeDescriptors(snapshot()); expect(encode.snapshot(valid)).toEqual(archive.ownedScheduledMotionArchiveEncoding(valid));
});
it('preserves special canonical keys, shared components, and later deep-freeze eligibility', () => {
  const value = snapshot(), payload = Object.assign(Object.create(null), { z: -0, a: '日本語', '10': 10, '2': 2 });
  Object.defineProperty(payload, '__proto__', { enumerable: true, value: { own: true } });
  mutable(value).execution.synthetic = payload;
  const encode = dependency.createOwnedScheduledMotionDependencyEncoding();
  const initial = encode.snapshot(value); payload.a = '変化';
  const mutableEncoding = encode.snapshot(value); expect(mutableEncoding).not.toEqual(initial);
  freezeDescriptors(value);
  const frozen = encode.snapshot(value); expect(frozen).toEqual(mutableEncoding); expect(frozen).not.toBe(mutableEncoding);
  expect(encode.snapshot(value)).toBe(frozen);
  const shared = freezeDescriptors({ ...value, execution: { ...value.execution, synthetic: { other: true } } });
  expect(encode.source(shared.source)).toBe(encode.source(value.source));
  expect(encode.baseField(shared.baseField)).toBe(encode.baseField(value.baseField));
  expect(encode.snapshot(shared)).toEqual(archive.ownedScheduledMotionArchiveEncoding(shared));
  expect(encode.snapshot(shared)).not.toBe(frozen);
});
it('retains long per-record snapshot budgets without introducing an aggregate cache limit', () => {
  const value = snapshot(), history = Array.from({ length: 350 }, (_, i) => ({ ...value.source,
    sourceId: `execution-${i}`, previousExecutionSourceId: i ? `execution-${i - 1}` : null,
    action: { kind: 'owned_motion_v2', synthetic: Array.from({ length: 400 }, (_, index) => index) } }));
  Object.assign(mutable(value), { history, source: history.at(-1), revision: history.length }); freezeDescriptors(value);
  expect(() => actorJson(value)).toThrow(/size limits/);
  const encode = dependency.createOwnedScheduledMotionDependencyEncoding(), expected = archive.ownedScheduledMotionArchiveEncoding(value);
  expect(encode.snapshot(value)).toEqual(expected); expect(encode.snapshot(value)).toBe(encode.snapshot(value));
  expect(() => actorJson(value)).toThrow(/size limits/);
});

it('caches a per-record validated large whole-history snapshot without a generic aggregate bypass', () => {
  const value = snapshot(), oldSource = value.source;
  const source = { ...oldSource, sourceId: 'history-view', previousExecutionSourceId: oldSource.sourceId, action: { kind: 'whole_play_history' } };
  const ref = { owner: 'field_execution', sourceId: oldSource.sourceId, revision: 1, physicalPitchSourceId: 'pitch-1' };
  Object.assign(mutable(value), { source, revision: 2, history: [oldSource, source], execution: { kind: 'whole_play_history', field: {}, physicalHistory: {
    scope: { gameId: 'game-1', playId: 1, physicalPitchSourceId: 'pitch-1' }, originalPitch: { owner: 'physical_pitch', sourceId: 'pitch-1' },
    originalTimeline: { synthetic: true }, origin: { synthetic: true },
    physicalSteps: Array.from({ length: 30 }, (_, i) => ({ source: ref, kind: 'owned_motion_v2', synthetic: Array.from({ length: 5000 }, () => i) })),
    observations: [], frames: [{ originTick: 1, elapsedSeconds: 0, tick: 1, occurrences: [{ source: ref, phase: 'motion_horizon' }] }],
    horizon: {}, cursor: null, carrierPlayerId: null, end: { kind: 'unestablished' },
  } } }); freezeDescriptors(value);
  expect(() => actorJson(value)).toThrow(/size limits/);
  const encode = dependency.createOwnedScheduledMotionDependencyEncoding(), result = encode.snapshot(value);
  expect(result).toEqual(archive.ownedScheduledMotionArchiveEncoding(value)); expect(encode.snapshot(value)).toBe(result);
  const changed = structuredClone(value); mutable(changed).execution.physicalHistory.physicalSteps[0].synthetic[0] = -1;
  freezeDescriptors(changed); expect(encode.snapshot(changed).hash).not.toBe(result.hash);
});
