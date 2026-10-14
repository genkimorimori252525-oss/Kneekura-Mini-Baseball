import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it } from 'vitest';
import { openSqliteActualFoulTerminalScoringStore, type SqliteActualFoulTerminalScoringStore } from './SqliteActualFoulTerminalScoringStore';
import { acknowledgedTerminalSql, rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const schema = `CREATE TABLE matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,state_json TEXT NOT NULL,activation_json TEXT);
CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL REFERENCES matches(match_id),closure_id TEXT NOT NULL,
request_hash TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));
CREATE TABLE official_fixtures(game_id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,fixture_event_id TEXT NOT NULL UNIQUE,fixture_revision INTEGER NOT NULL);
CREATE TABLE official_scoring_applications(scoring_application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL,
official_application_id TEXT NOT NULL REFERENCES applications(application_id),closure_id TEXT NOT NULL,source_event_id TEXT NOT NULL UNIQUE,
request_json TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));`;
/** Empty synthetic layouts test admission/mechanics only; no genuine origin. */
const fixture = (sql = schema) => {
  const directory = mkdtempSync(join(tmpdir(),'terminal-scoring-schema-')), path = join(directory,'private.sqlite');
  const db = new DatabaseSync(path); db.exec(sql); db.exec(acknowledgedTerminalSql); db.exec('PRAGMA user_version=3');
  return { directory,path,db,close() { db.close(); rmSync(directory,{ recursive:true,force:true }); } };
};
const faults = [
  ['missing scoring table','DROP TABLE official_scoring_applications'],
  ['missing official fixture','DROP TABLE official_fixtures'],
  ['old version','PRAGMA user_version=2'],
  ['future version','PRAGMA user_version=4'],
] as const;
for (const [label,change] of faults) it('TS01 opener refuses ' + label + ' without migration', () => {
  const f = fixture();
  try {
    f.db.exec(change); const rows = rawCensus(f.db), before = schemaCensus(f.db), journal = f.db.prepare('PRAGMA journal_mode').get();
    expect(() => openSqliteActualFoulTerminalScoringStore(f.path)).toThrow(/terminal scoring/);
    expect(rawCensus(f.db)).toEqual(rows); expect(schemaCensus(f.db)).toEqual(before);
    expect(f.db.prepare('PRAGMA journal_mode').get()).toEqual(journal);
  } finally { f.close(); }
});
for (const [label,from,to] of [
  ['Match revision type','durable_revision INTEGER','durable_revision TEXT'],
  ['application unique key','result_json TEXT NOT NULL,UNIQUE(match_id,closure_id)','result_json TEXT NOT NULL'],
  ['fixture revision type','fixture_revision INTEGER','fixture_revision TEXT'],
  ['fixture event unique key','fixture_event_id TEXT NOT NULL UNIQUE','fixture_event_id TEXT NOT NULL'],
  ['scoring source unique key','source_event_id TEXT NOT NULL UNIQUE','source_event_id TEXT NOT NULL'],
] as const) it('TS02 opener refuses changed ' + label, () => {
  const f = fixture(schema.replace(from,to));
  try {
    const rows = rawCensus(f.db), before = schemaCensus(f.db);
    expect(() => openSqliteActualFoulTerminalScoringStore(f.path)).toThrow(/terminal scoring/);
    expect(rawCensus(f.db)).toEqual(rows); expect(schemaCensus(f.db)).toEqual(before);
    expect(f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('delete');
  } finally { f.close(); }
});
it('TS03 opener never creates missing paths or accepts symlink and memory artifacts', () => {
  const f = fixture(), missing = join(f.directory,'missing.sqlite'), link = join(f.directory,'linked.sqlite');
  try {
    expect(() => openSqliteActualFoulTerminalScoringStore(missing)).toThrow(); expect(existsSync(missing)).toBe(false);
    symlinkSync(f.path,link); expect(() => openSqliteActualFoulTerminalScoringStore(link)).toThrow(/canonical/);
    expect(() => openSqliteActualFoulTerminalScoringStore(':memory:')).toThrow(/canonical/);
  } finally { f.close(); }
});
it('TS04 empty admitted storage has zero-write missing read and missing apply rejection', () => {
  const f = fixture(); let owner: SqliteActualFoulTerminalScoringStore | undefined;
  try {
    owner = openSqliteActualFoulTerminalScoringStore(f.path); const rows = rawCensus(f.db), before = schemaCensus(f.db);
    expect(owner.read('missing')).toBeNull(); expect(() => owner!.apply('missing')).toThrow(/missing/);
    expect(rawCensus(f.db)).toEqual(rows); expect(schemaCensus(f.db)).toEqual(before);
    owner.close(); owner.close(); expect(() => owner!.read('missing')).toThrow(/closed/);
  } finally { owner?.close(); f.close(); }
});

const messages = (error: unknown): string[] => error instanceof AggregateError
  ? [error.message,...error.errors.flatMap(messages)] : error instanceof Error ? [error.message] : [String(error)];
for (const fault of ['release_before','release_after','restore_after','primary_and_restore_after','rollback_to'] as const) {
  it('TS05 synthetic proof cleanup retires handle after ' + fault, () => {
    const f = fixture(); let owner: SqliteActualFoulTerminalScoringStore | undefined;
    const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec')!;
    let installed: PropertyDescriptor | undefined, injected = false, writer: Database | undefined;
    try {
      owner = openSqliteActualFoulTerminalScoringStore(f.path);
      if (fault === 'primary_and_restore_after' || fault === 'rollback_to') f.db.exec('DROP TABLE official_fixtures');
      const before = schemaCensus(f.db), rows = rawCensus(f.db);
      const original = descriptor.value as Database['exec'];
      installed = { ...descriptor,value:function(this:Database,sql:string) {
        const target = fault.startsWith('release') ? /^RELEASE terminal_scoring_proof_/.test(sql)
          : fault === 'rollback_to' ? /^ROLLBACK TO terminal_scoring_(?!proof_)/.test(sql) : sql === 'PRAGMA query_only=0';
        if (!injected && target) {
          injected = true; writer = this;
          if (fault.endsWith('after')) Reflect.apply(original,this,[sql]);
          throw new Error('SCORING_TEST_' + fault);
        }
        return Reflect.apply(original,this,[sql]);
      } };
      Object.defineProperty(DatabaseSync.prototype,'exec',installed);
      let rejected:unknown;
      try { owner.read('missing'); } catch (error) { rejected = error; }
      expect(injected).toBe(true); expect(rejected).toBeInstanceOf(AggregateError);
      expect(messages(rejected).join('\n')).toContain('SCORING_TEST_' + fault);
      if (fault === 'primary_and_restore_after' || fault === 'rollback_to') expect(messages(rejected).join('\n')).toContain('official storage missing');
      expect(() => owner!.read('missing')).toThrow(/closed|retired/);
      expect(() => writer!.prepare('SELECT 1')).toThrow();
      expect(rawCensus(f.db)).toEqual(rows); expect(schemaCensus(f.db)).toEqual(before);
    } finally {
      if (installed && Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec')?.value === installed.value) {
        Object.defineProperty(DatabaseSync.prototype,'exec',descriptor);
      }
      owner?.close(); f.close();
    }
  });
}

for (const fault of ['begin_after','begin_suppressed','commit_suppressed','commit_replaced','commit_after','commit_query_only'] as const) {
  it('TS06 operation boundary retires after ' + fault, () => {
    const f = fixture(); let owner: SqliteActualFoulTerminalScoringStore | undefined;
    const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec')!;
    let installed: PropertyDescriptor | undefined, injected = false, writer: Database | undefined;
    let savepointsAfterSuppressedBegin = 0;
    try {
      owner = openSqliteActualFoulTerminalScoringStore(f.path);
      const before = schemaCensus(f.db), rows = rawCensus(f.db);
      const original = descriptor.value as Database['exec'];
      installed = { ...descriptor,value:function(this:Database,sql:string) {
        if (injected && fault === 'begin_suppressed' && sql.startsWith('SAVEPOINT ')) savepointsAfterSuppressedBegin++;
        const target = fault.startsWith('begin') ? sql === 'BEGIN' : sql === 'COMMIT';
        if (!injected && target) {
          injected = true; writer = this;
          if (fault === 'begin_suppressed' || fault === 'commit_suppressed') return;
          Reflect.apply(original,this,[sql]);
          if (fault === 'commit_replaced') { Reflect.apply(original,this,['BEGIN']); return; }
          if (fault === 'commit_query_only') { Reflect.apply(original,this,['PRAGMA query_only=1']); return; }
          throw new Error('SCORING_BOUNDARY_' + fault);
        }
        return Reflect.apply(original,this,[sql]);
      } };
      Object.defineProperty(DatabaseSync.prototype,'exec',installed);
      let rejected:unknown;
      try { owner.read('missing'); } catch (error) { rejected = error; }
      expect(injected).toBe(true); expect(rejected).toBeInstanceOf(Error);
      expect(savepointsAfterSuppressedBegin).toBe(0);
      expect(() => writer!.prepare('SELECT 1')).toThrow();
      expect(() => owner!.read('missing')).toThrow(/closed|retired/);
      expect(rawCensus(f.db)).toEqual(rows); expect(schemaCensus(f.db)).toEqual(before);
    } finally {
      if (installed && Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec')?.value === installed.value) {
        Object.defineProperty(DatabaseSync.prototype,'exec',descriptor);
      }
      owner?.close(); f.close();
    }
  });
}

for (const fault of ['suppressed','replaced','query_only'] as const) {
  it('TS07 WAL constructor rejects commit boundary ' + fault, () => {
    const f = fixture(); let owner: SqliteActualFoulTerminalScoringStore | undefined;
    const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec')!;
    let installed: PropertyDescriptor | undefined, injected = false, writer: Database | undefined;
    try {
      f.db.exec('PRAGMA journal_mode=WAL');
      const before = schemaCensus(f.db), rows = rawCensus(f.db);
      const original = descriptor.value as Database['exec'];
      installed = { ...descriptor,value:function(this:Database,sql:string) {
        if (!injected && sql === 'COMMIT') {
          injected = true; writer = this;
          if (fault === 'suppressed') return;
          Reflect.apply(original,this,[sql]);
          Reflect.apply(original,this,[fault === 'replaced' ? 'BEGIN' : 'PRAGMA query_only=1']); return;
        }
        return Reflect.apply(original,this,[sql]);
      } };
      Object.defineProperty(DatabaseSync.prototype,'exec',installed);
      let rejected:unknown;
      try { owner = openSqliteActualFoulTerminalScoringStore(f.path); } catch (error) { rejected = error; }
      expect(injected).toBe(true); expect(rejected).toBeInstanceOf(Error);
      expect(owner).toBeUndefined(); expect(() => writer!.prepare('SELECT 1')).toThrow();
      expect(rawCensus(f.db)).toEqual(rows); expect(schemaCensus(f.db)).toEqual(before);
    } finally {
      if (installed && Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec')?.value === installed.value) {
        Object.defineProperty(DatabaseSync.prototype,'exec',descriptor);
      }
      owner?.close(); f.close();
    }
  });
}
