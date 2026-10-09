import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it,vi} from 'vitest';
// Finite Native lifecycle only. Existing authenticated physical/communication
// and received ancestry are explicit seams; no genuine gameplay credit.
const state=vi.hoisted(()=>({e:null as any,prior:null as any,next:null as any,previousCommunication:null as any,communication:null as any}));
vi.mock('./SqliteBattedWorldFieldExecutionStore',async importOriginal=>{
  const actual=await importOriginal<typeof import('./SqliteBattedWorldFieldExecutionStore')>();
  return {...actual,withBattedWorldPhysicalReadTraversal:<T>(_db:unknown,body:()=>T)=>body(),battedWorldFieldExecutionEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>({
    derive:()=>state.next,read:(id:string)=>id===state.prior.source.sourceId?state.prior:db.prepare('SELECT 1 FROM batted_world_field_executions WHERE source_id=?').get(id)?state.next:null,
    current:(value:any)=>{if(db.prepare('SELECT source_id FROM batted_world_field_execution_heads').get()!.source_id!==value.source.sourceId)throw new Error('current physical changed');},
    currentAdmission:(value:any)=>{if(db.prepare('SELECT source_id FROM batted_world_field_execution_heads').get()!.source_id!==value.source.sourceId)throw new Error('current physical changed');},
  })};
});
vi.mock('./SqliteActualReceivedUmpireRenewalEnrollmentStore',()=>({actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite:()=>({withOriginal:(_id:string,body:(v:unknown)=>unknown)=>body({value:state.e})})}));
vi.mock('./ActualReceivedUmpireRenewalEvidence',()=>({receivedRenewalEnrollmentEvidenceFromSqlite:()=>({qualifyNonPhysicalCurrent:()=>{}})}));
vi.mock('./SqliteActualReceivedUmpireRenewalAdoptionStore',()=>({actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite:()=>({read:()=>state.prior})}));
vi.mock('./ActualReceivedUmpireRenewalJournal',()=>({renewalJournal:()=>[{}, {}, {}, {source_id:'adoption-a'}]}));
vi.mock('./SqliteActualCommunicationStore',()=>({actualCommunicationEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>({
  scope:()=>[state.previousCommunication],derive:()=>state.communication,
  read:(id:string)=>id===state.previousCommunication.source.sourceId?state.previousCommunication:db.prepare('SELECT 1 FROM actual_call_communications WHERE source_id=?').get(id)?state.communication:null,
  currentBefore:()=>{if(db.prepare('SELECT source_id FROM batted_world_field_execution_heads').get()!.source_id!==state.next.source.sourceId)throw new Error('communication physical head differs');},
  current:()=>{if(db.prepare('SELECT source_id FROM actual_call_communication_heads').get()!.source_id!==state.communication.source.sourceId)throw new Error('communication head differs');},
})}));
import {installReceivedOwnerSchema} from './ActualReceivedUmpireDefenderSchema';
import {installRenewalOwnerSchema} from './ActualReceivedUmpireRenewalSchema';
import {openSqliteActualReceivedUmpireHandoffStore} from './SqliteActualReceivedUmpireHandoffStore';
import {deriveQuantizerClosedGenerationBoundary} from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import {ownedScheduledMotionArchiveEncoding as encoding} from './OwnedScheduledMotionArchive';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture=()=>{
  const dir=mkdtempSync(join(tmpdir(),'received-handoff-')),path=join(dir,'state.sqlite'),db=new DatabaseSync(path),at={originTick:0,elapsedSeconds:0.1,tick:100};
  const bound=deriveQuantizerClosedGenerationBoundary({originTick:0,throughTick:100,ticksPerSecond:1000}),end={originTick:0,elapsedSeconds:bound.lastIncludedElapsedSeconds,tick:100};
  const ids=Array.from({length:10},(_,i)=>'p'+i),knownWork=ids.map(playerId=>({playerId,decisionSourceId:null,motorSourceId:null}));
  const contributions=ids.map((playerId,i)=>({kind:'retained',playerId,command:{kind:i?'field':'received_renewal_adoption_v1',owner:'batted_world_field_executions',sourceId:'command-'+i,sourceVersion:'v1',sourceHash:'hash-'+i,adoptionSourceId:'adoption-a',adoptionSourceHash:'adoption-hash',adoptedAt:at,executedThrough:at,acceptedThroughTick:1000}}));
  const flightSource={physicalPitchSourceId:'pitch-a',execution:{ballFlightParameters:{ticksPerSecond:1000}}};
  const baseField={source:{sourceId:'field-a',sourceVersion:'v1'},response:{model:{gameId:'game-a'},touch:{worldContact:{flight:{source:flightSource}}}}};
  const field=(m:typeof at)=>({motion:{world:{kind:'moving',moment:{originTick:m.originTick,elapsedSeconds:m.elapsedSeconds,ball:{tick:m.tick}}},actors:[],cursor:{moment:m},carrierPlayerId:null},baseContacts:[]});
  const priorSource={sourceId:'adoption-a',sourceVersion:'v1',baseFieldSourceId:'field-a',previousExecutionSourceId:null,action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:'renewal-a',renewalMotorSourceId:'new-motor'}};
  const nextSource={sourceId:'seal-a',sourceVersion:'v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'adoption-a',action:{kind:'owned_motion_v2',checkpoint:{kind:'retained_quantizer_bucket_v1',throughTick:100},contributions,knownWork}};
  state.prior={source:priorSource,baseField,revision:1,history:[priorSource],execution:{kind:'received_renewal_adoption_v1',field:field(at),adoption:{renewalEnrollmentSourceId:'renewal-a'}}};
  state.next={source:nextSource,baseField,revision:2,history:[priorSource,nextSource],execution:{kind:'owned_motion_v2',field:field(end),composition:{mode:'retained',quantizerBoundary:bound},operation:null,adoption:{status:'checkpoint_reached'}}};
  const previousSource={sourceId:'communication-1',sourceVersion:'v1',callSourceId:'call-a',modelSourceId:null,currentExecutionSourceId:'adoption-a',previousCommunicationSourceId:null};
  const communicationSource={...previousSource,sourceId:'communication-2',currentExecutionSourceId:'seal-a',previousCommunicationSourceId:'communication-1'};
  state.previousCommunication={source:previousSource,revision:1,originCommunicationSourceId:'communication-1',gameId:'game-a',playId:1,physicalPitchSourceId:'pitch-a',evaluatedThrough:at};
  state.communication={...state.previousCommunication,source:communicationSource,revision:2,evaluatedThrough:end};
  const eSource={sourceId:'renewal-a',sourceVersion:'v1',capability:'received_umpire_renewal_enrollment_v1',receivedEnrollmentSourceId:'old-e',receivedReplanSourceId:'r2'};
  state.e={source:eSource,gameId:'game-a',playId:1,physicalPitchSourceId:'pitch-a',playerId:'p0',runtimeSourceId:'runtime-a',receivedEnrollmentSourceId:'old-e',
    cause:{physicalPitchSourceId:'pitch-a',playerId:'p0',callSourceId:'call-a',originCommunicationSourceId:'communication-1'},anchor:{baseField:{sourceId:'field-a'},legacyAdmissionPrefix:{count:24,digest:'legacy-original'}}};
  db.exec('BEGIN');installReceivedOwnerSchema(db);installRenewalOwnerSchema(db);db.exec('COMMIT');
  db.exec('CREATE TABLE batted_world_field_executions(source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT,base_field_source_id TEXT,previous_source_id TEXT,revision INTEGER,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT); CREATE TABLE batted_world_field_execution_heads(physical_pitch_source_id TEXT,base_field_source_id TEXT,source_id TEXT,revision INTEGER); CREATE TABLE actual_call_communications(source_id TEXT PRIMARY KEY,source_version TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,call_source_id TEXT,model_source_id TEXT,current_execution_source_id TEXT,previous_source_id TEXT,revision INTEGER,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT); CREATE TABLE actual_call_communication_heads(call_source_id TEXT,source_id TEXT,revision INTEGER)');
  db.prepare('INSERT INTO actual_received_umpire_renewal_enrollments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('renewal-a','v1','game-a',1,'pitch-a','p0','runtime-a','old-e','r1','r2','renewal-a',json(eSource),hash(eSource),json(state.e),hash(state.e));
  const p=encoding(state.prior);db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?,?,?,?,?)').run('adoption-a','pitch-a','field-a',null,1,'game-a',json(priorSource),hash(priorSource),p.json,p.hash);db.prepare('INSERT INTO batted_world_field_execution_heads VALUES(?,?,?,?)').run('pitch-a','field-a','adoption-a',1);
  db.prepare('INSERT INTO actual_call_communications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('communication-1','v1','game-a',1,'pitch-a','call-a',null,'adoption-a',null,1,json(previousSource),hash(previousSource),json(state.previousCommunication),hash(state.previousCommunication));db.prepare('INSERT INTO actual_call_communication_heads VALUES(?,?,?)').run('call-a','communication-1',1);
  const source={sourceId:'handoff-a',sourceVersion:'v1',capability:'received_umpire_physical_communication_handoff_v1' as const,renewalEnrollmentSourceId:'renewal-a',predecessorExecutionSourceId:'adoption-a',executionSourceId:'seal-a',communicationSourceId:'communication-2'};
  let changed=false,changedExecution=false;const store=openSqliteActualReceivedUmpireHandoffStore(path,{readAcceptedHandoff:()=>source,readAcceptedExecution:()=>({...state.next.source,...(changedExecution?{sourceVersion:'changed'}:{})}),readAcceptedCommunication:()=>({...state.communication.source,...(changed?{sourceVersion:'changed'}:{})})});
  const census=()=>db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all();return {db,path,store,source,census,change:()=>{changed=true;},changeExecution:()=>{changedExecution=true;},close:()=>{store.close();db.close();}};
};
it('RHN01 owns five Native changes and callback-free exact handoff reads with unchanged original rows',()=>{
  const f=fixture(),prepare=DatabaseSync.prototype.prepare;let changes=0;
  try{const prior=f.db.prepare("SELECT * FROM batted_world_field_executions WHERE source_id='adoption-a'").get();
    DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const statement=prepare.call(this,sql);if(/^(INSERT INTO batted_world_field_executions|UPDATE batted_world_field_execution_heads|INSERT INTO actual_call_communications|UPDATE actual_call_communication_heads|INSERT INTO actual_received_umpire_handoffs)/.test(sql)){const run=statement.run.bind(statement);statement.run=((...args:Parameters<typeof statement.run>)=>{const out=run(...args);changes+=Number(out.changes);return out;}) as typeof statement.run;}return statement;} as typeof prepare;
    const value=f.store.accept('handoff-a');expect(changes).toBe(5);expect(value.physical.sourceId).toBe('seal-a');expect(value.communication.sourceId).toBe('communication-2');expect(f.db.prepare("SELECT * FROM batted_world_field_executions WHERE source_id='adoption-a'").get()).toEqual(prior);
    f.store.close();const reader=openSqliteActualReceivedUmpireHandoffStore(f.path);try{expect(reader.read('handoff-a')).toEqual(value);expect(reader.accept('handoff-a')).toEqual(value);}finally{reader.close();}expect(changes).toBe(5);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it('RHN02 changed normal communication Source rolls back both outputs and the first handoff schema',()=>{
  const f=fixture(),prepare=DatabaseSync.prototype.prepare,before=f.census();let reached=false;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const statement=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_call_communications')){const run=statement.run.bind(statement);statement.run=((...args:Parameters<typeof statement.run>)=>{const out=run(...args);reached=true;f.change();return out;}) as typeof statement.run;}return statement;} as typeof prepare;
    expect(()=>f.store.accept('handoff-a')).toThrow(/callback/);expect(reached).toBe(true);expect(f.census()).toEqual(before);expect(f.db.prepare('SELECT source_id FROM batted_world_field_execution_heads').get()!.source_id).toBe('adoption-a');expect(f.db.prepare('SELECT source_id FROM actual_call_communication_heads').get()!.source_id).toBe('communication-1');
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});

it('RHN03 rejects redefined accepted communication Source on an existing exact handoff',()=>{
  const f=fixture();try{f.store.accept('handoff-a');f.change();expect(()=>f.store.accept('handoff-a'),'HANDOFF_RETRY_SUCCESSOR_SOURCE_REDEFINITION_ACCEPTED').toThrow(/successor.*frozen/);}finally{f.close();}
});

it('RHN04 rejects redefined accepted retained execution Source on an existing exact handoff',()=>{
  const f=fixture();try{f.store.accept('handoff-a');f.changeExecution();expect(()=>f.store.accept('handoff-a')).toThrow(/successor.*frozen/);}finally{f.close();}
});
