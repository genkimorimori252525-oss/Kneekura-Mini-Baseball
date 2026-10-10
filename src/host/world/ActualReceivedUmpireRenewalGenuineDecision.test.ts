/** TEST ONLY. One separately released decision from a closed genuine enrollment.
 * Existing owners authenticate ancestry; no prior acceptance is repeated. */
import {createRequire} from 'node:module';
import {copyFileSync,existsSync,mkdirSync,readFileSync,statSync,writeFileSync,openSync,fsyncSync,closeSync,constants} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {openSqliteActualReceivedUmpireRenewalDecisionStore} from './SqliteActualReceivedUmpireRenewalDecisionStore';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {receivedGenuineFile,receivedGenuineSidecars,receivedGenuineCensus,receivedGenuineHash,receivedGenuineSha,
  type ReceivedGenuinePin,type ReceivedGenuineSidecar} from './ActualReceivedUmpireDefenderGenuineStages.test-support';
import type {RenewalDecisionSource} from './ActualReceivedUmpireRenewal';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db=InstanceType<typeof DatabaseSync>;
type Checkpoint={schema:string;stage:string;database:ReceivedGenuinePin;receipt:ReceivedGenuinePin;terminal:ReceivedGenuinePin;report:ReceivedGenuinePin;
  inspection:ReceivedGenuinePin;progress:ReceivedGenuinePin;input:ReceivedGenuinePin;config:ReceivedGenuinePin;predecessor:ReceivedGenuinePin;sidecars:readonly ReceivedGenuineSidecar[]};
