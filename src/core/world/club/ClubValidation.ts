import type { ClubIssue, ClubIssueCode, ClubResult } from './ClubTypes';

export class ClubValidationError extends Error {
  constructor(readonly issue: ClubIssue) { super(issue.code + (issue.path ? ': ' + issue.path : '')); }
}
export function fail(code: ClubIssueCode, path?: string): never {
  throw new ClubValidationError(path === undefined ? { code } : { code, path });
}
export function attempt<T>(work: () => T): ClubResult<T> {
  try { return Object.freeze({ ok: true, value: freeze(work()) }); }
  catch (error) {
    if (!(error instanceof ClubValidationError)) throw error;
    return Object.freeze({ ok: false, reason: Object.freeze(error.issue) });
  }
}
/** Only called on freshly parsed plain records and arrays, never caller-owned objects. */
export function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export type Reader<T> = (input: unknown, path: string) => T;
export const text: Reader<string> = (input, path) => {
  if (typeof input !== 'string' || input.trim().length === 0) fail('INVALID_INPUT', path);
  return input;
};
export const integer: Reader<number> = (input, path) => {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 0) fail('INVALID_INPUT', path);
  return input;
};
export const positive: Reader<number> = (input, path) => {
  const n = integer(input, path); if (n === 0) fail('INVALID_INPUT', path); return n;
};
export const index: Reader<number> = (input, path) => {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0 || input > 100) fail('INVALID_INPUT', path);
  return input;
};
export const fraction: Reader<number> = (input, path) => {
  const n = index(input, path); if (n > 1) fail('INVALID_INPUT', path); return n;
};
export const nonnegative: Reader<number> = (input, path) => {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0) fail('INVALID_INPUT', path);
  return input;
};
export const boolean: Reader<boolean> = (input, path) => {
  if (typeof input !== 'boolean') fail('INVALID_INPUT', path); return input;
};
export function enumeration<const T extends readonly (string | number)[]>(values: T): Reader<T[number]> {
  return (input, path) => {
    if (!values.includes(input as T[number])) fail('INVALID_INPUT', path);
    return input as T[number];
  };
}
export function nullable<T>(read: Reader<T>): Reader<T | null> {
  return (input, path) => input === null ? null : read(input, path);
}
export function record(input: unknown, path: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail('INVALID_INPUT', path);
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) fail('INVALID_INPUT', path);
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
    if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) fail('INVALID_INPUT', path);
  }
  return input as Record<string, unknown>;
}
type Shape = Record<string, Reader<unknown>>;
type ShapeValue<S extends Shape> = { [K in keyof S]: S[K] extends Reader<infer T> ? T : never };
export function object<S extends Shape>(shape: S): Reader<ShapeValue<S>> {
  const keys = Object.keys(shape);
  return (input, path) => {
    const source = record(input, path);
    if (Object.keys(source).length !== keys.length || keys.some(k => !Object.hasOwn(source, k))) fail('INVALID_INPUT', path);
    const result: Record<string, unknown> = {};
    for (const key of keys) result[key] = shape[key]!(source[key], path + '.' + key);
    return result as ShapeValue<S>;
  };
}
export function list<T>(read: Reader<T>, keyOf?: (item: T) => string, nonempty = false): Reader<readonly T[]> {
  return (input, path) => {
    if (!Array.isArray(input) || (nonempty && input.length === 0)) fail('INVALID_INPUT', path);
    if (Object.keys(input).length !== input.length || Object.getOwnPropertySymbols(input).length !== 0) fail('INVALID_INPUT', path);
    const seen = new Set<string>(); const result: T[] = [];
    for (let i = 0; i < input.length; i += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail('INVALID_INPUT', path);
      const item = read(descriptor.value, path + '[' + i + ']');
      if (keyOf) {
        const key = keyOf(item); if (seen.has(key)) fail('DUPLICATE_ID', path); seen.add(key);
      }
      result.push(item);
    }
    return result;
  };
}
export const ids = list(text, x => x);
export const evidenceIds = list(text, x => x, true);
/** Exact accumulation first, range check second; cancellation never hides a rounded intermediate. */
export function exact(values: readonly number[], path: string, signed = false): number {
  let total = 0n;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) fail('OVERFLOW', path);
    total += BigInt(value);
  }
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (total > max || total < (signed ? -max : 0n)) fail('OVERFLOW', path);
  return Number(total);
}
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every(k => Object.hasOwn(b, k)
    && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
