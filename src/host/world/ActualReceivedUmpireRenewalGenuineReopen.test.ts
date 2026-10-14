/** TEST ONLY. Separately released cold reads and idempotent retries of one adopted endpoint.
 * No authorities, model facades, source callbacks or acceptance writes are provided. */
import {createRequire} from 'node:module';
import {copyFileSync,existsSync,mkdirSync,readFileSync,statSync,writeFileSync,openSync,fsyncSync,closeSync,constants} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {openSqliteActualReceivedUmpireRenewalEnrollmentStore} from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import {openSqliteActualReceivedUmpireRenewalDecisionStore} from './SqliteActualReceivedUmpireRenewalDecisionStore';
import {openSqliteActualReceivedUmpireRenewalMotorStore} from './SqliteActualReceivedUmpireRenewalMotorStore';
import {openSqliteActualReceivedUmpireRenewalAdoptionStore} from './SqliteActualReceivedUmpireRenewalAdoptionStore';
import {openSqliteActualReceivedUmpireDefenderReplanStore} from './SqliteActualReceivedUmpireDefenderReplanStore';
import {actualReceivedUmpireDefenderLiveWorkFromSqlite} from './ActualReceivedUmpireDefenderLiveWork';
import {ownedScheduledMotionArchiveEncoding as encoding} from './OwnedScheduledMotionArchive';
import type {DurableBattedWorldFieldExecution} from './SqliteBattedWorldFieldExecutionStore';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {receivedGenuineFile,receivedGenuineSidecars,receivedGenuineCensus,receivedGenuineHash,receivedGenuineSha,
  type ReceivedGenuinePin,type ReceivedGenuineSidecar} from './ActualReceivedUmpireDefenderGenuineStages.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db=InstanceType<typeof DatabaseSync>;
type Stage='historical_owners'|'adopted_work';
type Checkpoint={schema:string;stage:string;database:ReceivedGenuinePin;receipt:ReceivedGenuinePin;terminal:ReceivedGenuinePin;report:ReceivedGenuinePin;
  inspection:ReceivedGenuinePin;progress:ReceivedGenuinePin;input:ReceivedGenuinePin;config:ReceivedGenuinePin;predecessor:ReceivedGenuinePin;sidecars:readonly ReceivedGenuineSidecar[]};
type Input={schema:'received_renewal_genuine_reopen_input_v1';released:boolean;stage:Stage;reviewedHead:string;reviewedSrc:string;
  harness:{candidateHead:string;candidateSrc:string};root:ReceivedGenuinePin;predecessor:ReceivedGenuinePin};
