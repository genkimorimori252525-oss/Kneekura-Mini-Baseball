import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { assertFoulTerminalApplicationStorage, deriveFoulTerminalApplicationProposal,
  foulTerminalApplicationEvidenceFromSqlite, foulTerminalApplicationPin, foulTerminalPendingInput } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import type { DurableFoulTerminalApplication, DurableFoulTerminalAppliedPending,
  DurableFoulTerminalAcknowledgedApplication } from './ActualFoulTerminalApplication';

export type SqliteActualFoulTerminalApplicationRunner = Readonly<{
  read(sourceId: string): DurableFoulTerminalApplication | null;
  apply(sourceId: string): DurableFoulTerminalAppliedPending | DurableFoulTerminalAcknowledgedApplication;
  acknowledge(sourceId: string): DurableFoulTerminalAcknowledgedApplication;
  close(): void;
}>;
const same = (actual: unknown, expected: unknown, message: string) => {
  if (json(actual) !== json(expected)) throw new Error(message);
};
/** Existing official schema only. This runner owns no DDL or migration. */
const assertStorage = (db: DatabaseSync): void => {
  if (db.prepare('PRAGMA main.user_version').get()!.user_version !== 3) throw new Error('foul terminal runner requires existing schema version 3');
  if (!assertFoulTerminalApplicationStorage(db)) throw new Error('foul terminal queue schema is missing');
  const definitions = [
    ['matches', [['match_id','TEXT',0,1],['durable_revision','INTEGER',1,0],['state_json','TEXT',1,0],['activation_json','TEXT',0,0]], [['match_id']]],
    ['applications', [['application_id','TEXT',0,1],['match_id','TEXT',1,0],['closure_id','TEXT',1,0],['request_hash','TEXT',1,0],['result_json','TEXT',1,0]],
      [['application_id'],['match_id','closure_id']]],
    ['official_fixtures', [['game_id','TEXT',0,1],['venue_id','TEXT',1,0],['fixture_event_id','TEXT',1,0],['fixture_revision','INTEGER',1,0]],
      [['game_id'],['fixture_event_id']]],
  ] as const;
  for (const [table, columns, keys] of definitions) {
    const found = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(table);
    if (found.length !== 1 || found[0].type !== 'table') throw new Error('foul terminal official schema is missing: ' + table);
    same(db.prepare('PRAGMA main.table_info(' + table + ')').all().map(c => [c.name,c.type,c.notnull,c.pk,c.dflt_value]),
      columns.map(c => [...c,null]), 'foul terminal official columns differ: ' + table);
    const unique = db.prepare('PRAGMA main.index_list(' + table + ')').all().filter(index => index.unique === 1).map(index => {
      if (index.partial !== 0 || !['pk','u'].includes(String(index.origin))) throw new Error('foul terminal official uniqueness differs');
      return db.prepare('PRAGMA main.index_info("' + String(index.name).replaceAll('"','""') + '")').all().map(c => c.name);
    });
    same(unique.map(json).sort(), keys.map(json).sort(), 'foul terminal official unique keys differ: ' + table);
  }
};

/** Consume only an already-v3 private artifact. The external owner must first
 * stop/reap its old process and create/migrate its own new private copy; this
 * opener accepts no quiescence Boolean and makes no shared-database guarantee. */
