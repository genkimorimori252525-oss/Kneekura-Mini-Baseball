/** One opt-in integrated genuine continuation and ownership/reopen qualification.
 * Starts from the closed adoption endpoint; never rebuilds prior live stages. */
import {createRequire} from 'node:module';
import {copyFileSync,existsSync,mkdirSync,readFileSync,statSync,writeFileSync,openSync,fsyncSync,closeSync,constants} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {openSqliteActualReceivedUmpireContinuationStore} from './SqliteActualReceivedUmpireContinuationStore';
import {openSqliteActualReceivedUmpireRenewalEnrollmentStore} from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import {openSqliteActualReceivedUmpireRenewalDecisionStore} from './SqliteActualReceivedUmpireRenewalDecisionStore';
import {openSqliteActualReceivedUmpireRenewalMotorStore} from './SqliteActualReceivedUmpireRenewalMotorStore';
import {openSqliteActualReceivedUmpireRenewalAdoptionStore} from './SqliteActualReceivedUmpireRenewalAdoptionStore';
import {openSqliteActualReceivedUmpireDefenderReplanStore} from './SqliteActualReceivedUmpireDefenderReplanStore';
import {actualReceivedUmpireDefenderLiveWorkFromSqlite} from './ActualReceivedUmpireDefenderLiveWork';
import {ownedScheduledMotionArchiveEncoding as encoding} from './OwnedScheduledMotionArchive';
import {battedWorldFieldExecutionEvidenceFromSqlite,type DurableBattedWorldFieldExecution} from './SqliteBattedWorldFieldExecutionStore';
import {battedWorldFieldEvidenceFromSqlite} from './SqliteBattedWorldFieldStore';
import {actualPlayersKinematicsFromPrefix} from './ActualPlayerKinematicsFromPrefix';
import {withRenewalReadProof} from './ActualReceivedUmpireRenewalTransaction';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {receivedGenuineFile,receivedGenuineSidecars,receivedGenuineCensus,receivedGenuineHash,receivedGenuineSha,
  type ReceivedGenuinePin,type ReceivedGenuineSidecar} from './ActualReceivedUmpireDefenderGenuineStages.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db=InstanceType<typeof DatabaseSync>;
type Checkpoint={schema:string;stage:string;database:ReceivedGenuinePin;receipt:ReceivedGenuinePin;terminal:ReceivedGenuinePin;report:ReceivedGenuinePin;
  inspection:ReceivedGenuinePin;progress:ReceivedGenuinePin;input:ReceivedGenuinePin;config:ReceivedGenuinePin;predecessor:ReceivedGenuinePin;sidecars:readonly ReceivedGenuineSidecar[]};
