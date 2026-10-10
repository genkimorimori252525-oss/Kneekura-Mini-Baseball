import { createRequire } from 'node:module';
import { constants as fsConstants, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteActualReceivedUmpireDefenderEnrollmentStore } from './SqliteActualReceivedUmpireDefenderEnrollmentStore';
import { openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore, type DurableReceivedAvailability } from './SqliteActualReceivedUmpireDefenderPolicyAvailabilityStore';
import { openSqliteActualReceivedUmpireDefenderReplanStore, type DurableReceivedReplan } from './SqliteActualReceivedUmpireDefenderReplanStore';
import type { DurableReceivedEnrollment } from './ActualReceivedUmpireDefenderEvidence';
import { actualReceivedUmpireDefenderLiveWorkFromSqlite } from './ActualReceivedUmpireDefenderLiveWork';
import { beginActualLivePlayWrite } from './ActualLivePlayFence';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { deriveReceivedUmpireDefenderReplan, type ReceivedUmpireDefenderReplanInput } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { receivedGenuineReadInput, receivedGenuineSources, receivedGenuineCensus, receivedGenuineCheckCensus,
  receivedGenuineBaseline, receivedGenuineHash as hash, receivedGenuineSha as sha, receivedGenuineCanonical as json,
  receivedGenuineSidecars, receivedGenuineFile, type ReceivedGenuineCensus } from './ActualReceivedUmpireDefenderGenuineStages.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
