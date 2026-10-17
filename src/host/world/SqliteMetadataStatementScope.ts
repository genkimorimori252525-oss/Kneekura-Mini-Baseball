import type { DatabaseSync, StatementSync } from 'node:sqlite';
type Db = Pick<DatabaseSync, 'prepare'>;

// Keep the scope API and original connection identity for owner replay callers.
// Reusing compiled native statements coincided with malformed-JSON/heap failures
// on retained Native admissions. The cause remains unconfirmed; fresh prepare
// passed the controlled admission and unchanged original-owner rereads.
// Transaction fences remain the responsibility of the continuation read phase.
export const withSqliteMetadataStatementScope = <T>(_db: Db, derive: () => T): T => derive();

const read = <T>(db: Db, sql: string, execute: (statement: StatementSync) => T): T => {
  return execute(db.prepare(sql));
};

// Document metadata readers keep their two original binding shapes. Every call
// executes against the current raw document; no projection result is retained.
export const sqliteMetadataGet = (db: Db, sql: string, document: string) =>
  read(db, sql, statement => statement.get(document));
export const sqliteMetadataAll = (db: Db, sql: string, document: string) =>
  read(db, sql, statement => statement.all({ document }));

// Execute the original typed-JSON query for every identity. No statement, row,
// parsed claim or validation result is retained between calls.
export const sqliteMetadataClaimRows = (db: Db, sql: string, id: string) =>
  read(db, sql, statement => statement.all({ id }));
