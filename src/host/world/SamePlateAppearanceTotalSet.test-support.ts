import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants,copyFileSync,existsSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync } from 'node:fs';
import { dirname,join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { samePaTotalSetSources } from './SamePlateAppearanceTotalSet';
import type { AcceptedSamePaCumulativeTotal } from './SamePlateAppearanceCumulativeTotal';
import type { SamePaEmptyWorkPrefix,SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionRow,samePaExecutionReference } from './SamePlateAppearanceExecutionFromSqlite';
import { assertReservedPaStorage } from './SamePlateAppearanceExecutionStorage';
import { samePaEnrollmentRow,authenticateSamePaRow,assertNoSamePaPlayerReservation,assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { fileHash,rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
type FileReference=Readonly<{path:string;sha256:string}>;
type Input=Readonly<{version:'same_pa_ten_total_proposed_input_v1';qualifiedPrefixManifest:FileReference;totalInputs:FileReference;sourceCheckpoint:FileReference;
  approvedContract:FileReference;approvedViewContract:FileReference;sourceReview:FileReference;fixtureOnly:true}>;
type Qualified=Readonly<{version:'same_pa_empty_prefix_qualified_input_v1';qualified:true;artifact:FileReference;qualification:Readonly<Record<string,FileReference>>;
  prefixReference:SamePaReference<'reserved_pa_work_prefixes'>;prefix:SamePaEmptyWorkPrefix}>;
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'ten-TOTAL artifact has a sidecar: '+suffix);};
const readPinned=<T>(ref:FileReference):T=>{const bytes=readFileSync(ref.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);return JSON.parse(bytes.toString('utf8')) as T;};
const changes=(db:DatabaseSync)=>Number(db.prepare('SELECT total_changes() AS n').get()!.n);
/** Synchronous, exclusive, fsynced files bypass Vitest console buffering.
 * Partial milestones never qualify an incomplete or timed-out gate. */
export const writeTotalSetArtifact=(path:string,value:unknown)=>{
  const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
};
/** Opt-in genuine gate only. Copy/open is deferred until this separately
 * reviewed case runs. It invokes one ten-TOTAL owner, its retry and readback;
 * no enrollment, prefix, view, global workload or physical writer is used. */
export const verifyGenuineSamePaTotalSet=(input:Readonly<{inputPath:string;inputSha256:string;destinationPath:string}>)=>{
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS,'bounded private controller required');
  const packet=readPinned<Input>({path:input.inputPath,sha256:input.inputSha256});assert.equal(packet.version,'same_pa_ten_total_proposed_input_v1');assert.equal(packet.fixtureOnly,true);
  let milestone=0;
  const checkpoint=(phase:string,evidence:unknown)=>writeTotalSetArtifact(join(dirname(input.destinationPath),'checkpoint-'+String(++milestone).padStart(2,'0')+'-'+phase+'.json'),
    {version:'same_pa_ten_total_progress_v1',phase,at:new Date().toISOString(),gateQualified:false,input:{path:input.inputPath,sha256:input.inputSha256},destinationPath:input.destinationPath,evidence});
  for(const ref of [packet.approvedContract,packet.approvedViewContract,packet.sourceReview])assert.equal(fileHash(ref.path),ref.sha256);
  const sourceCheckpoint=readPinned<{qualifiedSource:boolean;genuineQualified:boolean;source:{head:string;src:string};counts:{commonProofs:unknown}}>(packet.sourceCheckpoint);
  assert.equal(sourceCheckpoint.qualifiedSource,true);assert.equal(sourceCheckpoint.genuineQualified,false);
  assert.equal(sourceCheckpoint.source.head,'bf21d811aec8fb172baaa10c877da1c7291847d9');assert.equal(sourceCheckpoint.source.src,'b6b8d489b9da2309b908a84add6d4825a3fbbde3');
  same(sourceCheckpoint.counts.commonProofs,{freshAccept:13,exactRetry:1,normalReopen:1,total:15});
  const qualified=readPinned<Qualified>(packet.qualifiedPrefixManifest);assert.equal(qualified.version,'same_pa_empty_prefix_qualified_input_v1');assert.equal(qualified.qualified,true);
  for(const ref of Object.values(qualified.qualification))assert.equal(fileHash(ref.path),ref.sha256);
  const prior=readPinned<{destinationPath:string;destinationSha256:string;prefixReference:unknown;prefix:SamePaEmptyWorkPrefix;proposedTotalSources:readonly AcceptedSamePaCumulativeTotal[];
    closedHandles:boolean;closedSidecars:boolean;exactRetry:boolean;callbackFreeReadOnlyReopen:boolean;totalOwnersQualified:boolean;executionViewQualified:boolean}>(qualified.qualification.receipt);
  same(qualified.artifact,{path:prior.destinationPath,sha256:prior.destinationSha256});same(qualified.prefixReference,prior.prefixReference);same(qualified.prefix,prior.prefix);
  for(const key of ['closedHandles','closedSidecars','exactRetry','callbackFreeReadOnlyReopen'] as const)assert.equal(prior[key],true);
  assert.equal(prior.totalOwnersQualified,false);assert.equal(prior.executionViewQualified,false);
  const terminal=readPinned<{status:string;originalChildExit:number;remainingOwnedProcesses:unknown[];failures:unknown[];tests:{passedCases:number;reportSha256:string}}>(qualified.qualification.nativeTerminal);
  assert.equal(terminal.status,'passed');assert.equal(terminal.originalChildExit,0);same(terminal.remainingOwnedProcesses,[]);same(terminal.failures,[]);assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.reportSha256,qualified.qualification.report.sha256);
  const declarations=readPinned<{version:string;qualifiedPrefixManifest:FileReference;totalSources:readonly AcceptedSamePaCumulativeTotal[]}>(packet.totalInputs);
  assert.equal(declarations.version,'same_pa_zero_total_inputs_proposed_v1');same(declarations.qualifiedPrefixManifest,packet.qualifiedPrefixManifest);same(declarations.totalSources,prior.proposedTotalSources);
  const sources=samePaTotalSetSources(declarations.totalSources),ids=sources.map(s=>s.sourceId);
  same(sources.map(s=>s.participantReference.playerId),['away-2','p2',...Array.from({length:8},(_,i)=>'home-'+(i+1))].sort());
  for(const source of sources){same(source.prefixReference,qualified.prefixReference);same(source.enrollmentReference,qualified.prefix.lineage.enrollmentReference);
    same(source.participantReference,qualified.prefix.lineage.participantReferences.find(p=>p.playerId===source.participantReference.playerId));}
  const sourcePath=qualified.artifact.path;assert.notEqual(sourcePath,input.destinationPath);assert(!existsSync(input.destinationPath));closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
  copyFileSync(sourcePath,input.destinationPath,constants.COPYFILE_EXCL);assert.equal(fileHash(input.destinationPath),qualified.artifact.sha256);
  const observers:DatabaseSync[]=[],open=()=>{const db=new NativeDatabase(input.destinationPath);observers.push(db);return db;};
  const observer=open();let writer:ReturnType<typeof openSqliteSamePlateAppearanceExecutionStore>|null=null;
  const witnesses:ReturnType<typeof witnessSqliteWrite>[]=[];const writerConnections=new Set<DatabaseSync>();
  try{
    const before=withSqliteReadTransaction(observer,()=>{
      assert.equal(assertReservedPaStorage(observer),true);
      const prefixRow=observer.prepare('SELECT * FROM reserved_pa_work_prefixes WHERE source_id=?').get(qualified.prefixReference.sourceId);assert(prefixRow);same(prefixRow,samePaExecutionRow(qualified.prefix));
      assert.equal(observer.prepare('SELECT count(*) AS n FROM reserved_pa_total_assessments').get()!.n,0);assert.equal(observer.prepare('SELECT count(*) AS n FROM reserved_pa_execution_views').get()!.n,0);
      const row=samePaEnrollmentRow(observer,qualified.prefix.lineage.enrollmentReference.sourceId);assert(row);const enrollment=authenticateSamePaRow(observer,row);
      same(samePaExecutionReference('same_pa_enrollments',enrollment),qualified.prefix.lineage.enrollmentReference);
      return {enrollment,rows:rawCensus(observer),schema:schemaCensus(observer)};
    });
    let authorityReads=0;const byId=new Map(sources.map(s=>[s.sourceId,s]));
    writer=openSqliteSamePlateAppearanceExecutionStore(input.destinationPath,{readAcceptedTotal:id=>{authorityReads++;assert(byId.has(id));return byId.get(id)!;},
      readAcceptedPrefix:()=>{throw new Error('prefix authority must not run in ten-TOTAL gate');},readAcceptedView:()=>{throw new Error('view authority must not run in ten-TOTAL gate');}});
    const observed:{ordinal:number;sourceId:string;changes:number}[]=[];
    witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments VALUES/,db=>{
      assert(db!==observer);assert(db.isTransaction);assert.equal(db.prepare('PRAGMA query_only').get()!.query_only,0);
      assert.equal(db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file,input.destinationPath);writerConnections.add(db);
      const ordinal=observed.length+1,sourceId=String(db.prepare('SELECT source_id FROM reserved_pa_total_assessments ORDER BY rowid DESC LIMIT 1').get()!.source_id);
      assert.equal(sourceId,ids[ordinal-1]);assert.equal(changes(db),ordinal);observed.push({ordinal,sourceId,changes:changes(db)});
      checkpoint('insert-'+String(ordinal).padStart(2,'0')+'-observed',{ordinal,sourceId,totalChanges:changes(db),uncommittedWriteObserved:true,postWriteProofNotYetReturned:true});return true;
    }));
    checkpoint('acceptance-started',{totalSources:sources,sourceArtifact:qualified.artifact,originalRowsHash:hash(before.rows),originalSchemaHash:hash(before.schema),writerInsertsObserved:0});
    const result=writer.acceptTotalSet(ids);if(result.kind!=='total_set')throw new Error('genuine ten-TOTAL set unexpectedly pending');
    assert.equal(result.totals.length,10);assert.equal(result.participantTotalReferences.length,10);assert.equal(authorityReads,10);
    for(const [index,total] of result.totals.entries())same(total,{kind:'cumulative_total',source:sources[index],lineage:qualified.prefix.lineage,coverageHash:qualified.prefix.coverageHash,effortUnits:0});
    same(result.participantTotalReferences,result.totals.map(t=>({playerId:t.source.participantReference.playerId,assessmentReference:samePaExecutionReference('reserved_pa_total_assessments',t)})));
    assert.equal(observed.length,10);assert.equal(writerConnections.size,1);const connection=[...writerConnections][0];assert.equal(changes(connection),10);assert.equal(connection.isTransaction,false);
    const expectedRows=before.rows.map(r=>r.table==='reserved_pa_total_assessments'?{table:r.table,rows:result.totals.map((total,i)=>({__ack_rowid:i+1,...samePaExecutionRow(total)}))}:r);
    withSqliteReadTransaction(observer,()=>{
      same(rawCensus(observer),expectedRows);same(schemaCensus(observer),before.schema);
      for(const p of before.enrollment.participants)assert.throws(()=>assertNoSamePaPlayerReservation(observer,p.binding),/blocks new global Player workload/);
      assert.throws(()=>assertNoSamePaWorkReservation(observer,{gameId:before.enrollment.gameId,playId:before.enrollment.playId,physicalPitchSourceId:before.enrollment.source.firstPhysicalPitchSourceId}),/blocks.*causal work/);
      assert.equal(changes(observer),0);
    });
    checkpoint('totals-returned-and-asserted',{result,writerObservation:{nativeConnections:1,totalChanges:10,statements:observed},newTotalRows:10,newViewRows:0,
      originalRowsAndRowidsPreserved:true,assertedRowsHash:hash(expectedRows),assertedSchemaHash:hash(before.schema),handlesStillOpen:true});
    checkpoint('retry-started',{participantTotalReferences:result.participantTotalReferences,totalChanges:10});
    same(writer.acceptTotalSet(ids),result);assert.equal(authorityReads,20);assert.equal(changes(connection),10);assert.equal(observed.length,10);
    same(rawCensus(observer),expectedRows);same(schemaCensus(observer),before.schema);
    checkpoint('retry-returned-and-asserted',{authorityReads,totalChanges:10,exactRetry:true,handlesStillOpen:true});
    while(witnesses.length)witnesses.pop()!.close();observer.close();writer.close();writer=null;assert.equal(connection.isOpen,false);closed(input.destinationPath);
    const committedHash=fileHash(input.destinationPath);checkpoint('writer-closed',{destinationSha256:committedHash,closedHandles:true,closedSidecars:true,exactRetry:true});
    checkpoint('reopen-started',{destinationSha256:committedHash,participantTotalReferences:result.participantTotalReferences,authorityFree:true});
    const reopened=openSqliteSamePlateAppearanceExecutionStore(input.destinationPath);try{same(reopened.readTotalSet(result.participantTotalReferences),result);}finally{reopened.close();}
    const final=open();try{withSqliteReadTransaction(final,()=>{same(rawCensus(final),expectedRows);same(schemaCensus(final),before.schema);assert.equal(changes(final),0);});}finally{final.close();}
    assert(observers.every(db=>!db.isOpen));assert([...writerConnections].every(db=>!db.isOpen));closed(input.destinationPath);assert.equal(fileHash(input.destinationPath),committedHash);
    closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
    for(const ref of [{path:input.inputPath,sha256:input.inputSha256},packet.qualifiedPrefixManifest,packet.totalInputs,packet.sourceCheckpoint,packet.approvedContract,packet.approvedViewContract,packet.sourceReview,...Object.values(qualified.qualification)])assert.equal(fileHash(ref.path),ref.sha256);
    checkpoint('readback-closed-and-asserted',{destinationSha256:committedHash,callbackFreeReadOnlyReopen:true,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,newTotalRows:10,newViewRows:0});
    return {version:'same_pa_genuine_ten_total_receipt_v1',input:{path:input.inputPath,sha256:input.inputSha256},qualifiedPrefixManifest:packet.qualifiedPrefixManifest,
      sourceArtifact:qualified.artifact,destinationPath:input.destinationPath,destinationSha256:committedHash,prefixReference:qualified.prefixReference,
      totals:result.totals,participantTotalReferences:result.participantTotalReferences,writerObservation:{nativeConnections:1,totalChanges:10,statements:observed},authorityReads,
      newTotalRows:10,newPrefixRows:0,newViewRows:0,newTables:0,newAutoindexes:0,originalRowsAndRowidsPreserved:true,
      exactRetry:true,callbackFreeReadOnlyReopen:true,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,
      commonProofCountsVerifiedInSourceTests:sourceCheckpoint.counts.commonProofs,globalWorkloadRowsChanged:0,physicalPitchWriterInvoked:false,
      firstPitchSlotConsumed:false,successorRightReleased:false,reservationReleased:false,totalOwnersQualified:true,executionViewQualified:false,fixtureOnly:true,productionCalibrationClaim:false};
  }finally{while(witnesses.length)witnesses.pop()!.close();writer?.close();for(const db of observers)if(db.isOpen)db.close();}
};
