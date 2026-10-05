import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
/** Only hashes/count scalars are retained. No statement, parameter, row or result cache. */
export const installScalarSqliteCounters = (sample: DatabaseSync) => {
  const entries = new Map<string, { sqlLength: number; prepare: number; get: number; all: number }>();
  const restorers: (() => boolean)[] = []; let closed = false;
  const count = (operation: 'prepare' | 'get' | 'all', sql: string) => {
    const key = sha(sql), value = entries.get(key) ?? { sqlLength: sql.length, prepare: 0, get: 0, all: 0 };
    value[operation]++; entries.set(key, value);
  };
  const install = (prototype: object, name: 'prepare' | 'get' | 'all') => {
    const original = Object.getOwnPropertyDescriptor(prototype, name)!;
    const intercept = function(this: { sourceSQL: string }, ...args: unknown[]) {
      const sql = name === 'prepare' ? args[0] : this.sourceSQL;
      if (!closed && typeof sql === 'string') count(name, sql);
      return Reflect.apply(original.value as (...args: unknown[]) => unknown, this, args);
    };
    const installed = { ...original, value: intercept };
    Object.defineProperty(prototype, name, installed);
    restorers.push(() => {
      const current = Object.getOwnPropertyDescriptor(prototype, name);
      if (!current || current.value !== installed.value || current.configurable !== installed.configurable ||
        current.enumerable !== installed.enumerable || current.writable !== installed.writable ||
        current.get !== installed.get || current.set !== installed.set) return false;
      Object.defineProperty(prototype, name, original); return true;
    });
  };
  const statementPrototype = Object.getPrototypeOf(sample.prepare('SELECT 1')) as object;
  install(Object.getPrototypeOf(sample) as object, 'prepare'); install(statementPrototype, 'get'); install(statementPrototype, 'all');
  return { close() { if (closed) return; closed = true; let changed = false;
      try { for (const restore of restorers.reverse()) if (!restore()) changed = true; } finally { restorers.length = 0; }
      if (changed) throw new Error('SQL counter interceptor changed; later interceptor preserved'); },
    report() { return [...entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sqlHash, counts]) => ({ sqlHash, ...counts })); } };
};
