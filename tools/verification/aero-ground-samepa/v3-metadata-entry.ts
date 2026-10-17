import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../../src/host/world/SqliteSamePlateAppearancePhysicalEpisodeStore';
import { openSqliteSamePlateAppearanceLifecycleStore } from '../../../src/host/world/SqliteSamePlateAppearanceLifecycleStore';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';
import { SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as STEP } from '../../../src/host/world/SamePlateAppearanceBallPhysics';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalOperationReference } from '../../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaReference } from '../../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { SamePaLifecycleCalibration } from '../../../src/host/world/SamePlateAppearanceLifecycleCalibration';
import { SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION } from '../../../src/host/world/SamePlateAppearanceLifecycleCalibrationSource';
import { projectObservationClockV1 } from '../../../src/core/sim/perception/ObservationClockProjectionV1';

/** Explicit preparation tool, never a live-branch runner. The supplied manifest
 * pins a CLOSED snapshot. Every writer receives only this tool's private copy.
 * Stages are separate processes so final `reopen` has no prior owner/session. */
type Manifest = Readonly<{ databasePath: string; sourceMapPath: string; databaseHash: string; sourceMapHash: string;
  rootReference: SamePaReference<'pa_physical_v1_field_roots'>;
  stepReference: SamePaReference<'pa_physical_v1_field_steps'>;
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'> }>;
type RowPin = { rowid: number; sourceId: string|null; hash: string };
type Pins = { schemaHash: string; tables: Record<string, RowPin[]> };
const [manifestArgument, outputArgument, stage='prepare',namespace='v3-metadata-clock-v1'] = process.argv.slice(2);
assert.ok(manifestArgument && outputArgument, 'manifest JSON and a new independent output directory required');
assert.ok(['prepare','advance','calibrate','admit','reopen'].includes(stage));
assert.match(namespace,/^[a-z][a-z0-9-]{2,80}$/);
const manifestPath=resolve(manifestArgument), manifest=JSON.parse(readFileSync(manifestPath,'utf8')) as Manifest;
const inputDb=resolve(manifest.databasePath), inputMap=resolve(manifest.sourceMapPath), out=resolve(outputArgument);
assert.ok(out!==dirname(inputDb) && !out.startsWith(dirname(inputDb)+'\\') && !out.startsWith(dirname(inputDb)+'/'), 'output must be outside the immutable snapshot directory');
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const originalUnchanged=()=>{assert.equal(sha(inputDb),manifest.databaseHash);assert.equal(sha(inputMap),manifest.sourceMapHash);};
originalUnchanged();mkdirSync(out,{recursive:true});
const path=join(out,'v3-metadata.sqlite'), mapPath=join(out,'accepted-sources.json');
assert.notEqual(path,inputDb);assert.notEqual(mapPath,inputMap);
const atomic=(file:string,value:unknown)=>{const pending=file+'.pending-'+process.pid;writeFileSync(pending,JSON.stringify(value,null,2),{flag:'wx'});renameSync(pending,file);};
if(stage==='prepare'){
  assert.ok(!existsSync(path)&&!existsSync(mapPath),'prepare never overwrites a prior proof copy');
  copyFileSync(inputDb,path,constants.COPYFILE_EXCL);copyFileSync(inputMap,mapPath,constants.COPYFILE_EXCL);
}else assert.ok(existsSync(path)&&existsSync(mapPath),'run prepare first');
const sources=new Map<string,unknown>(JSON.parse(readFileSync(mapPath,'utf8')));
const originals=new Map<string,unknown>(JSON.parse(readFileSync(inputMap,'utf8')));
const oldSourcesUnchanged=()=>{for(const [id,source]of originals)assert.deepEqual(sources.get(id),source);};
oldSourcesUnchanged();
const publish=<T extends {sourceId:string}>(source:T):T=>{const old=sources.get(source.sourceId);if(old)assert.deepEqual(old,source);else sources.set(source.sourceId,source);atomic(mapPath,[...sources]);return source;};
const raw=new DatabaseSync(path,{readOnly:true});
const rows=(db=raw):Pins=>{
  const schema=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const tables:Record<string,RowPin[]>={};
  for(const row of schema){const name=String(row.name);assert.match(name,/^[A-Za-z_][A-Za-z_0-9]*$/);
    tables[name]=db.prepare('SELECT rowid AS proof_rowid,* FROM '+name+' ORDER BY rowid').all().map(value=>({rowid:Number(value.proof_rowid),
      sourceId:typeof value.source_id==='string'?value.source_id:null,hash:hash(value)}));}
  return {schemaHash:hash(schema),tables};
};
const delta=(before:Pins,after:Pins,allowed:Record<string,readonly string[]>={},modified:Record<string,readonly RowPin[]>={})=>{
  assert.equal(after.schemaHash,before.schemaHash,'no DDL/schema change permitted');assert.deepEqual(Object.keys(after.tables),Object.keys(before.tables));
  for(const [table,old]of Object.entries(before.tables)){
    const current=after.tables[table];for(const row of old)assert.deepEqual(current.find(r=>r.rowid===row.rowid),modified[table]?.find(r=>r.rowid===row.rowid)??row,'existing row changed: '+table);
    const added=current.filter(r=>!old.some(previous=>previous.rowid===r.rowid));
    assert.deepEqual(added.map(r=>r.sourceId).sort(),[...(allowed[table]??[])].sort(),'unexpected row delta: '+table);
  }
};
const rowReference=(table:string,id:string)=>{const row=raw.prepare('SELECT source_hash,snapshot_hash FROM '+table+' WHERE source_id=?').get(id);assert.ok(row);return {owner:table,sourceId:id,sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)};};
const operationId=namespace+':observation:0';
const currentRef=():Manifest['viewReference']=>existsSync(join(out,'advance.json'))
  ?JSON.parse(readFileSync(join(out,'advance.json'),'utf8')).viewReference:manifest.viewReference;
