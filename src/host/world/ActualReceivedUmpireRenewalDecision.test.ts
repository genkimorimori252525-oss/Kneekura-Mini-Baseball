import { createRequire } from 'node:module';
import { existsSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it,vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { installReceivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { openSqliteActualReceivedUmpireRenewalEnrollmentStore } from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import type { RenewalEnrollmentSource,RenewalDecisionSource } from './ActualReceivedUmpireRenewal';
const seam=vi.hoisted(()=>({value:null as unknown,derives:0}));
// Native owner/counter/CAS tests; original received/physical ownership is an
// explicit isolated seam, not genuine received-donor qualification.
vi.mock('./ActualReceivedUmpireRenewalEvidence',()=>({receivedRenewalEnrollmentEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>({
  derive:(source:RenewalEnrollmentSource)=>{seam.derives++;return {value:{...seam.value as object,source,dependencyRevision:db.prepare('SELECT revision FROM original_dependency').get()!.revision}};},
  qualifyCurrent:()=>{if(db.prepare('SELECT current_cut FROM original_dependency').get()!.current_cut!==1200)throw new Error('renewal current cut differs');return 'original-open';},
})}));
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const enrollmentSource:RenewalEnrollmentSource={sourceId:'renewal-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_enrollment_v1',receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2'};
const decisionSource:RenewalDecisionSource={sourceId:'renewal-decision-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_decision_v1',renewalEnrollmentSourceId:'renewal-a'};
const fixture=async()=>{
  expect(existsSync(new URL('./SqliteActualReceivedUmpireRenewalDecisionStore.ts',import.meta.url)),'RENEWAL_DECISION_IMPLEMENTATION_MISSING').toBe(true);
  const m=await import('./SqliteActualReceivedUmpireRenewalDecisionStore'),directory=mkdtempSync(join(tmpdir(),'received-renewal-decision-')),path=join(directory,'state.sqlite'),db=new DatabaseSync(path);
  db.exec('CREATE TABLE original_dependency(revision INTEGER,current_cut INTEGER); INSERT INTO original_dependency VALUES(0,1200); BEGIN');installReceivedOwnerSchema(db);db.exec('COMMIT');
  const ref=(sourceId:string)=>({sourceId,sourceHash:hash(sourceId),snapshotHash:hash(['snapshot',sourceId])}),at={originTick:1000,elapsedSeconds:0.2,tick:1200},cut={...at,ticksPerSecond:1000};
  seam.value={source:enrollmentSource,gameId:'game-a',playId:1,physicalPitchSourceId:'pitch-a',playerId:'player-a',runtimeSourceId:'runtime-a',receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2',originProcessSourceId:'replan-1',
    receiver:{careerId:'career-a',playerId:'player-a',personId:'person-a',personLinkSourceId:'link-a',fieldingModelSourceId:'fielding-a',gameDay:10},cause:{physicalPitchSourceId:'pitch-a',playerId:'player-a',callSourceId:'call-a',originCommunicationSourceId:'send-a'},cut,
    selection:{selected:{intent:{kind:'ball_handler'},localPriority:0.816,evidenceAvailableAt:1100,evidenceKinds:['observed_ball','pre_play_plan']},target:{x:4,z:9},selectedAt:at,movementStartTick:1200,dueTick:1200},
    anchor:{receivedEnrollment:ref('received-a'),receivedReplan:ref('replan-2'),legacyAdmissionPrefix:{count:24,digest:'legacy'},receivedJournal:{count:4,digest:'received'},baseField:ref('field-a'),physicalPredecessor:{...ref('execution-a'),revision:10},observation:{...ref('observation-a'),revision:3}},pending:{kind:'renewal_decision',originProcessSourceId:'replan-1'}};
  const enrollment=openSqliteActualReceivedUmpireRenewalEnrollmentStore(path,{readAcceptedEnrollment:()=>enrollmentSource});enrollment.accept(enrollmentSource.sourceId);let accepted=decisionSource;
  const store=m.openSqliteActualReceivedUmpireRenewalDecisionStore(path,{readAcceptedDecision:()=>accepted});
  return {...m,path,db,store,enrollment,changeSource:(s:RenewalDecisionSource)=>{accepted=s;},close(){store.close();enrollment.close();db.close();rmSync(directory,{recursive:true});}};
};
it('RD01 materializes the owned received selection through exactly three Native row changes',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let changes=0;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(/^(INSERT INTO actual_received_umpire_renewal_|UPDATE actual_received_umpire_renewal_heads)/.test(sql)){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);changes+=Number(result.changes);return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    const d=f.store.accept(decisionSource.sourceId);expect(changes).toBe(3);expect(d.receipt).toMatchObject({sourceId:decisionSource.sourceId,cut:{originTick:1000,elapsedSeconds:0.2,tick:1200,ticksPerSecond:1000},selected:{intent:{kind:'ball_handler'}},target:{x:4,z:9},movementStartTick:1200});
    expect(f.db.prepare('SELECT stage,renewal_decision_source_id FROM actual_received_umpire_renewal_heads').all()).toEqual([{stage:2,renewal_decision_source_id:decisionSource.sourceId}]);expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_defender_admissions').get()!.n).toBe(0);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RD02 replays and retries an issued renewal decision without callbacks or current qualification',async()=>{
  const f=await fixture();try{const d=f.store.accept(decisionSource.sourceId);f.store.close();f.db.exec('UPDATE original_dependency SET current_cut=1300');const reader=f.openSqliteActualReceivedUmpireRenewalDecisionStore(f.path);try{seam.derives=0;expect(reader.read(decisionSource.sourceId)).toEqual(d);expect(seam.derives).toBe(1);expect(reader.accept(decisionSource.sourceId)).toEqual(d);}finally{reader.close();}}finally{f.close();}
});
it('RD03 rejects a second issuance Source without changing its issued head',async()=>{
  const f=await fixture();try{f.store.accept(decisionSource.sourceId);f.changeSource({...decisionSource,sourceId:'fork'});expect(()=>f.store.accept('fork')).toThrow(/stage|head|issued|claim/);expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_renewal_decisions').get()!.n).toBe(1);}finally{f.close();}
});
it('RD04 rolls issuance back when its accepted Source changes after the real INSERT',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_decisions')){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);f.changeSource({...decisionSource,sourceVersion:'changed'});return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(decisionSource.sourceId)).toThrow(/Source|callback/);expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(1);expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_renewal_decisions').get()!.n).toBe(0);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RD05 rederives independent original dependencies after each real issuance write',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_decisions')){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);prepare.call(db,'UPDATE original_dependency SET revision=1').run();return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(decisionSource.sourceId)).toThrow(/proof|dependency|proposal/);expect(f.db.prepare('SELECT revision FROM original_dependency').get()!.revision).toBe(0);expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(1);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RD06 projects one decision then one motor obligation from the durable renewal journal',async()=>{
  const f=await fixture();try{
    expect(existsSync(new URL('./ActualReceivedUmpireRenewalLiveWork.ts',import.meta.url)),'RENEWAL_WORK_PROJECTION_MISSING').toBe(true);
    const {actualReceivedUmpireRenewalLiveWorkFromSqlite}=await import('./ActualReceivedUmpireRenewalLiveWork');
    f.db.exec('BEGIN');expect(actualReceivedUmpireRenewalLiveWorkFromSqlite(f.db).read('received-a')).toMatchObject({kind:'received_renewal_work',stage:1,originProcessSourceId:'replan-1',work:{kind:'renewal_decision'}});f.db.exec('COMMIT');
    f.store.accept(decisionSource.sourceId);f.db.exec('BEGIN');expect(actualReceivedUmpireRenewalLiveWorkFromSqlite(f.db).read('received-a')).toMatchObject({kind:'received_renewal_work',stage:2,work:{kind:'renewal_motor'}});f.db.exec('COMMIT');
  }finally{if(f.db.isTransaction)f.db.exec('ROLLBACK');f.close();}
});