type Durable = DurableReceivedEnrollment | DurableReceivedAvailability | DurableReceivedReplan;
const inputPath=process.env.BASEBALL_RECEIVED_LIVE_INPUT;
const selectedStage=inputPath?JSON.parse(readFileSync(inputPath,'utf8')).stage:'unselected';
const readOnly=<T>(path:string,body:(db:Db)=>T):T=>{
  const db=new DatabaseSync(path,{readOnly:true});
  try{db.exec('BEGIN');const before=db.prepare('SELECT total_changes() AS n').get()!.n;const result=body(db);
    expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(before);db.exec('COMMIT');return result;
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
};
const checkHeads=(db:Db)=>{
  expect(db.prepare('SELECT count(*) AS n FROM actual_live_play_admissions').get()!.n).toBe(24);
  for(const [table,source_id,revision] of [['batted_world_field_execution_heads','received-input-reception-cut',10],['actual_field_observation_heads','received-input-after',3],
    ['actual_defensive_decision_heads','scheduled-decision-home-1',1],['actual_locomotion_heads','scheduled-motor-home-1',1]] as const)
    expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual([expect.objectContaining({source_id,revision})]);
};
const roleSeal=(db:Db)=>withBattedWorldPhysicalReadTraversal(db,()=>{
  const runtime=actualLiveRuntimeEvidenceFromSqlite(db).read('live-play-runtime');expect(runtime).not.toBeNull();
  const executions=battedWorldFieldExecutionEvidenceFromSqlite(db),current=executions.read('received-input-reception-cut');expect(current).not.toBeNull();
  const fields=battedWorldFieldEvidenceFromSqlite(db),baseField=current!.baseField;
  const prefix={baseField,fields:fields.scope(baseField,baseField.source.sourceId),executions:executions.scope(baseField,current!.source.sourceId)};
  const ids=runtime!.membership.participants.map(p=>p.playerId),selves=actualPlayersKinematicsFromPrefix(ids,prefix);
  expect(new Set(ids).size).toBe(10);expect(selves.flatMap(s=>s.roles)).toHaveLength(50);
  expect(new Set(selves.flatMap(s=>s.roles.map(r=>s.playerId+':'+r.role))).size).toBe(50);
  const roles=['body','glove','left_foot','right_foot','tag_hand'].sort();
  for(const self of selves){expect(self.roles.map(r=>r.role).sort()).toEqual(roles);expect(self.personId).toBe(runtime!.membership.participants.find(p=>p.playerId===self.playerId)!.personId);}
  return {currentExecutionSourceId:current!.source.sourceId,currentExecutionHash:ownedScheduledMotionArchiveHash(current!),participants:10,roleCount:50,
    players:selves.map(self=>({playerId:self.playerId,personId:self.personId,selfHash:hash(self),activeCommandHash:hash(self.activeCommand),
      roleAuthoritiesHash:hash(self.ownedMotionCoverage?.roleAuthorities??null),roles:self.roles.map(role=>({role:role.role,canonicalActorHash:hash(role.canonicalActor),declaredPoseHash:hash(role.declaredPose)}))}))};
});

it.runIf(!!inputPath)(`RG ${String(selectedStage)} preserves the qualified incumbent and records only its bounded received work`,()=>{
  const packet=receivedGenuineReadInput(inputPath!),{input,index,root,policyProof,policyInput,expected,receipts}=packet;
  const sources=receivedGenuineSources(),operation=index<4?index:index-4,retry=index>=4;
  const target=[sources.enrollment,sources.first,sources.availability,sources.second][operation];
  const output=process.env.BASEBALL_RECEIVED_LIVE_OUTPUT!;expect(isAbsolute(output)).toBe(true);expect(existsSync(output)).toBe(false);
  mkdirSync(output,{mode:0o700});expect(realpathSync(output)).toBe(output);const path=join(output,'received-live.sqlite');
  copyFileSync(input.predecessor.database.path,path,fsConstants.COPYFILE_EXCL);expect(sha(readFileSync(path))).toBe(input.predecessor.database.sha256);
  const closed:{phase:string;sidecars:{suffix:string;exists:boolean;bytes:number}[]}[]=[];
  const standalone=(phase:string)=>{
    const sidecars=['-wal','-journal'].map(suffix=>{const present=existsSync(path+suffix),bytes=present?statSync(path+suffix).size:0;expect(bytes,phase+suffix).toBe(0);return {suffix,exists:present,bytes};});
    closed.push({phase,sidecars});
  };
  standalone('exclusive-copy');
  const before=readOnly(path,db=>{checkHeads(db);return receivedGenuineCensus(db);});standalone('before-census-closed');
  expect(hash(receivedGenuineBaseline(before))).toBe(policyProof.afterCensusSha256);
  if(index===0)expect(before.tables).toHaveLength(70);else expect(hash(before)).toBe(receipts[index-1].afterCensusHash);
  const nativeExec=DatabaseSync.prototype.exec,nativePrepare=DatabaseSync.prototype.prepare;
  const connections=new Map<Db,number>(),witnesses:{operation:string;table:string;sourceId:unknown;changes:number;lastInsertRowid:number}[]=[];
  const changes=(db:Db)=>Number(nativePrepare.call(db,'SELECT total_changes() AS n').get()!.n);
  const touch=(db:Db)=>{if(!connections.has(db))connections.set(db,changes(db));};
  DatabaseSync.prototype.exec=function(this:Db,sql:string){touch(this);return nativeExec.call(this,sql);};
  DatabaseSync.prototype.prepare=function(this:Db,sql:string){
    touch(this);const statement=nativePrepare.call(this,sql),match=/^\s*(INSERT INTO|UPDATE)\s+(?:main\.)?(actual_received_umpire_defender_[a-z_]+)/.exec(sql);
    if(match){const run=statement.run;statement.run=function(this:typeof statement,...args:Parameters<typeof run>){const result=run.apply(this,args);
      const position=match[1]==='UPDATE'?0:match[2]==='actual_received_umpire_defender_admissions'?8:match[2]==='actual_received_umpire_defender_replan_heads'?3:0;
      witnesses.push({operation:match[1]==='UPDATE'?'update':'insert',table:match[2],sourceId:args[position],changes:Number(result.changes),lastInsertRowid:Number(result.lastInsertRowid)});return result;} as typeof run;}
    return statement;
  } as typeof nativePrepare;
  let accepted:Durable,accounting:{before:number;after:number;delta:number}[];
  let callbacks=0;
  try{
    const owner=operation===0?openSqliteActualReceivedUmpireDefenderEnrollmentStore(path,retry?undefined:{readAcceptedEnrollment:id=>{callbacks++;return id===target.sourceId?sources.enrollment:null;}})
      :operation===2?openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore(path,retry?undefined:{readAcceptedAvailability:id=>{callbacks++;return id===target.sourceId?sources.availability:null;}})
      :openSqliteActualReceivedUmpireDefenderReplanStore(path,retry?undefined:{readAcceptedReplan:id=>{callbacks++;return id===target.sourceId?(operation===1?sources.first:sources.second):null;}});
    try{accepted=owner.accept(target.sourceId);expect(connections.size,'all dependencies must use the original private Native connection').toBe(1);
      accounting=[...connections].map(([db,before])=>{const after=changes(db);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);expect(db.isTransaction).toBe(false);return {before,after,delta:after-before};});
      expect(accounting.map(a=>a.delta)).toEqual([retry?0:[2,3,2,3][operation]]);
    }finally{owner.close();}
    expect([...connections.keys()].every(db=>!db.isOpen)).toBe(true);
  }finally{DatabaseSync.prototype.prepare=nativePrepare;DatabaseSync.prototype.exec=nativeExec;}
  standalone('owner-closed');
  expect(accepted!.source).toEqual(target);if(retry)expect(callbacks).toBe(0);else expect(callbacks).toBeGreaterThan(0);
  const expectedWitnesses=retry?[]:[
    [['insert','actual_received_umpire_defender_enrollments'],['insert','actual_received_umpire_defender_admissions']],
    [['insert','actual_received_umpire_defender_replans'],['insert','actual_received_umpire_defender_replan_heads'],['insert','actual_received_umpire_defender_admissions']],
    [['insert','actual_received_umpire_defender_policy_availabilities'],['insert','actual_received_umpire_defender_admissions']],
    [['insert','actual_received_umpire_defender_replans'],['update','actual_received_umpire_defender_replan_heads'],['insert','actual_received_umpire_defender_admissions']],
  ][operation];
  expect(witnesses.map(w=>[w.operation,w.table])).toEqual(expectedWitnesses);
  for(const witness of witnesses){expect(witness.sourceId).toBe(target.sourceId);expect(witness.changes).toBe(1);expect(Number.isSafeInteger(witness.lastInsertRowid)).toBe(true);}
  if(retry)expect(accepted!).toEqual(receipts[operation].accepted);
  const cause={physicalPitchSourceId:'pitch-0',playerId:'home-1',callSourceId:'received-input-operative-call',originCommunicationSourceId:'received-input-send'};
  let roles:ReturnType<typeof roleSeal>|null=null,currentWork:unknown=null,freshPhysicalFenceChecks=0;
  if(operation===0){
    const value=accepted! as DurableReceivedEnrollment;expect(value.cause).toEqual(cause);
    expect(value.anchor).toMatchObject({legacyAdmissionPrefix:{count:24},execution:{sourceId:'received-input-reception-cut',revision:10},observation:{sourceId:'received-input-after',revision:3},
      at:expected.input.currentCut,decision:{sourceId:'scheduled-decision-home-1',revision:1},motor:{sourceId:'scheduled-motor-home-1'},adoption:{sourceId:'field-race-real-motor'}});
    if(index===0){roles=readOnly(path,db=>withBattedWorldPhysicalReadTraversal(db,()=>{
      currentWork=actualReceivedUmpireDefenderLiveWorkFromSqlite(db).read(sources.enrollment.sourceId);
      expect(currentWork).toEqual({kind:'received_enrollment_pending',sourceId:sources.enrollment.sourceId,sourceHash:hash(sources.enrollment),cause,reason:'process_not_admitted'});
      const scope={gameId:value.gameId,playId:value.playId};
      for(const selected of [scope,{...scope,physicalPitchSourceId:'pitch-0'}]){
        expect(()=>beginActualLivePlayWrite(db,selected,{owner:'batted_world_field_executions',sourceId:'received-live-blocked-physical-next'})).toThrow(/received.*pending/i);
        freshPhysicalFenceChecks++;
      }
      return roleSeal(db);
    }));const player=roles.players.find(p=>p.playerId==='home-1')!;
      expect(value.anchor).toMatchObject({selfHash:player.selfHash,activeCommandHash:player.activeCommandHash,roleAuthoritiesHash:player.roleAuthoritiesHash});
      expect(value.anchor.execution.snapshotHash).toBe(roles.currentExecutionHash);standalone('original-role-seal-closed');}
  }else if(operation===2){
    const value=accepted! as DurableReceivedAvailability;expect(value.availableAt).toEqual(expected.input.currentCut);expect(value.policyData.source).toEqual(policyInput.policy);
    expect(value.policyData.source.acceptedAtDay).toBeLessThanOrEqual((receipts[0].accepted as DurableReceivedEnrollment).receiver.gameDay);
  }else{
    const value=accepted! as DurableReceivedReplan;
    const availability=operation===3?receipts[2].accepted as DurableReceivedAvailability:null;
    const previous=operation===3?receipts[1].accepted as DurableReceivedReplan:null;
    const independent:ReceivedUmpireDefenderReplanInput={...expected.input,processSourceId:sources.first.sourceId,
      policy:availability?{sourceId:availability.source.sourceId,hash:hash(availability),availableAt:availability.availableAt,profiles:availability.policyData.source.profiles}:null,
      previous:previous?.replan??null};
    expect(value.input).toEqual(independent);expect(value.replan).toEqual(deriveReceivedUmpireDefenderReplan(independent));
    expect(value.originProcessSourceId).toBe(sources.first.sourceId);expect(value.replan.cause).toEqual(cause);
    expect(value.input.observation.reception.kind).toBe('received');if(value.input.observation.reception.kind==='received')expect(value.input.observation.reception.order).toBeNull();
    expect(value.input.predecessor.informationOrder).toBeNull();expect(value.replan.retainedCommand).toEqual(expected.input.predecessor.command);
    if(operation===1){expect(value.replan.policyBinding).toBeNull();expect(value.replan.selectedAt).toBeNull();}
    // Actual Core semantics decide the result. Pending/tie/no-trigger is retained,
    // reported honestly and receives no committed-selection or renewal credit.
    if(value.replan.selectedAt){expect(value.replan.selectedAt).toEqual(expected.input.currentCut);expect(value.replan.selected?.intent.kind).toBe('ball_handler');}
    if(value.replan.work.length){expect(value.replan.work).toHaveLength(1);expect(value.replan.work[0].sourceId).toBe(sources.first.sourceId);}
    if(index===7){currentWork=readOnly(path,db=>actualReceivedUmpireDefenderLiveWorkFromSqlite(db).read(sources.enrollment.sourceId));
      if(value.replan.work.length)expect(currentWork).toEqual({kind:'received_process_work',originProcessSourceId:sources.first.sourceId,revisionSourceId:sources.second.sourceId,revisionSourceHash:hash(sources.second),cause,work:value.replan.work[0]});
      else expect(currentWork).toMatchObject({kind:'received_enrollment_pending',sourceId:sources.enrollment.sourceId,cause,reason:'no_core_work'});
      standalone('current-work-read-closed');}
  }
  const after:ReceivedGenuineCensus=readOnly(path,db=>{checkHeads(db);return receivedGenuineCensus(db);});standalone('after-census-closed');
  receivedGenuineCheckCensus(before,after,index,policyProof);
  const owner=operation===0?'actual_received_umpire_defender_enrollments':operation===2?'actual_received_umpire_defender_policy_availabilities':'actual_received_umpire_defender_replans';
  const stored=after.tables.find(t=>t.name===owner)!.rows.map(row=>JSON.parse(row)).find(row=>row.source_id===target.sourceId)!;
  expect(stored).toMatchObject({source_json:json(target),source_hash:hash(target),snapshot_json:json(accepted!),snapshot_hash:hash(accepted!)});
  const outputHash=sha(readFileSync(path));if(retry)expect(outputHash).toBe(input.predecessor.database.sha256);
  receivedGenuineSidecars(input.predecessor.database,input.predecessor.sidecars);receivedGenuineSidecars(root.database,root.sidecars);
  for(const pin of root.originalLineage)receivedGenuineFile(pin);
  const result=operation===1||operation===3?(accepted! as DurableReceivedReplan).replan:null;
  writeFileSync(join(output,'received-live-stage.json'),JSON.stringify({schema:'received_live_genuine_stage_receipt_v1',stage:input.stage,
    reviewedImplementationHead:input.reviewedImplementationHead,reviewedImplementationSrc:input.reviewedImplementationSrc,
    rootReceiptSha256:root.receipt.sha256,predecessorReceiptSha256:index?input.history[index-1].receipt.sha256:root.receipt.sha256,
    inputDatabaseSha256:input.predecessor.database.sha256,outputDatabaseSha256:outputHash,sourceId:target.sourceId,sourceHash:hash(target),accepted:accepted!,acceptedJson:json(accepted!),acceptedHash:hash(accepted!),
    beforeCensusHash:hash(before),afterCensusHash:hash(after),originalCensusHash:hash(receivedGenuineBaseline(after)),originalTablesPreserved:69,originalRowsPreserved:135,originalAdmissionsPreserved:24,
    originalRoleSeal:roles,originalRoleSealJson:roles===null?null:json(roles),originalRoleSealHash:index?receipts[0].originalRoleSealHash:hash(roles),originalRolesPreserved:50,
    writerWitness:witnesses,writeAccounting:accounting!,authorityCallbacks:callbacks,callbackFreeRetry:retry,standaloneMainFileChecks:closed,currentWork,freshPhysicalFenceChecks,
    semantic:result?.semantic??null,phase:result?.phase??null,selectedAt:result?.selectedAt??null,selectionCommitted:result?.selectedAt!==null&&result?.selectedAt!==undefined,
    renewalPending:result?.work.some(w=>w.kind==='renewal_adoption')??false,newMotorOrAdoption:false,physicalAdvancement:false,closureCredit:0,productionCalibrationCredit:0},null,2)+'\n',{flag:'wx',mode:0o600});
});
