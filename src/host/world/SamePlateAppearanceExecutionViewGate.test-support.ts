import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants,copyFileSync,existsSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync } from 'node:fs';
import { dirname,join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { samePaViewInput,samePaAssessmentSetHash,type AcceptedSamePaExecutionView,type SamePaTotalReference } from './SamePlateAppearanceExecutionView';
import type { SamePaCumulativeTotal } from './SamePlateAppearanceCumulativeTotal';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionRow,samePaExecutionReference } from './SamePlateAppearanceExecutionFromSqlite';
import { assertReservedPaStorage } from './SamePlateAppearanceExecutionStorage';
import { samePaEnrollmentRow,authenticateSamePaRow,assertNoSamePaPlayerReservation,assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { fileHash,rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
type FileReference=Readonly<{path:string;sha256:string}>;
type Input=Readonly<{version:'same_pa_execution_view_proposed_input_v1';qualifiedTotalManifest:FileReference;sourceCheckpoint:FileReference;
  approvedContract:FileReference;viewSource:AcceptedSamePaExecutionView;fixtureOnly:true}>;
type Qualified=Readonly<{version:'same_pa_total_set_qualified_input_v1';qualified:true;artifact:FileReference;qualification:Readonly<Record<string,FileReference>>;
  prefixReference:SamePaReference<'reserved_pa_work_prefixes'>;totals:readonly SamePaCumulativeTotal[];participantTotalReferences:readonly SamePaTotalReference[]}>;
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const same=(a:unknown,b:unknown)=>assert.equal(json(a),json(b));
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'execution-view artifact has a sidecar: '+suffix);};
const readPinned=<T>(ref:FileReference):T=>{const bytes=readFileSync(ref.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);return JSON.parse(bytes.toString('utf8')) as T;};
const changes=(db:DatabaseSync)=>Number(db.prepare('SELECT total_changes() AS n').get()!.n);
export const writeExecutionViewArtifact=(path:string,value:unknown)=>{
  const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
};
/** Generic held harness. Concrete accepted Source/references must come from a
 * closed qualified ten-TOTAL receipt. No placeholder or guessed owner hash is
 * accepted, and only the separately released case may copy/open that input. */
