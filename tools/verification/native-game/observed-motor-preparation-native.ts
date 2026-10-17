import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,mkdirSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual,strictEqual,throws } from 'node:assert';
import { openSqliteObservedInitialPitchStore,observedInitialOperations,type ObservedInitialSource,type ObservedInitialMotorPreparationSource } from '../../../src/host/world/SqliteObservedInitialPitchStore';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { createReferenceBatKinematicsV1 } from '../../../src/core/sim/contact/ReferenceBatKinematicsV1';
import { createMeasuredBatAxisReferenceV1 } from '../../../src/core/sim/contact/MeasuredBatAxisReferenceV1';

const [inputArgument,outputArgument]=process.argv.slice(2);
if(!inputArgument||!outputArgument)throw new Error('requires immutable observed initial directory and NEW output directory');
const input=resolve(inputArgument),output=resolve(outputArgument),sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(input,'manifest.json'),'utf8'));
strictEqual(manifest.scope,'FRESH_18_PERSON_MEASURED_MODEL_PHYSICAL_FIRST_PITCH_OBSERVATION_FORECAST');
strictEqual(sha(readFileSync(resolve(input,'match.sqlite'))),manifest.files['match.sqlite']);
// SHM is a transient reader-lock index, not durable content. Copy only pinned
// main+WAL into a private staging snapshot; SQLite must never open the input.
const pinned=Object.entries(manifest.files).filter(([name])=>name==='match.sqlite'||name==='match.sqlite-wal');
for(const [name,digest] of pinned)strictEqual(sha(readFileSync(resolve(input,name))),digest);
mkdirSync(output);const path=resolve(output,'match.sqlite'),staging=resolve(output,'input-snapshot.sqlite');
const sourceShmHash=()=>existsSync(resolve(input,'match.sqlite-shm'))?sha(readFileSync(resolve(input,'match.sqlite-shm'))):null;
const beforeSourceShm=sourceShmHash();
for(const [name] of pinned)copyFileSync(resolve(input,name),staging+name.slice('match.sqlite'.length));
const sqlite=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),Native=sqlite.DatabaseSync;
const originalDb=new Native(staging,{readOnly:true});
try{await sqlite.backup(originalDb,path);}finally{originalDb.close();}
for(const [name,digest] of pinned)strictEqual(sha(readFileSync(resolve(input,name))),digest);
strictEqual(sourceShmHash(),beforeSourceShm);
const db=new Native(path);
const expected=JSON.parse(readFileSync(resolve(input,'expected.json'),'utf8'));
const sources=new Map<string,ObservedInitialSource>(),owner=openSqliteObservedInitialPitchStore(path,{readAcceptedOperation:id=>sources.get(id)??null});
const census=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,
  db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(row=>JSON.stringify(row)).sort()]);
