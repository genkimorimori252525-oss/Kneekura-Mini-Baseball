import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it,vi} from 'vitest';
import {assertSamePaRegistrationBeforeWork as check} from './ActualLiveRuntimeRegistration';

const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope={gameId:'game',playId:7,physicalPitchSourceId:'pitch',actorSourceId:'actor'};
const schema='CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER,source_json TEXT,snapshot_json TEXT)';

it('does not compile the large typed-claim predicate for an empty real original table, without caching emptiness',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(schema);const trace=vi.spyOn(db,'prepare');
  check(db,scope);
  expect(trace.mock.calls.filter(([sql])=>sql.startsWith('SELECT 1 FROM main.physical_pitch_progress_actions WHERE'))).toHaveLength(0);
  trace.mockRestore();
  db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?)').run('foreign','elsewhere',1,
   '{"physicalPitchSourceId":"foreign","physicalPitchSourceId":"pitch"}','{}');
  expect(()=>check(db,scope)).toThrow('precede every original physical work');
 }finally{db.close();}
});

it('keeps occupied-table original claims, escaped duplicate keys, malformed-document semantics and schema rejection',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(schema);const insert=db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?)');
  insert.run('foreign','elsewhere',1,'invalid JSON','{}');expect(()=>check(db,scope)).not.toThrow();
  insert.run('foreign-2','elsewhere',1,'{}','{"source":{"physicalPitchSourceId":"foreign"},"sour\\u0063e":{"physicalPitchSourceId":"pitch"}}');
  expect(()=>check(db,scope)).toThrow('precede every original physical work');
  db.exec('DROP TABLE physical_pitch_progress_actions;CREATE VIEW physical_pitch_progress_actions AS SELECT 1 AS source_id WHERE 0');
  expect(()=>check(db,scope)).toThrow();
 }finally{db.close();}
});

it('observes empty-table state only in its current WAL snapshot and rejects a peer claim after that snapshot ends',()=>{
 const folder=mkdtempSync(join(tmpdir(),'registration-empty-v125-')),path=join(folder,'world.sqlite'),db=new DatabaseSync(path),peer=new DatabaseSync(path);
 try{
  db.exec('PRAGMA journal_mode=WAL');db.exec(schema);db.exec('BEGIN');check(db,scope);
  peer.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?)').run('pitch','game',7,'{}','{}');
  expect(()=>check(db,scope)).not.toThrow();db.exec('COMMIT');
  expect(()=>check(db,scope)).toThrow('precede every original physical work');
 }finally{if(db.isTransaction)db.exec('ROLLBACK');peer.close();db.close();rmSync(folder,{recursive:true,force:true});}
});