type Input={schema:'received_renewal_genuine_decision_input_v1';released:boolean;reviewedHead:string;reviewedSrc:string;predecessor:ReceivedGenuinePin};
const inputPath=process.env.RECEIVED_RENEWAL_GENUINE_DECISION_INPUT;
const readJson=(pin:ReceivedGenuinePin)=>JSON.parse(receivedGenuineFile(pin).toString('utf8'));
const readOnly=<T>(path:string,body:(db:Db)=>T)=>{const db=new DatabaseSync(path,{readOnly:true});try{db.exec('BEGIN');const value=body(db);expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);db.exec('COMMIT');return value;}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}};
const decisionTable='actual_received_umpire_renewal_decisions',headTable='actual_received_umpire_renewal_heads',journalTable='actual_received_umpire_renewal_admissions';
it.runIf(!!inputPath)('RNG02 issues the genuine owned renewal decision with three changes and unchanged physical state',()=>{
  const input=JSON.parse(readFileSync(inputPath!,'utf8')) as Input;
  expect(input.schema).toBe('received_renewal_genuine_decision_input_v1');expect(input.released,'separate runtime release required before a genuine copy').toBe(true);
  expect(input.reviewedHead).toBe('45ff861d7b38f6003eb1a41f7884b30838f00539');expect(input.reviewedSrc).toBe('03faee383678b28552f7bdcc4c71c1f975092727');
  expect(input.predecessor.sha256).toBe('092f915c21578ea6ba9559d648743aced99aa70e226b68b6b78329d3c867efde');
  const checkpoint=readJson(input.predecessor) as Checkpoint,receipt=readJson(checkpoint.receipt),terminal=readJson(checkpoint.terminal),report=readJson(checkpoint.report),inspection=readJson(checkpoint.inspection),config=readJson(checkpoint.config),priorInput=readJson(checkpoint.input);
  expect(checkpoint).toMatchObject({schema:'received_renewal_genuine_checkpoint_v1',stage:'renewal-enrollment',database:{sha256:'21d07988262438a0683ac49f4e4942cbf4f5a60d43a7bb6285cdcf9447e61fcf'}});
  expect(config.sourceIdentity).toMatchObject({candidateHead:'f8e1b36315b73b9878ce76a7c71b40d778ad5fc8',candidateSrc:'702317ceee4fe668f10bd66b237046ff27b77555'});
  expect(terminal).toMatchObject({status:'passed',originalChildExit:0,remainingOwnedProcesses:[],failures:[],configSha256:checkpoint.config.sha256,tests:{passedCases:1,expectedFailedCases:0,skipped:[],reportSha256:checkpoint.report.sha256}});
  for(const group of ['source','dependencies','controls','runtime']){expect(terminal.before[group].sha256).toBe(config.inputs[group].sha256);expect(terminal.after[group].sha256).toBe(config.inputs[group].sha256);}
  expect(report).toMatchObject({success:true,numPassedTests:1,numFailedTests:0,numPendingTests:0});
  expect(inspection).toMatchObject({outputDatabaseSha256:checkpoint.database.sha256,receiptSha256:checkpoint.receipt.sha256,terminalSha256:checkpoint.terminal.sha256,inheritedTablesPreserved:75,inheritedRowsPreserved:145,legacyAdmissionsPreserved:24,newRows:3,exactNativeChanges:3});
  const progress=receivedGenuineFile(checkpoint.progress).toString('utf8').trim().split('\n').map(line=>JSON.parse(line));
  expect(progress.map(p=>p.phase)).toEqual(['acceptance_start','uncommitted_insert_observed','uncommitted_insert_observed','uncommitted_insert_observed','owner_returned','receipt_closed']);expect(progress[5]).toMatchObject({receiptSha256:checkpoint.receipt.sha256,outputDatabaseSha256:checkpoint.database.sha256,nativeConnectionsClosed:true});
  expect(priorInput.checkpoint).toEqual(checkpoint.predecessor);expect(checkpoint.predecessor.sha256).toBe('c7b8eb4021b3a80c7b9c389c63d7f251bfbeffa1fbaae29826a692dc646a7ad7');receivedGenuineFile(checkpoint.predecessor);
  expect(receipt).toMatchObject({schema:'received_renewal_genuine_enrollment_receipt_v1',reviewedHead:input.reviewedHead,reviewedSrc:input.reviewedSrc,outputDatabaseSha256:checkpoint.database.sha256,originalTablesPreserved:75,originalRowsPreserved:145,originalAdmissionsPreserved:24,originalRolesPreserved:50,changes:3,authorityCallbacks:6,newMotorOrAdoption:false,physicalAdvancement:false});
  const enrollment=receipt.accepted;expect(receipt.acceptedHash).toBe(hash(enrollment));expect(receipt.acceptedJson).toBe(json(enrollment));expect(enrollment.pending.kind).toBe('renewal_decision');
  receivedGenuineSidecars(checkpoint.database,checkpoint.sidecars);
  const directory=join(process.env.TMPDIR!,'artifact');expect(existsSync(directory)).toBe(false);mkdirSync(directory,{mode:0o700});const path=join(directory,'received-renewal.sqlite');
  copyFileSync(checkpoint.database.path,path,constants.COPYFILE_EXCL);receivedGenuineFile({path,sha256:checkpoint.database.sha256});
  const standalone=()=>{for(const suffix of ['-wal','-journal'])expect(existsSync(path+suffix)?statSync(path+suffix).size:0).toBe(0);};
  const before=readOnly(path,receivedGenuineCensus);standalone();expect(receivedGenuineHash(before)).toBe(receipt.afterCensusHash);expect(before.tables).toHaveLength(80);expect(before.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(148);
  const source:RenewalDecisionSource={sourceId:'received-renewal-decision-home-1',sourceVersion:'genuine-received-native-renewal-v1',capability:'received_umpire_renewal_decision_v1',renewalEnrollmentSourceId:'received-renewal-enrollment-home-1'};
  expect(source.renewalEnrollmentSourceId).toBe(enrollment.source.sourceId);
  let progressSequence=0;
  const checkpointProgress=(phase:string,details:Record<string,unknown>={})=>{const fd=openSync(join(directory,'renewal-decision-progress.jsonl'),progressSequence===0?'ax':'a',0o600);
    try{writeFileSync(fd,JSON.stringify({schema:'received_renewal_decision_progress_v1',sequence:++progressSequence,phase,wallTimeUnixMilliseconds:Date.now(),...details})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
    const d=openSync(directory,'r');try{fsyncSync(d);}finally{closeSync(d);}};
  const nativePrepare=DatabaseSync.prototype.prepare,nativeExec=DatabaseSync.prototype.exec,connections=new Map<Db,number>(),writes:{operation:string;table:string;changes:number}[]=[];let callbacks=0;
  const changes=(db:Db)=>Number(nativePrepare.call(db,'SELECT total_changes() AS n').get()!.n),touch=(db:Db)=>{if(!connections.has(db))connections.set(db,changes(db));};
  DatabaseSync.prototype.exec=function(this:Db,sql:string){touch(this);return nativeExec.call(this,sql);};
  DatabaseSync.prototype.prepare=function(this:Db,sql:string){touch(this);const db=this,statement=nativePrepare.call(this,sql),match=/^(INSERT INTO|UPDATE) (actual_received_umpire_renewal_[a-z_]+)/.exec(sql);
    if(match){const run=statement.run.bind(statement);statement.run=((...args:Parameters<typeof statement.run>)=>{const r=run(...args),w={operation:match[1],table:match[2],changes:Number(r.changes)};writes.push(w);checkpointProgress(db.isTransaction?'uncommitted_write_observed':'write_returned_without_transaction',{...w,sourceId:source.sourceId,writeOrdinal:writes.length,isTransaction:db.isTransaction,durability:'not_asserted'});return r;}) as typeof statement.run;}return statement;} as typeof nativePrepare;
  let accepted:ReturnType<ReturnType<typeof openSqliteActualReceivedUmpireRenewalDecisionStore>['accept']>;
  try{const owner=openSqliteActualReceivedUmpireRenewalDecisionStore(path,{readAcceptedDecision:id=>{callbacks++;expect(id).toBe(source.sourceId);return source;}});
    try{checkpointProgress('acceptance_start',{sourceId:source.sourceId});accepted=owner.accept(source.sourceId);checkpointProgress('owner_returned',{sourceId:source.sourceId,acceptedHash:hash(accepted),databaseClosePending:true});
      expect(connections.size).toBe(1);expect([...connections].map(([db,n])=>changes(db)-n)).toEqual([3]);for(const db of connections.keys()){expect(db.isTransaction).toBe(false);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);}}
    finally{owner.close();}expect([...connections.keys()].every(db=>!db.isOpen)).toBe(true);
  }finally{DatabaseSync.prototype.prepare=nativePrepare;DatabaseSync.prototype.exec=nativeExec;}
  standalone();expect(callbacks).toBe(7);expect(writes).toEqual([{operation:'INSERT INTO',table:decisionTable,changes:1},{operation:'UPDATE',table:headTable,changes:1},{operation:'INSERT INTO',table:journalTable,changes:1}]);
  expect(accepted!.source).toEqual(source);expect(accepted!.enrollmentHash).toBe(receipt.acceptedHash);expect(accepted!.receivedReplanHash).toBe(enrollment.anchor.receivedReplan.snapshotHash);
  expect(accepted!.receipt).toEqual({kind:'received_umpire_renewal_decision_v1',sourceId:source.sourceId,playerId:enrollment.playerId,physicalPitchSourceId:enrollment.physicalPitchSourceId,personId:enrollment.receiver.personId,personLinkSourceId:enrollment.receiver.personLinkSourceId,gameDay:enrollment.receiver.gameDay,
    cut:enrollment.cut,selected:enrollment.selection.selected,target:enrollment.selection.target,movementStartTick:enrollment.cut.tick,lifecycle:{status:'issued',issuedBySourceId:source.sourceId}});
  const after=readOnly(path,receivedGenuineCensus);standalone();expect(after.schema).toEqual(before.schema);expect(after.tables).toHaveLength(80);expect(after.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(150);
  for(const table of before.tables.filter(t=>![decisionTable,headTable,journalTable].includes(t.name)))expect(after.tables.find(t=>t.name===table.name)).toEqual(table);
  const rows=(c:typeof before,t:string)=>c.tables.find(v=>v.name===t)!.rows.map(row=>JSON.parse(row));expect(rows(before,decisionTable)).toHaveLength(0);expect(rows(after,decisionTable)).toHaveLength(1);
  expect(rows(after,decisionTable)[0]).toMatchObject({source_json:json(source),source_hash:hash(source),snapshot_json:json(accepted!),snapshot_hash:hash(accepted!)});
  expect(rows(after,headTable)).toEqual([{...rows(before,headTable)[0],stage:2,owner:decisionTable,source_id:source.sourceId,renewal_decision_source_id:source.sourceId}]);
  expect(rows(after,journalTable)).toHaveLength(2);expect(rows(after,journalTable)[0]).toEqual(rows(before,journalTable)[0]);
  receivedGenuineSidecars(checkpoint.database,checkpoint.sidecars);
  const outputDatabaseSha256=receivedGenuineSha(readFileSync(path)),receiptPath=join(directory,'received-renewal-decision.json'),fd=openSync(receiptPath,'wx',0o600);
  try{writeFileSync(fd,JSON.stringify({schema:'received_renewal_genuine_decision_receipt_v1',reviewedHead:input.reviewedHead,reviewedSrc:input.reviewedSrc,predecessorCheckpoint:input.predecessor,inputDatabaseSha256:checkpoint.database.sha256,outputDatabaseSha256,
    source,accepted:accepted!,acceptedJson:json(accepted!),acceptedHash:hash(accepted!),beforeCensusHash:receivedGenuineHash(before),afterCensusHash:receivedGenuineHash(after),changes:3,authorityCallbacks:callbacks,writes,
    inheritedOriginalTablesPreserved:75,inheritedOriginalRowsPreserved:145,originalAdmissionsPreserved:24,originalRolesPreserved:50,physicalAdvancement:false,newMotorOrAdoption:false,pending:'renewal_motor',closureCredit:0},null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  checkpointProgress('receipt_closed',{sourceId:source.sourceId,receiptSha256:receivedGenuineSha(readFileSync(receiptPath)),outputDatabaseSha256,nativeConnectionsClosed:true});
});