export const openSqliteActualFoulTerminalApplicationRunner = (path: string): SqliteActualFoulTerminalApplicationRunner => {
  if (!id(path) || !isAbsolute(path) || path === ':memory:' || !lstatSync(path).isFile() || realpathSync(path) !== path) {
    throw new Error('foul terminal runner requires an existing canonical regular-file artifact');
  }
  const { DatabaseSync: NativeDatabase } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new NativeDatabase(path);
  try {
    // Check installed authority before any writer PRAGMA. There is no CREATE,
    // ALTER, INSERT, migration or fallback to a newly initialized database.
    db.exec('BEGIN'); assertStorage(db); db.exec('COMMIT');
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  } catch (error) {
    const errors = [error];
    try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (cleanup) { errors.push(cleanup); }
    try { db.close(); } catch (cleanup) { errors.push(cleanup); }
    if (errors.length > 1) throw new AggregateError(errors,'foul terminal runner constructor cleanup failed',{ cause:error });
    throw error;
  }
  const owner = foulTerminalApplicationEvidenceFromSqlite(db), writer = new SqliteOfficialStateWriter(db);
  let closed = false, failed = false;
  const check = (sourceId: string) => {
    if (closed || failed) throw new Error('closed foul terminal application runner');
    if (!id(sourceId)) throw new Error('invalid foul terminal application Source identity');
  };
  const schema = () => ({ main:db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp:db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
    user:db.prepare('PRAGMA main.user_version').get()!.user_version });
  const counters = () => ({ schema:schema(), changes:db.prepare('SELECT total_changes() AS n').get()!.n });
  const queryOnly = () => {
    const value = db.prepare('PRAGMA query_only').get()!.query_only;
    if (value !== 0 && value !== 1) throw new Error('foul terminal runner query_only differs');
    return value;
  };
  const retire = (error: unknown, cleanup: unknown[]): never => {
    failed = true;
    try { db.close(); closed = true; } catch (closeError) { cleanup.push(closeError); }
    throw new AggregateError([error,...cleanup],'foul terminal runner retired after transaction cleanup failure',{ cause:error });
  };
  const proof = <T>(body: () => T): T => {
    if (!db.isTransaction) { failed = true; throw new Error('foul terminal runner proof transaction is missing'); }
    const savepoint = 'terminal_application_proof_' + randomUUID().replaceAll('-',''), setting = queryOnly();
    db.exec('SAVEPOINT ' + savepoint);
    let primary: unknown, bodyFailed = false;
    try {
      db.exec('PRAGMA query_only=1');
      const before = counters(), result = withBattedVenueLegalReadSnapshot(db,body);
      if (!db.isTransaction || queryOnly() !== 1) throw new Error('foul terminal runner proof transaction changed');
      same(counters(),before,'foul terminal runner proof changed schema or rows');
      try { db.exec('RELEASE ' + savepoint); } catch (error) { failed = true; throw error; }
      return result;
    } catch (error) { primary = error; bodyFailed = true; throw error; }
    finally {
      try {
        db.exec('PRAGMA query_only=' + setting);
        if (queryOnly() !== setting) throw new Error('foul terminal runner proof restoration differs');
      } catch (cleanup) {
        failed = true;
        if (bodyFailed) throw new AggregateError([primary,cleanup],'foul terminal runner proof restoration failed',{ cause:primary });
        throw cleanup;
      }
    }
  };
  const transaction = <T>(sourceId: string, write: boolean, body: () => { value: T; changes: 0 | 1 | 3 }): T => {
    check(sourceId);
    if (db.isTransaction) return retire(new Error('foul terminal runner has an unowned transaction'),[]);
    const setting = queryOnly(), before = counters(), savepoint = 'terminal_application_' + randomUUID().replaceAll('-','');
    db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try {
      db.exec('SAVEPOINT ' + savepoint); proof(() => assertStorage(db));
      const result = body(), after = counters();
      if (!db.isTransaction || queryOnly() !== setting || typeof before.changes !== 'number'
        || !Number.isSafeInteger(before.changes + result.changes) || after.changes !== before.changes + result.changes) {
        throw new Error('foul terminal runner exact write accounting or transaction differs');
      }
      same(after.schema,before.schema,'foul terminal runner schema changed during operation');
      try { db.exec('RELEASE ' + savepoint); } catch (error) { failed = true; throw error; }
      if (!db.isTransaction) { failed = true; throw new Error('foul terminal runner owned transaction disappeared'); }
      db.exec('COMMIT'); return result.value;
    } catch (error) {
      const cleanup: unknown[] = [];
      try {
        if (db.isTransaction) {
          try { db.exec('ROLLBACK TO ' + savepoint); } catch (identity) { failed = true; cleanup.push(identity); }
          db.exec('ROLLBACK');
        } else failed = true;
      } catch (rollback) { failed = true; cleanup.push(rollback); }
      try {
        if (queryOnly() !== setting) { db.exec('PRAGMA query_only=' + setting); failed = true; }
        if (db.isTransaction || queryOnly() !== setting) { failed = true; cleanup.push(new Error('foul terminal runner cleanup state differs')); }
      } catch (restore) { failed = true; cleanup.push(restore); }
      if (failed || cleanup.length) return retire(error,cleanup);
      throw error;
    }
  };
  return Object.freeze({
    read(sourceId: string) { return transaction(sourceId,false,() => ({ value:proof(() => owner.read(sourceId)),changes:0 })); },
    apply(sourceId: string) {
      return transaction(sourceId,true,() => {
        const before = proof(() => {
          const saved = owner.read(sourceId);
          if (!saved) throw new Error('foul terminal application queue is missing');
          if (saved.status !== 'QUEUED') return { kind:'retry' as const,saved };
          const current = deriveFoulTerminalApplicationProposal(db,saved.source,'current');
          same(current,saved.proposal,'foul terminal current application proof differs from its immutable queue');
          return { kind:'apply' as const,saved,pin:foulTerminalApplicationPin(db,saved.proposal) };
        });
        if (before.kind === 'retry') return { value:before.saved,changes:0 };
        const p = before.saved.proposal, official = writer.preparePendingNonLive(foulTerminalPendingInput(p)).write().readResult();
        const result = { sourceId,official,acknowledgement:null };
        const updated = db.prepare("UPDATE main.actual_foul_terminal_applications SET status='OFFICIAL_APPLIED_PENDING_POST_PLAY',result_json=? WHERE source_id=? AND status='QUEUED' AND result_json IS NULL")
          .run(json(result),sourceId);
        if (updated.changes !== 1) throw new Error('foul terminal queue changed before official checkpoint');
        const saved = proof(() => {
          const after = owner.read(sourceId);
          if (!after || after.status !== 'OFFICIAL_APPLIED_PENDING_POST_PLAY') throw new Error('foul terminal applied checkpoint is missing');
          same(after.proposal,p,'foul terminal original proposal changed during application');
          same(after.result,result,'foul terminal official writer result differs from original-source rederivation');
          const pin = foulTerminalApplicationPin(db,after.proposal);
          same({ ...pin,terminal:before.pin.terminal,applications:before.pin.applications },before.pin,
            'foul terminal original owners or policy changed during application');
          return after;
        });
        return { value:saved,changes:3 };
      });
    },
    acknowledge(sourceId: string) {
      return transaction(sourceId,true,() => {
        const before = proof(() => owner.prepareAcknowledgement(sourceId));
        if (before.kind === 'retry') return { value:before.saved,changes:0 };
        const columns = Object.keys(before.row);
        const updated = db.prepare('UPDATE main.actual_foul_terminal_applications SET status=?,result_json=? WHERE rowid=? AND '
          + columns.map(column => '"' + column.replaceAll('"','""') + '" IS ?').join(' AND '))
          .run(before.expectedRow.status,before.expectedRow.result_json,before.rowid,...columns.map(column => before.row[column]));
        if (updated.changes !== 1) throw new Error('foul terminal pending row changed before acknowledgement');
        const saved = proof(() => {
          const after = owner.read(sourceId);
          if (!after || after.status !== 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY') throw new Error('foul terminal acknowledged checkpoint is missing');
          const rowid = db.prepare('SELECT rowid AS value FROM main.actual_foul_terminal_applications WHERE source_id=?').get(sourceId)?.value;
          if (rowid !== before.rowid) throw new Error('foul terminal acknowledged row identity changed');
          same(foulTerminalApplicationPin(db,after.proposal),{ ...before.pin,terminal:[before.expectedRow] },
            'foul terminal acknowledgement changed original owners or official mirrors');
          return after;
        });
        return { value:saved,changes:1 };
      });
    },
    close() { if (!closed) { closed = true; db.close(); } },
  });
};
