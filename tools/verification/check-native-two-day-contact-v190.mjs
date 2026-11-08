import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const model={modelId:'native-v190-integration-only',version:'1',minimumEpisodes:2,minimumDays:1,windowDays:10,
  maximumSourceAgeDays:0,rule:{familyId:'line_drive',lowerAngleDeg:10,upperAngleDeg:30,minimumFraction:.6}},
  policy={policyId:'native-v190-integration-only',version:'1',families:[{familyId:'line_drive',modelId:model.modelId,
    modelVersion:model.version,minimumRecognitionEpisodes:2,minimumRecognitionDays:1}]};
const report={pass:false,authority:'FORMAL_NATIVE_TWO_GAME_TWO_DAY_CONTACT_CLASSIFICATION_COMPOSITION',
  projectionReads:0,productionCalibrationProven:false,normalAiProven:false,completedInterveningGamesProven:false,
  currentCareerClockProven:false,naturalCohortProven:false,privateArtifactNotForPublication:true};
let bundle,copy,db,store;
try{
  const paths=['tools/verification/check-native-two-day-contact-v190.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
  report.harnessPins=Object.fromEntries(await Promise.all(paths.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-two-day-contact-case-v190.ts',outputPath:resolve(out,'two-day-contact-bundle.mjs')});
  const api=await import(pathToFileURL(bundle.bundlePath).href),originalPath=resolve(out,'formal-two-game.sqlite'),fixture=api.createCase(originalPath);
  assert.equal(fixture.contacts.length,2);assert.notEqual(fixture.contacts[0].gameId,fixture.contacts[1].gameId);
  assert.deepEqual(fixture.contacts.map(c=>c.scope),[fixture.scope,fixture.scope]);assert.deepEqual(fixture.contacts.map(c=>c.seasonDay),[10,11]);
  assert.deepEqual(fixture.contacts.map(c=>c.inputWorkloadRevision),[0,0]);assert.deepEqual(fixture.contacts[0].workloadBefore,fixture.contacts[1].workloadBefore);
  store=api.open(originalPath);const captured=store.capture(fixture.scope,{careerCalendarEditionId:fixture.careerCalendarEditionId});
  assert(captured);assert.equal(captured.receipts.length,2);assert.equal(captured.captureCoverage.references.length,2);
  assert.deepEqual(captured.receipts.map(r=>r.reference),fixture.contacts.map(c=>c.reference));
  assert.deepEqual(captured.receipts.map(r=>r.calendarDateISO),['2032-02-28','2032-02-29']);
  assert.deepEqual(captured.observations.map(o=>o.time.day),[424,425]);assert.equal(new Set(captured.receipts.map(r=>r.episodeId)).size,2);
  for(let i=0;i<2;i++){
    const raw=fixture.contacts[i],receipt=captured.receipts[i],measurement=captured.measurements[i].measurement;
    assert.deepEqual(receipt.episodeScope,{gameId:raw.gameId,playId:raw.playId});
    assert.deepEqual(measurement.exitVelocityMps,raw.contact.exitVelocity);assert.deepEqual(measurement.exitSpinRadPerSecond,raw.contact.exitSpin);
    const v=raw.contact.exitVelocity,s=raw.contact.exitSpin,bytes=Buffer.alloc(48);
    [v.x,v.y,v.z,s.x,s.y,s.z].forEach((value,j)=>bytes.writeDoubleBE(value,j*8));
    assert.equal(receipt.measurementBitHash,createHash('sha256').update(bytes).digest('hex'));
  }
  store.close();store=null;await save('fixture-reference-expected.json',fixture);await save('capture.json',captured);
  const original=await fileState(originalPath);copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(out,'private-copy.sqlite'),expectedMainSha256:original.sha256});
  db=new DatabaseSync(copy.copyPath);db.exec('PRAGMA query_only=1; BEGIN');
  const changes=db.prepare('SELECT total_changes() AS count').get().count,
    catalog=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),
    request={scope:fixture.scope,classificationId:'v190-native-classification',projectionId:'v190-native-projection',worldRevision:0,model,policy};
  const first=api.read(db,request);report.projectionReads++;
  assert.equal(first.status,'READY');assert.deepEqual(first.reasons,[]);assert(frozen(first));
  assert.equal(firstDebugDifference(first.source,captured.source),null);assert.equal(first.currentInventoryHash,captured.captureCoverage.inventoryHash);
  assert.equal(first.classification.status,'READY');assert.equal(first.classification.sampleCount,2);assert.equal(first.classification.episodeCount,2);
  assert.equal(first.classification.evidenceSpanDays,1);assert.deepEqual(first.classification.request.time,{season:2032,day:425,sequence:0});
  const angles=fixture.contacts.map(c=>{const v=c.contact.exitVelocity;return Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI;}),
    fraction=angles.filter(a=>a>=10&&a<30).length/2,entry=first.projection.entries.find(e=>e.familyId==='line_drive');
  assert.equal(first.classification.metrics.find(m=>m.key==='lineDriveFraction').value,fraction);
  assert.equal(entry.status,fraction>=.6?'PRESENT':'ABSENT');assert.equal(entry.stateId,fraction>=.6?'LINE_DRIVE':null);
  // Classification bindings use the existing Core validator's representation (including time key order).
  // The separate raw Native Source/vector/bit checks above remain exact.
  const classifiedSource=api.validateSourceSnapshot(captured.source,'expected.source');
  assert.equal(firstDebugDifference(first.classification.assessment.bindings[0].source,classifiedSource),null);
  const second=api.read(db,request);report.projectionReads++;assert.equal(firstDebugDifference(first,second),null);detached(first,second);
  assert.equal(db.isTransaction,true);assert.equal(db.prepare('PRAGMA query_only').get().query_only,1);
  assert.equal(db.prepare('SELECT total_changes() AS count').get().count,changes);
  assert.deepEqual(db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),catalog);
  db.exec('COMMIT');db.close();db=null;
  const after=await fileState(copy.copyPath);assert.equal(after.sha256,original.sha256);assert.equal(after.bytes,original.bytes);
  await save('projection-first.json',first);await save('projection-second.json',second);
  report.launchAnglesDeg=angles;report.lineDriveFraction=fraction;report.projectedState=entry.status;report.readOnlyDatabaseBytesUnchanged=true;report.pass=true;
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
console.log(JSON.stringify({pass:report.pass,projectionReads:report.projectionReads,projectedState:report.projectedState,
  readOnlyDatabaseBytesUnchanged:report.readOnlyDatabaseBytesUnchanged,sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
