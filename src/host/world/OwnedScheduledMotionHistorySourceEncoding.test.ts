import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import * as physical from './BattedWorldFieldPhysicalPrefix';
import * as encoders from './OwnedScheduledMotionDependencyEncoding';
import * as canonical from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionArchiveEncoding } from './OwnedScheduledMotionArchive';
import { ownedPhysicalPlanEncodingFixture } from './OwnedPhysicalPlanEncodingFixtures.test-support';
import type { AcceptedBattedWorldFieldExecution as Source } from './SqliteBattedWorldFieldExecutionStore';

// Prepared source-only. This contract has NOT been compiled or executed.
// The primary RED target is duplicate Source actorJson work in a real public
// projection. Fixtures contain real Core progress but synthetic Native envelopes.
const project = physical.battedWorldFieldPhysicalPrefix;
const matches = physical.battedWorldFieldExecutionHistoryMatches;
type Prefix = Parameters<typeof project>[0];
type Encoding = ReturnType<ReturnType<typeof encoders.createOwnedScheduledMotionDependencyEncoding>['source']>;
const mutable = (value: unknown) => value as Record<string, any>;
const digest = (json: string) => createHash('sha256').update(json).digest('hex');
const outcome = (body: () => unknown) => {
  try { return { ok: true as const, value: body() }; }
  catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : String(error) }; }
};
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

type ObservedContext = { projection: boolean; calls: { source: Source; encoded: Encoding }[] };
// Each wrapper delegates to the real codec. baseField identifies the existing
// projection-local context; archive-reference contexts never call that role.
const observe = (afterSource?: (source: Source, encoded: Encoding, context: ObservedContext) => void) => {
  const create = encoders.createOwnedScheduledMotionDependencyEncoding;
  const contexts: ObservedContext[] = [];
  const spy = vi.spyOn(encoders, 'createOwnedScheduledMotionDependencyEncoding').mockImplementation(() => {
    const encoder = create(), context: ObservedContext = { projection: false, calls: [] };
    contexts.push(context);
    return Object.freeze({ ...encoder,
      baseField(value) { context.projection = true; return encoder.baseField(value); },
      source(value) {
        const encoded = encoder.source(value);
        context.calls.push({ source: value, encoded });
        if (context.projection) afterSource?.(value, encoded, context);
        return encoded;
      },
    });
  });
  return { projections: () => contexts.filter(context => context.projection), restore: () => spy.mockRestore() };
};
const sources = (prefix: Prefix) => prefix.executions.map(value => value.source);
const expectedCalls = (prefix: Prefix) => prefix.executions.flatMap((value, index) =>
  [...sources(prefix).slice(0, index + 1), ...value.history]);
const expectSourceOrder = (context: ObservedContext, expected: readonly Source[]) => {
  expect(context.calls).toHaveLength(expected.length);
  expected.forEach((source, index) => { expect(context.calls[index].source).toBe(source); });
};

it('encodes the terminal frozen Source once through the real public projection without changing output or archive bytes', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(3), terminal = prefix.executions.at(-1)!;
  // Mutable copies force the legacy full codec on every comparison even after repair.
  const expected = project(structuredClone(prefix));
  const archives = prefix.executions.map(ownedScheduledMotionArchiveEncoding);
  const json = vi.spyOn(canonical, 'actorJson');
  try {
    expect(project(prefix)).toEqual(expected);
    // The terminal Source cannot be an earlier operation's archive reference.
    // Baseline code calls actorJson twice; the proposed private history path calls it once.
    expect(json.mock.calls.filter(([value]) => value === terminal.source)).toHaveLength(1);
    expect(prefix.executions.map(ownedScheduledMotionArchiveEncoding)).toEqual(archives);
  } finally { json.mockRestore(); }
});

it('retains original/history evaluation order while reusing only exact frozen identities in one projection', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(3), observed = observe();
  try {
    project(prefix);
    const [context] = observed.projections(); expect(observed.projections()).toHaveLength(1);
    expectSourceOrder(context, expectedCalls(prefix));
    for (const source of sources(prefix)) {
      const calls = context.calls.filter(call => call.source === source);
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(new Set(calls.map(call => call.encoded)).size).toBe(1);
      expect(calls[0].encoded).toEqual({ json: canonical.actorJson(source), hash: canonical.actorHash(source) });
    }
  } finally { observed.restore(); }
});

