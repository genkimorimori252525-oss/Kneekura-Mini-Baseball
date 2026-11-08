import { types } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

const legacy = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const original = { stringify: JSON.stringify, ownKeys: Reflect.ownKeys, descriptor: Object.getOwnPropertyDescriptor,
  prototype: Object.getPrototypeOf, array: Array.isArray, entries: Object.entries, fromEntries: Object.fromEntries,
  define: Object.defineProperty, create: Object.create, sort: Array.prototype.sort, iterator: Array.prototype[Symbol.iterator],
  finite: Number.isFinite, string: String, proxy: types.isProxy, set: Set, has: Set.prototype.has, add: Set.prototype.add, remove: Set.prototype.delete };
const fallback = Symbol('canonical JSON requires original clone path');
const arrayIndex = (key: string) => { const n = +key; return n >= 0 && n < 4_294_967_295 && n % 1 === 0 && String(n) === key ? n : -1; };
const compare = (a: string, b: string) => {
  const ai = arrayIndex(a), bi = arrayIndex(b);
  return ai >= 0 ? bi >= 0 ? ai - bi : -1 : bi >= 0 ? 1 : a < b ? -1 : a > b ? 1 : 0;
};

/** The original inert validation order/budgets, without allocating a cloned
 * graph and another sorted graph. No result, authority or DB proof is cached. */
export const canonicalActorJsonV130 = (input: unknown): string => {
  if (JSON.stringify !== original.stringify || Reflect.ownKeys !== original.ownKeys
    || Object.getOwnPropertyDescriptor !== original.descriptor || Object.getPrototypeOf !== original.prototype
    || Array.isArray !== original.array || Object.entries !== original.entries || Object.fromEntries !== original.fromEntries
    || Object.defineProperty !== original.define || Object.create !== original.create || Array.prototype.sort !== original.sort
    || Array.prototype[Symbol.iterator] !== original.iterator || Number.isFinite !== original.finite || String !== original.string || Set !== original.set
    || Set.prototype.has !== original.has || Set.prototype.add !== original.add || Set.prototype.delete !== original.remove
    || Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON') || Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON')
    || Object.getOwnPropertyDescriptor(Object.prototype, 'get') || Object.getOwnPropertyDescriptor(Object.prototype, 'set')
    || Object.getOwnPropertyDescriptor(Object.prototype, 'value')
    || Object.getPrototypeOf(Array.prototype) !== Object.prototype) return legacy(input);
  let nodes = 0;
  const ancestors = new Set<object>();
  const visit = (value: unknown, depth: number): string => {
    if (++nodes > 100_000 || depth > 64) throw new Error('official window input exceeds size limits');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return original.stringify(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('official window input must be finite');
      return original.stringify(value);
    }
    if (typeof value !== 'object') throw new Error('official window input must contain inert data only');
    // Detect proxies before any of their traps. Prior ordinary descriptor
    // reads are unobservable, so the complete legacy traversal runs only once.
    if (original.proxy(value)) throw fallback;
    if (ancestors.has(value)) throw new Error('official window input must not contain cycles');
    ancestors.add(value);
    const array = Array.isArray(value);
    if (!array) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) throw new Error('official window input must be a plain inert object');
    } else if (Reflect.ownKeys(value).length !== value.length + 1) throw new Error('official window input must be a dense inert array');
    const keys = Reflect.ownKeys(value);
    if (array) {
      let index = 0;
      for (const key of keys) if (key !== 'length' && key !== String(index++)) throw fallback;
    }
    const fields: Record<string, string> = Object.create(null);
    let items = '', count = 0;
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('official window input must not contain symbols');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('official window input must not contain accessors');
      const encoded = visit(descriptor.value, depth + 1);
      if (array) { items += (count++ ? ',' : '') + encoded; } else fields[key] = encoded;
    }
    ancestors.delete(value);
    if (array) return '[' + items + ']';
    const ordered = keys as string[]; ordered.sort(compare);
    for (const key of ordered) items += (count++ ? ',' : '') + original.stringify(key) + ':' + fields[key];
    return '{' + items + '}';
  };
  try { return visit(input, 0); } catch (error) { if (error === fallback) return legacy(input); throw error; }
};
