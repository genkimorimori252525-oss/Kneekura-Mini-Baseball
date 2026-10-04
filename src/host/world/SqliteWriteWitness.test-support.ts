import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { vi } from 'vitest';

/** Test-only observation after the real SQLite statement and its triggers finish.
 * The boolean survives rollback, but is never supplied to a production owner. */
export const witnessSqliteWrite = (sql: string, observed: (db: DatabaseSync) => boolean) => {
  const sqlite = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const prepare = sqlite.DatabaseSync.prototype.prepare;
  const restoreStatements: (() => void)[] = [];
  let reached = false;
  const spy = vi.spyOn(sqlite.DatabaseSync.prototype, 'prepare').mockImplementation(function(this: DatabaseSync, text: string) {
    const statement = prepare.call(this, text);
    if (text === sql) {
      const connection = this, run = statement.run, descriptor = Object.getOwnPropertyDescriptor(statement, 'run');
      Object.defineProperty(statement, 'run', { configurable: true, value: (...args: unknown[]) => {
        const result = Reflect.apply(run, statement, args);
        reached = observed(connection) || reached;
        return result;
      } });
      restoreStatements.push(() => { if (descriptor) Object.defineProperty(statement, 'run', descriptor); else Reflect.deleteProperty(statement, 'run'); });
    }
    return statement;
  });
  return { wasReached: () => reached, close() { spy.mockRestore(); for (const restore of restoreStatements) restore(); } };
};