it('encodes distinct equal history objects independently instead of treating Source IDs or equal bytes as cache keys', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(2, 'mutable');
  const expected = project(structuredClone(prefix));
  for (const value of prefix.executions) mutable(value).history = value.history.map(source => structuredClone(source));
  freezeDescriptors(prefix); const observed = observe();
  try {
    expect(project(prefix)).toEqual(expected);
    const [context] = observed.projections(); expectSourceOrder(context, expectedCalls(prefix));
    for (const value of prefix.executions) for (const separate of value.history) {
      const original = sources(prefix).find(source => source.sourceId === separate.sourceId)!;
      expect(separate).not.toBe(original);
      const first = context.calls.find(call => call.source === original)!.encoded;
      const other = context.calls.find(call => call.source === separate)!.encoded;
      expect(other).toEqual(first); expect(other).not.toBe(first);
    }
  } finally { observed.restore(); }
});

it.each([false, true])('reencodes mutable descendants with shallow-frozen Source root=%s', shallow => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(2, 'mutable');
  if (shallow) sources(prefix).forEach(Object.freeze);
  const observed = observe();
  try {
    project(prefix); const [context] = observed.projections();
    for (const source of sources(prefix)) {
      const calls = context.calls.filter(call => call.source === source);
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(new Set(calls.map(call => call.encoded)).size).toBe(calls.length);
      expect(new Set(calls.map(call => call.encoded.json)).size).toBe(1);
    }
  } finally { observed.restore(); }
});

it.each([false, true])('detects a Source descendant mutation between original/history comparison with shallow root=%s', shallow => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(2, 'mutable'), target = prefix.executions[0].source;
  if (shallow) Object.freeze(target);
  let changed = false;
  const observed = observe(source => {
    if (source === target && !changed) { changed = true; mutable(target.action).contractMutation = 1; }
  });
  try {
    expect(() => project(prefix)).toThrow(/Source prefix differs/);
    expect(changed).toBe(true);
    const calls = observed.projections()[0].calls.filter(call => call.source === target);
    expect(calls).toHaveLength(2); expect(calls[1].encoded).not.toBe(calls[0].encoded);
    expect(calls[1].encoded.json).not.toBe(calls[0].encoded.json);
  } finally { observed.restore(); delete mutable(target.action).contractMutation; }
  // A failed comparison must not poison the next public operation.
  expect(() => project(prefix)).not.toThrow();
});

it('starts a new Source encoding scope for every projection, including projects through one replay factory', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(2), replay = physical.createBattedWorldFieldPhysicalReplay();
  const observed = observe();
  try {
    project(prefix); project(prefix); replay.project(prefix); replay.project(prefix);
    const contexts = observed.projections(); expect(contexts).toHaveLength(4);
    const terminal = prefix.executions.at(-1)!.source;
    expect(contexts.every(context => context.calls.some(call => call.source === terminal))).toBe(true);
    const encoded = contexts.map(context => context.calls.find(call => call.source === terminal)!.encoded);
    expect(new Set(encoded).size).toBe(4); expect(new Set(encoded.map(value => value.json)).size).toBe(1);
  } finally { observed.restore(); }
});

it('keeps the public history helper fresh with exactly two arguments and exposes no trusted comparator', () => {
  const source = ownedPhysicalPlanEncodingFixture(0).prefix.executions[0].source;
  const json = vi.spyOn(canonical, 'actorJson');
  try {
    expect(matches([source], [source])).toBe(true); expect(matches([source], [source])).toBe(true);
    expect(json.mock.calls.filter(([value]) => value === source)).toHaveLength(4);
    expect(matches.length).toBe(2); expect(physical).not.toHaveProperty('executionHistoryMatches');
    if (false) {
      // @ts-expect-error Public callers cannot inject trusted comparison bytes.
      matches([source], [source], () => 'forged');
    }
  } finally { json.mockRestore(); }
});

it('rejects a malformed original before comparing histories and retains actual-history short circuit', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(1, 'mutable'), first = prefix.executions[0].source;
  const bad = { ...first, action: { ...first.action, number: Infinity } } as unknown as Source;
  const unequal = { ...first, sourceVersion: 'different' };
  expect(() => matches([unequal], [first, bad])).toThrow(/finite/);
  // The first actual record differs: the later invalid record must stay unencoded.
  expect(matches([unequal, bad], [first, first])).toBe(false);
  const terminal = prefix.executions.at(-1)!;
  mutable(terminal).history = [unequal, bad];
  expect(() => project(prefix)).toThrow(/Source prefix differs/);
});

