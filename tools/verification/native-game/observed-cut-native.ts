import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,mkdirSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual,strictEqual,throws,notDeepStrictEqual } from 'node:assert';
import { openSqliteObservedInitialPitchStore,readObservedInitialPitchOperationFromSqlite,observedInitialOperations,type ObservedInitialSource } from '../../../src/host/world/SqliteObservedInitialPitchStore';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import type { SamePaObservedLaunchedPitch } from '../../../src/host/world/SamePlateAppearanceDispatchExecution';
import { readAuthoredNativeMatchV1 } from '../../../src/integration/native-game/AuthoredNativeMatchV1';
import { readSamePaObservedPitchFromSqlite } from '../../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { playerBattingModelEvidenceFromSqlite } from '../../../src/host/world/PlayerBattingModelEvidence';
import { withBodyCompositionTransaction } from '../../../src/host/world/BodyMaterializationSqliteOwnership';

const [inputArgument,outputArgument]=process.argv.slice(2);
if(!inputArgument||!outputArgument)throw new Error('requires immutable launch directory and new output directory');
const input=resolve(inputArgument),output=resolve(outputArgument),sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(input,'manifest.json'),'utf8'));
strictEqual(sha(readFileSync(resolve(input,'launch.sqlite'))),manifest.files['launch.sqlite']);
strictEqual(existsSync(resolve(input,'launch.sqlite-wal')),false);
mkdirSync(output);const path=resolve(output,'match.sqlite');copyFileSync(resolve(input,'launch.sqlite'),path);
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path);
const originalPitch=JSON.parse(readFileSync(resolve(input,'expected.json'),'utf8')) as SamePaObservedLaunchedPitch;
const launchReference=JSON.parse(readFileSync(resolve(input,'reference.json'),'utf8'));
const sources=new Map<string,ObservedInitialSource>(),owner=openSqliteObservedInitialPitchStore(path,{readAcceptedOperation:id=>sources.get(id)??null});
const census=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,
  db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(row=>JSON.stringify(row)).sort()]);
