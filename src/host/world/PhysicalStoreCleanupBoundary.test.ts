import { expect, test } from 'vitest';
import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
// Transaction mechanics on the existing small Native actor/pitch fixture.
// These are not genuine terminal completion/next-play qualification artifacts.
const fault=(kind:'actor'|'pitch',mode:'read_rollback'|'write_rollback'|'begin_after'|'write_begin_after'|'read_replaced', failRollback=true)=>{
 const prototype=DatabaseSync.prototype,prepareDescriptor=Object.getOwnPropertyDescriptor(prototype,'prepare')!,execDescriptor=Object.getOwnPropertyDescriptor(prototype,'exec')!;
 const prepare=prepareDescriptor.value as Database['prepare'],exec=execDescriptor.value as Database['exec'];
 const primary=new Error('physical-primary-sentinel'),cleanup=new Error('physical-cleanup-sentinel');
 let owner:Database|undefined,reached=false,rollbackReached=false;
 const restore:(()=>void)[]=[];
 const target=kind==='actor'?'physical_plate_appearance_actors':'physical_pitch_progress_actions';
 Object.defineProperty(prototype,'prepare',{...prepareDescriptor,value:function(this:Database,...args:Parameters<Database['prepare']>){
  const statement=Reflect.apply(prepare,this,args) as ReturnType<Database['prepare']>;
  const selected=(mode==='read_rollback'||mode==='read_replaced') && (kind==='actor'?args[0]==='SELECT * FROM physical_plate_appearance_actors WHERE source_id=?':args[0].startsWith('SELECT * FROM physical_pitch_progress_actions WHERE game_id=?'))
   || mode==='write_rollback' && args[0].startsWith('INSERT INTO '+target+' VALUES');
  if(selected){
   const method=mode==='write_rollback'?'run':kind==='actor'?'get':'all';
   const descriptor=Object.getOwnPropertyDescriptor(statement,method),original=statement[method];
   Object.defineProperty(statement,method,{configurable:true,writable:true,value:(...parameters:unknown[])=>{
    Reflect.apply(original,statement,parameters);owner=this;reached=true;
    if(mode==='write_rollback')expect(this.prepare('SELECT count(*) AS n FROM '+target).get()!.n).toBeGreaterThan(0);
    if(mode==='read_replaced'){this.exec('ROLLBACK');this.exec('BEGIN');expect(this.isTransaction).toBe(true);}
    throw primary;
   }});
   restore.push(()=>{if(descriptor)Object.defineProperty(statement,method,descriptor);else Reflect.deleteProperty(statement,method);});
  }
  return statement;
 }});
 Object.defineProperty(prototype,'exec',{...execDescriptor,value:function(this:Database,...args:Parameters<Database['exec']>){
  if(mode.endsWith('begin_after')&&args[0]===(mode==='write_begin_after'?'BEGIN IMMEDIATE':'BEGIN')&&!reached){Reflect.apply(exec,this,args);owner=this;reached=true;expect(this.isTransaction).toBe(true);throw primary;}
  if(!mode.endsWith('begin_after')&&owner===this&&args[0]==='ROLLBACK'){rollbackReached=true;if(failRollback&&(mode==='read_rollback'||mode==='write_rollback'))throw cleanup;}
  return Reflect.apply(exec,this,args);
 }});
 return {primary,cleanup,reached:()=>reached,rollbackReached:()=>rollbackReached,owner:()=>owner,
  close(){Object.defineProperty(prototype,'prepare',prepareDescriptor);Object.defineProperty(prototype,'exec',execDescriptor);while(restore.length)restore.pop()!();}};
};
const exercise=(kind:'actor'|'pitch',mode:'read_rollback'|'write_rollback'|'begin_after'|'write_begin_after'|'read_replaced')=>{
 const f=physicalPlateAppearanceActorFixture();
 try {
  const injected=fault(kind,mode);let error:unknown;
  try {try{
   if(mode==='write_rollback'||mode==='write_begin_after'){if(kind==='actor')f.actors.accept(f.source.sourceId);else f.pitch(0,0);}
   else if(kind==='actor')f.actors.read('missing');else f.pitches.readProgress('game-1',7);
  }catch(value){error=value;}
   expect(error).toBeDefined();expect(injected.reached()).toBe(true);
   if(!mode.endsWith('begin_after'))expect(injected.rollbackReached()).toBe(true);
  }finally{injected.close();}
  const read=()=>kind==='actor'?f.actors.read('missing'):f.pitches.readProgress('game-1',7);
  expect(read,'PHYSICAL_OWNER_REUSED_AFTER_UNCERTAIN_CLEANUP').toThrow(/closed|retired/);
  expect(()=>injected.owner()!.prepare('SELECT 1'),'PHYSICAL_NATIVE_HANDLE_NOT_RETIRED').toThrow();
  if(mode==='read_rollback'||mode==='write_rollback'){
   expect(error).toBeInstanceOf(AggregateError);
   const errors=(error as AggregateError).errors;
   const causes=(value:unknown):unknown[]=>value instanceof Error?[value,...('cause'in value?causes(value.cause):[])]:[value];
   expect(errors.flatMap(causes)).toContain(injected.primary);expect(errors).toContain(injected.cleanup);
  }
 }finally{f.f.close();}
};
test('PC-S01 real Native actor private-read rollback failure retires the owner',()=>exercise('actor','read_rollback'));
test('PC-S02 real Native pitch private-read rollback failure retires the owner',()=>exercise('pitch','read_rollback'));
test('PC-S03 real Native actor INSERT rollback failure retires the owner',()=>exercise('actor','write_rollback'));
test('PC-S04 real Native pitch INSERT rollback failure retires the owner',()=>exercise('pitch','write_rollback'));
test('PC-S05 real Native actor acquired-BEGIN exception cannot leak a reusable transaction',()=>exercise('actor','begin_after'));
test('PC-S06 real Native pitch acquired-BEGIN exception cannot leak a reusable transaction',()=>exercise('pitch','begin_after'));

