import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Independent copy of the pre-V130 serializer. Do not route this oracle through
// the candidate helper: allocation changes must preserve these original bytes.
const legacy = (v: unknown): string => JSON.stringify(cloneInert(v), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
type Fixture = { value: unknown; trace?: string[]; restore?: () => void };
const observe = (serialize: (value: unknown) => string, make: () => Fixture) => {
  const fixture = make();
  try {
    try { return { output: serialize(fixture.value), error: null, trace: [...(fixture.trace ?? [])] }; }
    catch (error) { return { output: null, error: { name: (error as Error).name, message: (error as Error).message }, trace: [...(fixture.trace ?? [])] }; }
  } finally { fixture.restore?.(); }
};
const same = (make: () => Fixture) => {
  const original = observe(legacy, make), candidate = observe(actorJson, make);
  expect(candidate).toEqual(original);
  return original;
};
const plain = (make: () => unknown) => () => ({ value: make() });
const nested = (depth: number) => {
  let value: unknown = 0;
  for (let i = 0; i < depth; i++) value = { child: value };
  return value;
};
const property = (object: object, key: PropertyKey, value: unknown) => {
  Object.defineProperty(object, key, { value, enumerable: true, configurable: true, writable: true });
  return object;
};
const prototypeProperty = (target: object, key: PropertyKey, descriptor: PropertyDescriptor) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, ...descriptor });
  return () => {
    // Remove a polluted descriptor key before passing another descriptor to
    // defineProperty; an inherited get/set/value can change that operation.
    Reflect.deleteProperty(target, key);
    if (previous) Object.defineProperty(target, key, previous);
  };
};

