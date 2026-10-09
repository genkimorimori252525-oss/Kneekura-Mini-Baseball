/** TEST ONLY. One separately released genuine enrollment, preserving the closed
 * eight-stage received lineage. No root reconstruction or dependency facade. */
import {createRequire} from 'node:module';
import {copyFileSync,existsSync,mkdirSync,readFileSync,statSync,writeFileSync,openSync,fsyncSync,closeSync,constants} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {openSqliteActualReceivedUmpireRenewalEnrollmentStore} from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import {beginActualLivePlayWrite} from './ActualLivePlayFence';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {receivedGenuineReadInput,receivedGenuineFile,receivedGenuineSidecars,receivedGenuineCensus,receivedGenuineHash,
  receivedGenuineSources,receivedGenuineSha,type ReceivedGenuinePin,type ReceivedGenuineCheckpoint} from './ActualReceivedUmpireDefenderGenuineStages.test-support';
import type {RenewalEnrollmentSource} from './ActualReceivedUmpireRenewal';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db=InstanceType<typeof DatabaseSync>;
type Input={schema:'received_renewal_genuine_enrollment_input_v1';released:boolean;reviewedHead:string;reviewedSrc:string;
  inheritedInput:ReceivedGenuinePin;inheritedConfig:ReceivedGenuinePin;checkpoint:ReceivedGenuinePin};
