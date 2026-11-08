import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,constants} from 'node:sqlite';
import {stringifyDebugRecord,firstDebugDifference} from './live-debug-record.mjs';
import {fileState,createPinnedNativeCopy,compilePinnedNativeEntry,assertNativeProbePins} from './native-measurement-probe-support-v183.mjs';

const root=process.cwd(),argument=process.argv[2],out=resolve(argument??''),rel=relative(root,out);
assert(argument&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'a new workspace output is required');
await mkdir(out,{recursive:false});
const save=(name,value)=>writeFile(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  sha=value=>createHash('sha256').update(value).digest('hex'),
  frozen=value=>!value||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value).every(frozen);
const sixBits=contact=>{
  const bytes=Buffer.alloc(48),v=contact.exitVelocity,s=contact.exitSpin;
  [v.x,v.y,v.z,s.x,s.y,s.z].forEach((value,index)=>bytes.writeDoubleBE(value,index*8));
  return {float64BEHex:bytes.toString('hex'),sha256:sha(bytes)};
};
function detached(left,right){if(!left||typeof left!=='object')return;assert.notEqual(left,right);for(const key of Object.keys(left))detached(left[key],right[key]);}
const state=db=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,
  changes:db.prepare('SELECT total_changes() n').get().n,mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,
  tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version,
  catalog:db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all()});
const report={pass:false,authority:'NATIVE_CONTINUOUS_FLIGHT_DISPLAY_LABEL_INVARIANCE_V191',actualFlightReads:0,
  displayReportApplied:false,displayNameActuallyChanged:false,flightHorizonSeconds:2,oldSavedDatabaseOpened:false,
  normalAiProven:false,naturalCohortProven:false,classifiedLineDriveProven:false,privateArtifactNotForPublication:true};
let bundle,copy,db;
try{
  const harnessPaths=['tools/verification/check-native-line-drive-flight-v191.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
  report.harnessPins=Object.fromEntries(await Promise.all(harnessPaths.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-line-drive-flight-case-v191.ts',outputPath:resolve(out,'native-flight-v191-bundle.mjs')});
  const api=await import(pathToFileURL(bundle.bundlePath).href),originalPath=resolve(out,'fresh-native-flight.sqlite'),fixture=api.prepare(originalPath);
  await save('prepared-native-flight.json',fixture);
  assert.equal(sha(fixture.rawPitch.source_json),fixture.reference.sourceHash);assert.equal(sha(fixture.rawPitch.snapshot_json),fixture.reference.snapshotHash);
  assert.equal(fixture.source.searchDurationTicks,2_000_000);assert(fixture.source.execution.ballPhysics);
  assert(!Object.hasOwn(fixture.source,'displayName'));assert(!Object.hasOwn(fixture.original.contact.source,'displayName'));
  report.reference=fixture.reference;report.fixtureAuthority=fixture.fixtureAuthority;report.seed=fixture.seed;
  report.originalContactBits=sixBits(fixture.original.contact.contact);
  const originalMain=await fileState(originalPath);
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(out,'private-read-copy.sqlite'),expectedMainSha256:originalMain.sha256});
  db=new DatabaseSync(copy.copyPath);
  db.setAuthorizer((code,table)=>code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH
    ||code===constants.SQLITE_DELETE&&table==='batted_ball_flights'?constants.SQLITE_DENY:constants.SQLITE_OK);
  db.exec('BEGIN');db.exec('PRAGMA query_only=1');db.exec('SAVEPOINT native_flight_label_caller');
  const before=state(db);
  const beforeDisplay=api.createDisplayReport(db,fixture.scope);report.displayReportApplied=true;
  assert(['PRESENT','ABSENT'].includes(beforeDisplay.status));assert.equal(beforeDisplay.sampleCount,2);assert.equal(beforeDisplay.episodeCount,2);
  assert.equal(beforeDisplay.evidenceSpanDays,1);assert.deepEqual(beforeDisplay.scope,fixture.scope);
  const first=api.read(db,fixture.source.sourceId,fixture.reference);report.actualFlightReads++;
  const afterDisplay=api.renameDisplayReport(beforeDisplay,'対照表示名');
  assert.equal(afterDisplay.displayName,'対照表示名');assert.equal(beforeDisplay.physicsEffects,'NONE');assert.equal(afterDisplay.physicsEffects,'NONE');
  assert.equal(beforeDisplay.modelCalibration,'UNCONFIRMED');assert.equal(afterDisplay.modelCalibration,'UNCONFIRMED');
  const {displayName:beforeName,...beforeFacts}=beforeDisplay,{displayName:afterName,...afterFacts}=afterDisplay;
  assert.notEqual(beforeName,afterName);report.displayNameActuallyChanged=true;assert.equal(firstDebugDifference(beforeFacts,afterFacts),null);
  assert.equal(beforeDisplay.source.snapshotId,fixture.registeredObservationSource.snapshotId);assert(frozen(beforeDisplay));assert(frozen(afterDisplay));
  detached(beforeDisplay,afterDisplay);
  const second=api.read(db,fixture.source.sourceId,fixture.reference);report.actualFlightReads++;
  report.firstDifference=firstDebugDifference(first,second);
  await save('display-report-before.json',beforeDisplay);await save('display-report-after.json',afterDisplay);
  await save('actual-first.lossless.json',first);await save('actual-second.lossless.json',second);
  assert.equal(report.firstDifference,null);assert.equal(stringifyDebugRecord(first),stringifyDebugRecord(second));
  assert(frozen(first));assert(frozen(second));detached(first,second);
  assert.deepEqual(sixBits(first.contact.contact),report.originalContactBits);
  assert.deepEqual(sixBits(first.flight.flight.contact),report.originalContactBits);
  assert.deepEqual(sixBits(second.flight.flight.contact),report.originalContactBits);
  assert.equal(first.flight.physicalPitch.source.request.delivery.matchSeed,fixture.seed);
  assert.deepEqual(first.flight.source,fixture.source);assert.deepEqual(second.flight.source,first.flight.source);
  assert.deepEqual(state(db),before);assert.throws(()=>db.prepare('DELETE FROM main.batted_ball_flights WHERE 0'),/authorized/i);
  db.exec('RELEASE native_flight_label_caller');assert.equal(db.isTransaction,true);assert.equal(db.prepare('PRAGMA query_only').get().query_only,1);
  db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;
  report.comparisons={normalNativeOriginalContactAndFlightRead:true,currentContinuousAeroGroundVersion:true,
    allActualRecordsLosslessEqual:true,originalSixFloat64BitsExact:true,sameNativeSeedAndPhysics:true,
    realDisplayReportRenamedWithoutPhysicalInput:true,callerSnapshotAuthorizerAndSchemaRetained:true,
    deeplyFrozenAndDetached:true,observedFlightHorizonSeconds:2};report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    if(bundle)report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion};
    for(const [path,pin]of Object.entries(report.harnessPins??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start);}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,actualFlightReads:report.actualFlightReads,displayReportApplied:report.displayReportApplied,
  displayNameActuallyChanged:report.displayNameActuallyChanged,sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