try{
  const last=expected.records.at(-1),prediction=owner.read(last.source.sourceId);
  deepStrictEqual(JSON.parse(JSON.stringify(prediction)),last);
  if(prediction?.kind!=='observed_initial_prediction_v1')throw new Error('actual saved observed forecast required');
  const calibration=(route:string)=>{
    const row=db.prepare('SELECT * FROM pa_dispatch_v1_execution_calibrations').all().find(row=>{
      const s=JSON.parse(String(row.source_json));return s.route===route;
    });if(!row)throw new Error('original calibration missing');
    return {owner:'pa_dispatch_v1_execution_calibrations' as const,sourceId:String(row.source_id),sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)};
  };
  const source:ObservedInitialMotorPreparationSource={sourceId:'observed-initial:measured-motor-preparation',sourceVersion:'explicit-preparation-v1',
    capability:'same_pa_observed_initial_motor_preparation_v1',launchReference:prediction.source.launchReference,
    previousOperationReference:reference(observedInitialOperations,prediction),predictionReference:reference(observedInitialOperations,prediction),
    motorCalibrationReference:calibration('batter_motor'),repertoireCalibrationReference:calibration('batter_swing'),aggression:.5};
  const before=census();
  for(const bad of [
    {...source,sourceId:source.sourceId+':wrong-route',motorCalibrationReference:calibration('batter_observation')},
    {...source,sourceId:source.sourceId+':foreign-prediction',predictionReference:expected.references[0]},
    {...source,sourceId:source.sourceId+':future-flight',actualTrajectory:prediction.cut.physical.moment},
  ]){sources.set(bad.sourceId,bad);throws(()=>owner.accept(bad.sourceId));deepStrictEqual(census(),before);}
  sources.set(source.sourceId,source);const prepared=owner.accept(source.sourceId);
  if(prepared.kind!=='observed_initial_motor_preparation_v1'||prepared.plan.status!=='READY')throw new Error('actual observed measured motor preparation required');
  strictEqual(prepared.scope,'motor_preparation_only');strictEqual(prepared.motionIssued,false);strictEqual(prepared.physicalEffect,'none');
  strictEqual(prepared.plan.motion.trajectory,null);
  const sampled=prepared.plan.motion.sampledTrajectoryV1;if(!sampled)throw new Error('original measured keys required');
  const repertoireRow=db.prepare('SELECT source_json FROM pa_dispatch_v1_execution_calibrations WHERE source_id=?').get(source.repertoireCalibrationReference.sourceId)!;
  const original=JSON.parse(String(repertoireRow.source_json)).response.values.sampledProfiles.find((p:any)=>p.profileId===prepared.plan.motion!.profileId);
  const originalReference=createMeasuredBatAxisReferenceV1({...original.measured,startTick:sampled.startTick,
    ticksPerSecond:sampled.ticksPerSecond,playbackRate:original.playbackRate,transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1}}).reference;
  deepStrictEqual(JSON.parse(JSON.stringify(sampled.frames)),JSON.parse(JSON.stringify(originalReference.frames)));strictEqual(sampled.frames.length,137);
  strictEqual(sampled.transform.scale,1);strictEqual(sampled.playbackRate,original.playbackRate);
  const motion=createReferenceBatKinematicsV1(sampled);strictEqual(Number.isFinite(motion.maximumSweetSpotSpeedMps),true);
  // The proposal may start after the currently owned pitcher control expires.
  // It must NOT authorize extending that finite world lease or a physical hit.
  const oldTables=(rows:ReturnType<typeof census>)=>rows.filter(row=>!String(row[0]).startsWith('pa_observed_initial_v1_'));
  deepStrictEqual(oldTables(census()),oldTables(before));
  const saved=census(),read=openSqliteObservedInitialPitchStore(path);
  try{deepStrictEqual(read.read(source.sourceId),prepared);deepStrictEqual(read.accept(source.sourceId),prepared);}finally{read.close();}
  deepStrictEqual(census(),saved);
  const stale={...source,sourceId:source.sourceId+':stale'};sources.set(stale.sourceId,stale);throws(()=>owner.accept(stale.sourceId));deepStrictEqual(census(),saved);
  expected.records.push(prepared);expected.references.push(reference(observedInitialOperations,prepared));expected.sources.push(source);
  writeFileSync(resolve(output,'expected.json'),JSON.stringify(expected),{flag:'wx'});
  writeFileSync(resolve(output,'native-report.json'),JSON.stringify({status:'PASS_NATIVE_OBSERVED_MEASURED_MOTOR_PREPARATION',
    ownerMocks:false,originalRowsUnchanged:true,originalMeasuredKeys:sampled.frames.length,observedForecastOnly:true,
    measuredMotorPrepared:true,measuredBattingAdmitted:false,motionIssued:false,physicalEffect:'none',
    proposedMotorStartTick:prepared.plan.motion.motorStartTick,ownedPitcherControlThroughTick:prepared.cut.ownedControlThroughTick,
    invalidOriginalsRefusedWithoutMutation:true,callbackFreeReopen:true,fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_OBSERVED_MEASURED_MOTOR_PREPARATION\n');
}finally{owner.close();db.close();}
