import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { installReceivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { renewalOwnerSchema } from './ActualReceivedUmpireRenewalSchema';
import type { RenewalEnrollmentSource } from './ActualReceivedUmpireRenewal';
import { withReceivedReadProof } from './ActualReceivedUmpireDefenderTransaction';
const seam=vi.hoisted(()=>({value:null as unknown,nestedProof:false}));
// Isolate original-owner authentication only. All new durable rows, family
// census, Native transactions and lifecycle failure injection are exercised.
vi.mock('./ActualReceivedUmpireRenewalEvidence',()=>({receivedRenewalEnrollmentEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>({
  derive:(source:RenewalEnrollmentSource)=>{const read=()=>{const dep=db.prepare('SELECT revision FROM original_dependency').get()!.revision;
    return {value:{...seam.value as object,source,dependencyRevision:dep}};};return seam.nestedProof?withReceivedReadProof(db,read):read();},
  qualifyCurrent:()=>{if(db.prepare('SELECT current_cut FROM original_dependency').get()!.current_cut!==1200)throw new Error('renewal current cut differs');return 'original-open';},
})}));
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const source:RenewalEnrollmentSource={sourceId:'renewal-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_enrollment_v1',receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2'};
const fixture=async()=>{
  expect(existsSync(new URL('./SqliteActualReceivedUmpireRenewalEnrollmentStore.ts',import.meta.url)),'RENEWAL_ENROLLMENT_IMPLEMENTATION_MISSING').toBe(true);
  const m=await import('./SqliteActualReceivedUmpireRenewalEnrollmentStore');
  const directory=mkdtempSync(join(tmpdir(),'received-renewal-enrollment-')),path=join(directory,'state.sqlite'),db=new DatabaseSync(path);
  db.exec("CREATE TABLE original_dependency(revision INTEGER,current_cut INTEGER); INSERT INTO original_dependency VALUES(0,1200); BEGIN");installReceivedOwnerSchema(db);db.exec('COMMIT');
  const ref=(sourceId:string)=>({sourceId,sourceHash:hash(sourceId),snapshotHash:hash(['snapshot',sourceId])});
  seam.nestedProof=false;
  seam.value={source,gameId:'game-a',playId:1,physicalPitchSourceId:'pitch-a',playerId:'player-a',runtimeSourceId:'runtime-a',receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2',originProcessSourceId:'replan-1',
    receiver:{careerId:'career-a',playerId:'player-a',personId:'person-a',personLinkSourceId:'person-link',fieldingModelSourceId:'fielding-a',gameDay:10},
    cause:{physicalPitchSourceId:'pitch-a',playerId:'player-a',callSourceId:'call-a',originCommunicationSourceId:'send-a'},
    cut:{originTick:1000,elapsedSeconds:0.2,tick:1200,ticksPerSecond:1000},
    anchor:{receivedEnrollment:ref('received-a'),receivedReplan:ref('replan-2'),legacyAdmissionPrefix:{count:24,digest:'legacy-digest'},receivedJournal:{count:4,digest:'received-digest'},
      baseField:ref('field-a'),physicalPredecessor:{...ref('execution-a'),revision:10},observation:{...ref('observation-a'),revision:3}},
    pending:{kind:'renewal_decision',originProcessSourceId:'replan-1'}};
  let accepted:RenewalEnrollmentSource|null=source;
  const store=m.openSqliteActualReceivedUmpireRenewalEnrollmentStore(path,{readAcceptedEnrollment:()=>accepted});
  return {...m,directory,path,db,store,setSource:(next:RenewalEnrollmentSource|null)=>{accepted=next;},close(){store.close();db.close();rmSync(directory,{recursive:true});}};
};
it('RE01 leaves a pristine renewal namespace untouched on open read and failed acceptance',async()=>{
  const f=await fixture();try{f.setSource(null);expect(renewalOwnerSchema(f.db)).toBe('pristine');expect(f.store.read('none')).toBeNull();expect(()=>f.store.accept('none')).toThrow(/Source.*missing/);expect(renewalOwnerSchema(f.db)).toBe('pristine');}finally{f.close();}
});
it('RE02 commits exactly enrollment head and journal rows with a decision obligation',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let changes=0;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_')){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);changes+=Number(result.changes);return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    const value=f.store.accept(source.sourceId);expect(changes).toBe(3);expect(value.pending.kind).toBe('renewal_decision');
    expect(f.db.prepare('SELECT stage,source_id FROM actual_received_umpire_renewal_heads').all()).toEqual([{stage:1,source_id:source.sourceId}]);
    expect(f.db.prepare('SELECT sequence,owner FROM actual_received_umpire_renewal_admissions').all()).toEqual([{sequence:1,owner:'actual_received_umpire_renewal_enrollments'}]);
    expect(f.db.prepare('SELECT * FROM actual_received_umpire_defender_admissions').all()).toEqual([]);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RE03 reopens and retries without authority calls writes or a new Source identity',async()=>{
  const f=await fixture();try{const value=f.store.accept(source.sourceId);f.store.close();const store=f.openSqliteActualReceivedUmpireRenewalEnrollmentStore(f.path);try{expect(store.read(source.sourceId)).toEqual(value);expect(store.accept(source.sourceId)).toEqual(value);expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_renewal_admissions').get()!.n).toBe(1);}finally{store.close();}}finally{f.close();}
});
it('RE04 rolls bootstrap and all rows back when accepted Source changes after the real enrollment INSERT',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let inserted=false;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_enrollments')){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);inserted=true;f.setSource({...source,sourceVersion:'changed'});return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(source.sourceId)).toThrow(/Source|callback/);expect(inserted).toBe(true);expect(renewalOwnerSchema(f.db)).toBe('pristine');
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RE05 authenticates independent dependencies again after the real owner write',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_enrollments')){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);prepare.call(db,'UPDATE original_dependency SET revision=1').run();return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(source.sourceId)).toThrow(/proof|proposal|dependency|accounting/);expect(renewalOwnerSchema(f.db)).toBe('pristine');expect(f.db.prepare('SELECT revision FROM original_dependency').get()!.revision).toBe(0);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RE06 rejects a changed current physical cut before creating renewal ownership',async()=>{
  const f=await fixture();try{f.db.exec('UPDATE original_dependency SET current_cut=1201');expect(()=>f.store.accept(source.sourceId)).toThrow(/current cut/);expect(renewalOwnerSchema(f.db)).toBe('pristine');}finally{f.close();}
});
it('RE07 reports uncertain committed enrollment and retires after a real COMMIT and replacement BEGIN',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let injected=false;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_enrollments')){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);if(!injected){injected=true;db.exec('COMMIT; BEGIN IMMEDIATE');throw new Error('injected committed owner');}return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(source.sourceId)).toThrow(/uncertain.*retired|ownership.*retired/);expect(()=>f.store.read(source.sourceId)).toThrow(/retired|closed/);
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_renewal_enrollments').get()!.n).toBe(1);expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_renewal_heads').get()!.n).toBe(0);
    const reopened=f.openSqliteActualReceivedUmpireRenewalEnrollmentStore(f.path);try{expect(()=>reopened.read(source.sourceId)).toThrow(/journal|head|admission/);}finally{reopened.close();}
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});

