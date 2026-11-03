import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { deepStrictEqual,strictEqual } from 'node:assert';
import { readObservedInitialPitchOperationFromSqlite } from '../../../src/host/world/SqliteObservedInitialPitchStore';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readAuthoredNativeMatchV1 } from '../../../src/integration/native-game/AuthoredNativeMatchV1';
import { readSamePaObservedPitchFromSqlite } from '../../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { playerBattingModelEvidenceFromSqlite } from '../../../src/host/world/PlayerBattingModelEvidence';
import { withBodyCompositionTransaction } from '../../../src/host/world/BodyMaterializationSqliteOwnership';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
const [databasePath,expectedPath,reportPath,authoredManifestPath]=process.argv.slice(2);if(!databasePath||!expectedPath||!reportPath)throw new Error('requires database expected report');
const sqlite=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),Native=sqlite.DatabaseSync;
const sha=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
const durableFiles=()=>Object.fromEntries(['','-wal'].map(suffix=>[suffix||'main',existsSync(databasePath+suffix)?sha(readFileSync(databasePath+suffix)):null]));
const beforeDurableFiles=durableFiles(),beforeFileHash=sha(readFileSync(databasePath)),db=new Native(databasePath,{readOnly:true});
try{
  const audit=(target=db)=>{
    strictEqual(target.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
    const schemas=target.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const rows=target.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t=>[t.name,
      target.prepare('SELECT * FROM "'+String(t.name).replaceAll('"','""')+'"').all().map(r=>JSON.stringify(r)).sort()]);return {schemas,rows};
  };
  const before=audit(),expected=JSON.parse(readFileSync(expectedPath,'utf8'));
  const authoredManifest=authoredManifestPath?JSON.parse(readFileSync(authoredManifestPath,'utf8')):null;
  // Legacy genesis facade constructors negotiate journal mode even for read
  // methods. Authenticate their result on an exact Native backup, keeping the
  // actual subject DB and its WAL strictly unchanged. All other proofs below
  // use the original OS-read-only connection, with no author callbacks.
  const facadePath=reportPath+'.authored-genesis.sqlite';
  if(authoredManifest){
    strictEqual(existsSync(facadePath),false);await sqlite.backup(db,facadePath);
    const copy=new Native(facadePath,{readOnly:true});try{deepStrictEqual(audit(copy),before);}finally{copy.close();}
  }
  const authored=authoredManifest?readAuthoredNativeMatchV1(facadePath,authoredManifest.authoredGenesisReadPins):null;
  if(authoredManifest){const copy=new Native(facadePath,{readOnly:true});try{deepStrictEqual(audit(copy),before);}finally{copy.close();}}
  const model=authoredManifest?withBodyCompositionTransaction(db,false,()=>playerBattingModelEvidenceFromSqlite(db).read(authoredManifest.battingModelReference.sourceId)):null;
  if(authoredManifest){if(!model||!authored)throw new Error('authored original model or genesis missing');
    strictEqual(authored.models.length,18);deepStrictEqual(reference('world_player_batting_models',model),authoredManifest.battingModelReference);}
  db.exec('PRAGMA query_only=1; BEGIN');
  const records=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>expected.references.map((ref:any)=>readObservedInitialPitchOperationFromSqlite(db,ref))));
  let initialBatEquipmentOwned=false;
  if(authoredManifest){
    const launch=withBattedWorldPhysicalReadTraversal(db,()=>readSamePaObservedPitchFromSqlite(db,records[0].source.launchReference));
    deepStrictEqual(JSON.parse(JSON.stringify(launch.pitch.originalActor)),JSON.parse(JSON.stringify(authored!.actor)));deepStrictEqual(launch.action.source.batterModelReference,authoredManifest.battingModelReference);
    strictEqual(!!model!.repertoire.values.sampledProfiles?.length,true);
    initialBatEquipmentOwned=launch.pitch.initialLiveBallBinding.kind==='same_pa_observed_initial_pitch_live_binding_v2';
  }
  deepStrictEqual(JSON.parse(JSON.stringify(records)),expected.records);db.exec('COMMIT');deepStrictEqual(audit(),before);
  const afterFileHash=sha(readFileSync(databasePath));strictEqual(afterFileHash,beforeFileHash);
  const afterDurableFiles=durableFiles();
  // OS-read-only SQLite can create an empty WAL/SHM read index in a writable
  // directory. An absent WAL and a ZERO-byte WAL both contain no durable
  // transaction. A header/frame change remains a failure, including page 1.
  const content=(files:ReturnType<typeof durableFiles>)=>({...files,'-wal':files['-wal']===sha(new Uint8Array())?null:files['-wal']});
  deepStrictEqual(content(afterDurableFiles),content(beforeDurableFiles));
  const initialDecision=records.find((r:any)=>r.kind==='observed_initial_decision_v1');
  const initialPitchRows=initialDecision?Number(db.prepare('SELECT COUNT(*) n FROM pa_dispatch_v1_pitch_actions WHERE enrollment_source_id=?')
    .get(initialDecision.lineage.enrollmentReference.sourceId)!.n):null;
  if(initialDecision)strictEqual(initialPitchRows,1);
  const report={status:'PASS_INDEPENDENT_NATIVE_INITIAL_CUT_REOPEN',ownerMocks:false,authorCallbacks:false,
    outerConnectionReadOnly:true,ownedFacadeConnectionsUsed:false,
    authoredGenesisProofFrom:authoredManifest?'schema_and_all_rows_identical_private_native_backup':null,schemasAndAllRowsUnchanged:true,
    beforeDurableFiles,afterDurableFiles,durableFilesUnchanged:JSON.stringify(beforeDurableFiles)===JSON.stringify(afterDurableFiles),
    durableContentUnchanged:true,emptyWalReadIndexOnly:JSON.stringify(beforeDurableFiles)!==JSON.stringify(afterDurableFiles),
    tableCount:before.rows.length,beforeFileHash,afterFileHash,logicalSha256:sha(JSON.stringify(before)),expectedSha256:sha(readFileSync(expectedPath)),
    actualCuts:records.filter((r:any)=>r.kind==='observed_initial_cut_v1').length,actualCaptures:records.filter((r:any)=>r.kind==='observed_initial_capture_v1').length,
    sensoryDeliveryAdmitted:records.some((r:any)=>r.kind==='observed_initial_delivery_v1'),observedPredictionAdmitted:records.some((r:any)=>r.kind==='observed_initial_prediction_v1'),
    fresh18PersonGenesis:!!authored,measuredBattingModelInSameDatabase:!!model?.repertoire.values.sampledProfiles?.length,
    initialBatEquipmentOwned,
    originalMeasuredKeys:model?.repertoire.values.sampledProfiles?.reduce((n,p)=>n+p.measured.frames.length,0)??0,
    measuredMotorPrepared:records.some((r:any)=>r.kind==='observed_initial_motor_preparation_v1'),
    initialBattingDecision:initialDecision?.calculation.commitment?.action??null,initialNativePitchRows:initialPitchRows,
    measuredBattingAdmitted:false,fullMatchVerified:false};
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify(report)+'\n');
}finally{db.close();}