const inputPath=process.env.RECEIVED_RENEWAL_GENUINE_REOPEN_INPUT;
const readJson=(pin:ReceivedGenuinePin)=>JSON.parse(receivedGenuineFile(pin).toString('utf8'));
const readOnly=<T>(path:string,body:(db:Db)=>T)=>{const db=new DatabaseSync(path,{readOnly:true});try{db.exec('BEGIN');const value=body(db);expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);db.exec('COMMIT');return value;}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}};
const verifyClosed=(pin:ReceivedGenuinePin)=>{
  const c=readJson(pin) as Checkpoint,t=readJson(c.terminal),r=readJson(c.report),v=readJson(c.config);readJson(c.inspection);receivedGenuineFile(c.progress);readJson(c.input);
  expect(t).toMatchObject({status:'passed',originalChildExit:0,remainingOwnedProcesses:[],failures:[],configSha256:c.config.sha256,tests:{passedCases:1,expectedFailedCases:0,reportSha256:c.report.sha256}});
  expect(r).toMatchObject({success:true,numPassedTests:1,numFailedTests:0});for(const group of ['source','dependencies','controls','runtime']){expect(t.before[group].sha256).toBe(v.inputs[group].sha256);expect(t.after[group].sha256).toBe(v.inputs[group].sha256);}return {checkpoint:c,receipt:readJson(c.receipt),config:v};
};
const cases=[['historical_owners','RNG05 reopens the genuine renewal enrollment decision and motor without callbacks or writes'],['adopted_work','RNG06 reopens the genuine replan adoption and current work without callbacks or writes']] as const;
for(const [stage,name] of cases)it.runIf(!!inputPath)(name,()=>{
  const input=JSON.parse(readFileSync(inputPath!,'utf8')) as Input;expect(input.schema).toBe('received_renewal_genuine_reopen_input_v1');expect(input.released).toBe(true);expect(input.stage).toBe(stage);
  expect(input.reviewedHead).toBe('45ff861d7b38f6003eb1a41f7884b30838f00539');expect(input.reviewedSrc).toBe('03faee383678b28552f7bdcc4c71c1f975092727');expect(input.root.sha256).toBe('14246c9a10da06b7e518c347275b59459785016d87e88a27d7ca231be92ab74b');
  const root=verifyClosed(input.root);expect(root.checkpoint).toMatchObject({schema:'received_renewal_genuine_checkpoint_v1',stage:'renewal-adoption'});expect(root.config.sourceIdentity).toMatchObject({candidateHead:'6bcc543873eeee65ae892fe29db9bf9ba0e3bdf2',candidateSrc:'71b99c9452fa83ba6f6a68dbbd55e58e59148a05'});
  expect(root.receipt).toMatchObject({schema:'received_renewal_genuine_adoption_receipt_v1',changes:4,authorityCallbacks:10,adopted:true,physicalAdvancement:false,pending:'physical_continuation',closureCredit:0,outputDatabaseSha256:root.checkpoint.database.sha256});
  const previous=stage==='historical_owners'?root:verifyClosed(input.predecessor);
  if(stage==='historical_owners')expect(input.predecessor).toEqual(input.root);
  else{expect(previous.checkpoint).toMatchObject({schema:'received_renewal_genuine_reopen_checkpoint_v1',stage:'historical_owners'});expect(previous.config.sourceIdentity).toMatchObject(input.harness);expect(previous.receipt).toMatchObject({schema:'received_renewal_genuine_reopen_receipt_v1',stage:'historical_owners',rootCheckpoint:input.root,changes:0,authorityCallbacks:0,callbackFree:true,outputDatabaseSha256:root.checkpoint.database.sha256});}
  const c=previous.checkpoint;expect(c.database.sha256).toBe(root.checkpoint.database.sha256);receivedGenuineSidecars(c.database,c.sidecars);
  const directory=join(process.env.TMPDIR!,'artifact');expect(existsSync(directory)).toBe(false);mkdirSync(directory,{mode:0o700});const path=join(directory,'received-renewal.sqlite');copyFileSync(c.database.path,path,constants.COPYFILE_EXCL);receivedGenuineFile({path,sha256:c.database.sha256});
  const standalone=()=>{for(const suffix of ['-wal','-journal'])expect(existsSync(path+suffix)?statSync(path+suffix).size:0).toBe(0);};
  const before=readOnly(path,receivedGenuineCensus);standalone();expect(receivedGenuineHash(before)).toBe(root.receipt.afterCensusHash);expect(before.tables).toHaveLength(80);expect(before.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(154);
  const row=(table:string,id:string)=>{const found=before.tables.find(t=>t.name===table)!.rows.map(s=>JSON.parse(s)).filter(r=>r.source_id===id);expect(found).toHaveLength(1);return found[0];};
  const enrollmentRow=row('actual_received_umpire_renewal_enrollments','received-renewal-enrollment-home-1'),enrollment=JSON.parse(enrollmentRow.snapshot_json),adoptionRow=row('batted_world_field_executions','received-renewal-adoption-home-1');
  expect(adoptionRow.snapshot_json).toBe(root.receipt.acceptedArchiveJson);expect(adoptionRow.snapshot_hash).toBe(root.receipt.acceptedArchiveHash);expect(adoptionRow.revision).toBe(11);
  let sequence=0;
  const progress=(phase:string,details:Record<string,unknown>={})=>{const fd=openSync(join(directory,'renewal-reopen-progress.jsonl'),sequence===0?'ax':'a',0o600);try{writeFileSync(fd,JSON.stringify({schema:'received_renewal_reopen_progress_v1',sequence:++sequence,stage,phase,wallTimeUnixMilliseconds:Date.now(),...details})+'\n');fsyncSync(fd);}finally{closeSync(fd);}const d=openSync(directory,'r');try{fsyncSync(d);}finally{closeSync(d);}};
  const nativePrepare=DatabaseSync.prototype.prepare,nativeExec=DatabaseSync.prototype.exec,nativeClose=DatabaseSync.prototype.close,connections=new Map<Db,readonly unknown[]>(),expectedQueryOnly=new WeakMap<Db,number>(),closed:{changes:number;queryOnly:unknown;schemaUnchanged:boolean}[]=[];
  const counters=(db:Db)=>[nativePrepare.call(db,'SELECT total_changes() AS n').get()!.n,nativePrepare.call(db,'PRAGMA main.schema_version').get()!.schema_version,nativePrepare.call(db,'PRAGMA temp.schema_version').get()!.schema_version] as const;
  const touch=(db:Db)=>{if(!connections.has(db))connections.set(db,counters(db));};
  DatabaseSync.prototype.exec=function(this:Db,sql:string){touch(this);return nativeExec.call(this,sql);};DatabaseSync.prototype.prepare=function(this:Db,sql:string){touch(this);return nativePrepare.call(this,sql);} as typeof nativePrepare;
  DatabaseSync.prototype.close=function(this:Db){touch(this);const before=connections.get(this)!,after=counters(this),queryOnly=nativePrepare.call(this,'PRAGMA query_only').get()!.query_only;try{expect(after).toEqual(before);expect(this.isTransaction).toBe(false);expect(queryOnly).toBe(expectedQueryOnly.get(this)??0);}finally{nativeClose.call(this);expect(this.isOpen).toBe(false);closed.push({changes:Number(after[0])-Number(before[0]),queryOnly,schemaUnchanged:after[1]===before[1]&&after[2]===before[2]});}};
  const results:{owner:string;sourceId:string;readHash:string;retryHash:string}[]=[];let currentWork:unknown=null;
  const runOwner=(owner:string,id:string,open:()=>{read(id:string):unknown;accept(id:string):unknown;close():void},encode:(value:unknown)=>string=json)=>{
    const expected=row(owner,id),store=open();try{progress('read_start',{owner,sourceId:id});const read=store.read(id);expect(encode(read)).toBe(expected.snapshot_json);progress('read_returned',{owner,sourceId:id,snapshotHash:expected.snapshot_hash});progress('retry_start',{owner,sourceId:id});const retry=store.accept(id);expect(encode(retry)).toBe(expected.snapshot_json);progress('retry_returned',{owner,sourceId:id,snapshotHash:expected.snapshot_hash});results.push({owner,sourceId:id,readHash:expected.snapshot_hash,retryHash:expected.snapshot_hash});}finally{store.close();}
  };
  try{progress('stage_start',{rootCheckpointSha256:input.root.sha256});
    if(stage==='historical_owners'){
      runOwner('actual_received_umpire_renewal_enrollments',enrollment.source.sourceId,()=>openSqliteActualReceivedUmpireRenewalEnrollmentStore(path));
      runOwner('actual_received_umpire_renewal_decisions','received-renewal-decision-home-1',()=>openSqliteActualReceivedUmpireRenewalDecisionStore(path));
      runOwner('actual_received_umpire_renewal_motors','received-renewal-motor-home-1',()=>openSqliteActualReceivedUmpireRenewalMotorStore(path));
    }else{
      runOwner('actual_received_umpire_defender_replans',enrollment.receivedReplanSourceId,()=>openSqliteActualReceivedUmpireDefenderReplanStore(path));
      runOwner('batted_world_field_executions',adoptionRow.source_id,()=>openSqliteActualReceivedUmpireRenewalAdoptionStore(path),value=>encoding(value as DurableBattedWorldFieldExecution).json);
      const db=new DatabaseSync(path,{readOnly:true});expectedQueryOnly.set(db,1);try{db.exec('PRAGMA query_only=ON; BEGIN');progress('current_work_start');currentWork=actualReceivedUmpireDefenderLiveWorkFromSqlite(db).read(enrollment.receivedEnrollmentSourceId);expect(currentWork).toEqual({kind:'received_renewal_work',renewalEnrollmentSourceId:enrollment.source.sourceId,originProcessSourceId:enrollment.originProcessSourceId,receivedReplanSourceId:enrollment.receivedReplanSourceId,stage:4,cause:enrollment.cause,work:{kind:'physical_continuation',sourceId:adoptionRow.source_id,dueTick:enrollment.cut.tick,cause:enrollment.cause}});expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);db.exec('COMMIT');progress('current_work_returned',{snapshotHash:hash(currentWork)});}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
    }
    expect(connections.size).toBe(3);expect(closed).toHaveLength(3);expect(closed.every(s=>s.changes===0&&s.schemaUnchanged)).toBe(true);expect([...connections.keys()].every(db=>!db.isOpen)).toBe(true);
  }finally{DatabaseSync.prototype.prepare=nativePrepare;DatabaseSync.prototype.exec=nativeExec;DatabaseSync.prototype.close=nativeClose;}
  standalone();const after=readOnly(path,receivedGenuineCensus);standalone();expect(after).toEqual(before);const outputDatabaseSha256=receivedGenuineSha(readFileSync(path));expect(outputDatabaseSha256).toBe(c.database.sha256);receivedGenuineSidecars(c.database,c.sidecars);receivedGenuineSidecars(root.checkpoint.database,root.checkpoint.sidecars);
  const receiptPath=join(directory,'received-renewal-reopen.json'),fd=openSync(receiptPath,'wx',0o600);try{writeFileSync(fd,JSON.stringify({schema:'received_renewal_genuine_reopen_receipt_v1',stage,reviewedHead:input.reviewedHead,reviewedSrc:input.reviewedSrc,harness:input.harness,rootCheckpoint:input.root,predecessorCheckpoint:input.predecessor,inputDatabaseSha256:c.database.sha256,outputDatabaseSha256,beforeCensusHash:receivedGenuineHash(before),afterCensusHash:receivedGenuineHash(after),results,currentWork,changes:0,authorityCallbacks:0,callbackFree:true,nativeConnections:closed,physicalAdvancement:false,pending:'physical_continuation',closureCredit:0},null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  progress('receipt_closed',{receiptSha256:receivedGenuineSha(readFileSync(receiptPath)),outputDatabaseSha256,nativeConnectionsClosed:true});
});