it('RE08 retires the renewal handle when a nested old proof RELEASE executes then throws',async()=>{
  const f=await fixture(),exec=DatabaseSync.prototype.exec;let injected=false;
  try{seam.nestedProof=true;
    DatabaseSync.prototype.exec=function(this:InstanceType<typeof DatabaseSync>,sql:string){const result=exec.call(this,sql);if(!injected&&sql==='RELEASE received_defender_read_proof'){injected=true;throw new Error('injected old proof cleanup');}return result;};
    expect(()=>f.store.accept(source.sourceId)).toThrow(/cleanup/);expect(injected).toBe(true);
    DatabaseSync.prototype.exec=exec;seam.nestedProof=false;
    expect(()=>f.store.read('absent'),'NESTED_OLD_PROOF_FAILURE_HANDLE_REUSED').toThrow(/retired|closed/);
  }finally{DatabaseSync.prototype.exec=exec;seam.nestedProof=false;f.close();}
});

it('RE09 rejects a physical-action-only union claim before renewal bootstrap',async()=>{
  const f=await fixture(),exec=DatabaseSync.prototype.exec;let setup=false;
  try{f.db.exec('CREATE TABLE batted_world_field_executions(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)');
    const s={sourceId:'orphan-adoption',sourceVersion:'fixture-v1',previousExecutionSourceId:'execution-a',action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:'missing-renewal',renewalMotorSourceId:'missing-motor'}};
    f.db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?)').run('orphan-adoption','game-a',1,'pitch-a',JSON.stringify(s),'{}');
    DatabaseSync.prototype.exec=function(this:InstanceType<typeof DatabaseSync>,sql:string){if(sql.startsWith('CREATE TABLE actual_received_umpire_renewal_'))setup=true;return exec.call(this,sql);};
    expect(()=>f.store.accept(source.sourceId),'PHYSICAL_RENEWAL_UNION_ORPHAN_ADMITTED').toThrow(/claim|ownership/);
    expect(setup).toBe(false);expect(renewalOwnerSchema(f.db)).toBe('pristine');
  }finally{DatabaseSync.prototype.exec=exec;f.close();}
});