const committedFault=async(kind:'dependency'|'callback'|'current')=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare,exec=DatabaseSync.prototype.exec;let owner:InstanceType<typeof DatabaseSync>|null=null,injected=false,committedRows:unknown;
  try{
    DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_renewal_decisions')){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);owner=db;return result;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    DatabaseSync.prototype.exec=function(this:InstanceType<typeof DatabaseSync>,sql:string){const result=exec.call(this,sql);if(this===owner&&sql==='COMMIT'&&!injected){injected=true;committedRows=f.db.prepare('SELECT * FROM actual_received_umpire_renewal_decisions').all();
      if(kind==='callback')f.changeSource({...decisionSource,sourceVersion:'changed-after-commit'});
      else exec.call(f.db,kind==='dependency'?'UPDATE original_dependency SET revision=1':'UPDATE original_dependency SET current_cut=9999');
    }return result;};
    expect(()=>f.store.accept(decisionSource.sourceId),'RENEWAL_POST_COMMIT_AUTHORITY_CHANGE_ESCAPED').toThrow(/uncertain.*retired/);expect(injected).toBe(true);
    expect(()=>f.store.read(decisionSource.sourceId)).toThrow(/retired|closed/);
    expect(f.db.prepare('SELECT * FROM actual_received_umpire_renewal_decisions').all()).toEqual(committedRows);
    expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(2);
  }finally{DatabaseSync.prototype.prepare=prepare;DatabaseSync.prototype.exec=exec;f.close();}
};
it('RD07 retires after COMMIT changes its dependency authority with committed owner rows conserved',()=>committedFault('dependency'));
it('RD08 retires after COMMIT changes its callback authority with committed owner rows conserved',()=>committedFault('callback'));
it('RD09 retires after COMMIT changes its current authority with committed owner rows conserved',()=>committedFault('current'));
