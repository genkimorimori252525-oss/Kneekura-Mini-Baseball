import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {stringifyDebugRecord,firstDebugDifference} from './live-debug-record.mjs';
import {fileState,createPinnedNativeCopy,compilePinnedNativeEntry,assertNativeProbePins} from './native-measurement-probe-support-v183.mjs';

const root=process.cwd(),arg=process.argv[2],out=resolve(arg??''),rel=relative(root,out);
assert(arg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');await mkdir(out,{recursive:false});
const save=(name,value)=>writeFile(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  sha=bytes=>createHash('sha256').update(bytes).digest('hex'),
  frozen=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen);
function detached(a,b){if(!a||typeof a!=='object')return;assert.notEqual(a,b);for(const k of Object.keys(a))detached(a[k],b[k]);}
function tables(path,names){
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    db.exec('PRAGMA query_only=1; BEGIN');
    names??=db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
    const result={};for(const name of names){
      assert(/^[a-zA-Z0-9_]+$/.test(name));
      result[name]={schema:db.prepare('SELECT sql FROM main.sqlite_master WHERE name=?').get(name).sql,
        rows:db.prepare('SELECT * FROM main."'+name+'" ORDER BY rowid').all()};
    }
    db.exec('COMMIT');return result;
  }finally{db.close();}
}
function catalog(path,excludedTables=[]){
  const db=new DatabaseSync(path,{readOnly:true});
  try{return db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all()
    .filter(row=>!excludedTables.includes(row.tbl_name));}
  finally{db.close();}
}
const report={pass:false,authority:'NATIVE_CONTACT_OBSERVATION_CAPTURE_AND_PERSISTENT_SOURCE_ON_FORMAL_FIXTURE',
  captureCalls:0,observeRetryCalls:0,snapshotReads:0,rejectedCalls:0,originalPhysicalTablesUnchanged:false,originalPhysicalCatalogUnchanged:false,
  recognitionCreated:false,populationComplete:false,normalAiProven:false,naturalCohortProven:false,privateArtifactNotForPublication:true};