const readBasis=(historical=false)=>withSqliteReadTransaction(raw,()=>(historical?readHistoricalSamePaLifecycleViewFromSqlite:readCurrentSamePaLifecycleViewFromSqlite)(raw,currentRef()));
const proofPath=(name:string)=>join(out,name+'.json');
const pendingProofs:{name:string;value:object}[]=[];
const writeProof=(name:string,value:object)=>{pendingProofs.push({name,value});};
// Hash receipts only after every owned connection is closed. In WAL mode the
// main file can otherwise omit the just-committed original-owner admission.
const flushProofs=(finalRows:Pins)=>{for(const {name,value}of pendingProofs){oldSourcesUnchanged();originalUnchanged();
  const checkpoint=join(out,'closed-'+name+'-'+process.pid);mkdirSync(checkpoint,{recursive:false});
  const checkpointPath=join(checkpoint,'checkpoint.sqlite'),checkpointMap=join(checkpoint,'accepted-sources.json');
  const original=new DatabaseSync(path,{readOnly:true});try{assert.deepEqual(rows(original),finalRows);original.prepare('VACUUM INTO ?').run(checkpointPath);}finally{original.close();}
  const closed=new DatabaseSync(checkpointPath,{readOnly:true});try{assert.deepEqual(rows(closed),finalRows);assert.equal(closed.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');}finally{closed.close();}
  copyFileSync(mapPath,checkpointMap,constants.COPYFILE_EXCL);
  const closedCheckpoint={directory:checkpoint,databasePath:checkpointPath,sourceMapPath:checkpointMap,databaseHash:sha(checkpointPath),sourceMapHash:sha(checkpointMap),allRowsAndSchemaEqual:true};
  atomic(join(checkpoint,'manifest.json'),{...closedCheckpoint,stage,name,namespace,bodyExecution:false,officialResult:null});
  atomic(proofPath(name),{...value,stage,pid:process.pid,manifestHash:sha(manifestPath),namespace,closedCheckpoint,
  databaseHash:sha(path),sourceMapHash:sha(mapPath),originalDatabaseHash:sha(inputDb),originalSourceMapHash:sha(inputMap),
  closedDatabaseFiles:{main:sha(path),wal:existsSync(path+'-wal')?sha(path+'-wal'):null},
  oldSourcesUnchanged:true,bodyExecution:false,teamExecutionCredit:0,officialResult:null});}};
const physical=()=>openSqliteSamePlateAppearancePhysicalEpisodeStore(path,{readAcceptedOperation:id=>sources.get(id)});
const lifecycle=()=>openSqliteSamePlateAppearanceLifecycleStore(path,{readAcceptedPrefix:id=>sources.get(id),readAcceptedTotal:id=>sources.get(id),
  readAcceptedView:id=>sources.get(id),readAcceptedCalibration:id=>sources.get(id)});
const pinPhysical=(root:SamePaPhysicalFieldRoot,step:SamePaPhysicalFieldStep)=>{
  assert.equal(root.source.sourceVersion,ROOT);assert.equal(step.source.sourceVersion,STEP);assert.equal(step.source.action,undefined);
  assert.deepEqual(step.source.fieldRootReference,manifest.rootReference);assert.deepEqual(step.lineage,root.lineage);
  const motion=step.field.motion,cursor=motion.cursor;assert.ok(cursor?.sourceCurve);assert.equal(motion.carrierPlayerId,null);
  assert.ok(cursor.sourceSide==='incoming'||cursor.sourceSide==='outgoing');assert.deepEqual(cursor.sourceCurve.profile,root.source.ballPhysics);
  assert.deepEqual(createSourceFreeBallKernel(cursor.sourceCurve).evaluateAt(cursor.moment.elapsedSeconds,cursor.sourceSide).moment,cursor.moment);
  assert.equal(step.ballSolverEvidence?.solverVersion,'source_field_contact_escape_v3');
  return {rootReference:manifest.rootReference,stepReference:manifest.stepReference,exactCursor:cursor,worldMoment:motion.world.moment,
    fieldHash:hash(step.field),timelineHash:hash(step.timeline),evaluationTick:step.evaluationTick,solverEvidenceHash:hash(step.ballSolverEvidence)};
};
// Preserve the first attempted stage's exact row baseline. An interrupted
// original-owner write can be resumed without pretending its rows are new again.
const beforePath=proofPath('before-'+stage),observedBefore=rows();
const before: Pins=existsSync(beforePath)?JSON.parse(readFileSync(beforePath,'utf8')):observedBefore;
if(!existsSync(beforePath))atomic(beforePath,before);
const started=Date.now();
try{
  assert.equal(raw.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
  if(stage==='prepare'){
    const owner=physical();try{
      const root=owner.readOperation(manifest.rootReference).record,step=owner.readOperation(manifest.stepReference).record;
      assert.equal(root.kind,'same_pa_physical_field_root_v1');assert.equal(step.kind,'same_pa_physical_field_step_v1');
      if(root.kind!=='same_pa_physical_field_root_v1'||step.kind!=='same_pa_physical_field_step_v1')throw new Error('original field kind differs');
      assert.deepEqual(originals.get(root.source.sourceId),root.source);assert.deepEqual(originals.get(step.source.sourceId),step.source);
      // The closed step may legitimately precede its lifecycle adoption. Read
      // that original view historically; do not call a stale view current.
      const basis=readBasis(true);assert.ok([manifest.rootReference.sourceId,manifest.stepReference.sourceId].includes(basis.view.cut.physicalOperationReference.sourceId));
      delta(before,rows());atomic(proofPath('initial-rows'),before);
      writeProof('prepare',{status:'PASS_ORIGINAL_V3_ROOT_STEP_OWNER_READ_PRIVATE_COPY',...pinPhysical(root,step),originalHistoricalViewReference:currentRef(),
        lifecycleCoversStep:basis.view.cut.physicalOperationReference.sourceId===manifest.stepReference.sourceId,
        sourceMapMayIncludePublishedUnadmittedDeclarations:true,elapsedMilliseconds:Date.now()-started});
    }finally{owner.close();}
  }else if(stage==='advance'){
    assert.ok(!existsSync(proofPath('advance')),'advance is a separately pinned one-time stage');
    const b=readBasis(true),prior=withSqliteReadTransaction(raw,()=>{
      const prefix=readSamePaLifecycleRecordFromSqlite(raw,'prefix',b.view.source.prefixReference.sourceId);assert.ok(prefix?.kind==='same_pa_lifecycle_prefix');
      const totals=readSamePaLifecycleSetFromSqlite(raw,'total',b.view.source.participantTotalReferences.map(r=>r.assessmentReference.sourceId));
      assert.ok(totals.every(t=>t?.kind==='same_pa_lifecycle_total'));return{prefix,totals};});
    assert.notEqual(b.view.cut.physicalOperationReference.sourceId,manifest.stepReference.sourceId,'current view already includes the step; use its pin without advancing again');
    const owner=lifecycle();try{
      const prefixSource=publish({...prior.prefix.source,sourceId:namespace+':cut13:prefix',sourceVersion:'explicit-synthetic-v3-metadata-proof-v1',eventReferences:[...prior.prefix.source.eventReferences,manifest.stepReference]});
      const prefix=owner.acceptPrefix(prefixSource.sourceId);assert.equal(prefix.kind,'same_pa_lifecycle_prefix');if(prefix.kind!=='same_pa_lifecycle_prefix')throw new Error('prefix pending');
      const prefixReference=reference('pa_lifecycle_v1_work_prefixes',prefix);
      const totals=prior.totals.map(t=>{assert.ok(t?.kind==='same_pa_lifecycle_total');return publish({...t.source,sourceId:namespace+':cut13:total:'+t.source.participantReference.playerId,
        sourceVersion:'explicit-synthetic-v3-metadata-proof-v1',prefixReference,provenance:{...t.source.provenance,assessmentSourceId:namespace+':cut13:assessment:'+t.source.participantReference.playerId,
          assessmentVersion:'explicit-synthetic-v3-metadata-proof-v1',calibrationSourceId:'original-cumulative-work-calculation-unchanged',calibrationVersion:'explicit-synthetic-v3-metadata-proof-v1'}});});
      const set=owner.acceptTotalSet(totals.map(t=>t.sourceId));assert.equal(set.kind,'same_pa_lifecycle_total_set');if(set.kind!=='same_pa_lifecycle_total_set')throw new Error('totals pending');
      const viewSource=publish({...b.view.source,sourceId:namespace+':cut13:view',sourceVersion:'explicit-synthetic-v3-metadata-proof-v1',prefixReference,participantTotalReferences:set.participantTotalReferences});
      const view=owner.acceptView(viewSource.sourceId);assert.equal(view.kind,'same_pa_lifecycle_view');if(view.kind!=='same_pa_lifecycle_view')throw new Error('view pending');
      assert.deepEqual(view.cut.physicalOperationReference,manifest.stepReference);
      delta(before,rows(),{pa_lifecycle_v1_work_prefixes:[prefixSource.sourceId],pa_lifecycle_v1_total_assessments:totals.map(t=>t.sourceId),pa_lifecycle_v1_execution_views:[viewSource.sourceId]});
      writeProof('advance',{status:'PASS_ORIGINAL_OWNER_STEP_LIFECYCLE_ADOPTION',viewReference:reference('pa_lifecycle_v1_execution_views',view),priorViewReference:manifest.viewReference,elapsedMilliseconds:Date.now()-started});
    }finally{owner.close();}
  }else if(stage==='calibrate'){
    const b=readBasis();assert.deepEqual(b.view.cut.physicalOperationReference,manifest.stepReference);
    const previous=withSqliteReadTransaction(raw,()=>{
      const ids=raw.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(manifest.viewReference.sourceId).map(r=>String(r.source_id));assert.equal(ids.length,32);
      const values=readSamePaLifecycleSetFromSqlite(raw,'calibration',ids);assert.ok(values.every(c=>c?.kind==='same_pa_lifecycle_calibration'));return values as SamePaLifecycleCalibration[];
    });
    const prepared=JSON.parse(readFileSync(proofPath('prepare'),'utf8')),target=prepared.exactCursor.sourceCurve.profile.air.ticksPerSecond as number;
    const declarations=previous.map(c=>{const member=b.members.find(m=>m.playerId===c.source.member.playerId);assert.ok(member);
      const projection=c.source.route==='defender_observation'?{response:{kind:'accepted_execution_values_v1' as const,values:projectObservationClockV1(c.source.response.values,target)},
        observationClockProjection:{kind:'observation_clock_projection_v1' as const,originalNominalReference:c.source.nominalReference,
          originalEffectiveCalibrationReference:reference('pa_lifecycle_v1_execution_calibrations',c),fieldReference:manifest.stepReference}}:{};
      return publish({...c.source,sourceId:namespace+':cal:'+c.source.member.playerId+':'+c.source.route,
        sourceVersion:c.source.route==='defender_observation'?SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION:'explicit-synthetic-prior-values-v1',viewReference:currentRef(),member,
        provenance:{assessmentSourceId:namespace+':assessment:'+member.playerId+':'+c.source.route,assessmentVersion:'explicit-unit-projection-v1',calibrationSourceId:c.source.sourceId,calibrationVersion:c.source.sourceVersion},...projection});});
    const owner=lifecycle();try{
      const result=owner.acceptCalibrationSet(declarations.map(s=>s.sourceId));assert.equal(result.kind,'same_pa_lifecycle_calibration_set');
      if(result.kind!=='same_pa_lifecycle_calibration_set')throw new Error('calibrations pending');
      for(const [i,c]of result.calibrations.entries()){
        const original=previous[i];
        if(c.source.route==='defender_observation'&&original.source.route==='defender_observation'){
          assert.deepEqual(c.source.response.values,projectObservationClockV1(original.source.response.values,target));
          assert.equal(c.observationClockProjection?.authority,'UNIT_CONVERSION_NOT_ABILITY_CHANGE');
        }else assert.deepEqual(c.source.response,original.source.response);
      }
      delta(before,rows(),{pa_lifecycle_v1_execution_calibrations:declarations.map(s=>s.sourceId)});
      writeProof('calibrate',{status:'PASS_EXPLICIT_UNIT_PROJECTED_OBSERVATION_AND_PRIOR_OTHER_VALUES_ORIGINAL_CALIBRATION_OWNER',calibrationSourceIds:declarations.map(s=>s.sourceId),
        observationClockProjection:SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION,targetTicksPerSecond:target,siValuesUnchanged:true,
        originalCalibrationSourcesUnchanged:true,elapsedMilliseconds:Date.now()-started});
    }finally{owner.close();}
  }else if(stage==='admit'){
    const alreadySaved=raw.prepare('SELECT 1 FROM pa_physical_v1_field_steps WHERE source_id=?').get(operationId)!==undefined;
    const b=readBasis(alreadySaved);assert.deepEqual(b.view.cut.physicalOperationReference,manifest.stepReference);
    const owner=physical();try{
      const root=owner.readOperation(manifest.rootReference).record,previous=owner.readOperation(manifest.stepReference).record;
      assert.ok(root.kind==='same_pa_physical_field_root_v1'&&previous.kind==='same_pa_physical_field_step_v1');const pinned=pinPhysical(root,previous);
      const member=b.members.find(m=>b.actor.defenderBindings.some(d=>d.playerId===m.playerId));assert.ok(member);
      const calibrationRows=raw.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? AND player_id=? AND route=?').all(currentRef().sourceId,member.playerId,'defender_observation');assert.equal(calibrationRows.length,1);
      const calibration=JSON.parse(String(calibrationRows[0].snapshot_json)) as SamePaLifecycleCalibration;
      const cursor=previous.field.motion.cursor!,body=previous.field.motion.actors.find(a=>a.playerId===member.playerId&&a.primitive.role==='body');assert.ok(body);
      const dt=(cursor.moment.originTick-body.primitive.startTick)/root.response.world.parameters.ticksPerSecond+cursor.moment.elapsedSeconds-(body.startElapsedSeconds??0);
      const center=(axis:'x'|'y'|'z')=>body.primitive.startCenter[axis]+body.primitive.startVelocity[axis]*dt+.5*body.primitive.acceleration[axis]*dt*dt;
      // Explicit synthetic gaze fixture only; this is not a calibrated tactical policy.
      const source=publish({sourceId:operationId,sourceVersion:STEP,capability:'same_pa_physical_field_step_v1',viewReference:currentRef(),launchReference:previous.source.launchReference,
        previousOperationReference:manifest.stepReference,previousFieldReference:manifest.stepReference,fieldRootReference:manifest.rootReference,throughTick:previous.evaluationTick,
        action:{kind:'defender_observation_v1',member,calibrationReference:reference('pa_lifecycle_v1_execution_calibrations',calibration),previousObservationReference:null,
          view:{poseVersion:'explicit-current-ball-directed-synthetic-fixture-v1',bodyRelativeEyeOffset:{x:0,y:.6,z:0},attentionTarget:{kind:'ball'},
            forward:{x:cursor.moment.ball.position.x-center('x'),y:cursor.moment.ball.position.y-center('y')-.6,z:cursor.moment.ball.position.z-center('z')}}}});
      const step=owner.acceptOperation(source.sourceId);assert.ok(step.kind==='same_pa_physical_field_step_v1');
      assert.deepEqual(step.field,previous.field);assert.deepEqual(step.timeline,previous.timeline);assert.equal(step.evaluationTick,previous.evaluationTick);
      assert.deepEqual(step.ballSolverEvidence,previous.ballSolverEvidence);assert.ok(step.actionResult?.kind==='defender_observation_v1');
      assert.deepEqual(step.actionResult.receipt.at,{originTick:cursor.moment.originTick,elapsedSeconds:cursor.moment.elapsedSeconds,tick:cursor.moment.ball.tick});
      // The original owner necessarily CASes its operation head. Check its exact
      // expected row separately; no archived physical/Source row may change.
      const head=raw.prepare('SELECT rowid AS proof_rowid,* FROM pa_physical_v1_heads WHERE enrollment_source_id=?').get(step.lineage.enrollmentReference.sourceId);assert.ok(head);
      const expectedHead={proof_rowid:head.proof_rowid,enrollment_source_id:step.lineage.enrollmentReference.sourceId,career_id:step.lineage.careerId,
        game_id:step.lineage.gameId,play_id:step.lineage.playId,pitch_ordinal:step.pitchOrdinal,launch_source_id:step.physicalPitchSourceId,
        operation_ordinal:step.operationOrdinal,last_owner:'pa_physical_v1_field_steps',last_source_id:operationId,last_snapshot_hash:hash(step)};
      assert.deepEqual({...head},expectedHead);
      delta(before,rows(),{pa_physical_v1_field_steps:[operationId]},{pa_physical_v1_heads:[{rowid:Number(head.proof_rowid),sourceId:null,hash:hash(expectedHead)}]});
      writeProof('admit',{status:'PASS_ONE_V3_METADATA_NATIVE_OWNER_ADMISSION_COLD_REOPEN_REQUIRED',...pinned,metadataReference:reference('pa_physical_v1_field_steps',step),
        metadataHash:hash(step),newPhysicalRowCount:1,originalOwnerHeadCasCount:1,expectedHeadHash:hash(expectedHead),observationStatus:step.actionResult.receipt.results,elapsedMilliseconds:Date.now()-started});
    }finally{owner.close();}
  }else{
    const admitted=JSON.parse(readFileSync(proofPath('admit'),'utf8'));assert.notEqual(admitted.pid,process.pid,'cold reopen must use a fresh process');
    const owner=openSqliteSamePlateAppearancePhysicalEpisodeStore(path);try{
      const root=owner.readOperation(manifest.rootReference).record,previous=owner.readOperation(manifest.stepReference).record;
      assert.ok(root.kind==='same_pa_physical_field_root_v1'&&previous.kind==='same_pa_physical_field_step_v1');const pinned=pinPhysical(root,previous);
      const metadata=owner.readOperation(admitted.metadataReference as SamePaPhysicalOperationReference).record;assert.ok(metadata.kind==='same_pa_physical_field_step_v1');
      assert.equal(hash(metadata),admitted.metadataHash);assert.deepEqual(metadata.field,previous.field);assert.deepEqual(metadata.timeline,previous.timeline);
      assert.deepEqual(metadata.ballSolverEvidence,previous.ballSolverEvidence);assert.deepEqual(sources.get(metadata.source.sourceId),metadata.source);
      assert.deepEqual(readBasis(true).view.cut.physicalOperationReference,manifest.stepReference);
      const pin=rowReference('pa_physical_v1_field_steps',operationId);assert.deepEqual(pin,admitted.metadataReference);
      delta(before,rows());assert.equal(sha(path),admitted.databaseHash);
      writeProof('cold-reopen',{status:'PASS_ONE_V3_METADATA_ORIGINAL_NATIVE_OWNER_ADMISSION_AND_COLD_REOPEN',...pinned,metadataReference:pin,
        metadataHash:hash(metadata),admissionProcessId:admitted.pid,coldReopenProcessId:process.pid,sourceMapAuthorityNotUsedForReopen:true,
        lifecycleAfterMetadata:'NOT_ADVANCED',scheduler:'UNVERIFIED_RULES_SOURCE_GUARD_RETAINED',elapsedMilliseconds:Date.now()-started});
    }finally{owner.close();}
  }
  console.log(JSON.stringify({stage,status:'PASS',out,bodyExecution:false,officialResult:null}));
}catch(error){writeProof('failure-'+stage+'-'+Date.now(),{status:'FAIL_PRESERVED',message:String(error),stack:error instanceof Error?error.stack:null,elapsedMilliseconds:Date.now()-started});throw error;}
finally{const finalRows=rows();raw.close();flushProofs(finalRows);}
