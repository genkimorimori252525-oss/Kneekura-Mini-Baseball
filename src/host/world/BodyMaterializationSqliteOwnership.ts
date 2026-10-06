import type { DatabaseSync } from 'node:sqlite';
import { sqliteJsonMetadataNodes } from './SqliteOwnershipMetadata';

export type BodyCompositionDb = Pick<DatabaseSync, 'prepare'>;
export const bodyCompositionTableInstalled = (db: BodyCompositionDb, name: string): boolean => {
  const rows = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(name);
  if (!rows.length) return false;
  if (rows.length !== 1 || rows[0].type !== 'table') throw new Error('body composition main owner schema differs');
  return true;
};
/** Original native owners use unqualified names: peers and TEMP cannot supply replacements. */
export const assertBodyCompositionNativeConnection = (db: BodyCompositionDb): void => {
  const databases = db.prepare('PRAGMA database_list').all();
  if (databases.filter(row => row.name === 'main').length !== 1 || databases.some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
    throw new Error('body composition requires original main owners');
  }
};
export const bodyCompositionSourceClaim = (document: string, path: readonly string[]) =>
  `EXISTS (SELECT 1 FROM (${sqliteJsonMetadataNodes(document, path)}) identity WHERE identity.type='text' AND identity.atom=?)`;
/** Own a snapshot only when the caller has not already opened a transaction. */
export const withBodyCompositionTransaction = <T>(db: DatabaseSync, write: boolean, body: () => T): T => {
  assertBodyCompositionNativeConnection(db);
  if (db.isTransaction) return body();
  db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
  try {
    const value = body();
    if (!db.isTransaction) throw new Error('body composition transaction disappeared');
    db.exec('COMMIT'); return value;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
};
