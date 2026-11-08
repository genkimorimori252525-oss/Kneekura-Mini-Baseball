import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { stringifyDebugRecord, firstDebugDifference } from './live-debug-record.mjs';
import { fileState, createPinnedNativeCopy, compilePinnedNativeEntry, assertNativeProbePins } from './native-measurement-probe-support-v183.mjs';

const root=process.cwd(),arg=process.argv[2],out=resolve(arg??''),rel=relative(root,out);
assert(arg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');await mkdir(out,{recursive:false});
const save=(name,value)=>writeFile(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  frozen=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen);
function detached(a,b){if(!a||typeof a!=='object')return;assert.notEqual(a,b);for(const k of Object.keys(a))detached(a[k],b[k]);}
// These parameters exercise an insufficient Native sample. They do not define a production calibration.
const model={modelId:'native-v189-insufficiency-probe-only',version:'1',minimumEpisodes:2,minimumDays:1,
  windowDays:10,maximumSourceAgeDays:0,rule:{familyId:'line_drive',lowerAngleDeg:10,upperAngleDeg:30,minimumFraction:.6}},
  policy={policyId:'native-v189-probe-only',version:'1',families:[{familyId:'line_drive',modelId:model.modelId,
    modelVersion:model.version,minimumRecognitionEpisodes:2,minimumRecognitionDays:1}]};
const report={pass:false,authority:'FORMAL_NATIVE_CONTACT_TO_INSUFFICIENT_CLASSIFICATION_AND_UNASSESSED_PROJECTION',
  projectionReads:0,recognitionCreated:false,productionCalibrationProven:false,multiDayReadyProven:false,
  privateArtifactNotForPublication:true};
let bundle,copy,db,store;
try{
  const paths=['tools/verification/check-native-contact-trait-projection-v189.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
  report.harnessPins=Object.fromEntries(await Promise.all(paths.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-contact-trait-projection-case-v189.ts',outputPath:resolve(out,'trait-projection-bundle.mjs')});
  const api=await import(pathToFileURL(bundle.bundlePath).href),originalPath=resolve(out,'formal-observed.sqlite'),fixture=api.createCase(originalPath);
  store=api.open(originalPath);const captured=store.capture(fixture.scope,{careerCalendarEditionId:fixture.careerCalendarEditionId});
  assert(captured);assert.equal(captured.receipts.length,1);store.close();store=null;
  await save('fixture-reference-expected.json',fixture);const original=await fileState(originalPath);
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(out,'private-copy.sqlite'),expectedMainSha256:original.sha256});
  // A normal connection lets SQLite retire its own empty WAL/SHM on close.
  // SQL remains query_only throughout the borrowed read; all database files must still match after close.
  db=new DatabaseSync(copy.copyPath);db.exec('PRAGMA query_only=1; BEGIN');
  const catalog=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),
    changes=db.prepare('SELECT total_changes() AS count').get().count,
    request={scope:fixture.scope,classificationId:'native-v189-classification',projectionId:'native-v189-projection',worldRevision:0,model,policy};
  // worldRevision=0 is explicit probe metadata, not an inferred Native world revision.
  const first=api.read(db,request);report.projectionReads++;
  assert.equal(first.status,'UNAVAILABLE');assert.deepEqual(first.reasons,['INSUFFICIENT_EVIDENCE']);assert(frozen(first));
  assert.equal(first.currentInventoryHash,captured.captureCoverage.inventoryHash);
  assert.equal(firstDebugDifference(first.source,captured.source),null);
  assert.equal(first.timeSemantics,'AS_OF_LATEST_REGISTERED_CONTACT');assert.equal(first.worldRevisionAuthority,'CALLER_PROJECTION_METADATA');
  assert.equal(first.classification.status,'UNAVAILABLE');assert.equal(first.classification.sampleCount,1);assert.equal(first.classification.episodeCount,1);
  assert.equal(first.classification.assessment,null);assert.deepEqual(first.classification.request.time,{season:2032,day:425,sequence:0});
  assert.equal(first.classification.request.observations[0].eventId,captured.observations[0].eventId);
  for(const key of ['x','y','z']){
    const raw=captured.observations[0].exitVelocityMps[key];
    assert(Object.is(first.classification.request.observations[0].exitVelocityMps[key],raw===0?0:raw));
  }
  const entry=first.projection.entries.find(x=>x.familyId==='line_drive');assert.equal(entry.status,'UNASSESSED');assert.equal(entry.stateId,null);
  const second=api.read(db,request);report.projectionReads++;assert.equal(firstDebugDifference(first,second),null);detached(first,second);
  assert.equal(db.isTransaction,true);assert.equal(db.prepare('PRAGMA query_only').get().query_only,1);
  assert.equal(db.prepare('SELECT total_changes() AS count').get().count,changes);
  assert.deepEqual(db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),catalog);
  db.exec('COMMIT');db.close();db=null;
  const copyAfter=await fileState(copy.copyPath);assert.equal(copyAfter.sha256,original.sha256);assert.equal(copyAfter.bytes,original.bytes);
  report.readOnlyDatabaseBytesUnchanged=true;report.classifierCanonicalSignedZeroOnly=true;
  await save('projection-first.json',first);await save('projection-second.json',second);report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const owner of [db,store])if(owner)try{owner.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    if(bundle)report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion};
    for(const [path,pin]of Object.entries(report.harnessPins??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start);}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,projectionReads:report.projectionReads,recognitionCreated:report.recognitionCreated,
  readOnlyDatabaseBytesUnchanged:report.readOnlyDatabaseBytesUnchanged,sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
