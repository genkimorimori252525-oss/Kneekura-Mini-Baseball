import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants,copyFileSync,existsSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync } from 'node:fs';
import { dirname,join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { samePaPrefixInput,type AcceptedSamePaWorkPrefix,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaTotalInput,type AcceptedSamePaCumulativeTotal } from './SamePlateAppearanceCumulativeTotal';
import { assertReservedPaStorage,reservedPaSchema } from './SamePlateAppearanceExecutionStorage';
import { samePaEnrollmentRow,authenticateSamePaRow,assertNoSamePaPlayerReservation,assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { fileHash,rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
type FileReference=Readonly<{path:string;sha256:string}>;
type Declaration=Pick<AcceptedSamePaCumulativeTotal,'sourceId'|'sourceVersion'|'capability'|'effortUnits'|'provenance'>&Readonly<{playerId:string}>;
type Input=Readonly<{version:'same_pa_empty_prefix_proposed_input_v1';qualifiedReservationManifest:FileReference;sourceCheckpoint:FileReference;approvedContract:FileReference;
  prefixSource:AcceptedSamePaWorkPrefix;totalDeclarations:readonly Declaration[];fixtureOnly:true}>;
type Qualified=Readonly<{version:'same_pa_reservation_qualified_input_v1';qualified:true;artifact:FileReference;qualification:Readonly<Record<string,FileReference>>;
  enrollmentReference:SamePaReference<'same_pa_enrollments'>;actorReference:SamePaReference<'physical_plate_appearance_actors'>;participantBaselineReferences:readonly unknown[];
  enrollmentQualified:true;executionViewQualified:false;physicalExecutionQualified:false;resumeQualified:false}>;
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'empty-prefix artifact has a sidecar: '+suffix);};
const readPinned=<T>(ref:FileReference):T=>{const bytes=readFileSync(ref.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);return JSON.parse(bytes.toString('utf8')) as T;};
const changes=(db:DatabaseSync)=>Number(db.prepare('SELECT total_changes() AS n').get()!.n);
const tables=Object.keys(reservedPaSchema);
/** Test artifacts bypass Vitest's buffered console and survive a later stage
 * timeout. Every numbered milestone is partial evidence, never gate approval. */
export const writeEmptyPrefixArtifact=(path:string,value:unknown)=>{
  const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
};

/** Only this separately reviewed prefix gate may copy/open the closed genuine
 * reservation. No enrollment, TOTAL, view, global workload or physical writer
 * is invoked. Candidate TOTAL refs come from the newly authenticated prefix. */
export const verifyGenuineSamePaEmptyPrefix=(input:Readonly<{inputPath:string;inputSha256:string;destinationPath:string}>)=>{
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS,'bounded private controller required');
  const packet=readPinned<Input>({path:input.inputPath,sha256:input.inputSha256});assert.equal(packet.version,'same_pa_empty_prefix_proposed_input_v1');assert.equal(packet.fixtureOnly,true);
  let milestone=0;
  const checkpoint=(phase:string,evidence:unknown)=>writeEmptyPrefixArtifact(join(dirname(input.destinationPath),
    'checkpoint-'+String(++milestone).padStart(2,'0')+'-'+phase+'.json'),{version:'same_pa_empty_prefix_progress_v1',phase,at:new Date().toISOString(),
    gateQualified:false,input:{path:input.inputPath,sha256:input.inputSha256},destinationPath:input.destinationPath,evidence});
  assert.equal(fileHash(packet.approvedContract.path),packet.approvedContract.sha256);
  const sourceCheckpoint=readPinned<{frozenRuntime:{head:string;src:string};boundaries:{genuinePrefixQualified:boolean}}>(packet.sourceCheckpoint);
  assert.equal(sourceCheckpoint.frozenRuntime.head,'40f2cb9b7fe5b485ee5c0a28a38c4d4646bc161e');assert.equal(sourceCheckpoint.frozenRuntime.src,'1ca213b5facef44c7c579e5ff5df8fdb98ed1401');assert.equal(sourceCheckpoint.boundaries.genuinePrefixQualified,false);
  const qualified=readPinned<Qualified>(packet.qualifiedReservationManifest);
  assert.equal(qualified.version,'same_pa_reservation_qualified_input_v1');assert.equal(qualified.qualified,true);assert.equal(qualified.enrollmentQualified,true);
  assert.equal(qualified.executionViewQualified,false);assert.equal(qualified.physicalExecutionQualified,false);assert.equal(qualified.resumeQualified,false);
  for(const ref of Object.values(qualified.qualification))assert.equal(fileHash(ref.path),ref.sha256);
  const prior=readPinned<{destinationPath:string;destinationSha256:string;enrollmentReference:unknown;actorReference:unknown;participantBaselineReferences:unknown;
    closedHandles:boolean;closedSidecars:boolean;exactRetry:boolean;callbackFreeReadOnlyReopen:boolean}>(qualified.qualification.receipt);
  same(qualified.artifact,{path:prior.destinationPath,sha256:prior.destinationSha256});same(qualified.enrollmentReference,prior.enrollmentReference);
  same(qualified.actorReference,prior.actorReference);same(qualified.participantBaselineReferences,prior.participantBaselineReferences);
  for(const key of ['closedHandles','closedSidecars','exactRetry','callbackFreeReadOnlyReopen'] as const)assert.equal(prior[key],true);
  const terminal=readPinned<{status:string;originalChildExit:number;remainingOwnedProcesses:unknown[];failures:unknown[];tests:{passedCases:number;reportSha256:string}}>(qualified.qualification.nativeTerminal);
  assert.equal(terminal.status,'passed');assert.equal(terminal.originalChildExit,0);same(terminal.remainingOwnedProcesses,[]);same(terminal.failures,[]);assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.reportSha256,qualified.qualification.report.sha256);
  const source=samePaPrefixInput(packet.prefixSource);same(source.enrollmentReference,qualified.enrollmentReference);
  const expectedPlayers=['away-2','p2',...Array.from({length:8},(_,i)=>'home-'+(i+1))];same(packet.totalDeclarations.map(p=>p.playerId),expectedPlayers);
  for(const declaration of packet.totalDeclarations)same(declaration,{playerId:declaration.playerId,sourceId:'fixture-same-pa-empty-total-20261008:'+declaration.playerId,sourceVersion:'fixture-v1',
    capability:'reserved_same_pa_cumulative_total_v1',effortUnits:0,provenance:{assessmentSourceId:'fixture-same-pa-empty-assessment-20261008:'+declaration.playerId,
      assessmentVersion:'fixture-only-zero-total-v1',calibrationSourceId:'fixture-same-pa-empty-coverage-total-20261008',calibrationVersion:'fixture-only-zero-total-v1'}});
  const sourcePath=qualified.artifact.path;assert.notEqual(sourcePath,input.destinationPath);assert(!existsSync(input.destinationPath));closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
  copyFileSync(sourcePath,input.destinationPath,constants.COPYFILE_EXCL);assert.equal(fileHash(input.destinationPath),qualified.artifact.sha256);
  const observers:DatabaseSync[]=[],open=()=>{const db=new NativeDatabase(input.destinationPath);observers.push(db);return db;};
  const observer=open();let writer:ReturnType<typeof openSqliteSamePlateAppearanceExecutionStore>|null=null;
  const witnesses:ReturnType<typeof witnessSqliteWrite>[]=[];const writerConnections=new Set<DatabaseSync>();
  try{
    const before=withSqliteReadTransaction(observer,()=>{
      assert.equal(assertReservedPaStorage(observer),false);const row=samePaEnrollmentRow(observer,source.enrollmentReference.sourceId);assert(row);
      assert.equal(row.source_hash,source.enrollmentReference.sourceHash);assert.equal(row.snapshot_hash,source.enrollmentReference.snapshotHash);
      const enrollment=authenticateSamePaRow(observer,row);same(enrollment.source.actorReference,qualified.actorReference);
      const actorRow=observer.prepare('SELECT * FROM physical_plate_appearance_actors WHERE source_id=?').get(qualified.actorReference.sourceId);assert(actorRow);
      const actor=JSON.parse(String(actorRow.snapshot_json)) as {source:unknown;match:{playId:number;balls:number;strikes:number};world:{tick:number}};
      assert.equal(actorRow.source_hash,qualified.actorReference.sourceHash);assert.equal(actorRow.snapshot_hash,qualified.actorReference.snapshotHash);
      assert.equal(hash(actor.source),actorRow.source_hash);assert.equal(hash(actor),actorRow.snapshot_hash);assert.equal(hash(actor),enrollment.actorHash);assert.equal(hash(actor.world),enrollment.worldHash);
      return {enrollment,actor,rows:rawCensus(observer),schema:schemaCensus(observer)};
    });
    let authorityReads=0;
    writer=openSqliteSamePlateAppearanceExecutionStore(input.destinationPath,{readAcceptedPrefix:id=>{authorityReads++;assert.equal(id,source.sourceId);return source;},
      readAcceptedTotal:()=>{throw new Error('TOTAL authority must not run in prefix gate');},readAcceptedView:()=>{throw new Error('view authority must not run in prefix gate');}});
    const observed:{changes:number}[]=[];
    witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_work_prefixes VALUES/,db=>{
      assert(db!==observer);assert(db.isTransaction);assert.equal(db.prepare('PRAGMA query_only').get()!.query_only,0);
      assert.equal(db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file,input.destinationPath);
      writerConnections.add(db);observed.push({changes:changes(db)});return true;
    }));
    checkpoint('acceptance-started',{prefixSource:source,sourceArtifact:qualified.artifact,originalRowsHash:hash(before.rows),originalSchemaHash:hash(before.schema),writerInsertObserved:false});
    console.info('SP_EMPTY_PREFIX_PROGRESS=authenticating and accepting one genuine empty prefix');
    const prefix=writer.acceptPrefix(source.sourceId);if(prefix.kind!=='empty_prefix')throw new Error('genuine prefix unexpectedly pending');same(prefix.source,source);
    const e=before.enrollment,participantReferences=e.participants.map(p=>({playerId:p.binding.playerId,bindingHash:hash(p.binding),personHash:p.personHash,baselineSourceId:p.baselineSourceId,revision:p.state.revision,stateHash:hash(p.state)}));
    same(prefix.lineage,{enrollmentReference:qualified.enrollmentReference,actorReference:qualified.actorReference,careerId:e.careerId,gameId:e.gameId,playId:e.playId,
      firstPhysicalPitchSourceId:e.source.firstPhysicalPitchSourceId,participantReferences});
    same(prefix.timeline,{playId:before.actor.match.playId,startedAtTick:before.actor.world.tick,lastEventTick:before.actor.world.tick,nextSequence:0,
      status:{kind:'active',count:{balls:before.actor.match.balls,strikes:before.actor.match.strikes}},events:[]});
    assert.equal(prefix.worldHash,e.worldHash);assert.equal(prefix.timelineHash,hash(prefix.timeline));assert.equal(prefix.physicalRevision,0);assert.equal(prefix.endpoint,null);same(prefix.episodes,[]);same(prefix.resumes,[]);
    same(prefix.participantWork,participantReferences.map(p=>({playerId:p.playerId,work:[]})));
    same(observed,[{changes:1}]);assert.equal(writerConnections.size,1);const connection=[...writerConnections][0];assert.equal(changes(connection),1);assert.equal(connection.isTransaction,false);
    const row={__ack_rowid:1,source_id:source.sourceId,enrollment_source_id:source.enrollmentReference.sourceId,career_id:e.careerId,game_id:e.gameId,play_id:e.playId,
      actor_source_id:qualified.actorReference.sourceId,first_pitch_source_id:e.source.firstPhysicalPitchSourceId,physical_revision:0,
      source_json:json(source),source_hash:hash(source),snapshot_json:json(prefix),snapshot_hash:hash(prefix)};
    const expectedRows=[...before.rows,{table:tables[0],rows:[row]},{table:tables[1],rows:[]},{table:tables[2],rows:[]}].sort((a,b)=>String(a.table)<String(b.table)?-1:1);
    const afterSchema=withSqliteReadTransaction(observer,()=>{
      assert.equal(assertReservedPaStorage(observer),true);same(rawCensus(observer),expectedRows);
      const schema=schemaCensus(observer),added=schema.main.filter(r=>tables.includes(String(r.tbl_name)));assert.equal(added.length,9);
      same(schema.main.filter(r=>!tables.includes(String(r.tbl_name))),before.schema.main);same(schema.temp,before.schema.temp);
      assert.equal(schema.mainVersion,Number(before.schema.mainVersion)+3);assert.equal(schema.tempVersion,before.schema.tempVersion);assert.equal(schema.userVersion,before.schema.userVersion);
      for(const table of tables){const objects=added.filter(r=>r.tbl_name===table);assert.equal(objects.length,3);same(objects.filter(r=>r.type==='index').map(r=>({name:r.name,sql:r.sql})),[1,2].map(i=>({name:'sqlite_autoindex_'+table+'_'+i,sql:null})));}
      for(const p of e.participants)assert.throws(()=>assertNoSamePaPlayerReservation(observer,p.binding),/blocks new global Player workload/);
      assert.throws(()=>assertNoSamePaWorkReservation(observer,{gameId:e.gameId,playId:e.playId,physicalPitchSourceId:e.source.firstPhysicalPitchSourceId}),/blocks.*causal work/);
      assert.equal(changes(observer),0);return schema;
    });
    checkpoint('prefix-returned-and-asserted',{prefix,writerObservation:{nativeConnections:writerConnections.size,totalChanges:1,statements:observed},
      newPrefixRows:1,newTotalRows:0,newViewRows:0,newTables:3,newAutoindexes:6,originalRowsAndRowidsPreserved:true,assertedRowsHash:hash(expectedRows),assertedSchemaHash:hash(afterSchema),handlesStillOpen:true});
    checkpoint('retry-started',{prefixSourceId:source.sourceId,prefixSnapshotHash:hash(prefix),totalChanges:changes(connection)});
    same(writer.acceptPrefix(source.sourceId),prefix);assert.equal(authorityReads,2);assert.equal(changes(connection),1);assert.equal(observed.length,1);
    same(rawCensus(observer),expectedRows);same(schemaCensus(observer),afterSchema);
    checkpoint('retry-returned-and-asserted',{prefixSnapshotHash:hash(prefix),authorityReads,totalChanges:1,exactRetry:true,originalRowsAndRowidsPreserved:true,handlesStillOpen:true});
    while(witnesses.length)witnesses.pop()!.close();observer.close();writer.close();writer=null;assert.equal(connection.isOpen,false);closed(input.destinationPath);
    const committedHash=fileHash(input.destinationPath);
    checkpoint('writer-closed',{destinationSha256:committedHash,writerAndObserverClosed:true,closedSidecars:true,exactRetry:true});
    checkpoint('reopen-started',{destinationSha256:committedHash,prefixSnapshotHash:hash(prefix),authorityFree:true});
    console.info('SP_EMPTY_PREFIX_PROGRESS=one write and exact retry closed; normal authority-free reopen');
    const reopened=openSqliteSamePlateAppearanceExecutionStore(input.destinationPath);try{same(reopened.readPrefix(source.sourceId),prefix);}finally{reopened.close();}
    const final=open();try{withSqliteReadTransaction(final,()=>{same(rawCensus(final),expectedRows);same(schemaCensus(final),afterSchema);assert.equal(changes(final),0);});}finally{final.close();}
    assert(observers.every(db=>!db.isOpen));assert([...writerConnections].every(db=>!db.isOpen));closed(input.destinationPath);assert.equal(fileHash(input.destinationPath),committedHash);
    closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
    for(const ref of [{path:input.inputPath,sha256:input.inputSha256},packet.qualifiedReservationManifest,packet.sourceCheckpoint,packet.approvedContract,...Object.values(qualified.qualification)])assert.equal(fileHash(ref.path),ref.sha256);
    checkpoint('readback-closed-and-asserted',{destinationSha256:committedHash,callbackFreeReadOnlyReopen:true,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,
      originalRowsAndRowidsPreserved:true,newPrefixRows:1,newTotalRows:0,newViewRows:0});
    const prefixReference={owner:'reserved_pa_work_prefixes' as const,sourceId:source.sourceId,sourceHash:hash(source),snapshotHash:hash(prefix)};
    const proposedTotalSources=packet.totalDeclarations.map(d=>{const participantReference=participantReferences.find(p=>p.playerId===d.playerId);assert(participantReference);
      const declaration={sourceId:d.sourceId,sourceVersion:d.sourceVersion,capability:d.capability,effortUnits:d.effortUnits,provenance:d.provenance};
      return samePaTotalInput({...declaration,enrollmentReference:source.enrollmentReference,prefixReference,participantReference});});
    return {version:'same_pa_genuine_empty_prefix_receipt_v1',input:{path:input.inputPath,sha256:input.inputSha256},qualifiedReservationManifest:packet.qualifiedReservationManifest,
      sourceArtifact:qualified.artifact,destinationPath:input.destinationPath,destinationSha256:committedHash,prefixReference,prefix,
      proposedTotalSources,writerObservation:{nativeConnections:writerConnections.size,totalChanges:1,statements:observed},authorityReads,
      newPrefixRows:1,newTotalRows:0,newViewRows:0,newTables:3,newAutoindexes:6,originalRowsAndRowidsPreserved:true,
      exactRetry:true,callbackFreeReadOnlyReopen:true,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,
      globalWorkloadRowsChanged:0,physicalPitchWriterInvoked:false,firstPitchSlotConsumed:false,successorRightReleased:false,reservationReleased:false,
      totalOwnersQualified:false,executionViewQualified:false,fixtureOnly:true,productionCalibrationClaim:false};
  }finally{while(witnesses.length)witnesses.pop()!.close();writer?.close();for(const db of observers)if(db.isOpen)db.close();}
};
