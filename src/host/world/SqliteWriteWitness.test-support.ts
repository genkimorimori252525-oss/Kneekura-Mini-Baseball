import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';

const sameDescriptor = (actual: PropertyDescriptor | undefined, expected: PropertyDescriptor): boolean => actual !== undefined
  && (['configurable', 'enumerable', 'value', 'writable', 'get', 'set'] as const).every(key => actual[key] === expected[key]);

/** Test-only observation after the real SQLite statement and its triggers finish.
 * Never use a mock/spy here: its global result history retains every unrelated
 * native StatementSync throughout a potentially long physical derivation. */
export const witnessSqliteWrite = (sql: string | RegExp, observed: (db: DatabaseSync) => boolean) => {
  const pattern = typeof sql === 'string' ? null : new RegExp(sql.source, sql.flags.replace(/[gy]/g, ''));
  const sqlite = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const prototype = sqlite.DatabaseSync.prototype, descriptor = Object.getOwnPropertyDescriptor(prototype, 'prepare');
  if (!descriptor || typeof descriptor.value !== 'function') throw new Error('SQLite witness requires an own prepare method descriptor');
  const prepare = descriptor.value as DatabaseSync['prepare'];
  const restoreTargets: (() => boolean)[] = [];
  let reached = false, closed = false;
  const intercept = function(this: DatabaseSync, ...args: Parameters<DatabaseSync['prepare']>) {
    const text = args[0];
    const statement = Reflect.apply(prepare, this, args) as ReturnType<DatabaseSync['prepare']>;
    if (!closed && (pattern ? pattern.test(text) : text === sql)) {
      const connection = this, run = statement.run, originalRun = Object.getOwnPropertyDescriptor(statement, 'run');
      const wrappedRun = (...args: unknown[]) => {
        const result = Reflect.apply(run, statement, args);
        if (!closed) reached = observed(connection) || reached;
        return result;
      };
      const installedRun = { configurable: true, writable: true, enumerable: originalRun?.enumerable ?? false, value: wrappedRun };
      Object.defineProperty(statement, 'run', installedRun);
      // Only a target statement is held, so its exact descriptor can be restored.
      restoreTargets.push(() => {
        if (!sameDescriptor(Object.getOwnPropertyDescriptor(statement, 'run'), installedRun)) return false;
        if (originalRun) Object.defineProperty(statement, 'run', originalRun); else Reflect.deleteProperty(statement, 'run');
        return true;
      });
    }
    return statement;
  };
  const installedPrepare = { ...descriptor, value: intercept };
  Object.defineProperty(prototype, 'prepare', installedPrepare);
  return { wasReached: () => reached, close() {
    if (closed) return; closed = true;
    let changed = false;
    try {
      if (sameDescriptor(Object.getOwnPropertyDescriptor(prototype, 'prepare'), installedPrepare)) Object.defineProperty(prototype, 'prepare', descriptor);
      else changed = true;
      for (const restore of restoreTargets) if (!restore()) changed = true;
    } finally { restoreTargets.length = 0; }
    if (changed) throw new Error('SQLite witness interceptor changed before close; later interceptor was preserved');
  } };
};
