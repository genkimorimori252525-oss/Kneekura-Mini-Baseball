import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openReceivedTransaction } from './ActualReceivedUmpireDefenderTransaction';
import { receivedOwnerSchema, receivedOwnerSchemas } from './ActualReceivedUmpireDefenderSchema';
import { beginActualLivePlayWrite } from './ActualLivePlayFence';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
const scope = { gameId: 'game-a', playId: 1, physicalPitchSourceId: 'pitch-a' };
const fixture = () => {
  const directory=mkdtempSync(join(tmpdir(),'received-review-lifecycle-')),path=join(directory,'state.sqlite'),db=new DatabaseSync(path);
  db.exec("CREATE TABLE original(value TEXT); INSERT INTO original VALUES('keep');");
  const tx=openReceivedTransaction(path);
  return {db,tx,close(){tx.close();db.close();rmSync(directory,{recursive:true});}};
};
const originalRows=(db:Db)=>db.prepare('SELECT * FROM original').all();
const insertEnrollment=(db:Db)=>{
  const source={sourceId:'enroll-a',sourceVersion:'review-fixture',capability:'received_umpire_defender_enrollment_v1',runtimeSourceId:'runtime-a',
    physicalPitchSourceId:'pitch-a',playerId:'player-a',observationSourceId:'observe-a',currentExecutionSourceId:'execute-a',
    predecessorDecisionSourceId:'decision-a',predecessorMotorSourceId:'motor-a',predecessorAdoptionSourceId:'adopt-a'};
  db.prepare('INSERT INTO actual_received_umpire_defender_enrollments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    source.sourceId,source.sourceVersion,'game-a',1,'pitch-a','player-a','runtime-a','call-a','send-a',24,'prefix',json(source),hash(source),json({source}),hash({source}));
};
const observeInsert=(db:Db,observer:()=>void)=>{
  const prepare=db.prepare.bind(db);let observed=false;
  db.prepare=((sql:string)=>{const statement=prepare(sql);if(sql.startsWith('INSERT INTO actual_received_umpire_defender_enrollments')){
    const run=statement.run.bind(statement);statement.run=((...args:Parameters<typeof statement.run>)=>{const result=run(...args);observed=true;observer();return result;}) as typeof statement.run;
  }return statement;}) as Db['prepare'];
  return {restore(){db.prepare=prepare;},observed:()=>observed};
};
const committedPartial=(db:Db)=>{
  expect(db.prepare('SELECT count(*) AS n FROM actual_received_umpire_defender_enrollments').get()!.n).toBe(1);
  expect(db.prepare('SELECT * FROM actual_received_umpire_defender_admissions').all()).toEqual([]);
  db.exec('BEGIN');try{expect(()=>beginActualLivePlayWrite(db,scope,{owner:'batted_world_field_executions',sourceId:'next'})).toThrow(/received.*pending/i);}finally{db.exec('ROLLBACK');}
};

it('R01 rejects and retires after a real INSERT observer commits and replaces the write transaction',()=>{
  const f=fixture(),fault=observeInsert(f.tx.db,()=>{f.tx.db.exec('COMMIT');f.tx.db.exec('BEGIN IMMEDIATE');});
  try{
    expect(()=>f.tx.write({bootstrap:true,changes:1},()=>{insertEnrollment(f.tx.db);return true;},()=>{}),'WRITE_TRANSACTION_REPLACEMENT_ACCEPTED').toThrow(/uncertain|ownership/i);
    expect(fault.observed()).toBe(true);committedPartial(f.db);expect(()=>f.tx.read(()=>null)).toThrow(/closed|retired/i);
  }finally{f.close();}
});

it('R02 retires after a post-INSERT forced commit throws and leaves an honest partial durable outcome',()=>{
  const f=fixture(),fault=observeInsert(f.tx.db,()=>{f.tx.db.exec('COMMIT');f.tx.db.exec('BEGIN IMMEDIATE');throw new Error('observer threw after real commit');});
  try{
    let error:unknown;try{f.tx.write({bootstrap:true,changes:1},()=>{insertEnrollment(f.tx.db);return true;},()=>{});}catch(e){error=e;}
    expect(error).toBeDefined();expect(fault.observed()).toBe(true);committedPartial(f.db);
    expect(()=>f.tx.read(()=>null),'PARTIAL_COMMIT_HANDLE_REUSED').toThrow(/closed|retired/i);expect(String(error)).toMatch(/uncertain|ownership/i);
  }finally{f.close();}
});

it('R03 detects pre-write rollback and replacement without inventing any durable enrollment',()=>{
  const f=fixture();
  try{
    expect(()=>f.tx.write({bootstrap:true,changes:0},()=>{f.tx.db.exec('ROLLBACK');f.tx.db.exec('BEGIN IMMEDIATE');throw new Error('pre-write replacement');},()=>{})).toThrow();
    expect(receivedOwnerSchema(f.db)).toBe('pristine');expect(originalRows(f.db)).toEqual([{value:'keep'}]);
    expect(()=>f.tx.read(()=>null),'PREWRITE_REPLACEMENT_HANDLE_REUSED').toThrow(/closed|retired/i);
  }finally{f.close();}
});

it('R04 rejects read COMMIT query-only drift and retires the private handle',()=>{
  const f=fixture(),exec=f.tx.db.exec.bind(f.tx.db);
  try{
    f.tx.db.exec=((sql:string)=>{exec(sql);if(sql==='COMMIT')exec('PRAGMA query_only=1');}) as Db['exec'];
    expect(()=>f.tx.read(()=>originalRows(f.tx.db)),'READ_COMMIT_SETTING_DRIFT_ACCEPTED').toThrow(/commit|state|query/i);
    expect(()=>f.tx.read(()=>null)).toThrow(/closed|retired/i);expect(originalRows(f.db)).toEqual([{value:'keep'}]);
  }finally{f.close();}
});

it('R05 rejects unrelated row or schema mutation after a real read COMMIT without compensation',()=>{
  for(const mutation of ["UPDATE original SET value='changed-after-commit'",'CREATE TABLE after_read_commit(value TEXT)']){
    const f=fixture(),exec=f.tx.db.exec.bind(f.tx.db);let observed=false;
    try{
      f.tx.db.exec=((sql:string)=>{exec(sql);if(sql==='COMMIT'){observed=true;exec(mutation);}}) as Db['exec'];
      expect(()=>f.tx.read(()=>originalRows(f.tx.db)),'READ_COMMIT_MUTATION_ACCEPTED').toThrow(/commit|account|schema/i);
      expect(observed).toBe(true);expect(()=>f.tx.read(()=>null)).toThrow(/closed|retired/i);
      if(mutation.startsWith('UPDATE'))expect(originalRows(f.db)).toEqual([{value:'changed-after-commit'}]);
      else expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='after_read_commit'").get()).toBeDefined();
    }finally{f.close();}
  }
});

it('R06 rejects final write-readback COMMIT query-only drift and retires after the genuine commit',()=>{
  const f=fixture(),exec=f.tx.db.exec.bind(f.tx.db);let commits=0;
  try{
    f.tx.db.exec=((sql:string)=>{exec(sql);if(sql==='COMMIT'&&++commits===2)exec('PRAGMA query_only=1');}) as Db['exec'];
    expect(()=>f.tx.write({bootstrap:true,changes:0},()=>true,()=>{}),'WRITE_READBACK_SETTING_DRIFT_ACCEPTED').toThrow(/uncertain.*commit/i);
    expect(commits).toBe(2);expect(receivedOwnerSchema(f.db)).toBe('installed');expect(()=>f.tx.read(()=>null)).toThrow(/closed|retired/i);
  }finally{f.close();}
});

it('R07 rejects final write-readback COMMIT mutations and retains their honest durable outcome',()=>{
  for(const mutation of ["UPDATE original SET value='changed-after-commit'",'CREATE TABLE after_write_commit(value TEXT)']){
    const f=fixture(),exec=f.tx.db.exec.bind(f.tx.db);let commits=0;
    try{
      f.tx.db.exec=((sql:string)=>{exec(sql);if(sql==='COMMIT'&&++commits===2)exec(mutation);}) as Db['exec'];
      expect(()=>f.tx.write({bootstrap:true,changes:0},()=>true,()=>{}),'WRITE_READBACK_MUTATION_ACCEPTED').toThrow(/uncertain.*commit/i);
      expect(commits).toBe(2);expect(receivedOwnerSchema(f.db)).toBe('installed');expect(()=>f.tx.read(()=>null)).toThrow(/closed|retired/i);
      if(mutation.startsWith('UPDATE'))expect(originalRows(f.db)).toEqual([{value:'changed-after-commit'}]);
      else expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='after_write_commit'").get()).toBeDefined();
    }finally{f.close();}
  }
});

it('R08 retires after proof RELEASE really executes then throws even when outer rollback succeeds',()=>{
  const f=fixture(),exec=f.tx.db.exec.bind(f.tx.db);let observed=false;
  try{
    f.tx.db.exec=((sql:string)=>{exec(sql);if(!observed&&sql==='RELEASE received_defender_read_proof'){observed=true;throw new Error('release observer');}}) as Db['exec'];
    expect(()=>f.tx.read(()=>true)).toThrow(/cleanup/i);expect(observed).toBe(true);
    expect(()=>f.tx.read(()=>null),'PROOF_RELEASE_FAILURE_HANDLE_REUSED').toThrow(/closed|retired/i);expect(originalRows(f.db)).toEqual([{value:'keep'}]);
  }finally{f.close();}
});

it('R09 retires after query-only restoration executes then throws during proof cleanup',()=>{
  const f=fixture(),exec=f.tx.db.exec.bind(f.tx.db);let observed=false;
  try{
    f.tx.db.exec=((sql:string)=>{exec(sql);if(!observed&&sql==='PRAGMA query_only=0'){observed=true;throw new Error('restore observer');}}) as Db['exec'];
    expect(()=>f.tx.read(()=>true)).toThrow(/cleanup/i);expect(observed).toBe(true);
    expect(()=>f.tx.read(()=>null),'PROOF_RESTORATION_FAILURE_HANDLE_REUSED').toThrow(/closed|retired/i);
  }finally{f.close();}
});

it('R10 rejects uppercase partial enrollment ownership through the shared legacy ingress unchanged',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(receivedOwnerSchemas.actual_received_umpire_defender_enrollments.replace('actual_received_umpire_defender_enrollments','ACTUAL_RECEIVED_UMPIRE_DEFENDER_ENROLLMENTS'));
    const before=db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();db.exec('BEGIN');
    expect(()=>beginActualLivePlayWrite(db,scope,{owner:'batted_world_field_executions',sourceId:'next'}),'UPPERCASE_PARTIAL_OWNER_IGNORED').toThrow(/schema/i);
    expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);db.exec('ROLLBACK');
  }finally{db.close();}
});

it('R11 rejects all-five mixed-case SQLite aliases instead of classifying the namespace as pristine',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    for(const [name,sql] of Object.entries(receivedOwnerSchemas))db.exec(sql.replace(name,name.replace(/[a-z]/g,(letter,index)=>index%2?letter.toUpperCase():letter)));
    const before=db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
    expect(()=>receivedOwnerSchema(db),'ALL_CASE_ALIAS_OWNERS_IGNORED').toThrow(/schema/i);expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
  }finally{db.close();}
});