const inputPath=process.env.RECEIVED_RENEWAL_GENUINE_INPUT;
const readJson=(pin:ReceivedGenuinePin)=>JSON.parse(receivedGenuineFile(pin).toString('utf8'));
const identity='source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL';
const scope='runtime_source_id TEXT NOT NULL,received_enrollment_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,received_replan_source_id TEXT NOT NULL,renewal_enrollment_source_id TEXT NOT NULL';
const archive='source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL';
// Independent contract oracle; do not import the production schema installer.
const layouts={
  actual_received_umpire_renewal_enrollments:`${identity},${scope},${archive},UNIQUE(received_enrollment_source_id),UNIQUE(origin_process_source_id),UNIQUE(physical_pitch_source_id,player_id)`,
  actual_received_umpire_renewal_decisions:`${identity},${scope},${archive},UNIQUE(renewal_enrollment_source_id)`,
  actual_received_umpire_renewal_motors:`${identity},${scope},renewal_decision_source_id TEXT NOT NULL,${archive},UNIQUE(renewal_enrollment_source_id),UNIQUE(renewal_decision_source_id)`,
  actual_received_umpire_renewal_heads:'renewal_enrollment_source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,runtime_source_id TEXT NOT NULL,received_enrollment_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,received_replan_source_id TEXT NOT NULL,stage INTEGER NOT NULL,owner TEXT NOT NULL,source_id TEXT NOT NULL UNIQUE,renewal_decision_source_id TEXT,renewal_motor_source_id TEXT,adoption_source_id TEXT,physical_predecessor_source_id TEXT NOT NULL,physical_predecessor_revision INTEGER NOT NULL,UNIQUE(physical_pitch_source_id,player_id)',
  actual_received_umpire_renewal_admissions:'renewal_enrollment_source_id TEXT NOT NULL,sequence INTEGER NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,runtime_source_id TEXT NOT NULL,received_enrollment_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,received_replan_source_id TEXT NOT NULL,owner TEXT NOT NULL,source_id TEXT NOT NULL,source_version TEXT NOT NULL,legacy_prefix_digest TEXT NOT NULL,received_prefix_digest TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_hash TEXT NOT NULL,previous_receipt_hash TEXT,receipt_hash TEXT NOT NULL,PRIMARY KEY(renewal_enrollment_source_id,sequence),UNIQUE(owner,source_id)',
};
const tables=Object.keys(layouts),indexes=[4,2,3,3,2];
const readOnly=<T>(path:string,body:(db:Db)=>T)=>{const db=new DatabaseSync(path,{readOnly:true});try{db.exec('BEGIN');const value=body(db);expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);db.exec('COMMIT');return value;}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}};
it.runIf(!!inputPath)('RNG01 enrolls the qualified received receiver with three genuine changes and unchanged incumbent',()=>{
  const input=JSON.parse(readFileSync(inputPath!,'utf8')) as Input;
  expect(input.schema).toBe('received_renewal_genuine_enrollment_input_v1');expect(input.released,'separate runtime release required before a genuine copy').toBe(true);
  expect(input.reviewedHead).toBe('45ff861d7b38f6003eb1a41f7884b30838f00539');expect(input.reviewedSrc).toBe('03faee383678b28552f7bdcc4c71c1f975092727');
  receivedGenuineFile(input.inheritedInput);const inherited=receivedGenuineReadInput(input.inheritedInput.path),config=readJson(input.inheritedConfig);
  expect(inherited.input.stage).toBe('reopen-revision-two');expect(inherited.input.history).toHaveLength(7);
  expect(config.sourceIdentity).toMatchObject({candidateHead:'83b08a721ffc5fef36e1cf3422ef2625c2c8cfcb',candidateSrc:'bd5faa8b4c51fe25bb2c32585b7be386b467d637'});
  expect(config.artifactEnvironment.BASEBALL_RECEIVED_LIVE_INPUT).toBe(input.inheritedInput.path);
  expect(input.checkpoint.sha256).toBe('c7b8eb4021b3a80c7b9c389c63d7f251bfbeffa1fbaae29826a692dc646a7ad7');
  const checkpoint=readJson(input.checkpoint) as ReceivedGenuineCheckpoint,receipt=readJson(checkpoint.receipt),terminal=readJson(checkpoint.terminal),report=readJson(checkpoint.report),inspection=readJson(checkpoint.inspection);
  expect(checkpoint.stage).toBe('reopen-revision-two');expect(checkpoint.database.sha256).toBe('9166f83a3dd02b1385d04550dc57c4f2fcdaac09ac722a7a98c555f13812a069');
  expect(terminal).toMatchObject({status:'passed',originalChildExit:0,remainingOwnedProcesses:[],failures:[],configSha256:input.inheritedConfig.sha256,tests:{passedCases:1,expectedFailedCases:0,skipped:[],reportSha256:checkpoint.report.sha256}});
  expect(report).toMatchObject({success:true,numPassedTests:1,numFailedTests:0,numPendingTests:0});
  expect(inspection).toMatchObject({outputDatabaseSha256:checkpoint.database.sha256,receiptSha256:checkpoint.receipt.sha256,terminalSha256:checkpoint.terminal.sha256,originalRowsPreserved:135,originalAdmissionsPreserved:24});
  expect(receipt).toMatchObject({stage:checkpoint.stage,outputDatabaseSha256:checkpoint.database.sha256,inputDatabaseSha256:inherited.input.predecessor.database.sha256,
    predecessorReceiptSha256:inherited.input.history[6].receipt.sha256,reviewedImplementationHead:inherited.input.reviewedImplementationHead,reviewedImplementationSrc:inherited.input.reviewedImplementationSrc,originalRolesPreserved:50,newMotorOrAdoption:false});
  expect(receipt.accepted).toEqual(inherited.receipts[3].accepted);expect(receipt.acceptedHash).toBe(hash(receipt.accepted));expect(receipt.acceptedJson).toBe(json(receipt.accepted));
  receivedGenuineSidecars(checkpoint.database,checkpoint.sidecars);
  const directory=join(process.env.TMPDIR!,'artifact');expect(existsSync(directory)).toBe(false);mkdirSync(directory,{mode:0o700});const path=join(directory,'received-renewal.sqlite');
  copyFileSync(checkpoint.database.path,path,constants.COPYFILE_EXCL);receivedGenuineFile({path,sha256:checkpoint.database.sha256});
  const standalone=()=>{for(const suffix of ['-wal','-journal'])expect(existsSync(path+suffix)?statSync(path+suffix).size:0).toBe(0);};
  const before=readOnly(path,receivedGenuineCensus);standalone();expect(receivedGenuineHash(before)).toBe(receipt.afterCensusHash);expect(before.tables).toHaveLength(75);expect(before.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(145);
  let progressSequence=0;
  const progress=(phase:string,details:Record<string,unknown>={})=>{
    // Test diagnostics only. INSERT observations do not assert durable commit.
    // Each record is fsynced and closed before returning to the Native owner.
    const fd=openSync(join(directory,'renewal-enrollment-progress.jsonl'),progressSequence===0?'ax':'a',0o600);
    try{writeFileSync(fd,JSON.stringify({schema:'received_renewal_enrollment_progress_v1',sequence:++progressSequence,phase,wallTimeUnixMilliseconds:Date.now(),...details})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
    const directoryFd=openSync(directory,'r');try{fsyncSync(directoryFd);}finally{closeSync(directoryFd);}
  };
  const prior=receivedGenuineSources(),source:RenewalEnrollmentSource={sourceId:'received-renewal-enrollment-home-1',sourceVersion:'genuine-received-native-renewal-v1',capability:'received_umpire_renewal_enrollment_v1',receivedEnrollmentSourceId:prior.enrollment.sourceId,receivedReplanSourceId:prior.second.sourceId};
  const nativePrepare=DatabaseSync.prototype.prepare,nativeExec=DatabaseSync.prototype.exec,connections=new Map<Db,number>(),writes:{table:string;changes:number}[]=[];let callbacks=0;
  const changes=(db:Db)=>Number(nativePrepare.call(db,'SELECT total_changes() AS n').get()!.n),touch=(db:Db)=>{if(!connections.has(db))connections.set(db,changes(db));};
  DatabaseSync.prototype.exec=function(this:Db,sql:string){touch(this);return nativeExec.call(this,sql);};
  DatabaseSync.prototype.prepare=function(this:Db,sql:string){touch(this);const db=this,statement=nativePrepare.call(this,sql),match=/^INSERT INTO (actual_received_umpire_renewal_[a-z_]+)/.exec(sql);
    if(match){const run=statement.run.bind(statement);statement.run=((...args:Parameters<typeof statement.run>)=>{const r=run(...args);writes.push({table:match[1],changes:Number(r.changes)});progress(db.isTransaction?'uncommitted_insert_observed':'insert_returned_without_transaction',{sourceId:source.sourceId,table:match[1],changes:Number(r.changes),insertOrdinal:writes.length,isTransaction:db.isTransaction,durability:'not_asserted'});return r;}) as typeof statement.run;}return statement;} as typeof nativePrepare;
  let accepted:ReturnType<ReturnType<typeof openSqliteActualReceivedUmpireRenewalEnrollmentStore>['accept']>;
  try{const owner=openSqliteActualReceivedUmpireRenewalEnrollmentStore(path,{readAcceptedEnrollment:id=>{callbacks++;expect(id).toBe(source.sourceId);return source;}});
    try{progress('acceptance_start',{sourceId:source.sourceId});accepted=owner.accept(source.sourceId);progress('owner_returned',{sourceId:source.sourceId,acceptedHash:hash(accepted),databaseClosePending:true});expect(connections.size).toBe(1);expect([...connections].map(([db,n])=>changes(db)-n)).toEqual([3]);
      for(const db of connections.keys()){expect(db.isTransaction).toBe(false);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);}}
    finally{owner.close();}expect([...connections.keys()].every(db=>!db.isOpen)).toBe(true);
  }finally{DatabaseSync.prototype.prepare=nativePrepare;DatabaseSync.prototype.exec=nativeExec;}
  standalone();expect(callbacks).toBe(6);expect(writes).toEqual([tables[0],tables[3],tables[4]].map(table=>({table,changes:1})));
  expect(accepted!.source).toEqual(source);expect(accepted!.originProcessSourceId).toBe(prior.first.sourceId);expect(accepted!.pending.kind).toBe('renewal_decision');
  expect(accepted!.cut).toEqual({originTick:11180360,elapsedSeconds:0.849942,tick:12030302,ticksPerSecond:1000000});expect(accepted!.selection.selected.intent.kind).toBe('ball_handler');
  expect(accepted!.anchor).toMatchObject({legacyAdmissionPrefix:{count:24},receivedJournal:{count:4},physicalPredecessor:{sourceId:'received-input-reception-cut',revision:10},observation:{sourceId:'received-input-after',revision:3},motor:{sourceId:'scheduled-motor-home-1'}});
  const roleSeal=inherited.receipts[0].originalRoleSeal;expect(roleSeal.participants).toBe(10);expect(roleSeal.roleCount).toBe(50);expect(accepted!.anchor.participants).toHaveLength(10);
  for(const participant of accepted!.anchor.participants){const original=roleSeal.players.find((p:{playerId:string})=>p.playerId===participant.playerId);expect(original).toMatchObject(participant);}
  const after=readOnly(path,db=>{expect(db.prepare('SELECT count(*) AS n FROM actual_live_play_admissions').get()!.n).toBe(24);
    for(const selected of [{gameId:accepted!.gameId,playId:accepted!.playId},{gameId:accepted!.gameId,playId:accepted!.playId,physicalPitchSourceId:'pitch-0'}])
      expect(()=>beginActualLivePlayWrite(db,selected,{owner:'batted_world_field_executions',sourceId:'renewal-genuine-blocked-next'})).toThrow(/received.*pending/i);
    return receivedGenuineCensus(db);});standalone();
  expect({schema:after.schema.filter(r=>!tables.includes(String(r.tbl_name))),tables:after.tables.filter(t=>!tables.includes(t.name))}).toEqual(before);
  expect(after.tables).toHaveLength(80);expect(after.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(148);
  for(const [i,table] of tables.entries()){const rows=after.schema.filter(r=>r.tbl_name===table);expect(rows).toHaveLength(1+indexes[i]);expect(rows.map(r=>r.name).sort()).toEqual([table,...Array.from({length:indexes[i]},(_,n)=>`sqlite_autoindex_${table}_${n+1}`)].sort());
    expect(String(rows.find(r=>r.name===table)!.sql).replace(/\s/g,'')).toBe(`CREATE TABLE ${table}(${layouts[table as keyof typeof layouts]})`.replace(/\s/g,''));
    expect(after.tables.find(t=>t.name===table)!.rows).toHaveLength([1,0,0,1,1][i]);}
  const enrollmentRow=JSON.parse(after.tables.find(t=>t.name===tables[0])!.rows[0]);expect(enrollmentRow).toMatchObject({source_json:json(source),source_hash:hash(source),snapshot_json:json(accepted!),snapshot_hash:hash(accepted!)});
  receivedGenuineSidecars(checkpoint.database,checkpoint.sidecars);receivedGenuineSidecars(inherited.root.database,inherited.root.sidecars);
  for(const pin of inherited.root.originalLineage)receivedGenuineFile(pin);
  const outputDatabaseSha256=receivedGenuineSha(readFileSync(path));
  const receiptPath=join(directory,'received-renewal-enrollment.json'),receiptFd=openSync(receiptPath,'wx',0o600);
  try{writeFileSync(receiptFd,JSON.stringify({schema:'received_renewal_genuine_enrollment_receipt_v1',reviewedHead:input.reviewedHead,reviewedSrc:input.reviewedSrc,
    predecessorCheckpoint:input.checkpoint,predecessorReceipt:checkpoint.receipt,inputDatabaseSha256:checkpoint.database.sha256,outputDatabaseSha256,source,accepted:accepted!,acceptedJson:json(accepted!),acceptedHash:hash(accepted!),
    beforeCensusHash:receivedGenuineHash(before),afterCensusHash:receivedGenuineHash(after),originalTablesPreserved:75,originalRowsPreserved:145,originalAdmissionsPreserved:24,originalRolesPreserved:50,
    writes,changes:3,authorityCallbacks:callbacks,physicalAdvancement:false,newMotorOrAdoption:false,closureCredit:0},null,2)+'\n');fsyncSync(receiptFd);}finally{closeSync(receiptFd);}
  progress('receipt_closed',{sourceId:source.sourceId,receiptSha256:receivedGenuineSha(readFileSync(receiptPath)),outputDatabaseSha256,nativeConnectionsClosed:true});
});