const inputPath=process.env.RECEIVED_CONTINUATION_GENUINE_INPUT;
const readJson=(pin:ReceivedGenuinePin)=>JSON.parse(receivedGenuineFile(pin).toString('utf8'));
const readOnly=<T>(path:string,body:(db:Db)=>T)=>{const db=new DatabaseSync(path,{readOnly:true});try{db.exec('PRAGMA query_only=ON; BEGIN');const value=body(db);expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);db.exec('COMMIT');return value;}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}};
it.runIf(!!inputPath)('RCG01 advances the genuine adopted commands and closes one callback-free historical and current ownership batch',()=>{
  const input=JSON.parse(readFileSync(inputPath!,'utf8')) as {schema:string;released:boolean;harness:{candidateHead:string;candidateSrc:string};predecessor:ReceivedGenuinePin};
  expect(input).toMatchObject({schema:'received_continuation_genuine_input_v1',released:true});
  expect(input.predecessor.sha256).toBe('14246c9a10da06b7e518c347275b59459785016d87e88a27d7ca231be92ab74b');
  const c=readJson(input.predecessor) as Checkpoint,t=readJson(c.terminal),r=readJson(c.report),config=readJson(c.config),receipt=readJson(c.receipt);
  expect(c).toMatchObject({schema:'received_renewal_genuine_checkpoint_v1',stage:'renewal-adoption'});
  expect(config.sourceIdentity).toMatchObject({candidateHead:'6bcc543873eeee65ae892fe29db9bf9ba0e3bdf2',candidateSrc:'71b99c9452fa83ba6f6a68dbbd55e58e59148a05'});
  expect(t).toMatchObject({status:'passed',originalChildExit:0,remainingOwnedProcesses:[],failures:[],configSha256:c.config.sha256,tests:{passedCases:1,expectedFailedCases:0,reportSha256:c.report.sha256}});
  expect(r).toMatchObject({success:true,numPassedTests:1,numFailedTests:0});for(const g of ['source','dependencies','controls','runtime']){expect(t.before[g].sha256).toBe(config.inputs[g].sha256);expect(t.after[g].sha256).toBe(config.inputs[g].sha256);}
  readJson(c.inspection);receivedGenuineFile(c.progress);receivedGenuineFile(c.input);
  expect(receipt).toMatchObject({schema:'received_renewal_genuine_adoption_receipt_v1',changes:4,authorityCallbacks:10,physicalAdvancement:false,pending:'physical_continuation',outputDatabaseSha256:c.database.sha256});receivedGenuineSidecars(c.database,c.sidecars);
  const dir=join(process.env.TMPDIR!,'artifact');expect(existsSync(dir)).toBe(false);mkdirSync(dir,{mode:0o700});const path=join(dir,'received-continuation.sqlite');copyFileSync(c.database.path,path,constants.COPYFILE_EXCL);receivedGenuineFile({path,sha256:c.database.sha256});
  const standalone=()=>{for(const suffix of ['-wal','-journal'])expect(existsSync(path+suffix)?statSync(path+suffix).size:0).toBe(0);};
  const before=readOnly(path,receivedGenuineCensus);standalone();expect(receivedGenuineHash(before)).toBe(receipt.afterCensusHash);expect(before.tables).toHaveLength(80);expect(before.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(154);
  const row=(table:string,id:string)=>{const rows=before.tables.find(t=>t.name===table)!.rows.map(s=>JSON.parse(s)).filter(r=>r.source_id===id);expect(rows).toHaveLength(1);return rows[0];};
  const enrollment=JSON.parse(row('actual_received_umpire_renewal_enrollments','received-renewal-enrollment-home-1').snapshot_json),oldAdoption=row('batted_world_field_executions','received-renewal-adoption-home-1');
  expect(oldAdoption.snapshot_json).toBe(receipt.acceptedArchiveJson);expect(oldAdoption.snapshot_hash).toBe(receipt.acceptedArchiveHash);
  const source={sourceId:'received-positive-continuation-home-1',sourceVersion:'genuine-received-positive-continuation-v1',baseFieldSourceId:'field-race-candidate-0',previousExecutionSourceId:oldAdoption.source_id as string,
    action:{kind:'received_renewal_continuation_v1' as const,renewalEnrollmentSourceId:enrollment.source.sourceId as string,renewalAdoptionSourceId:oldAdoption.source_id as string}};
  let sequence=0;const progress=(phase:string,details:Record<string,unknown>={})=>{const fd=openSync(join(dir,'received-continuation-progress.jsonl'),sequence===0?'ax':'a',0o600);try{writeFileSync(fd,JSON.stringify({schema:'received_continuation_progress_v1',sequence:++sequence,phase,wallTimeUnixMilliseconds:Date.now(),...details})+'\n');fsyncSync(fd);}finally{closeSync(fd);}const d=openSync(dir,'r');try{fsyncSync(d);}finally{closeSync(d);}};
  const nativePrepare=DatabaseSync.prototype.prepare;let writes=0,callbacks=0,value:DurableBattedWorldFieldExecution;
  const writer=openSqliteActualReceivedUmpireContinuationStore(path,{readAcceptedContinuation:id=>{callbacks++;expect(id).toBe(source.sourceId);return source;}});
  DatabaseSync.prototype.prepare=function(this:Db,sql:string){const stmt=nativePrepare.call(this,sql);if(/^(INSERT INTO batted_world_field_executions|UPDATE batted_world_field_execution_heads|INSERT INTO actual_received_umpire_continuations)/.test(sql)){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const out=run(...args);writes+=Number(out.changes);expect(db.isTransaction).toBe(true);progress('uncommitted_write',{sql,changes:Number(out.changes),cumulative:writes});return out;}) as typeof stmt.run;}return stmt;} as typeof nativePrepare;
  try{progress('acceptance_start',{predecessorCheckpoint:input.predecessor.sha256});value=writer.accept(source.sourceId);progress('owner_returned',{sourceId:value.source.sourceId,revision:value.revision,archiveHash:encoding(value).hash,writes,callbacks});}
  finally{DatabaseSync.prototype.prepare=nativePrepare;writer.close();}
  expect(writes).toBe(3);expect(callbacks).toBe(9);expect(value!.revision).toBe(12);expect(value!.execution.kind).toBe('received_renewal_continuation_v1');
  if(value!.execution.kind!=='received_renewal_continuation_v1')throw new Error('genuine continuation missing');const execution=value!.execution;
  expect(execution.at).toEqual({originTick:11180360,elapsedSeconds:0.849942,tick:12030302,ticksPerSecond:1000000});expect(execution.coverageThroughTick).toBe(13030302);
  expect(execution.executedThrough.elapsedSeconds).toBeGreaterThan(execution.at.elapsedSeconds);expect(execution.executedThrough.elapsedSeconds).toBeLessThanOrEqual((execution.checkpointThroughTick-execution.at.originTick)/execution.at.ticksPerSecond);
  const after=readOnly(path,receivedGenuineCensus);standalone();expect(after.tables).toHaveLength(81);expect(after.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(156);
  for(const table of before.tables){const next=after.tables.find(t=>t.name===table.name)!;
    if(table.name==='batted_world_field_executions'){expect(next.rows).toHaveLength(table.rows.length+1);expect(next.rows).toEqual(expect.arrayContaining(table.rows));}
    else if(table.name==='batted_world_field_execution_heads'){const old=JSON.parse(table.rows[0]),nextRow=JSON.parse(next.rows[0]);expect(next.rows).toHaveLength(1);expect(nextRow).toEqual({...old,source_id:source.sourceId,revision:12});}
    else expect(next).toEqual(table);
  }
  const newSchema=after.schema.filter(s=>!before.schema.some(b=>json(b)===json(s)));expect(newSchema).toHaveLength(4);expect(newSchema.map(s=>s.type).sort()).toEqual(['index','index','index','table']);
  const coldExec=DatabaseSync.prototype.exec,coldClose=DatabaseSync.prototype.close,connections=new Map<Db,unknown[]>(),closed:unknown[][]=[];
  const counters=(db:Db)=>[db.prepare('SELECT total_changes() AS n').get()!.n,db.prepare('PRAGMA main.schema_version').get()!.schema_version,db.prepare('PRAGMA temp.schema_version').get()!.schema_version];
  DatabaseSync.prototype.exec=function(this:Db,sql:string){if(!connections.has(this))connections.set(this,counters(this));return coldExec.call(this,sql);};
  DatabaseSync.prototype.close=function(this:Db){const start=connections.get(this),end=counters(this);try{expect(start).toBeDefined();expect(end).toEqual(start);expect(this.isTransaction).toBe(false);}finally{coldClose.call(this);closed.push(end);}};
  const results:{owner:string;sourceId:string;readHash:string;retryHash:string|null}[]=[];
  let projection:unknown;
  try{
  // Each earlier owner's existing-row retry only repeats this same immutable
  // reader twice. Keep its changed-head historical read here; the new owner
  // alone exercises cold read plus exact retry in this genuine batch.
  const runOwner=(owner:string,id:string,open:()=>{read(id:string):unknown;accept(id:string):unknown;close():void},encode:(value:unknown)=>string=json,retry=false)=>{
    const expected=owner==='actual_received_umpire_continuations'?encoding(value!).json:row(owner,id).snapshot_json,store=open();
    try{progress('cold_read_start',{owner,sourceId:id});const read=encode(store.read(id));expect(read).toBe(expected);progress('cold_read_returned',{owner,sourceId:id});
      const retried=retry?encode(store.accept(id)):null;if(retried!==null){expect(retried).toBe(expected);progress('cold_retry_returned',{owner,sourceId:id});}
      results.push({owner,sourceId:id,readHash:receivedGenuineSha(read),retryHash:retried===null?null:receivedGenuineSha(retried)});
    }finally{store.close();}
  };
  runOwner('actual_received_umpire_renewal_enrollments',enrollment.source.sourceId,()=>openSqliteActualReceivedUmpireRenewalEnrollmentStore(path));
  runOwner('actual_received_umpire_renewal_decisions','received-renewal-decision-home-1',()=>openSqliteActualReceivedUmpireRenewalDecisionStore(path));
  runOwner('actual_received_umpire_renewal_motors','received-renewal-motor-home-1',()=>openSqliteActualReceivedUmpireRenewalMotorStore(path));
  runOwner('actual_received_umpire_defender_replans',enrollment.receivedReplanSourceId,()=>openSqliteActualReceivedUmpireDefenderReplanStore(path));
  runOwner('batted_world_field_executions',oldAdoption.source_id,()=>openSqliteActualReceivedUmpireRenewalAdoptionStore(path),v=>encoding(v as DurableBattedWorldFieldExecution).json);
  runOwner('actual_received_umpire_continuations',source.sourceId,()=>openSqliteActualReceivedUmpireContinuationStore(path),v=>encoding(v as DurableBattedWorldFieldExecution).json,true);
  expect(results).toHaveLength(6);expect(results.filter(r=>r.retryHash!==null).map(r=>r.owner)).toEqual(['actual_received_umpire_continuations']);
  progress('current_projection_start');projection=readOnly(path,db=>withRenewalReadProof(db,()=>{
    const work=actualReceivedUmpireDefenderLiveWorkFromSqlite(db).read(enrollment.receivedEnrollmentSourceId);expect(work).toMatchObject({stage:4,work:{...execution.liveWork}});
    const fields=battedWorldFieldEvidenceFromSqlite(db),base=fields.read(source.baseFieldSourceId)!,physical=battedWorldFieldExecutionEvidenceFromSqlite(db);
    const prefix={baseField:base,fields:fields.scope(base,base.source.sourceId),executions:physical.scope(base,source.sourceId)},batter=base.response.touch.worldContact.flight.physicalPitch.frame.batterActor!;
    const ids=[batter.binding.playerId,...batter.defenderBindings.map(b=>b.playerId)],selves=actualPlayersKinematicsFromPrefix(ids,prefix),prior=actualPlayersKinematicsFromPrefix(ids,{...prefix,executions:prefix.executions.slice(0,-1)});
    for(const old of prior){const next=selves.find(s=>s.playerId===old.playerId)!;expect(next.ownedMotionCoverage).toEqual(old.ownedMotionCoverage);expect(next.adoptions).toHaveLength(old.adoptions.length);expect(next.activeCommand.sourceId).toBe(old.activeCommand.sourceId);expect(next.at.elapsedSeconds).toBe(execution.executedThrough.elapsedSeconds);}
    expect(selves).toHaveLength(10);expect(selves.reduce((n,s)=>n+s.roles.length,0)).toBe(50);expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);return {work,selvesHash:hash(selves),participants:10,roles:50};
  }));progress('current_projection_returned',{projectionHash:hash(projection)});expect(connections.size).toBe(7);expect(closed).toHaveLength(7);
  }finally{DatabaseSync.prototype.exec=coldExec;DatabaseSync.prototype.close=coldClose;}
  expect(callbacks).toBe(9);const finalCensus=readOnly(path,receivedGenuineCensus);standalone();expect(finalCensus).toEqual(after);receivedGenuineSidecars(c.database,c.sidecars);
  const outputDatabaseSha256=receivedGenuineSha(readFileSync(path)),receiptPath=join(dir,'received-continuation.json'),fd=openSync(receiptPath,'wx',0o600);
  try{writeFileSync(fd,JSON.stringify({schema:'received_continuation_genuine_receipt_v1',harness:input.harness,predecessorCheckpoint:input.predecessor,inputDatabaseSha256:c.database.sha256,outputDatabaseSha256,
    beforeCensusHash:receivedGenuineHash(before),afterCensusHash:receivedGenuineHash(after),acceptedArchiveJson:encoding(value!).json,acceptedArchiveHash:encoding(value!).hash,
    writes,authorityCallbacks:callbacks,results,projection,executedThrough:execution.executedThrough,physicalAdvancement:true,pending:execution.liveWork.kind,closureCredit:0},null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  progress('receipt_closed',{receiptSha256:receivedGenuineSha(readFileSync(receiptPath)),outputDatabaseSha256,nativeConnectionsClosed:true});
});
