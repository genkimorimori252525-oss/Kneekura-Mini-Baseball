import {afterEach,expect,it,vi} from 'vitest';
import {practiceFixture} from './PitchPracticeAttempt.test-support';
import {readNativeDevelopmentEpisodeFromSqlite as read} from './NativeDevelopmentEpisodeFromSqlite';
import {withNativeDevelopmentReadPhaseV126 as phase} from './NativeDevelopmentReadPhaseV126';
import {openSqliteDevelopmentInitiationStore,readOwnedDevelopmentEpisode} from './SqliteDevelopmentInitiationStore';
import {createRequire} from 'node:module';

const cleanup:(()=>void)[]=[];
afterEach(()=>{while(cleanup.length)cleanup.pop()!();});
it('shares a completed genuine frozen Native prefix between sibling reads only in one owned read-only section',async()=>{
 const f=await practiceFixture(cleanup),db=f.db;db.exec('BEGIN');
 const trace=vi.spyOn(db,'prepare'),queries=()=>trace.mock.calls.filter(([sql])=>sql.startsWith('SELECT * FROM world_development_initiations WHERE episode_id=$id')).length;
 try{
  let first:ReturnType<typeof read>;
  phase(db,()=>{first=read(db,'episode',2);const second=read(db,'episode',2);expect(queries()).toBe(1);expect(second).toBe(first);
   expect(Object.isFrozen(first!.episode.events)).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);});
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  const next=phase(db,()=>read(db,'episode',2));expect(next).toEqual(first!);expect(next).not.toBe(first!);expect(queries()).toBe(2);
 }finally{trace.mockRestore();db.exec('ROLLBACK');}
});

it('does not revive a cached prefix after caught failures, DML, or a namespace change, and restores caller settings',async()=>{
 const f=await practiceFixture(cleanup),db=f.db;db.exec('BEGIN');
 try{
  expect(()=>phase(db,()=>{read(db,'episode',2);expect(()=>read(db,'episode',999)).toThrow();expect(()=>read(db,'episode',2)).toThrow(/expired/);})).toThrow(/expired/);
  expect(()=>phase(db,()=>{read(db,'episode',2);db.exec('PRAGMA query_only=0;UPDATE world_development_initiations SET revision=revision;PRAGMA query_only=1');return read(db,'episode',2);})).toThrow();
  expect(()=>phase(db,()=>{read(db,'episode',2);db.exec("ATTACH ':memory:' AS foreign_owner");expect(()=>read(db,'episode',2)).toThrow();db.exec('DETACH foreign_owner');expect(()=>read(db,'episode',2)).toThrow(/expired/);})).toThrow(/expired/);
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  db.exec('PRAGMA query_only=1');expect(phase(db,()=>read(db,'episode',2))?.episode.revision).toBe(2);
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
 }finally{db.exec('ROLLBACK;PRAGMA query_only=0');}
 expect(()=>phase(db,()=>0)).toThrow('active Native');
});

it('still authenticates a separate owned reader and executes its mutable learning guard on every read',async()=>{
 const f=await practiceFixture(cleanup);f.sources.episodes.archiveRosterOrigin('episode');
 let calls=0,fail=false;
 const owner=openSqliteDevelopmentInitiationStore(f.path,{roster:f.roster,person:f.sources.person,
  appraisal:{readAcceptedAppraisal:()=>null},policies:{readAcceptedPolicies:()=>null}},null,()=>{
   calls++;if(fail)throw Error('external owned guard changed');
  });cleanup.push(owner.close);
 const db=f.db;db.exec('BEGIN');
 try{
  expect(()=>phase(db,()=>{read(db,'episode',2);readOwnedDevelopmentEpisode(owner,db,'episode',2);expect(calls).toBe(1);
   fail=true;readOwnedDevelopmentEpisode(owner,db,'episode',2);})).toThrow('external owned guard changed');
  expect(calls).toBe(2);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  owner.close();expect(()=>phase(db,()=>readOwnedDevelopmentEpisode(owner,db,'episode',2))).toThrow('closed');
 }finally{db.exec('ROLLBACK');}
});

it('public owned reads share only their nested Native archive proofs and reread external learning guards in every new operation',async()=>{
 const f=await practiceFixture(cleanup);f.sources.episodes.archiveRosterOrigin('episode');
 let guardCalls=0,fail=false,installed=false,restore=()=>{};const sqls:string[]=[];
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 const owner=openSqliteDevelopmentInitiationStore(f.path,{roster:f.roster,person:f.sources.person,
  appraisal:{readAcceptedAppraisal:()=>null},policies:{readAcceptedPolicies:()=>null}},null,connection=>{
   guardCalls++;if(!(connection instanceof DatabaseSync))throw Error('actual Native owner connection required');
   if(!installed){const original=connection.prepare,trace=vi.spyOn(connection,'prepare').mockImplementation((...args)=>{
    sqls.push(args[0]);return Reflect.apply(original,connection,args);
   });restore=()=>trace.mockRestore();installed=true;}
   const first=read(connection,'episode',1),second=read(connection,'episode',1);
   expect(first).toEqual(second);if(fail)throw Error('changed external public-read guard');
  });cleanup.push(owner.close,()=>restore());
 const queries=()=>sqls.filter(sql=>sql.startsWith('SELECT * FROM world_development_initiations WHERE episode_id=$id')).length;
 expect(owner.read('episode')?.episode.revision).toBe(2);expect(guardCalls).toBe(1);expect(queries()).toBe(1);
 expect(owner.read('episode')?.episode.revision).toBe(2);expect(guardCalls).toBe(2);expect(queries()).toBe(2);
 fail=true;expect(()=>owner.read('episode')).toThrow('changed external public-read guard');expect(guardCalls).toBe(3);
});
