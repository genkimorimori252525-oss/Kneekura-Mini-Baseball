import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants,copyFileSync,existsSync,readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { samePlateAppearanceEnrollmentInput,type AcceptedSamePlateAppearanceEnrollment,type SamePlateAppearanceBaselineReference } from './SamePlateAppearanceEnrollment';
import { assertSamePaStorage,authenticateSamePaRow,samePaSchema,samePaMember,samePaSlot,
  assertNoSamePaPlayerReservation,assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { fileHash,rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

type FileReference=Readonly<{path:string;sha256:string}>;
type QualifiedBaseline=Readonly<{
  version:'same_pa_baseline_qualified_input_v1';qualified:true;artifact:FileReference;
  qualification:Readonly<Record<string,FileReference>>;
  actorReference:AcceptedSamePlateAppearanceEnrollment['actorReference'];
  participantBaselineReferences:readonly SamePlateAppearanceBaselineReference[];
  enrollmentQualified:false;physicalExecutionQualified:false;resumeQualified:false;
}>;
type ReservationInput=Readonly<{
  version:'same_pa_reservation_proposed_input_v1';qualifiedBaselineManifest:FileReference;
  enrollmentSource:AcceptedSamePlateAppearanceEnrollment;fixtureOnly:true;
}>;
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const same=(actual:unknown,expected:unknown)=>assert.equal(json(actual),json(expected));
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'reservation artifact has a sidecar: '+suffix);};
const readPinned=<T>(ref:FileReference):T=>{const bytes=readFileSync(ref.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);return JSON.parse(bytes.toString('utf8')) as T;};
const totalChanges=(db:DatabaseSync)=>{const value=db.prepare('SELECT total_changes() AS n').get()!.n;assert.equal(typeof value,'number');return value as number;};
const ownerTables=Object.keys(samePaSchema);
const row=(value:Record<string,unknown>,rowid:number)=>({__ack_rowid:rowid,...value});
const sortRows=<T extends {table:unknown}>(rows:T[])=>rows.sort((a,b)=>String(a.table)<String(b.table)?-1:String(a.table)>String(b.table)?1:0);

/** Real Native owner qualification. Only an exclusive copy receives its twelve
 * reservation inserts; every prerequisite is authenticated by the runtime owner.
 * This fixture gate never invokes a physical executor or mutates prior owners. */