try{
  const authored=manifest.authoredGenesisReadPins?readAuthoredNativeMatchV1(path,manifest.authoredGenesisReadPins):null;
  let measuredBattingModelInSameDatabase=false;
  if(authored){
    strictEqual(authored.models.length,18);deepStrictEqual(JSON.parse(JSON.stringify(authored.actor)),originalPitch.originalActor);
    const model=withBodyCompositionTransaction(db,false,()=>playerBattingModelEvidenceFromSqlite(db).read(manifest.battingModelReference.sourceId));
    if(!model)throw new Error('original authored batting model missing');deepStrictEqual(reference('world_player_batting_models',model),manifest.battingModelReference);
    measuredBattingModelInSameDatabase=!!model.repertoire.values.sampledProfiles?.length;strictEqual(measuredBattingModelInSameDatabase,true);
    db.exec('BEGIN; PRAGMA query_only=1');
    try{const actual=withBattedWorldPhysicalReadTraversal(db,()=>readSamePaObservedPitchFromSqlite(db,launchReference));
      deepStrictEqual(JSON.parse(JSON.stringify(actual.pitch)),originalPitch);deepStrictEqual(actual.action.source.batterModelReference,manifest.battingModelReference);
    }finally{db.exec('COMMIT; PRAGMA query_only=0');}
  }
  const release=originalPitch.result.delivery.release.releaseAtUs,ballPhysics={kind:'aero_ground_v1' as const,air:originalPitch.result.trajectory.parameters,
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:originalPitch.result.trajectory.parameters.aerodynamics.ballRadiusM,inertiaRatio:.378,restingVerticalSpeedMps:.15,
      material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}};
  const base={sourceVersion:'synthetic-initial-cut-v1',launchReference};
  const first={...base,sourceId:'observed-initial:cut1',capability:'same_pa_observed_initial_cut_v1' as const,previousOperationReference:null,throughTick:release+20000,ballPhysics};
  sources.set(first.sourceId,first);const before=census(),cut=owner.accept(first.sourceId);
  if(cut.kind!=='observed_initial_cut_v1')throw new Error('actual first cut missing');
  strictEqual(cut.stage,'in_flight');strictEqual(cut.evaluationTick,release+20000);strictEqual(cut.sceneBodyReferences.length,10);
  notDeepStrictEqual(cut.physical.moment.ball.position,originalPitch.result.delivery.release.position);
  deepStrictEqual(cut.beforeTimeline,originalPitch.beforeTimeline);
  const originalRows=census().filter(row=>!String(row[0]).startsWith('pa_observed_initial_v1_'));deepStrictEqual(originalRows,before);
  const calibrationRow=db.prepare('SELECT * FROM pa_dispatch_v1_execution_calibrations').all().find(row=>{
    const s=JSON.parse(String(row.source_json));return s.route==='batter_observation'&&s.member.playerId===originalPitch.originalActor.binding.playerId;
  });if(!calibrationRow)throw new Error('original sensory calibration missing');
  const calibrationReference={owner:'pa_dispatch_v1_execution_calibrations' as const,sourceId:String(calibrationRow.source_id),sourceHash:String(calibrationRow.source_hash),snapshotHash:String(calibrationRow.snapshot_hash)};
  const captureSource={...base,sourceId:'observed-initial:capture1',capability:'same_pa_observed_initial_capture_v1' as const,
    previousOperationReference:reference(observedInitialOperations,cut),calibrationReference};sources.set(captureSource.sourceId,captureSource);
  const capture=owner.accept(captureSource.sourceId);if(capture.kind!=='observed_initial_capture_v1')throw new Error('actual capture missing');
  strictEqual(capture.evaluationTick,cut.evaluationTick);strictEqual(capture.eventSequence,1);strictEqual(capture.calculation.deliveredMemory,null);
  // The actual model, geometry and occluders must yield a real captured sample.
  // Its latency is retained; this does not authorize early prediction/decision.
  strictEqual(capture.calculation.sample!==null,true);strictEqual(capture.calculation.availableTick!>cut.evaluationTick,true);
  const early={...base,sourceId:'observed-initial:early-delivery',capability:'same_pa_observed_initial_delivery_v1' as const,
    previousOperationReference:reference(observedInitialOperations,capture),captureReference:reference(observedInitialOperations,capture),calibrationReference};
  sources.set(early.sourceId,early);const atCapture=census();throws(()=>owner.accept(early.sourceId),/later owned physical cut/);deepStrictEqual(census(),atCapture);
  const second={...first,sourceId:'observed-initial:cut2',previousOperationReference:reference(observedInitialOperations,capture),throughTick:release+40000};
  sources.set(second.sourceId,second);const cut2=owner.accept(second.sourceId);if(cut2.kind!=='observed_initial_cut_v1')throw new Error('second actual cut missing');
  const captureSource2={...captureSource,sourceId:'observed-initial:capture2',previousOperationReference:reference(observedInitialOperations,cut2)};
  sources.set(captureSource2.sourceId,captureSource2);const capture2=owner.accept(captureSource2.sourceId);
  if(capture2.kind!=='observed_initial_capture_v1')throw new Error('second actual capture missing');strictEqual(capture2.eventSequence,2);
  const deliveredSource={...early,sourceId:'observed-initial:delivery1',previousOperationReference:reference(observedInitialOperations,capture2)};
  sources.set(deliveredSource.sourceId,deliveredSource);const delivered=owner.accept(deliveredSource.sourceId);
  if(delivered.kind!=='observed_initial_delivery_v1')throw new Error('actual delivered observation missing');
  strictEqual(delivered.delivery.evaluatedAtTick,cut2.evaluationTick);strictEqual(delivered.delivery.availableTick,capture.calculation.availableTick);
  const predictionSource={...base,sourceId:'observed-initial:prediction1',capability:'same_pa_observed_initial_prediction_v1' as const,
    previousOperationReference:reference(observedInitialOperations,delivered),deliveryReference:reference(observedInitialOperations,delivered)};
  sources.set(predictionSource.sourceId,predictionSource);const prediction=owner.accept(predictionSource.sourceId);
  if(prediction.kind!=='observed_initial_prediction_v1')throw new Error('actual observed forecast missing');
  deepStrictEqual(prediction.forecast.trajectory.start.position,capture.calculation.sample!.estimate.position);
  deepStrictEqual(prediction.forecast.trajectory.start.velocity,capture.calculation.sample!.estimate.velocity);
  strictEqual(prediction.forecast.availableTick,cut2.evaluationTick);
  const saved=census();
  for(const bad of [{...second,sourceId:'observed-initial:stale',previousOperationReference:reference(observedInitialOperations,cut)},
    {...second,sourceId:'observed-initial:expired',previousOperationReference:reference(observedInitialOperations,prediction),throughTick:cut.ownedControlThroughTick+1}]){
    sources.set(bad.sourceId,bad);throws(()=>owner.accept(bad.sourceId));deepStrictEqual(census(),saved);
  }
  owner.close();const reopened=openSqliteObservedInitialPitchStore(path);
  const records=[cut,capture,cut2,capture2,delivered,prediction];
  try{for(const record of records){deepStrictEqual(reopened.read(record.source.sourceId),record);deepStrictEqual(reopened.accept(record.source.sourceId),record);}}finally{reopened.close();}
  deepStrictEqual(census(),saved);deepStrictEqual(census().filter(row=>!String(row[0]).startsWith('pa_observed_initial_v1_')),before);
  // Isolated, rolled-back corruption in this generated test database. The
  // production reader must refuse the missing prefix and perform no repair.
  db.exec('SAVEPOINT corruption');
  try{
    db.prepare(`DELETE FROM ${observedInitialOperations} WHERE source_id=?`).run(cut.source.sourceId);const corrupt=census();db.exec('PRAGMA query_only=1');
    throws(()=>withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>readObservedInitialPitchOperationFromSqlite(db,reference(observedInitialOperations,prediction)))));
    deepStrictEqual(census(),corrupt);
  }finally{db.exec('PRAGMA query_only=0; ROLLBACK TO corruption; RELEASE corruption');}
  deepStrictEqual(census(),saved);
  const expected={records,references:records.map(v=>reference(observedInitialOperations,v)),sources:[first,captureSource,second,captureSource2,deliveredSource,predictionSource]};
  writeFileSync(resolve(output,'expected.json'),JSON.stringify(expected),{flag:'wx'});
  writeFileSync(resolve(output,'native-report.json'),JSON.stringify({status:'PASS_NATIVE_OBSERVED_INITIAL_CUT_AND_CAPTURE',ownerMocks:false,originalRowsUnchanged:true,
    actualCuts:2,actualCaptures:2,capturedSamples:records.filter(v=>v.kind==='observed_initial_capture_v1'&&v.calculation.sample!==null).length,
    sensoryDeliveryAdmitted:true,observedPredictionAdmitted:true,earlyDeliveryRefused:true,missingPrefixReadRefusedWithoutRepair:true,
    measuredBattingAdmitted:false,fresh18PersonGenesis:!!authored,measuredBattingModelInSameDatabase,fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_OBSERVED_INITIAL_CUT_AND_CAPTURE\n');
}finally{owner.close();db.close();}
