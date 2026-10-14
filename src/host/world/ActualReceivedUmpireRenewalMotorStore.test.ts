import { createRequire } from 'node:module';
import { existsSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it,vi } from 'vitest';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { installReceivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { openSqliteActualReceivedUmpireRenewalEnrollmentStore } from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import { openSqliteActualReceivedUmpireRenewalDecisionStore } from './SqliteActualReceivedUmpireRenewalDecisionStore';
import type { RenewalEnrollmentSource,RenewalDecisionSource,RenewalMotorSource } from './ActualReceivedUmpireRenewal';
const seam=vi.hoisted(()=>({value:null as unknown,facts:null as unknown}));
// Original ownership is isolated, while the new Native owners and pure Core
// motor calculation are real. This is not a genuine received-donor gate.
vi.mock('./ActualReceivedUmpireRenewalEvidence',()=>({receivedRenewalEnrollmentEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>({
  derive:(source:RenewalEnrollmentSource)=>({value:{...seam.value as object,source,dependencyRevision:db.prepare('SELECT revision FROM original_dependency').get()!.revision},...seam.facts as object}),
  qualifyCurrent:()=>{if(db.prepare('SELECT current_cut FROM original_dependency').get()!.current_cut!==150)throw new Error('renewal current cut differs');return 'original-open';},
})}));
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const enrollmentSource:RenewalEnrollmentSource={sourceId:'renewal-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_enrollment_v1',receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2'};
const decisionSource:RenewalDecisionSource={sourceId:'renewal-decision',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_decision_v1',renewalEnrollmentSourceId:'renewal-a'};
const motorSource:RenewalMotorSource={sourceId:'renewal-motor',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_motor_v1',renewalEnrollmentSourceId:'renewal-a',renewalDecisionSourceId:'renewal-decision'};
const fixture=async()=>{
  expect(existsSync(new URL('./SqliteActualReceivedUmpireRenewalMotorStore.ts',import.meta.url)),'RENEWAL_MOTOR_OWNER_IMPLEMENTATION_MISSING').toBe(true);
  const m=await import('./SqliteActualReceivedUmpireRenewalMotorStore'),facts=(await import('./ActualReceivedUmpireRenewalMotorFixtures.test-support')).receivedRenewalMotorFixture();
  const directory=mkdtempSync(join(tmpdir(),'received-renewal-motor-')),path=join(directory,'state.sqlite'),db=new DatabaseSync(path);
  db.exec('CREATE TABLE original_dependency(revision INTEGER,current_cut INTEGER); INSERT INTO original_dependency VALUES(0,150); BEGIN');installReceivedOwnerSchema(db);db.exec('COMMIT');
  const ref=(sourceId:string)=>({sourceId,sourceHash:hash(sourceId),snapshotHash:hash(['snapshot',sourceId])}),d=facts.decision;
  seam.value={source:enrollmentSource,gameId:facts.self.gameId,playId:1,physicalPitchSourceId:d.physicalPitchSourceId,playerId:d.playerId,runtimeSourceId:'runtime-a',receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2',originProcessSourceId:'replan-1',
    receiver:{careerId:facts.model.source.careerId,playerId:d.playerId,personId:d.personId,personLinkSourceId:d.personLinkSourceId,fieldingModelSourceId:facts.model.source.fieldingModelSourceId,gameDay:d.gameDay},cause:{physicalPitchSourceId:d.physicalPitchSourceId,playerId:d.playerId,callSourceId:'call-a',originCommunicationSourceId:'send-a'},cut:d.cut,
    selection:{selected:d.selected,target:d.target,selectedAt:facts.self.at,movementStartTick:d.movementStartTick,dueTick:d.movementStartTick},
    anchor:{receivedEnrollment:ref('received-a'),receivedReplan:ref('replan-2'),legacyAdmissionPrefix:{count:24,digest:'legacy'},receivedJournal:{count:4,digest:'received'},baseField:ref('field-a'),physicalPredecessor:{...ref('execution-a'),revision:10},observation:{...ref('observation-a'),revision:3},selfHash:hash(facts.self),locomotionModel:{sourceId:facts.model.source.sourceId,sourceHash:hash(facts.model.source),snapshotHash:hash(facts.model)}},pending:{kind:'renewal_decision',originProcessSourceId:'replan-1'}};
  seam.facts={self:facts.self,model:facts.model};
  const enrollment=openSqliteActualReceivedUmpireRenewalEnrollmentStore(path,{readAcceptedEnrollment:()=>enrollmentSource});enrollment.accept(enrollmentSource.sourceId);
  const decisions=openSqliteActualReceivedUmpireRenewalDecisionStore(path,{readAcceptedDecision:()=>decisionSource});decisions.accept(decisionSource.sourceId);let accepted=motorSource;
  const store=m.openSqliteActualReceivedUmpireRenewalMotorStore(path,{readAcceptedMotor:()=>accepted});
  return {...m,path,db,store,decisions,facts,changeSource:(s:RenewalMotorSource)=>{accepted=s;},close(){store.close();decisions.close();enrollment.close();db.close();rmSync(directory,{recursive:true});}};
};
it('RM01 owns exactly three motor changes using real Core mathematics and each retained role command',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let changes=0;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(/^(INSERT INTO actual_received_umpire_renewal_|UPDATE actual_received_umpire_renewal_heads)/.test(sql)){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const r=run(...args);changes+=Number(r.changes);return r;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    const m=f.store.accept(motorSource.sourceId);expect(changes).toBe(3);expect(m.receipt.coverageEndTick).toBe(220);expect(m.receipt.lifecycle).toEqual({status:'adoption_pending',executedThrough:null});
    expect(m.receipt.retainedRoles.map(p=>p.command.sourceId)).toEqual(f.facts.self.ownedMotionCoverage!.roleAuthorities.map(p=>p.command.sourceId));expect(f.db.prepare('SELECT stage,renewal_motor_source_id FROM actual_received_umpire_renewal_heads').get()).toEqual({stage:3,renewal_motor_source_id:motorSource.sourceId});
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RM02 reopens and retries a motor without callbacks current qualification or duplicate writes',async()=>{
  const f=await fixture();try{const m=f.store.accept(motorSource.sourceId);f.store.close();f.db.exec('UPDATE original_dependency SET current_cut=151');const store=f.openSqliteActualReceivedUmpireRenewalMotorStore(f.path);try{expect(store.read(motorSource.sourceId)).toEqual(m);expect(store.accept(motorSource.sourceId)).toEqual(m);expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_renewal_admissions').get()!.n).toBe(3);}finally{store.close();}}finally{f.close();}
});
it('RM03 rejects a second motor Source while preserving its original motor head',async()=>{
  const f=await fixture();try{f.store.accept(motorSource.sourceId);f.changeSource({...motorSource,sourceId:'second-motor'});expect(()=>f.store.accept('second-motor')).toThrow(/stage|head|motor/);expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_renewal_motors').get()!.n).toBe(1);}finally{f.close();}
});
it('RM04 rolls motor acceptance back after a real INSERT changes its original dependency',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_motors')){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const r=run(...args);prepare.call(db,'UPDATE original_dependency SET revision=1').run();return r;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(motorSource.sourceId)).toThrow(/proof|dependency|proposal/);expect(f.db.prepare('SELECT revision FROM original_dependency').get()!.revision).toBe(0);expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(2);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RM05 rolls motor acceptance back after the accepted Source rebinds its decision',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_motors')){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const r=run(...args);f.changeSource({...motorSource,renewalDecisionSourceId:'foreign-decision'});return r;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(motorSource.sourceId)).toThrow(/Source|callback/);expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(2);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RM06 keeps a later resealed motor result opaque during historical decision replay',async()=>{
  const f=await fixture();try{f.store.accept(motorSource.sourceId);const d=f.decisions.read(decisionSource.sourceId);
    const row=f.db.prepare('SELECT * FROM actual_received_umpire_renewal_motors').get()!,value=JSON.parse(String(row.snapshot_json));value.receipt='opaque later motor';const snapshotHash=hash(value);
    f.db.prepare('UPDATE actual_received_umpire_renewal_motors SET snapshot_json=?,snapshot_hash=?').run(JSON.stringify(value),snapshotHash);
    const entry=f.db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE sequence=3').get()!,{receipt_hash:ignored,...body}=entry;body.snapshot_hash=snapshotHash;
    f.db.prepare('UPDATE actual_received_umpire_renewal_admissions SET snapshot_hash=?,receipt_hash=? WHERE sequence=3').run(snapshotHash,hash(body));
    expect(f.decisions.read(decisionSource.sourceId)).toEqual(d);expect(()=>f.store.read(motorSource.sourceId)).toThrow(/archive/);
  }finally{f.close();}
});
it('RM07 projects physical adoption pending while rejecting a changed current cut',async()=>{
  const f=await fixture();try{
    expect(existsSync(new URL('./ActualReceivedUmpireRenewalLiveWork.ts',import.meta.url)),'RENEWAL_WORK_PROJECTION_MISSING').toBe(true);
    const {actualReceivedUmpireRenewalLiveWorkFromSqlite}=await import('./ActualReceivedUmpireRenewalLiveWork');f.store.accept(motorSource.sourceId);
    f.db.exec('BEGIN');expect(actualReceivedUmpireRenewalLiveWorkFromSqlite(f.db).read('received-a')).toMatchObject({kind:'received_renewal_work',stage:3,originProcessSourceId:'replan-1',work:{kind:'renewal_physical_adoption',sourceId:motorSource.sourceId,dueTick:150}});f.db.exec('COMMIT');
    f.db.exec('UPDATE original_dependency SET current_cut=151; BEGIN');expect(()=>actualReceivedUmpireRenewalLiveWorkFromSqlite(f.db).read('received-a')).toThrow(/current cut/);f.db.exec('ROLLBACK');
  }finally{if(f.db.isTransaction)f.db.exec('ROLLBACK');f.close();}
});

const committedFault=async(kind:'dependency'|'callback'|'current')=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare,exec=DatabaseSync.prototype.exec;let owner:InstanceType<typeof DatabaseSync>|null=null,injected=false,committedRows:unknown;
  try{
    DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_motors')){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);owner=db;return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    DatabaseSync.prototype.exec=function(this:InstanceType<typeof DatabaseSync>,sql:string){const result=exec.call(this,sql);if(this===owner&&sql==='COMMIT'&&!injected){injected=true;committedRows=f.db.prepare('SELECT * FROM actual_received_umpire_renewal_motors').all();
      if(kind==='callback')f.changeSource({...motorSource,sourceVersion:'changed-after-commit'});
      else exec.call(f.db,kind==='dependency'?'UPDATE original_dependency SET revision=1':'UPDATE original_dependency SET current_cut=9999');
    }return result;};
    expect(()=>f.store.accept(motorSource.sourceId),'RENEWAL_POST_COMMIT_AUTHORITY_CHANGE_ESCAPED').toThrow(/uncertain.*retired/);expect(injected).toBe(true);
    expect(()=>f.store.read(motorSource.sourceId)).toThrow(/retired|closed/);
    expect(f.db.prepare('SELECT * FROM actual_received_umpire_renewal_motors').all()).toEqual(committedRows);
    expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(3);
  }finally{DatabaseSync.prototype.prepare=prepare;DatabaseSync.prototype.exec=exec;f.close();}
};
it('RM08 retires after COMMIT changes its dependency authority with committed owner rows conserved',()=>committedFault('dependency'));
it('RM09 retires after COMMIT changes its callback authority with committed owner rows conserved',()=>committedFault('callback'));
it('RM10 retires after COMMIT changes its current authority with committed owner rows conserved',()=>committedFault('current'));

it('RM11 rejects an unjournaled physical renewal claim at the motor stage',async()=>{
  const f=await fixture();try{f.store.accept(motorSource.sourceId);
    f.db.exec('CREATE TABLE batted_world_field_executions(source_id TEXT,physical_pitch_source_id TEXT,base_field_source_id TEXT,previous_source_id TEXT,revision INTEGER,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT)');
    const s={sourceId:'unjournaled-renewal',sourceVersion:'fixture-v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'execution-a',action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:enrollmentSource.sourceId,renewalMotorSourceId:motorSource.sourceId}};
    f.db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?,?,?,?,?)').run(s.sourceId,'pitch','field-a','execution-a',11,'game-a',JSON.stringify(s),hash(s),JSON.stringify({source:s}),hash({source:s}));
    expect(()=>f.store.read(motorSource.sourceId),'UNJOURNALED_RENEWAL_PHYSICAL_CLAIM_IGNORED').toThrow(/claim|physical|journal/);
  }finally{f.close();}
});

it('RJ01 binds the actual snapshotFormat header and keeps the later physical result opaque',async()=>{
  const f=await fixture();try{f.store.accept(motorSource.sourceId);
    const {renewalJournal,appendRenewalJournal}=await import('./ActualReceivedUmpireRenewalJournal');
    const e=JSON.parse(String(f.db.prepare('SELECT snapshot_json FROM actual_received_umpire_renewal_enrollments').get()!.snapshot_json)) as import('./ActualReceivedUmpireRenewalEvidence').DurableReceivedRenewalEnrollment;
    const table='batted_world_field_executions',source={sourceId:'journaled-adoption',sourceVersion:'fixture-v1',baseFieldSourceId:e.anchor.baseField.sourceId,previousExecutionSourceId:e.anchor.physicalPredecessor.sourceId,
      action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:e.source.sourceId,renewalMotorSourceId:motorSource.sourceId}};
    // Only metadata is claimed here. Actual Core output is covered by RN01.
    const snapshot={snapshotFormat:'received_renewal_adoption_snapshot_v1',source,execution:'opaque later physical result'};
    f.db.exec('CREATE TABLE batted_world_field_executions(source_id TEXT,physical_pitch_source_id TEXT,base_field_source_id TEXT,previous_source_id TEXT,revision INTEGER,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT)');
    f.db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?,?,?,?,?)').run(source.sourceId,e.physicalPitchSourceId,source.baseFieldSourceId,source.previousExecutionSourceId,e.anchor.physicalPredecessor.revision+1,e.gameId,json(source),hash(source),json(snapshot),hash(snapshot));
    f.db.prepare('UPDATE actual_received_umpire_renewal_heads SET stage=4,owner=?,source_id=?,adoption_source_id=?').run(table,source.sourceId,source.sourceId);appendRenewalJournal(f.db,e,table,source.sourceId);
    expect(()=>renewalJournal(f.db,e),'ACTUAL_RENEWAL_SNAPSHOT_FORMAT_REJECTED').not.toThrow();expect(renewalJournal(f.db,e)).toHaveLength(4);
    const wrong={format:snapshot.snapshotFormat,source,execution:snapshot.execution},entry=f.db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE sequence=4').get()!,{receipt_hash:ignored,...body}=entry;body.snapshot_hash=hash(wrong);
    f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=?,snapshot_hash=?').run(json(wrong),hash(wrong));f.db.prepare('UPDATE actual_received_umpire_renewal_admissions SET snapshot_hash=?,receipt_hash=? WHERE sequence=4').run(hash(wrong),hash(body));
    expect(()=>renewalJournal(f.db,e)).toThrow(/header lineage/);
  }finally{f.close();}
});
