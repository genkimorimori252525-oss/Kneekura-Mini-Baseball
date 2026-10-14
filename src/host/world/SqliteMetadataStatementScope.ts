import type { DatabaseSync, StatementSync } from 'node:sqlite';
type Db = Pick<DatabaseSync, 'prepare'>;

// Entries exist only during one synchronous owner proof. Keep the original
// connection identity: other owners use it for their own private replay context.
const scopes = new WeakMap<Db, Map<string, StatementSync>>();

/** Reuse compilation only. No row, JSON projection, validation or evidence is saved. */
export const withSqliteMetadataStatementScope = <T>(db: Db, derive: () => T): T => {
  const previous = scopes.get(db), statements = new Map<string, StatementSync>();
  scopes.set(db, statements);
  try { return derive(); }
  finally {
    statements.clear();
    if (previous) scopes.set(db, previous); else scopes.delete(db);
  }
};

const read = <T>(db: Db, sql: string, execute: (statement: StatementSync) => T): T => {
  const statements = scopes.get(db), cached = statements?.get(sql);
  // A SQLite function or instrumented connection may reenter a reader. Never
  // share an executing statement, and never expose a retained statement/iterator.
  statements?.delete(sql);
  const statement = cached ?? db.prepare(sql);
  try { return execute(statement); }
  finally { statements?.set(sql, statement); }
};

// Document metadata readers keep their two original binding shapes. Every call
// executes against the current raw document; no projection result is retained.
export const sqliteMetadataGet = (db: Db, sql: string, document: string) =>
  read(db, sql, statement => statement.get(document));
export const sqliteMetadataAll = (db: Db, sql: string, document: string) =>
  read(db, sql, statement => statement.all({ document }));

// Lifecycle identity/assessment claims use the same immutable owner scope.
// Rebind and execute the original typed-JSON query for every identity; only its
// compiled statement is shared, never a row, parsed claim or validation result.
export const sqliteMetadataClaimRows = (db: Db, sql: string, id: string) =>
  read(db, sql, statement => statement.all({ id }));