test('PC-S07 healthy Native actor and pitch read rollbacks preserve ordinary retries',()=>{
 for(const kind of ['actor','pitch'] as const){const f=physicalPlateAppearanceActorFixture();try{
  const injected=fault(kind,'read_rollback',false);
  try{expect(()=>kind==='actor'?f.actors.read('missing'):f.pitches.readProgress('game-1',7)).toThrow();
   expect(injected.reached()).toBe(true);expect(injected.rollbackReached()).toBe(true);
  }finally{injected.close();}
  expect(kind==='actor'?f.actors.read('missing'):f.pitches.readProgress('game-1',7)).toBeNull();
  expect(injected.owner()!.isTransaction).toBe(false);expect(()=>injected.owner()!.prepare('SELECT 1')).not.toThrow();
 }finally{f.f.close();}}
});
test('PC-S08 real Native actor acquired writer-BEGIN exception retires before insertion',()=>exercise('actor','write_begin_after'));
test('PC-S09 real Native pitch acquired writer-BEGIN exception retires before insertion',()=>exercise('pitch','write_begin_after'));

test('PC-S10 real Native actor read transaction replacement retires after lost cleanup identity',()=>exercise('actor','read_replaced'));
test('PC-S11 real Native pitch read transaction replacement retires after lost cleanup identity',()=>exercise('pitch','read_replaced'));

const commitSettingDrift=(kind:'actor'|'pitch')=>{
 const f=physicalPlateAppearanceActorFixture(),prototype=DatabaseSync.prototype,descriptor=Object.getOwnPropertyDescriptor(prototype,'exec')!;
 let owner:Database|undefined,reached=false;
 try {
  Object.defineProperty(prototype,'exec',{...descriptor,value:function(this:Database,...args:Parameters<Database['exec']>){
   const result=Reflect.apply(descriptor.value,this,args);
   if(args[0]==='COMMIT'&&!reached){owner=this;reached=true;expect(this.isTransaction).toBe(false);
    Reflect.apply(descriptor.value,this,['PRAGMA query_only=1']);expect(this.prepare('PRAGMA query_only').get()!.query_only).toBe(1);}
   return result;
  }});
  const read=()=>kind==='actor'?f.actors.read('missing'):f.pitches.readProgress('game-1',7);
  expect(read,'PHYSICAL_POST_COMMIT_SETTING_DRIFT_ACCEPTED').toThrow(/retired/);expect(reached).toBe(true);
  Object.defineProperty(prototype,'exec',descriptor);
  expect(read).toThrow(/closed|retired/);expect(()=>owner!.prepare('SELECT 1')).toThrow();
 }finally{Object.defineProperty(prototype,'exec',descriptor);f.f.close();}
};
test('PC-S12 real Native actor post-COMMIT query-only drift retires before return',()=>commitSettingDrift('actor'));
test('PC-S13 real Native pitch post-COMMIT query-only drift retires before return',()=>commitSettingDrift('pitch'));
