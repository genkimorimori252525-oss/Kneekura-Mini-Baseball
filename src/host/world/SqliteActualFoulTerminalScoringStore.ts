import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { createSqliteOfficialScoringWriter } from '../SqliteOfficialScoringWriter';
import { officialStateSerialized as json } from '../OfficialStateEncoding';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { assertTerminalScoringStorage, terminalScoringSchema, TerminalScoringProofIntegrityError } from './ActualFoulTerminalScoringEvidenceFromSqlite';

export type SqliteActualFoulTerminalScoringStore = Readonly<{
  apply(terminalSourceId: string): PersistedOfficialScoring;
  read(terminalSourceId: string): PersistedOfficialScoring | null;
  close(): void;
}>;

/** Existing admitted private artifact only. No CREATE, migration, application,
 * acknowledgement, workload or activation operation belongs to this owner. */
export const openSqliteActualFoulTerminalScoringStore = (path: string): SqliteActualFoulTerminalScoringStore => {
  if (!id(path) || !isAbsolute(path) || path === ':memory:' || !lstatSync(path).isFile() || realpathSync(path) !== path) {
    throw new Error('terminal scoring requires an existing canonical regular-file artifact');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  let writer: ReturnType<typeof createSqliteOfficialScoringWriter>;
  try {
    db.exec('BEGIN'); assertTerminalScoringStorage(db); db.exec('COMMIT');
    if (db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0) {
      throw new Error('terminal scoring constructor commit boundary differs');
    }
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
    writer = createSqliteOfficialScoringWriter(db);
  } catch (error) {
    const errors = [error];
    try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (cleanup) { errors.push(cleanup); }
    try { db.close(); } catch (cleanup) { errors.push(cleanup); }
    if (errors.length > 1) throw new AggregateError(errors,'terminal scoring constructor cleanup failed',{ cause:error });
    throw error;
  }
  let closed = false, failed = false;
  const queryOnly = () => {
    const setting = db.prepare('PRAGMA query_only').get()!.query_only;
    if (setting !== 0 && setting !== 1) throw new Error('terminal scoring query_only differs');
    return setting;
  };
  const counters = () => ({ schema:terminalScoringSchema(db),changes:db.prepare('SELECT total_changes() AS n').get()!.n });
  const retire = (error: unknown, cleanup: unknown[]): never => {
    failed = true;
    try { db.close(); closed = true; } catch (closeError) { cleanup.push(closeError); }
    throw new AggregateError([error,...cleanup],'terminal scoring retired after transaction cleanup failure',{ cause:error });
  };
  const transaction = <T>(sourceId: string, write: boolean, body: () => { value:T; changes:0 | 1 }): T => {
    if (closed || failed) throw new Error('closed terminal scoring store');
    if (!id(sourceId)) throw new Error('invalid terminal scoring Source identity');
    if (db.isTransaction) return retire(new Error('terminal scoring has an unowned transaction'),[]);
    const setting = queryOnly(), before = counters(), name = 'terminal_scoring_' + randomUUID().replaceAll('-','');
    let acquired = false;
    try {
      db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
      if (!db.isTransaction) throw new Error('terminal scoring transaction acquisition disappeared');
      acquired = true;
      db.exec('SAVEPOINT ' + name);
      const result = body(), after = counters();
      if (!db.isTransaction || queryOnly() !== setting || typeof before.changes !== 'number'
        || !Number.isSafeInteger(before.changes + result.changes) || after.changes !== before.changes + result.changes) {
        throw new Error('terminal scoring exact write accounting or transaction differs');
      }
      if (json(after.schema) !== json(before.schema)) throw new Error('terminal scoring schema changed during operation');
      try { db.exec('RELEASE ' + name); } catch (error) { failed = true; throw error; }
      if (!db.isTransaction) { failed = true; throw new Error('terminal scoring owned transaction disappeared'); }
      db.exec('COMMIT');
      if (db.isTransaction || queryOnly() !== setting) {
        failed = true; throw new Error('terminal scoring commit boundary differs');
      }
      return result.value;
    } catch (error) {
      if (!acquired || error instanceof TerminalScoringProofIntegrityError) failed = true;
      const cleanup: unknown[] = [];
      try {
        if (db.isTransaction) {
          try { db.exec('ROLLBACK TO ' + name); } catch (identity) { failed = true; cleanup.push(identity); }
          db.exec('ROLLBACK');
        } else failed = true;
      } catch (rollback) { failed = true; cleanup.push(rollback); }
      try {
        if (queryOnly() !== setting) { db.exec('PRAGMA query_only=' + setting); failed = true; }
        if (db.isTransaction || queryOnly() !== setting) { failed = true; cleanup.push(new Error('terminal scoring cleanup state differs')); }
      } catch (restore) { failed = true; cleanup.push(restore); }
      if (failed || cleanup.length) return retire(error,cleanup);
      throw error;
    }
  };
  return Object.freeze({
    apply(sourceId) { return transaction(sourceId,true,() => writer.applyTerminal(sourceId)); },
    read(sourceId) { return transaction(sourceId,false,() => ({ value:writer.readTerminal(sourceId),changes:0 })); },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
