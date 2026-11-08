/** Tagged data preserves -0, undefined, NaN and infinities across JSON and
 * browser-tool transport. Ordinary object keys cannot collide with tags. */
export function encodeDebugRecord(value) {
  const stack = new Set();
  function encode(v) {
    if (v === null) return ['null'];
    if (v === undefined) return ['undefined'];
    if (typeof v === 'number') return ['number', Object.is(v, -0) ? '-0' : String(v)];
    if (typeof v === 'string' || typeof v === 'boolean') return [typeof v, v];
    if (typeof v !== 'object' || stack.has(v)) throw Error('expected acyclic plain record data');
    stack.add(v);
    const result = Array.isArray(v) ? ['array', v.map(encode)]
      : ['object', Object.keys(v).map(key => [key, encode(v[key])])];
    stack.delete(v); return result;
  }
  return encode(value);
}

export function decodeDebugRecord(value) {
  function fail() { throw Error('invalid debug record'); }
  if (!Array.isArray(value)) return fail();
  const [tag, payload] = value;
  if (tag === 'null' && value.length === 1) return null;
  if (tag === 'undefined' && value.length === 1) return undefined;
  if (value.length !== 2) return fail();
  if ((tag === 'string' || tag === 'boolean') && typeof payload === tag) return payload;
  if (tag === 'number' && typeof payload === 'string') {
    if (payload === '-0') return -0;
    const n = Number(payload); if (String(n) !== payload) return fail(); return n;
  }
  if (tag === 'array' && Array.isArray(payload)) return payload.map(decodeDebugRecord);
  if (tag === 'object' && Array.isArray(payload)) {
    const keys = new Set();
    return Object.fromEntries(payload.map(pair => {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || keys.has(pair[0])) return fail();
      keys.add(pair[0]); return [pair[0], decodeDebugRecord(pair[1])];
    }));
  }
  return fail();
}

/** Ordinary records retain their normal JSON representation. Only values
 * JSON cannot faithfully represent (and colliding user keys) need wrappers. */
export function stringifyDebugRecord(value) {
  const tag = '$liveDebugValue';
  return JSON.stringify(value, function (key, current) {
    const original = this[key];
    if (original && typeof original === 'object' && !Array.isArray(original)
      && Object.getPrototypeOf(original) !== Object.prototype && Object.getPrototypeOf(original) !== null)
      throw Error('expected plain record data');
    if (['function', 'symbol', 'bigint'].includes(typeof current)) throw Error('expected plain record data');
    if (current === undefined) return { [tag]: ['undefined'] };
    if (typeof current === 'number' && (!Number.isFinite(current) || Object.is(current, -0)))
      return { [tag]: ['number', Object.is(current, -0) ? '-0' : String(current)] };
    if (current && typeof current === 'object' && !Array.isArray(current) && Object.hasOwn(current, tag))
      return { [tag]: ['object', Object.entries(current)] };
    return current;
  });
}

export function parseDebugRecord(text) {
  const tag = '$liveDebugValue';
  function fail() { throw Error('invalid compact debug record'); }
  function restore(value) {
    if (!value || typeof value !== 'object') return value;
    if (!Array.isArray(value) && Object.hasOwn(value, tag)) {
      const wrapped = value[tag];
      if (Object.keys(value).length !== 1 || !Array.isArray(wrapped)) return fail();
      if (wrapped[0] === 'undefined' && wrapped.length === 1) return undefined;
      if (wrapped[0] === 'number' && wrapped.length === 2 && typeof wrapped[1] === 'string') {
        if (wrapped[1] === '-0') return -0;
        const number = Number(wrapped[1]);
        if (Number.isFinite(number) || String(number) !== wrapped[1]) return fail();
        return number;
      }
      if (wrapped[0] === 'object' && wrapped.length === 2 && Array.isArray(wrapped[1])) {
        const keys = new Set();
        return Object.fromEntries(wrapped[1].map(pair => {
          if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || keys.has(pair[0])) return fail();
          keys.add(pair[0]); return [pair[0], restore(pair[1])];
        }));
      }
      return fail();
    }
    for (const key of Object.keys(value)) value[key] = restore(value[key]);
    return value;
  }
  return restore(JSON.parse(text));
}

/** Finds the first exact discrepancy without numeric tolerances or dropped
 * diagnostics. A surrounding frame supplies its simulation tick. */
export function firstDebugDifference(expected, actual, path = '$', tick = null) {
  if (Object.is(expected, actual)) return null;
  const summary = value => value && typeof value === 'object'
    ? ['keys', Object.keys(value)] : encodeDebugRecord(value);
  const mismatch = () => ({ path, tick, expected: summary(expected), actual: summary(actual) });
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object') return mismatch();
  if (Array.isArray(expected) !== Array.isArray(actual)) return mismatch();
  const a = Object.keys(expected), b = Object.keys(actual);
  if (a.length !== b.length || a.some((key, i) => key !== b[i])) return mismatch();
  if (typeof expected.tick === 'number') tick = expected.tick;
  for (const key of a) {
    const next = Array.isArray(expected) ? path + '[' + key + ']' : path + '.' + key;
    const difference = firstDebugDifference(expected[key], actual[key], next, tick);
    if (difference) return difference;
  }
  return null;
}