describe.sequential('Canonical actor JSON V130 — original byte and validation contract', () => {
  it.each([
    ['plain nested data', () => ({ z: [true, null, { y: 2, a: 'x' }], a: 1 })],
    ['null prototype and __proto__ data', () => property(Object.assign(Object.create(null), { z: 2, a: 1 }), '__proto__', { value: 3 })],
    ['shared aliases', () => { const child = { z: [1, 2], a: false }; return { second: child, first: child }; }],
    ['finite number spellings', () => [-0, 0, Number.MIN_VALUE, Number.MAX_VALUE, 1e-7, 1e21, .000001]],
    ['Unicode and unmatched surrogates', () => ['日本語', '😀', '\u0000tail', '\ud800', '\udfff', '\ud83d\ude00', '\u2028\u2029', '"\\\n']],
    ['own nonfunction toJSON', () => ({ z: { toJSON: null, x: 2 }, toJSON: 'ordinary data', a: [1] })],
  ] as const)('matches original canonical bytes: %s', (_name, make) => {
    const result = same(plain(make));
    expect(result.error).toBeNull();
    expect(actorHash(make())).toBe(sha(result.output!));
  });

  it('orders true integer keys numerically and all remaining keys lexically, preserving own __proto__', () => {
    const make = () => {
      const value: Record<string, unknown> = {};
      for (const key of ['z', '4294967295', '01', '2', '-0', '4294967294', '0', '10', 'a']) property(value, key, key);
      property(value, '__proto__', 'data');
      return value;
    };
    expect(same(plain(make)).output).toBe('{"0":"0","2":"2","10":"10","4294967294":"4294967294","-0":"-0","01":"01","4294967295":"4294967295","__proto__":"data","a":"a","z":"z"}');
    expect(same(plain(() => -0)).output).toBe('0');
  });

  it.each([64, 65])('preserves the depth boundary at %i', depth => {
    const result = same(plain(() => nested(depth)));
    expect(result.error?.message ?? null).toBe(depth === 64 ? null : 'official window input exceeds size limits');
  });

  it.each([99_999, 100_000])('counts root and every primitive at array length %i', length => {
    const result = same(plain(() => Array(length).fill(null)));
    expect(result.error?.message ?? null).toBe(length === 99_999 ? null : 'official window input exceeds size limits');
  });

  it.each([33_333, 33_334])('revisits aliases rather than deduplicating the node budget: %i aliases', count => {
    const result = same(plain(() => { const child = { leaf: [1] }; return Array(count).fill(child); }));
    expect(result.error?.message ?? null).toBe(count === 33_333 ? null : 'official window input exceeds size limits');
  });

  it.each([
    ['undefined', (): unknown => undefined, 'inert data only'],
    ['function', () => () => 1, 'inert data only'],
    ['bigint', (): unknown => 1n, 'inert data only'],
    ['symbol value', () => Symbol('value'), 'inert data only'],
    ['NaN', () => NaN, 'must be finite'],
    ['Infinity', () => Infinity, 'must be finite'],
    ['Date', () => new Date(0), 'plain inert object'],
    ['custom prototype', () => Object.create({ inherited: 1 }), 'plain inert object'],
    ['symbol key', () => property({}, Symbol('key'), 1), 'must not contain symbols'],
    ['nonenumerable', () => Object.defineProperty({}, 'hidden', { value: 1 }), 'must not contain accessors'],
    ['own toJSON function', () => ({ toJSON() { throw Error('must not execute'); } }), 'inert data only'],
    ['cycle', (): unknown => { const value: { self?: unknown } = {}; value.self = value; return value; }, 'must not contain cycles'],
    ['array cycle', (): unknown => { const value: unknown[] = []; value.push(value); return value; }, 'must not contain cycles'],
  ] as const)('preserves rejection: %s', (_name, make, reason) => {
    expect(same(plain(make)).error?.message).toContain(reason);
  });

  it('rejects accessors without running getters, and validates original insertion order before sorting', () => {
    const result = same(() => {
      const trace: string[] = [];
      const value = Object.defineProperty({ z: 1 }, 'a', { enumerable: true, get() { trace.push('getter'); throw Error('getter executed'); } });
      return { value, trace };
    });
    expect(result.trace).toEqual([]);
    expect(result.error?.message).toContain('must not contain accessors');
    expect(same(plain(() => ({ z: NaN, a: undefined }))).error?.message).toContain('must be finite');
    expect(same(plain(() => ({ z: undefined, a: NaN }))).error?.message).toContain('inert data only');
  });

  it.each([
    ['dense', () => [1, null, false], '[1,null,false]', null],
    ['uncompensated sparse', () => new Array(1), null, 'dense inert array'],
    ['hole balanced by extra property', () => Object.assign(new Array(1), { extra: 1 }), '[]', null],
    ['trailing hole balanced by extra property', () => Object.assign([1, ,], { extra: 2 }), '[1]', null],
    ['interior hole and extra property', () => Object.assign([, 1], { extra: 2 }), '[null,1]', null],
    ['ignored property still rejects undefined', () => Object.assign(new Array(1), { extra: undefined }), null, 'inert data only'],
    ['dense with extra property', () => Object.assign([1], { extra: 2 }), null, 'dense inert array'],
  ] as const)('preserves original array semantics: %s', (_name, make, output, reason) => {
    const result = same(plain(make));
    expect(result.output).toBe(output);
    if (reason) expect(result.error?.message).toContain(reason); else expect(result.error).toBeNull();
  });

  it('validates ignored nonindex array values against the node budget', () => {
    const result = same(plain(() => Object.assign(new Array(1), { ignored: Array(99_999).fill(null) })));
    expect(result.error?.message).toBe('official window input exceeds size limits');
  });

  it.each(['object', 'null-prototype', 'array'] as const)('preserves inherited toJSON timing and clone receiver: %s', kind => {
    const result = same(() => {
      const trace: string[] = [], value = kind === 'array' ? [1] : Object.assign(kind === 'null-prototype' ? Object.create(null) : {}, { z: 2, a: 1 });
      const restore = prototypeProperty(kind === 'array' ? Array.prototype : Object.prototype, 'toJSON', {
        value: function(this: object, key: string) { trace.push('toJSON:' + key + ':' + (this === value ? 'source' : 'clone')); return 'keys:' + Object.keys(this).join(','); },
      });
      return { value, trace, restore };
    });
    expect(result.trace).toEqual(['toJSON::clone']);
    expect(result.output).toBe(kind === 'array' ? '"keys:0"' : '"keys:z,a"');
  });

  it('preserves inherited numeric array properties in compensated holes', () => {
    const result = same(() => ({ value: Object.assign([, 'own'], { extra: 1 }),
      restore: prototypeProperty(Array.prototype, '0', { value: 'inherited', writable: true }) }));
    expect(result.output).toBe('["inherited","own"]');
  });

  it.each(['object', 'array'] as const)('preserves Proxy trap order without duplicating effects: %s', kind => {
    const result = same(() => {
      const trace: string[] = [], target = kind === 'array' ? [1, { z: 2 }] : { z: { b: 2 }, a: 1 };
      const value = new Proxy(target, {
        getPrototypeOf(t) { trace.push('prototype'); return Reflect.getPrototypeOf(t); },
        ownKeys(t) { trace.push('keys'); return Reflect.ownKeys(t); },
        getOwnPropertyDescriptor(t, key) { trace.push('descriptor:' + String(key)); return Reflect.getOwnPropertyDescriptor(t, key); },
        get(t, key, receiver) { trace.push('get:' + String(key)); return Reflect.get(t, key, receiver); },
      });
      return { value, trace };
    });
    expect(result.error).toBeNull();
    expect(result.trace).toEqual(kind === 'array' ? ['keys', 'get:length', 'keys', 'descriptor:0', 'descriptor:1']
      : ['prototype', 'keys', 'descriptor:z', 'descriptor:a']);
  });

  it('finishes clone validation before a Proxy-installed prototype toJSON, with no second trap traversal', () => {
    const result = same(() => {
      const trace: string[] = [], previous = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON');
      const target = { z: 2, a: { child: 1 } };
      const value = new Proxy(target, {
        getPrototypeOf(t) { trace.push('prototype'); return Reflect.getPrototypeOf(t); },
        ownKeys(t) { trace.push('keys'); return Reflect.ownKeys(t); },
        getOwnPropertyDescriptor(t, key) {
          trace.push('descriptor:' + String(key));
          if (key === 'z') Object.defineProperty(Object.prototype, 'toJSON', { configurable: true, value: function(key: string) { trace.push('installed-toJSON:' + key); return 'installed:' + key; } });
          return Reflect.getOwnPropertyDescriptor(t, key);
        },
      });
      return { value, trace, restore: () => { if (previous) Object.defineProperty(Object.prototype, 'toJSON', previous); else Reflect.deleteProperty(Object.prototype, 'toJSON'); } };
    });
    expect(result.output).toBe('"installed:"');
    expect(result.trace).toEqual(['prototype', 'keys', 'descriptor:z', 'descriptor:a', 'installed-toJSON:']);
  });

  it('review RED: preserves integer-key bytes when the global String intrinsic changes', () => {
    const make = (): Fixture => {
      const previous = globalThis.String, value = { 2: 'b', 10: 'a' };
      globalThis.String = (() => '') as unknown as StringConstructor;
      return { value, restore: () => { globalThis.String = previous; } };
    };
    const original = observe(legacy, make), candidate = observe(actorJson, make);
    // Both executions have restored String before any assertion/framework work.
    expect(original.output).toBe('{"2":"b","10":"a"}');
    expect(original.error).toBeNull();
    expect(candidate).toEqual(original);
  });

  it('review RED: preserves clone defineProperty rejection with inherited descriptor get pollution', () => {
    const make = (): Fixture => {
      const value = { x: 1 };
      const restore = prototypeProperty(Object.prototype, 'get', { value: () => 7 });
      return { value, restore };
    };
    const original = observe(legacy, make), candidate = observe(actorJson, make);
    // observe deletes prototype.get in finally, before matching exceptions.
    expect(original.output).toBeNull();
    expect(original.error?.name).toBe('TypeError');
    expect(original.error?.message).toMatch(/Invalid property descriptor/);
    expect(candidate).toEqual(original);
  });

  it('review RED: preserves inherited descriptor value getter and its late toJSON side effect', () => {
    const make = (): Fixture => {
      const trace: string[] = [], value = Object.defineProperty({}, 'x', {
        enumerable: true, get() { trace.push('input-getter'); throw Error('input getter must not run'); },
      });
      const previousHook = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON');
      const restoreValue = prototypeProperty(Object.prototype, 'value', {
        get() {
          trace.push('descriptor-value');
          Object.defineProperty(Object.prototype, 'toJSON', { configurable: true,
            value: function(key: string) { trace.push('late-toJSON:' + key); return 'late:' + key; } });
          return 7;
        },
      });
      return { value, trace, restore: () => {
        restoreValue();
        Reflect.deleteProperty(Object.prototype, 'toJSON');
        if (previousHook) Object.defineProperty(Object.prototype, 'toJSON', previousHook);
      } };
    };
    const original = observe(legacy, make), candidate = observe(actorJson, make);
    expect(original.output).toBe('"late:"');
    expect(original.error).toBeNull();
    expect(original.trace).toEqual(['descriptor-value', 'late-toJSON:']);
    expect(candidate).toEqual(original);
  });

  it('diagnoses repeated pure payload serialization without a speed threshold or controlled CPU claim', () => {
    const payload = { source: { sourceId: 'characterization-only', sourceVersion: 'v130' },
      participants: Array.from({ length: 24 }, (_, i) => ({ playerId: 'p' + i, state: { revision: i, energy: .8, speed: 9 + i / 100 }, position: [i, 1, -0] })) };
    const expected = legacy(payload), repetitions = 50, rounds = 4;
    const measure = (serialize: (value: unknown) => string) => {
      const milliseconds: number[] = [], hash = createHash('sha256'); let equal = true;
      for (let round = 0; round < rounds; round++) {
        const started = performance.now();
        for (let i = 0; i < repetitions; i++) { const output = serialize(payload); equal = equal && output === expected; hash.update(output); }
        milliseconds.push(performance.now() - started);
      }
      expect(equal).toBe(true);
      return { milliseconds, repeatedOutputSha256: hash.digest('hex') };
    };
    const original = measure(legacy), candidate = measure(actorJson);
    expect(candidate.repeatedOutputSha256).toBe(original.repeatedOutputSha256);
    expect(actorHash(payload)).toBe(sha(expected));
    console.info('CANONICAL_JSON_V130_DIAGNOSTIC', JSON.stringify({ rounds, repetitionsPerRound: repetitions,
      serializedBytes: Buffer.byteLength(expected), outputSha256: sha(expected), legacy: original, candidate,
      controlledComparison: false, concurrentRootWorkMayAffectWallTime: true, speedThresholdApplied: false }));
  });
});