it('rejects a non-inert original tail before reading a malformed actual history in the public projection', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(1, 'mutable'), terminal = prefix.executions.at(-1)!;
  mutable(terminal.source.action).bad = Infinity;
  mutable(terminal).history = new Array(terminal.revision);
  expect(() => project(prefix)).toThrow(/finite/);
});

it('rechecks active, sparse, extra-key and oversized history arrays after earlier Sources have warmed', () => {
  let getters = 0;
  const changes: ((history: Source[]) => void)[] = [
    history => { Object.defineProperty(history, '0', { enumerable: true, get() { getters++; return null; } }); },
    history => { Object.defineProperty(history, '0', { enumerable: false, value: history[0] }); },
    history => { delete history[0]; },
    history => { Object.defineProperty(history, Symbol('hidden'), { value: 1 }); },
    history => { Object.defineProperty(history, 'extra', { value: 1 }); },
    history => { history.length = 100_001; },
  ];
  for (const change of changes) {
    const { prefix } = ownedPhysicalPlanEncodingFixture(2, 'mutable');
    // Freeze the exact Source identities without freezing any history array.
    // Earlier valid rows must yield real same-context source-encoding hits before
    // the terminal malformed container is checked on each fresh invocation.
    sources(prefix).forEach(source => { freezeDescriptors(source); });
    const warmed = prefix.executions[0].source, terminal = prefix.executions.at(-1)!;
    const history = terminal.history as Source[]; change(history);
    expect(Object.isFrozen(warmed)).toBe(true); expect(Object.isFrozen(warmed.action)).toBe(true);
    const observed = observe(); let previousEncoding: Encoding | undefined;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(terminal.history).toBe(history); expect(Object.isFrozen(history)).toBe(false);
        expect(() => project(prefix)).toThrow(/inert|size limits/);
        const contexts = observed.projections(); expect(contexts).toHaveLength(attempt + 1);
        const calls = contexts[attempt].calls.filter(call => call.source === warmed);
        expect(calls.length).toBeGreaterThanOrEqual(2);
        calls.slice(1).forEach(call => { expect(call.encoded).toBe(calls[0].encoded); });
        if (previousEncoding) expect(calls[0].encoded).not.toBe(previousEncoding);
        previousEncoding = calls[0].encoded;
        expect(terminal.history).toBe(history);
      }
    } finally { observed.restore(); }
  }
  expect(getters).toBe(0);
});

it('does not retain failed encodings and can validate a repaired Source in the next projection', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(1, 'mutable'), target = prefix.executions.at(-1)!.source;
  let getters = 0;
  Object.defineProperty(target.action, 'bad', { configurable: true, enumerable: true, get() { getters++; return 1; } });
  const replay = physical.createBattedWorldFieldPhysicalReplay();
  expect(() => replay.project(prefix)).toThrow(/accessors/);
  expect(() => replay.project(prefix)).toThrow(/accessors/); expect(getters).toBe(0);
  delete mutable(target.action).bad; freezeDescriptors(prefix);
  expect(replay.project(prefix)).toEqual(project(prefix));
});

it('rejects frozen non-inert Source descendants with the original codec errors', () => {
  let called = 0;
  const changes: ((target: Record<string, any>) => void)[] = [
    target => { target.bad = NaN; }, target => { target.bad = Infinity; },
    target => { target.bad = undefined; }, target => { target.bad = 1n; },
    target => { target.toJSON = () => { called++; return {}; }; },
    target => { target.bad = Object.create({ inherited: true }); },
    target => { Object.defineProperty(target, Symbol('hidden'), { value: true }); },
    target => { target.bad = target; },
    target => { Object.defineProperty(target, 'bad', { enumerable: true, get() { called++; return 1; } }); },
  ];
  for (const change of changes) {
    const { prefix } = ownedPhysicalPlanEncodingFixture(0, 'mutable'), target = prefix.executions[0].source;
    change(mutable(target.action)); freezeDescriptors(prefix);
    const expected = outcome(() => canonical.actorJson(target)); expect(expected.ok).toBe(false);
    expect(outcome(() => project(prefix))).toEqual(expected);
    expect(outcome(() => project(prefix))).toEqual(expected);
  }
  expect(called).toBe(0);
});

