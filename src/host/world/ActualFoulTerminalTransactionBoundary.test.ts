// Transaction mechanics only: empty real SQLite schemas, no genuine receipt credit.
import { createRequire } from 'node:module';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect,it } from 'vitest';
import { foulTerminalAcknowledgementTableSql } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Database = InstanceType<typeof DatabaseSync>;
type Store = { read(id:string):unknown;close():void };
const openers = [
  { name:'runner',open:openSqliteActualFoulTerminalApplicationRunner },
  { name:'queue',open:openSqliteActualFoulTerminalApplicationStore },
] as const;
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(),'terminal-boundary-')),path = join(directory,'empty.sqlite');
  const db = new DatabaseSync(path);
  db.exec(foulTerminalAcknowledgementTableSql+`;
    CREATE TABLE matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,state_json TEXT NOT NULL,activation_json TEXT);
    CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL,closure_id TEXT NOT NULL,request_hash TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));
    CREATE TABLE official_fixtures(game_id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,fixture_event_id TEXT NOT NULL UNIQUE,fixture_revision INTEGER NOT NULL);
    PRAGMA user_version=3;`);
  db.close(); return { path,clean:() => rmSync(directory,{recursive:true,force:true}) };
};
type Fault = 'begin-after'|'begin-suppressed'|'commit-suppressed'|'commit-replaced'|'commit-query-only';
const faults:readonly Fault[] = ['begin-after','begin-suppressed','commit-suppressed','commit-replaced','commit-query-only'];
const patch = (target:object,run:(db:Database,sql:string,original:(sql:string)=>void)=>void) => {
  const own = Object.getOwnPropertyDescriptor(target,'exec');
  const original = (target as Database).exec;
  Object.defineProperty(target,'exec',{ configurable:true,writable:true,value:function(this:Database,sql:string) {
    return run(this,sql,text => Reflect.apply(original,this,[text]));
  } });
  return () => { if (own) Object.defineProperty(target,'exec',own); else Reflect.deleteProperty(target,'exec'); };
};
const inject = (fault:Fault,sql:string,original:(sql:string)=>void) => {
  if (fault==='begin-after') { original(sql); throw new Error('injected BEGIN post-execution failure'); }
  if (fault==='begin-suppressed' || fault==='commit-suppressed') return;
  original(sql);
  if (fault==='commit-replaced') original('BEGIN');
  if (fault==='commit-query-only') original('PRAGMA query_only=1');
};
const isBegin = (sql:string) => /^BEGIN(?: IMMEDIATE)?$/.test(sql);
for (const owner of openers) {
  it(`TB ${owner.name} normal missing-row read commits and preserves connection settings`,() => {
    const f=fixture();let db:Database|undefined,store:Store|undefined;
    const restore=patch(DatabaseSync.prototype,(connection,sql,exec)=>{ db=connection;exec(sql); });
    try {
      store=owner.open(f.path);restore();expect(store.read('missing')).toBeNull();
      expect(db!.isTransaction).toBe(false);expect(db!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      expect(db!.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);
    } finally { restore();store?.close();f.clean(); }
  });
  for (const fault of faults) it(`TB ${owner.name} rejects ${fault} on read without returning unowned state`,() => {
    const f=fixture();let db:Database|undefined,store:Store|undefined,restoreFault=()=>{};
    const restoreCapture=patch(DatabaseSync.prototype,(connection,sql,exec)=>{ db=connection;exec(sql); });
    try {
      store=owner.open(f.path);restoreCapture();let witnessed=false;
      restoreFault=patch(db!,(_connection,sql,exec)=>{
        if (!witnessed && (fault.startsWith('begin') ? isBegin(sql) : sql==='COMMIT')) {
          witnessed=true;inject(fault,sql,exec);
        } else exec(sql);
      });
      expect(() => store!.read('missing'),'TRANSACTION_BOUNDARY_REJECTION_MISSING').toThrow();
      expect(witnessed).toBe(true);restoreFault();
      let closed=false;try { db!.prepare('SELECT 1'); } catch { closed=true; }
      if (!closed) {
        expect(db!.isTransaction,'BEGIN_FAILURE_LEFT_TRANSACTION_OPEN').toBe(false);
        expect(db!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      }
      if (fault.startsWith('commit') || fault==='begin-suppressed') {
        expect(closed,'UNPROVEN_TRANSACTION_HANDLE_NOT_RETIRED').toBe(true);
        expect(() => store!.read('missing')).toThrow(/closed|retired/);
      }
    } finally { restoreCapture();restoreFault();store?.close();f.clean(); }
  });
  it(`TB ${owner.name} preserves usability after BEGIN fails before execution`,() => {
    const f=fixture();let store:Store|undefined,db:Database|undefined;
    const capture=patch(DatabaseSync.prototype,(connection,sql,exec)=>{ db=connection;exec(sql); });
    let restore=()=>{};
    try {
      store=owner.open(f.path);capture();let hit=false;
      restore=patch(db!,(_connection,sql,exec)=>{
        if (!hit && isBegin(sql)) { hit=true;throw new Error('injected BEGIN pre-execution failure'); }exec(sql);
      });
      expect(() => store!.read('missing')).toThrow('injected BEGIN pre-execution failure');restore();
      expect(hit).toBe(true);expect(db!.isTransaction).toBe(false);expect(store.read('missing')).toBeNull();
    } finally {capture();restore();store?.close();f.clean();}
  });
}
for (const owner of openers) for (const fault of ['commit-suppressed','commit-replaced','commit-query-only'] as const) {
  it(`TB ${owner.name} constructor rejects ${fault} and closes its handle`,() => {
    const f=fixture();let db:Database|undefined,unexpected:Store|undefined,hit=false;
    const restore=patch(DatabaseSync.prototype,(connection,sql,exec)=>{
      db=connection;
      if (!hit && sql==='COMMIT') {hit=true;inject(fault,sql,exec);} else exec(sql);
    });
    try {
      expect(() => {unexpected=owner.open(f.path);},'CONSTRUCTOR_BOUNDARY_REJECTION_MISSING').toThrow();
      expect(hit).toBe(true);restore();expect(() => db!.prepare('SELECT 1')).toThrow();
    } finally {restore();unexpected?.close();f.clean();}
  });
}