let bundle,copy,store;
try{
  const paths=['tools/verification/check-native-contact-observation-v188.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
  report.harnessPins=Object.fromEntries(await Promise.all(paths.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-contact-observation-case-v188.ts',outputPath:resolve(out,'contact-observation-bundle.mjs')});
  const api=await import(pathToFileURL(bundle.bundlePath).href),originalPath=resolve(out,'formal-observed.sqlite'),fixture=api.createCase(originalPath);
  await save('fixture-reference-expected.json',fixture);
  const physicalBefore=tables(originalPath),physicalNames=Object.keys(physicalBefore),catalogBefore=catalog(originalPath),observationTables=Object.values(api.observationTables),
    input={scope:fixture.scope,reference:fixture.reference,careerCalendarEditionId:fixture.careerCalendarEditionId};
  assert(observationTables.every(name=>!physicalNames.includes(name)),'the new observation tables must not exist in the physical fixture');
  store=api.open(originalPath);
  const captured=store.capture(fixture.scope,{careerCalendarEditionId:fixture.careerCalendarEditionId});report.captureCalls++;
  assert(captured);assert.equal(captured.receipts.length,1);assert.equal(captured.observations.length,1);assert(frozen(captured));
  assert.equal(captured.boundary,'NATIVE_REGISTERED_CONTACT_SNAPSHOT_ONLY');assert.equal(captured.populationCoverage,'SUPPORTED_NATIVE_INVENTORY_AT_CAPTURE');
  assert.equal(captured.sequenceSemantics,'OWNER_ACCEPTANCE_ORDER_WITHIN_CAREER_DAY');assert.equal(captured.classification,null);
  const receipt=captured.receipts[0];assert.deepEqual(receipt.reference,fixture.reference);assert.equal(receipt.revision,1);
  assert.deepEqual(receipt.time,{season:2032,day:425,sequence:0});assert.equal(receipt.calendarDateISO,'2032-02-29');
  assert.equal(receipt.careerDayOne,'2031-01-01');assert.equal(captured.source.owner,'BATTING_CONTACT');assert.equal(captured.source.subjectId,fixture.scope.playerId);
  assert.equal(captured.source.revision,1);assert.deepEqual(captured.source.time,receipt.time);
  assert.deepEqual(captured.observations[0].exitVelocityMps,fixture.expectedPhysical.contact.exitVelocity);
  const measured=captured.measurements[0];assert.deepEqual(measured.measurement.exitVelocityMps,fixture.expectedPhysical.contact.exitVelocity);
  assert.deepEqual(measured.measurement.exitSpinRadPerSecond,fixture.expectedPhysical.contact.exitSpin);
  const bytes=Buffer.alloc(48),v=fixture.expectedPhysical.contact.exitVelocity,s=fixture.expectedPhysical.contact.exitSpin;
  [v.x,v.y,v.z,s.x,s.y,s.z].forEach((value,index)=>bytes.writeDoubleBE(value,index*8));assert.equal(receipt.measurementBitHash,sha(bytes));
  const retried=store.observe(input);report.observeRetryCalls++;assert.deepEqual(retried,receipt);
  const unchanged=store.capture(fixture.scope,{careerCalendarEditionId:fixture.careerCalendarEditionId});report.captureCalls++;
  assert.equal(firstDebugDifference(unchanged,captured),null);
  store.close();store=null;
  assert.deepEqual(tables(originalPath,physicalNames),physicalBefore);report.originalPhysicalTablesUnchanged=true;
  assert.deepEqual(catalog(originalPath,observationTables),catalogBefore);report.originalPhysicalCatalogUnchanged=true;
  report.originalPhysicalTableCount=physicalNames.length;
  const original=await fileState(originalPath);
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(out,'private-copy.sqlite'),expectedMainSha256:original.sha256});
  store=api.open(copy.copyPath);
  const first=store.readSnapshot(fixture.scope);report.snapshotReads++;assert(first);assert(frozen(first));assert.equal(firstDebugDifference(first,captured),null);
  const second=store.readSnapshot(fixture.scope);report.snapshotReads++;assert(second);detached(first,second);
  assert.equal(firstDebugDifference(first,second),null);assert.equal(stringifyDebugRecord(first),stringifyDebugRecord(second));
  const bad=structuredClone(input);bad.reference.snapshotHash='0'.repeat(64);
  for(const invalid of [bad,{...structuredClone(input),careerCalendarEditionId:'explicit-missing-formal-calendar-v188'}]){
    report.rejectedCalls++;assert.throws(()=>store.observe(invalid));
  }
  const recovered=store.readSnapshot(fixture.scope);report.snapshotReads++;assert.equal(firstDebugDifference(first,recovered),null);
  store.close();store=null;
  await save('capture.json',captured);await save('snapshot-first.json',first);await save('snapshot-second.json',second);
  report.comparisons={automaticInventoryCapture:true,sameRefReceiptAndRevisionStable:true,formalTimeAndEpisodeSource:true,
    originalVectorsAndSixFloat64BitsExact:true,sourceOwnerAndObservationBinding:true,losslessReadsExact:true,
    deeplyFrozenAndDetached:true,failedObserveRollbackAndRecovery:true,captureCoverageExplicitAtCapture:true};report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(store){try{store.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    if(bundle)report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion};
    for(const [path,pin]of Object.entries(report.harnessPins??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start);}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,captureCalls:report.captureCalls,observeRetryCalls:report.observeRetryCalls,snapshotReads:report.snapshotReads,
  originalPhysicalTablesUnchanged:report.originalPhysicalTablesUnchanged,originalPhysicalCatalogUnchanged:report.originalPhysicalCatalogUnchanged,
  sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