export const verifyGenuineSamePaReservation=(input:Readonly<{inputPath:string;inputSha256:string;destinationPath:string}>)=>{
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS,'private bounded controller required');
  const packet=readPinned<ReservationInput>({path:input.inputPath,sha256:input.inputSha256});
  assert.equal(packet.version,'same_pa_reservation_proposed_input_v1');assert.equal(packet.fixtureOnly,true);
  const qualified=readPinned<QualifiedBaseline>(packet.qualifiedBaselineManifest);
  assert.equal(qualified.version,'same_pa_baseline_qualified_input_v1');assert.equal(qualified.qualified,true);
  assert.equal(qualified.enrollmentQualified,false);assert.equal(qualified.physicalExecutionQualified,false);assert.equal(qualified.resumeQualified,false);
  for(const ref of Object.values(qualified.qualification))assert.equal(fileHash(ref.path),ref.sha256);
  const baseline=readPinned<{
    version:string;destinationPath:string;destinationSha256:string;actorReference:QualifiedBaseline['actorReference'];
    participantBaselineReferences:QualifiedBaseline['participantBaselineReferences'];reservationAttempted:boolean;
    closedHandles:boolean;closedSidecars:boolean;exactRetry:boolean;callbackFreeReadOnlyReopen:boolean;
  }>(qualified.qualification.receipt);
  assert.equal(baseline.version,'same_pa_away2_baseline_prerequisite_v1');assert.equal(baseline.reservationAttempted,false);
  for(const key of ['closedHandles','closedSidecars','exactRetry','callbackFreeReadOnlyReopen'] as const)assert.equal(baseline[key],true);
  same(qualified.artifact,{path:baseline.destinationPath,sha256:baseline.destinationSha256});
  same(qualified.actorReference,baseline.actorReference);same(qualified.participantBaselineReferences,baseline.participantBaselineReferences);
  const terminal=readPinned<{status:string;originalChildExit:number;remainingOwnedProcesses:unknown[];failures:unknown[];tests:{passedCases:number;reportSha256:string}}>(qualified.qualification.nativeTerminal);
  assert.equal(terminal.status,'passed');assert.equal(terminal.originalChildExit,0);same(terminal.remainingOwnedProcesses,[]);same(terminal.failures,[]);
  assert.equal(terminal.tests.passedCases,1);assert.equal(terminal.tests.reportSha256,qualified.qualification.report.sha256);
  const source=samePlateAppearanceEnrollmentInput(packet.enrollmentSource);
  same(source.actorReference,qualified.actorReference);same(source.participantBaselineReferences,qualified.participantBaselineReferences);
  const sourcePath=qualified.artifact.path;assert.notEqual(sourcePath,input.destinationPath);assert(!existsSync(input.destinationPath));
  closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
  copyFileSync(sourcePath,input.destinationPath,constants.COPYFILE_EXCL);assert.equal(fileHash(input.destinationPath),qualified.artifact.sha256);
  const observers:DatabaseSync[]=[],openObserver=()=>{const db=new NativeDatabase(input.destinationPath);observers.push(db);return db;};
  const observer=openObserver();let writer:ReturnType<typeof openSqliteSamePlateAppearanceEnrollmentStore>|null=null;
  const witnesses:ReturnType<typeof witnessSqliteWrite>[]=[];const writerConnections=new Set<DatabaseSync>();
  try{
    const before=withSqliteReadTransaction(observer,()=>{
      assert.equal(assertSamePaStorage(observer),false);return {rows:rawCensus(observer),schema:schemaCensus(observer)};
    });
    let authorityReads=0;
    writer=openSqliteSamePlateAppearanceEnrollmentStore(input.destinationPath,{readAcceptedEnrollment:sourceId=>{
      authorityReads++;assert.equal(sourceId,source.sourceId);return source;
    }});
    same(rawCensus(observer),before.rows);same(schemaCensus(observer),before.schema);
    const observed:{kind:string;changes:number}[]=[];
    for(const [kind,sql] of [
      ['root','INSERT INTO main.same_pa_enrollments VALUES(?,?,?,?,?,?,?,?,?,?)'],
      ['member','INSERT INTO main.same_pa_participant_reservations VALUES(?,?,?,?,?,?,?)'],
      ['slot','INSERT INTO main.same_pa_successor_rights VALUES(?,?,?,?,?,?,?,?)'],
    ] as const)witnesses.push(witnessSqliteWrite(sql,connection=>{
      assert(connection!==observer);assert(connection.isTransaction);assert.equal(connection.prepare('PRAGMA query_only').get()!.query_only,0);
      assert.equal(connection.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file,input.destinationPath);
      writerConnections.add(connection);observed.push({kind,changes:totalChanges(connection)});
      console.info('SP_RESERVATION_PROGRESS='+kind+' inserted; real owner reauthentication follows; changes='+totalChanges(connection));return true;
    }));
    console.info('SP_RESERVATION_PROGRESS=beginning real enrollment prerequisites and twelve owned inserts');
    const accepted=writer.accept(source.sourceId);assert.equal(accepted.kind,'reserved');
    if(accepted.kind!=='reserved')throw new Error('qualified exact ten baselines unexpectedly pending');
    same(accepted.source,source);same(accepted.firstPitch,{physicalPitchSourceId:source.firstPhysicalPitchSourceId,state:'blocked_execution_basis',predecessorResumeSourceId:null,consumingSourceId:null});
    same([...accepted.participants.map(p=>({playerId:p.binding.playerId,baselineSourceId:p.baselineSourceId,revision:p.state.revision,stateHash:hash(p.state)}))].sort((a,b)=>a.playerId.localeCompare(b.playerId)),
      [...source.participantBaselineReferences].sort((a,b)=>a.playerId.localeCompare(b.playerId)));
    same(observed,[{kind:'root',changes:1},...Array.from({length:10},(_,i)=>({kind:'member',changes:i+2})),{kind:'slot',changes:12}]);
    assert.equal(writerConnections.size,1);const connection=[...writerConnections][0];
    assert.equal(connection.isTransaction,false);assert.equal(connection.prepare('PRAGMA query_only').get()!.query_only,0);assert.equal(totalChanges(connection),12);
    const root={source_id:source.sourceId,career_id:accepted.careerId,game_id:accepted.gameId,play_id:accepted.playId,
      actor_source_id:source.actorReference.sourceId,first_pitch_source_id:source.firstPhysicalPitchSourceId,
      source_json:json(source),source_hash:hash(source),snapshot_json:json(accepted),snapshot_hash:hash(accepted)};
    const members=accepted.participants.map((p,i)=>{const m=samePaMember(accepted,p);return row({
      enrollment_source_id:source.sourceId,career_id:accepted.careerId,player_id:m.playerId,baseline_source_id:m.baselineSourceId,
      revision:m.revision,state_hash:m.stateHash,member_json:json(m)},i+1);});
    const slot={enrollment_source_id:source.sourceId,first_pitch_source_id:source.firstPhysicalPitchSourceId,
      game_id:accepted.gameId,play_id:accepted.playId,state:'blocked_execution_basis',predecessor_resume_source_id:null,consuming_source_id:null,slot_json:json(samePaSlot(accepted))};
    const expectedRows=sortRows([...before.rows,{table:ownerTables[0],rows:[row(root,1)]},{table:ownerTables[1],rows:members},{table:ownerTables[2],rows:[row(slot,1)]}]);
    const afterSchema=withSqliteReadTransaction(observer,()=>{
      assert.equal(assertSamePaStorage(observer),true);same(authenticateSamePaRow(observer,root),accepted);same(rawCensus(observer),expectedRows);
      const schema=schemaCensus(observer),added=schema.main.filter(r=>ownerTables.includes(String(r.tbl_name)));
      same(schema.main.filter(r=>!ownerTables.includes(String(r.tbl_name))),before.schema.main);
      same(schema.temp,before.schema.temp);assert.equal(schema.mainVersion,Number(before.schema.mainVersion)+3);
      assert.equal(schema.tempVersion,before.schema.tempVersion);assert.equal(schema.userVersion,before.schema.userVersion);assert.equal(added.length,12);
      for(const [table,count] of [[ownerTables[0],4],[ownerTables[1],2],[ownerTables[2],3]] as const){
        const objects=added.filter(r=>r.tbl_name===table);assert.equal(objects.length,count+1);
        const tableRow=objects.find(r=>r.type==='table');assert(tableRow);assert.equal(tableRow.name,table);assert.equal(tableRow.sql,samePaSchema[table as keyof typeof samePaSchema]);
        same(objects.filter(r=>r.type==='index').map(r=>({name:r.name,sql:r.sql})),Array.from({length:count},(_,i)=>({name:'sqlite_autoindex_'+table+'_'+(i+1),sql:null})));
      }
      for(const p of accepted.participants)assert.throws(()=>assertNoSamePaPlayerReservation(observer,p.binding),/blocks new global Player workload/);
      assert.throws(()=>assertNoSamePaWorkReservation(observer,{gameId:accepted.gameId,playId:accepted.playId,physicalPitchSourceId:source.firstPhysicalPitchSourceId}),/blocks causal work/);
      assert.equal(totalChanges(observer),0);return schema;
    });
    console.info('SP_RESERVATION_PROGRESS=exact twelve writes verified; retrying original Source');
    same(writer.accept(source.sourceId),accepted);assert.equal(authorityReads,2);assert.equal(observed.length,12);assert.equal(totalChanges(connection),12);
    same(rawCensus(observer),expectedRows);same(schemaCensus(observer),afterSchema);
    while(witnesses.length)witnesses.pop()!.close();
    observer.close();writer.close();writer=null;assert.equal(connection.isOpen,false);closed(input.destinationPath);
    const committedHash=fileHash(input.destinationPath);
    console.info('SP_RESERVATION_PROGRESS=zero-write retry closed; normal authority-free reopen');
    const reopened=openSqliteSamePlateAppearanceEnrollmentStore(input.destinationPath);
    try{same(reopened.read(source.sourceId),accepted);}finally{reopened.close();}
    const finalObserver=openObserver();try{withSqliteReadTransaction(finalObserver,()=>{
      same(rawCensus(finalObserver),expectedRows);same(schemaCensus(finalObserver),afterSchema);assert.equal(totalChanges(finalObserver),0);
    });}finally{finalObserver.close();}
    assert(observers.every(db=>!db.isOpen));assert([...writerConnections].every(db=>!db.isOpen));closed(input.destinationPath);
    assert.equal(fileHash(input.destinationPath),committedHash);closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
    assert.equal(fileHash(input.inputPath),input.inputSha256);assert.equal(fileHash(packet.qualifiedBaselineManifest.path),packet.qualifiedBaselineManifest.sha256);
    for(const ref of Object.values(qualified.qualification))assert.equal(fileHash(ref.path),ref.sha256);
    return {version:'same_pa_genuine_reservation_receipt_v1',input:{path:input.inputPath,sha256:input.inputSha256},
      qualifiedBaselineManifest:packet.qualifiedBaselineManifest,sourceArtifact:qualified.artifact,destinationPath:input.destinationPath,destinationSha256:committedHash,
      enrollmentSource:source,enrollmentSourceHash:hash(source),enrollmentSnapshotHash:hash(accepted),
      enrollmentReference:{owner:'same_pa_enrollments',sourceId:source.sourceId,sourceHash:hash(source),snapshotHash:hash(accepted)},
      actorReference:source.actorReference,participantBaselineReferences:source.participantBaselineReferences,
      firstPitch:accepted.firstPitch,writerObservation:{nativeConnections:writerConnections.size,statements:observed,totalChanges:12},
      authorityReads,exactRetry:true,callbackFreeReadOnlyReopen:true,originalRowsAndRowidsPreserved:true,
      newRootRows:1,newMemberRows:10,newBlockedSlotRows:1,newTables:3,newAutoindexes:9,globalWorkloadRowsChanged:0,
      closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,physicalPitchWriterInvoked:false,
      firstPitchSlotConsumed:false,successorRightReleased:false,reservationReleased:false,fixtureOnly:true,productionCalibrationClaim:false};
  }finally{
    while(witnesses.length)witnesses.pop()!.close();writer?.close();for(const db of observers)if(db.isOpen)db.close();
  }
};