export const verifyGenuineSamePaExecutionView=(input:Readonly<{inputPath:string;inputSha256:string;destinationPath:string}>)=>{
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS,'bounded private controller required');
  const packet=readPinned<Input>({path:input.inputPath,sha256:input.inputSha256});assert.equal(packet.version,'same_pa_execution_view_proposed_input_v1');assert.equal(packet.fixtureOnly,true);
  let milestone=0;const checkpoint=(phase:string,evidence:unknown)=>writeExecutionViewArtifact(join(dirname(input.destinationPath),'checkpoint-'+String(++milestone).padStart(2,'0')+'-'+phase+'.json'),
    {version:'same_pa_execution_view_progress_v1',phase,at:new Date().toISOString(),gateQualified:false,input:{path:input.inputPath,sha256:input.inputSha256},destinationPath:input.destinationPath,evidence});
  assert.equal(fileHash(packet.approvedContract.path),packet.approvedContract.sha256);
  const sourceCheckpoint=readPinned<{qualifiedSource:boolean;source:{head:string;src:string}}>(packet.sourceCheckpoint);
  assert.equal(sourceCheckpoint.qualifiedSource,true);assert.equal(sourceCheckpoint.source.head,'bf21d811aec8fb172baaa10c877da1c7291847d9');assert.equal(sourceCheckpoint.source.src,'b6b8d489b9da2309b908a84add6d4825a3fbbde3');
  const qualified=readPinned<Qualified>(packet.qualifiedTotalManifest);assert.equal(qualified.version,'same_pa_total_set_qualified_input_v1');assert.equal(qualified.qualified,true);
  for(const ref of Object.values(qualified.qualification))assert.equal(fileHash(ref.path),ref.sha256);
  const prior=readPinned<{destinationPath:string;destinationSha256:string;prefixReference:unknown;totals:readonly SamePaCumulativeTotal[];participantTotalReferences:readonly SamePaTotalReference[];
    closedHandles:boolean;closedSidecars:boolean;exactRetry:boolean;callbackFreeReadOnlyReopen:boolean;totalOwnersQualified:boolean;executionViewQualified:boolean}>(qualified.qualification.receipt);
  same(qualified.artifact,{path:prior.destinationPath,sha256:prior.destinationSha256});same(qualified.prefixReference,prior.prefixReference);same(qualified.totals,prior.totals);same(qualified.participantTotalReferences,prior.participantTotalReferences);
  for(const key of ['closedHandles','closedSidecars','exactRetry','callbackFreeReadOnlyReopen','totalOwnersQualified'] as const)assert.equal(prior[key],true);assert.equal(prior.executionViewQualified,false);
  const terminal=readPinned<{status:string;originalChildExit:number;remainingOwnedProcesses:unknown[];failures:unknown[];tests:{passedCases:number;reportSha256:string}}>(qualified.qualification.nativeTerminal);
  assert.equal(terminal.status,'passed');assert.equal(terminal.originalChildExit,0);same(terminal.remainingOwnedProcesses,[]);same(terminal.failures,[]);assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.reportSha256,qualified.qualification.report.sha256);
  const source=samePaViewInput(packet.viewSource);assert.equal(qualified.totals.length,10);same(source.enrollmentReference,qualified.totals[0].source.enrollmentReference);
  same(source.prefixReference,qualified.prefixReference);same(source.participantTotalReferences,qualified.participantTotalReferences);
  for(const total of qualified.totals){same(total.source.enrollmentReference,source.enrollmentReference);same(total.source.prefixReference,source.prefixReference);
    same(samePaExecutionReference('reserved_pa_total_assessments',total),source.participantTotalReferences.find(r=>r.playerId===total.source.participantReference.playerId)?.assessmentReference);assert.equal(total.effortUnits,0);}
  const sourcePath=qualified.artifact.path;assert.notEqual(sourcePath,input.destinationPath);assert(!existsSync(input.destinationPath));closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
  copyFileSync(sourcePath,input.destinationPath,constants.COPYFILE_EXCL);assert.equal(fileHash(input.destinationPath),qualified.artifact.sha256);
  const observers:DatabaseSync[]=[],open=()=>{const db=new NativeDatabase(input.destinationPath);observers.push(db);return db;};const observer=open();
  let writer:ReturnType<typeof openSqliteSamePlateAppearanceExecutionStore>|null=null;const witnesses:ReturnType<typeof witnessSqliteWrite>[]=[];const connections=new Set<DatabaseSync>();
  try{
    const before=withSqliteReadTransaction(observer,()=>{
      assert.equal(assertReservedPaStorage(observer),true);assert.equal(observer.prepare('SELECT count(*) AS n FROM reserved_pa_execution_views').get()!.n,0);
      assert.equal(observer.prepare('SELECT count(*) AS n FROM reserved_pa_total_assessments').get()!.n,10);
      for(const total of qualified.totals)same(observer.prepare('SELECT * FROM reserved_pa_total_assessments WHERE source_id=?').get(total.source.sourceId),samePaExecutionRow(total));
      const row=samePaEnrollmentRow(observer,source.enrollmentReference.sourceId);assert(row);const enrollment=authenticateSamePaRow(observer,row);same(samePaExecutionReference('same_pa_enrollments',enrollment),source.enrollmentReference);
      return {enrollment,rows:rawCensus(observer),schema:schemaCensus(observer)};
    });
    let authorityReads=0;writer=openSqliteSamePlateAppearanceExecutionStore(input.destinationPath,{readAcceptedView:id=>{authorityReads++;assert.equal(id,source.sourceId);return source;},
      readAcceptedPrefix:()=>{throw new Error('prefix authority must not run in view gate');},readAcceptedTotal:()=>{throw new Error('TOTAL authority must not run in view gate');}});
    const observed:{changes:number}[]=[];witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_execution_views VALUES/,db=>{
      assert(db!==observer);assert(db.isTransaction);assert.equal(db.prepare('PRAGMA query_only').get()!.query_only,0);assert.equal(db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file,input.destinationPath);
      connections.add(db);observed.push({changes:changes(db)});checkpoint('insert-observed',{totalChanges:changes(db),uncommittedWriteObserved:true,postWriteProofNotYetReturned:true});return true;
    }));
    checkpoint('acceptance-started',{viewSource:source,sourceArtifact:qualified.artifact,originalRowsHash:hash(before.rows),originalSchemaHash:hash(before.schema)});
    const view=writer.acceptView(source.sourceId);if(view.kind!=='basis_prepared')throw new Error('genuine execution view unexpectedly pending');same(view.source,source);assert.equal(view.participants.length,10);
    same(view.lineage,qualified.totals[0].lineage);assert.equal(view.coverageHash,qualified.totals[0].coverageHash);
    assert.equal(view.assessmentSetHash,samePaAssessmentSetHash(source.participantTotalReferences));
    same(view.participants.map(p=>p.playerId),before.enrollment.participants.map(p=>p.binding.playerId));
    for(const p of view.participants){const original=before.enrollment.participants.find(v=>v.binding.playerId===p.playerId);assert(original);same(p.reservedState,original.state);
      same(p.activity,{sourceEventId:'actual-total-play-workload:'+hash([before.enrollment.careerId,before.enrollment.gameId,before.enrollment.playId,p.playerId]),
        sourceVersion:'reserved-same-pa-total-workload-v1',evidenceId:source.prefixReference.sourceId,careerId:before.enrollment.careerId,playerId:p.playerId,atDay:original.binding.gameDay,kind:'MATCH',effortUnits:0});
      same(p.projectedState,advancePlayerWorkloadRecovery(original.state,original.state.revision,p.activity));assert.equal(p.projectedStateHash,hash(p.projectedState));
      assert.equal(p.projectedState.fatigue,original.state.fatigue);assert.equal(p.projectedState.revision,original.state.revision+1);
      same(p.totalReference,qualified.participantTotalReferences.find(v=>v.playerId===p.playerId)?.assessmentReference);}
    same(observed,[{changes:1}]);assert.equal(connections.size,1);const connection=[...connections][0];assert.equal(changes(connection),1);assert.equal(connection.isTransaction,false);assert.equal(authorityReads,1);
    const expectedRows=before.rows.map(r=>r.table==='reserved_pa_execution_views'?{table:r.table,rows:[{__ack_rowid:1,...samePaExecutionRow(view)}]}:r);
    withSqliteReadTransaction(observer,()=>{same(rawCensus(observer),expectedRows);same(schemaCensus(observer),before.schema);
      for(const p of before.enrollment.participants)assert.throws(()=>assertNoSamePaPlayerReservation(observer,p.binding),/blocks new global Player workload/);
      assert.throws(()=>assertNoSamePaWorkReservation(observer,{gameId:before.enrollment.gameId,playId:before.enrollment.playId,physicalPitchSourceId:before.enrollment.source.firstPhysicalPitchSourceId}),/blocks.*causal work/);assert.equal(changes(observer),0);});
    const viewReference=samePaExecutionReference('reserved_pa_execution_views',view);
    checkpoint('view-returned-and-asserted',{view,viewReference,totalChanges:1,newViewRows:1,originalRowsAndRowidsPreserved:true,assertedRowsHash:hash(expectedRows),assertedSchemaHash:hash(before.schema),handlesStillOpen:true});
    checkpoint('retry-started',{viewReference,totalChanges:1});same(writer.acceptView(source.sourceId),view);assert.equal(authorityReads,2);assert.equal(changes(connection),1);assert.equal(observed.length,1);
    same(rawCensus(observer),expectedRows);same(schemaCensus(observer),before.schema);checkpoint('retry-returned-and-asserted',{viewReference,authorityReads,totalChanges:1,exactRetry:true,handlesStillOpen:true});
    while(witnesses.length)witnesses.pop()!.close();observer.close();writer.close();writer=null;assert.equal(connection.isOpen,false);closed(input.destinationPath);const committedHash=fileHash(input.destinationPath);
    checkpoint('writer-closed',{destinationSha256:committedHash,closedHandles:true,closedSidecars:true});checkpoint('reopen-started',{destinationSha256:committedHash,viewReference,authorityFree:true});
    const reopened=openSqliteSamePlateAppearanceExecutionStore(input.destinationPath);try{same(reopened.readView(source.sourceId),view);}finally{reopened.close();}
    const final=open();try{withSqliteReadTransaction(final,()=>{same(rawCensus(final),expectedRows);same(schemaCensus(final),before.schema);assert.equal(changes(final),0);});}finally{final.close();}
    assert(observers.every(db=>!db.isOpen));assert([...connections].every(db=>!db.isOpen));closed(input.destinationPath);assert.equal(fileHash(input.destinationPath),committedHash);closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
    for(const ref of [{path:input.inputPath,sha256:input.inputSha256},packet.qualifiedTotalManifest,packet.sourceCheckpoint,packet.approvedContract,...Object.values(qualified.qualification)])assert.equal(fileHash(ref.path),ref.sha256);
    checkpoint('readback-closed-and-asserted',{destinationSha256:committedHash,viewReference,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,callbackFreeReadOnlyReopen:true});
    return {version:'same_pa_genuine_execution_view_receipt_v1',input:{path:input.inputPath,sha256:input.inputSha256},qualifiedTotalManifest:packet.qualifiedTotalManifest,
      sourceArtifact:qualified.artifact,destinationPath:input.destinationPath,destinationSha256:committedHash,viewReference,view,writerObservation:{nativeConnections:1,totalChanges:1,statements:observed},authorityReads,
      newViewRows:1,newTotalRows:0,newPrefixRows:0,newTables:0,newAutoindexes:0,originalRowsAndRowidsPreserved:true,actualFatiguePreserved:true,projectedRevisionOnly:true,
      exactRetry:true,callbackFreeReadOnlyReopen:true,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,globalWorkloadRowsChanged:0,
      physicalPitchWriterInvoked:false,firstPitchSlotConsumed:false,successorRightReleased:false,reservationReleased:false,executionViewQualified:true,physicalExecutionQualified:false,fixtureOnly:true,productionCalibrationClaim:false};
  }finally{while(witnesses.length)witnesses.pop()!.close();writer?.close();for(const db of observers)if(db.isOpen)db.close();}
};
