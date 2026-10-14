import { createRequire } from 'node:module';
import { afterEach,expect,it,vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { enrollmentFixture,native,count } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore as open } from './SqliteSamePlateAppearanceEnrollmentStore';
import { readSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollmentFromSqlite';
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixtures:ReturnType<typeof enrollmentFixture>[]=[],owners:{close():void}[]=[];
afterEach(()=>{vi.restoreAllMocks();owners.splice(0).reverse().forEach(o=>o.close());fixtures.splice(0).reverse().forEach(f=>f.close());});
const setup=()=>{const f=enrollmentFixture();fixtures.push(f);const owner=open(f.path,{readAcceptedEnrollment:()=>f.source});owners.push(owner);return {...f,owner};};
const pristine=(db:DatabaseSync)=>expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'same_pa_%'").all()).toEqual([]);
it.each(['baseline','root','member','right'] as const)('SP-W01 writer-local AFTER INSERT %s mutation rolls back the whole new namespace',fault=>{
  const f=setup(),original=NativeDatabase.prototype.prepare;let injected=false,effectObserved=false;
  const target=fault==='right'?'same_pa_successor_rights':fault==='member'?'same_pa_participant_reservations':'same_pa_enrollments';
  const patch=vi.spyOn(NativeDatabase.prototype,'prepare').mockImplementation(function(this:DatabaseSync,sql:string){
    if(!injected&&sql.startsWith('INSERT INTO main.'+target)){
      injected=true;const change=fault==='baseline'?"UPDATE world_player_workload_heads SET revision=88 WHERE player_id='home-9'":fault==='root'?'DELETE FROM same_pa_enrollments':fault==='member'?"UPDATE same_pa_participant_reservations SET player_id='moved'":"UPDATE same_pa_successor_rights SET consuming_source_id='alias'";
      this.exec(`CREATE TRIGGER injected_enrollment_fault AFTER INSERT ON ${target} BEGIN ${change}; END`);effectObserved=true;
    }
    return original.call(this,sql);
  });
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow(/same-PA/);expect(injected&&effectObserved).toBe(true);pristine(f.db);
  expect(f.workload.readHead('career-a','home-9')!.revision).toBe(0);
  patch.mockRestore();expect(f.owner.accept(f.source.sourceId).kind).toBe('reserved');
});
it('SP-W02 separate WAL writer advances an accepted baseline between preflight and acquisition',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec;let fired=false;
  f.activities.set('intervening',{sourceEventId:'intervening',sourceVersion:'fixture-v1',evidenceId:'independent',careerId:'career-a',playerId:'away-2',atDay:2,kind:'TRAVEL',distanceKm:1});
  const patch=vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){
    if(!fired&&sql==='BEGIN IMMEDIATE'){fired=true;f.workload.apply('intervening',0);}return exec.call(this,sql);
  });
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow(/stale/);expect(fired).toBe(true);pristine(f.db);patch.mockRestore();
  expect(f.workload.readHead('career-a','away-2')!.revision).toBe(1);
});
it('SP-W02 actual forced COMMIT retires and reports uncertainty without pretending rollback',()=>{
  const f=setup(),prepare=NativeDatabase.prototype.prepare;let fired=false;
  vi.spyOn(NativeDatabase.prototype,'prepare').mockImplementation(function(this:DatabaseSync,sql:string){
    const statement=prepare.call(this,sql);if(!fired&&sql.startsWith('INSERT INTO main.same_pa_enrollments')){
      const run=statement.run.bind(statement);vi.spyOn(statement,'run').mockImplementation((...args:Parameters<typeof run>)=>{const result=run(...args);fired=true;this.exec('COMMIT');return result;});
    }return statement;
  });
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow(/retired.*uncertain/);expect(fired).toBe(true);
  expect(()=>f.owner.read(f.source.sourceId)).toThrow(/retired/);expect(count(f.db,'same_pa_enrollments')).toBe(1);expect(count(f.db,'same_pa_participant_reservations')).toBe(0);
});
it('SP-W02 rollback failure retires the private owner',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec,prepare=NativeDatabase.prototype.prepare;let fired=false;
  vi.spyOn(NativeDatabase.prototype,'prepare').mockImplementation(function(this:DatabaseSync,sql:string){
    if(sql.startsWith('INSERT INTO main.same_pa_enrollments'))throw new Error('controlled insert failure');return prepare.call(this,sql);
  });
  vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){if(sql==='ROLLBACK'){fired=true;throw new Error('controlled rollback failure');}return exec.call(this,sql);});
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow(/retired/);expect(fired).toBe(true);expect(()=>f.owner.read(f.source.sourceId)).toThrow(/retired/);pristine(f.db);
});
it('SP-W02 post-COMMIT mutation fails durable accounting and retires without repair',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec;let wrote=false,fired=false;
  vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){
    if(sql==='BEGIN IMMEDIATE')wrote=true;const result=exec.call(this,sql);
    if(wrote&&!fired&&sql==='COMMIT'){fired=true;exec.call(this,"DELETE FROM same_pa_successor_rights");}return result;
  });
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow(/retired.*uncertain/);expect(fired).toBe(true);expect(count(f.db,'same_pa_enrollments')).toBe(1);expect(count(f.db,'same_pa_successor_rights')).toBe(0);
});
it('SP-W02 clean close/reopen uses a query-only Native snapshot and no authority callbacks',()=>{
  const f=setup(),saved=f.owner.accept(f.source.sourceId);f.owner.close();const db=native(f.path);owners.push(db);db.exec('PRAGMA query_only=1; BEGIN');
  try{expect(readSamePlateAppearanceEnrollment(db,f.source.sourceId)).toEqual(saved);}finally{db.exec('COMMIT');}
});