// Count expanded occurrences, not distinct references, exactly as the codec budget does.
const nodes = (value: unknown): number => value === null || typeof value !== 'object' ? 1
  : 1 + Object.values(value).reduce<number>((total, child) => total + nodes(child), 0);
it('retains the exact per-Source node boundary and charges shared references repeatedly', () => {
  for (const shared of [false, true]) for (const excess of [0, 1]) {
    const { prefix } = ownedPhysicalPlanEncodingFixture(0, 'mutable'), source = prefix.executions[0].source;
    mutable(source.action).contractPayload = [];
    const available = 100_000 - nodes(source), leaf = { n: 0 };
    const payload = shared ? Array(Math.floor(available / 2)).fill(leaf) : Array(available).fill(0);
    if (shared && available % 2) payload.push(0);
    if (excess) payload.push(0);
    mutable(source.action).contractPayload = payload; freezeDescriptors(prefix);
    expect(nodes(source)).toBe(100_000 + excess);
    if (excess) {
      expect(() => matches([source], [source])).toThrow(/size limits/);
      expect(() => project(prefix)).toThrow(/size limits/);
    } else {
      expect(matches([source], [source])).toBe(true); expect(() => project(prefix)).not.toThrow();
    }
  }
});

it('retains depth 64 acceptance and depth 65 rejection inside a real projection Source', () => {
  for (const depth of [64, 65]) {
    const { prefix } = ownedPhysicalPlanEncodingFixture(0, 'mutable'), source = prefix.executions[0].source;
    // Source is depth 0, action depth 1, contractPayload depth 2.
    let payload: unknown = null;
    for (let level = 2; level < depth; level++) payload = { next: payload };
    mutable(source.action).contractPayload = payload; freezeDescriptors(prefix);
    if (depth === 64) { expect(matches([source], [source])).toBe(true); expect(() => project(prefix)).not.toThrow(); }
    else { expect(() => matches([source], [source])).toThrow(/size limits/); expect(() => project(prefix)).toThrow(/size limits/); }
  }
});

it.each(['motion', 'owned_motion_v1'])('retains raw/v1 aggregate budgets for %s and the per-record versioned opt-in', kind => {
  const raw = freezeDescriptors({ action: { kind }, payload: Array(55_000).fill(0) }) as unknown as Source;
  const history = [raw, raw];
  expect(() => canonical.actorJson(raw)).not.toThrow();
  expect(() => matches(history, history)).toThrow(/size limits/);
  const owned = freezeDescriptors({ action: { kind: 'owned_motion_v2' } }) as unknown as Source;
  expect(matches([raw, owned, raw], [raw, owned, raw])).toBe(true);
  // A future owned record cannot change the earlier bounded raw/v1 convention.
  expect(() => matches(history, history)).toThrow(/size limits/);
});

it('preserves canonical integer-key ordering, -0, null, UTF-16 and escaping through cached Source bytes', () => {
  const { prefix } = ownedPhysicalPlanEncodingFixture(0, 'mutable'), source = prefix.executions[0].source;
  const payload = Object.assign(Object.create(null), { z: -0, a: null, '10': 10, '2': 2, '01': 1,
    text: '日本語\u2028\u2029\ud800X\udfff\"\\\n\t' });
  Object.defineProperty(payload, '__proto__', { enumerable: true, value: { own: true } });
  mutable(source.action).contractPayload = payload; freezeDescriptors(prefix);
  const expected = canonical.actorJson(source), observed = observe();
  expect(Object.keys(JSON.parse(canonical.actorJson(payload)))).toEqual(['2', '10', '01', '__proto__', 'a', 'text', 'z']);
  expect(JSON.parse(canonical.actorJson(payload)).z).toBe(0);
  try {
    project(prefix); const calls = observed.projections()[0].calls;
    expect(calls).toHaveLength(2); expect(calls[1].encoded).toBe(calls[0].encoded);
    expect(calls[0].encoded).toEqual({ json: expected, hash: digest(expected) });
    expect(calls[0].encoded.json).toContain('\\ud800'); expect(calls[0].encoded.json).toContain('\\udfff');
  } finally { observed.restore(); }
});
