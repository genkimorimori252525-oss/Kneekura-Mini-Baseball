import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,constants} from 'node:sqlite';
import {parseDebugRecord,stringifyDebugRecord,firstDebugDifference} from './live-debug-record.mjs';
import {fileState,createPinnedNativeCopy,compilePinnedNativeEntry,assertNativeProbePins} from './native-measurement-probe-support-v183.mjs';

const root=process.cwd(),[reportArg,outputArg]=process.argv.slice(2),inputReport=resolve(reportArg??''),output=resolve(outputArg??''),rel=relative(root,output);
assert(reportArg&&outputArg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'saved V183 report and new workspace output required');
await mkdir(output,{recursive:false});
const save=(name,value)=>writeFile(resolve(output,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  frozen=value=>!value||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value).every(frozen),
  state=db=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,
    changes:db.prepare('SELECT total_changes() n').get().n,mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version});
function detached(first,second){
  if(!first||typeof first!=='object')return;
  assert.notEqual(first,second,'two calendar reads must not share object references');
  for(const key of Object.keys(first))detached(first[key],second[key]);
}
const fixturePath=resolve(dirname(inputReport),'fixture-reference-expected.json'),harnessFiles=[
  'tools/verification/check-native-contact-calendar-v186.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
const report={pass:false,authority:'CURRENT_NATIVE_CONTACT_CALENDAR_CONSUMER_ON_SAVED_ORIGINAL_FIXTURE',producerExercised:'Original',
  actualApiReads:0,badRefReads:0,missingFormalSelectionReads:0,legacyUnavailabilityProven:false,joinedPositiveFormalCalendarProven:false,
  recognitionCreated:false,traitTimeCreated:false,naturalCohortProven:false,privateArtifactNotForPublication:true};
let copy,bundle,db;
try{
  report.inputPins=Object.fromEntries(await Promise.all([inputReport,fixturePath,...harnessFiles.map(path=>resolve(root,path))]
    .map(async path=>[relative(root,path).replaceAll('\\','/'),{start:await fileState(path)}])));
  const saved=parseDebugRecord(await readFile(inputReport,'utf8')),fixture=parseDebugRecord(await readFile(fixturePath,'utf8'));
  assert.equal(saved.pass,true);assert.equal(saved.authority,'CURRENT_NATIVE_ORIGINAL_PITCH_OWNER_ON_EXPLICIT_BUNT_FIXTURE');
  // The accepted V183 report predates persisting the copy locator. Its known
  // creator used this fixed sibling filename, and pinned the original bytes.
  const legacy=!saved.copy,originalPath=legacy?resolve(dirname(inputReport),'authored-original.sqlite'):resolve(saved.copy.originalPath),
    expectedMain=legacy?saved.originalDatabaseAfter.main:saved.copy.originalDatabaseBefore.main;
  report.sourceLocator={format:legacy?'LEGACY_V183_REPORT_WITHOUT_COPY_FIELD':'V183_COPY_LOCATOR',originalPath,expectedMain};
  assert.deepEqual(await fileState(originalPath),expectedMain,'saved original bytes differ from the accepted report');
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(output,'private-copy.sqlite'),expectedMainSha256:expectedMain.sha256});report.copy=copy;
  bundle=await compilePinnedNativeEntry({root,entryPath:'src/host/world/NativeMeasuredContactCalendarV186.ts',outputPath:resolve(output,'contact-calendar-bundle.mjs')});
  assert(Object.hasOwn(bundle.sourcePins,'src/core/world/competition/WorldCalendarDate.ts'),'the actual calendar Core must be part of the pinned entry');
  const {readNativeMeasuredContactCalendarV186FromSqlite:read}=await import(pathToFileURL(bundle.bundlePath).href),binding=fixture.expected.actor.binding,
    input={contacts:{scope:{careerId:binding.careerId,playerId:binding.playerId},references:[structuredClone(fixture.reference),structuredClone(fixture.reference)]}},inputBefore=structuredClone(input);
  db=new DatabaseSync(copy.copyPath);let denied=0;
  db.setAuthorizer((code,table)=>{
    if(code===constants.SQLITE_DELETE&&table==='physical_pitch_progress_actions'||code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH){denied++;return constants.SQLITE_DENY;}
    return constants.SQLITE_OK;
  });
  db.exec('BEGIN');db.exec('SAVEPOINT caller_owned_contact_calendar');
  const before=state(db),first=read(db,input);report.actualApiReads++;
  assert.deepEqual(state(db),before);assert.deepEqual(input,inputBefore);assert(frozen(first));
  assert.equal(first.boundary,'NATIVE_CONTACT_CALENDAR_BINDINGS_ONLY');assert.equal(first.chronology,'UNRESOLVED');assert.equal(first.classification,null);
  assert.equal(first.collection.contacts.length,1);assert.equal(first.collection.requests.length,2);assert.equal(first.calendars.length,1);
  assert.deepEqual(first.collection.scope,input.contacts.scope);
  for(const request of first.collection.requests){assert.deepEqual(request.reference,fixture.reference);assert.equal(request.status,'CONTACT');assert.equal(request.contactIndex,0);}
  const item=first.collection.contacts[0],evidence=item.evidence;
  assert.deepEqual(item.reference,fixture.reference);
  assert.deepEqual({source:evidence.source,actor:evidence.actor,contactEvent:evidence.contactEvent,contact:evidence.contact,
    progressRevision:evidence.progressRevision,scope:evidence.scope},fixture.expected);
  assert.deepEqual(item.measurement.exitVelocityMps,fixture.expected.contact.exitVelocity);assert.deepEqual(item.measurement.exitSpinRadPerSecond,fixture.expected.contact.exitSpin);
  const velocity=fixture.expected.contact.exitVelocity;
  assert.equal(item.measurement.launchAngleDeg,Math.atan2(velocity.y,Math.hypot(velocity.x,velocity.z))*180/Math.PI);
  const calendar=first.calendars[0].calendar;
  assert.deepEqual(first.calendars[0].reference,fixture.reference);
  assert.deepEqual(calendar,{kind:'DOMESTIC',seasonId:binding.competitionEditionId,seasonDay:binding.gameDay,gameId:binding.gameId,
    fixtureEventId:binding.fixtureEventId,careerDayOne:null,careerCalendarSelection:null,status:'UNAVAILABLE',reason:'NO_DOMESTIC_CALENDAR_ORIGIN',
    calendarDateISO:null,calendarYear:null,origin:null,careerDay:null,careerDayReason:'NO_DOMESTIC_CALENDAR_ORIGIN'});
  assert.notEqual(item.reference,input.contacts.references[0]);assert.notEqual(first.collection.scope,input.contacts.scope);
  const firstText=stringifyDebugRecord(first);
  db.exec('PRAGMA query_only=1');const secondBefore=state(db),second=read(db,input);report.actualApiReads++;
  assert.deepEqual(state(db),secondBefore);assert.deepEqual(input,inputBefore);assert(frozen(second));detached(first,second);
  assert.equal(firstDebugDifference(first,second),null);assert.equal(stringifyDebugRecord(second),firstText);
  const deniedBefore=denied;assert.throws(()=>db.prepare('DELETE FROM main.physical_pitch_progress_actions WHERE 0'),/authorized/i);assert(denied>deniedBefore);
  const badInput=structuredClone(input);
  for(const reference of badInput.contacts.references)reference.snapshotHash='0'.repeat(64);
  const badBefore=state(db);report.badRefReads++;assert.throws(()=>read(db,badInput));assert.deepEqual(state(db),badBefore);
  const missingInput={...structuredClone(input),careerCalendarEditionId:'explicit-missing-formal-calendar-v186'},missingBefore=state(db);
  report.missingFormalSelectionReads++;
  assert.throws(()=>read(db,missingInput),error=>{report.missingFormalSelectionError=String(error.message);return /selection|no such table/.test(error.message);});
  assert.deepEqual(state(db),missingBefore);
  db.exec('RELEASE caller_owned_contact_calendar');assert.equal(db.isTransaction,true);db.exec('ROLLBACK');assert.equal(state(db).changes,before.changes);
  db.setAuthorizer(null);db.close();db=null;
  await writeFile(resolve(output,'actual-first.json'),firstText+'\n',{flag:'wx'});await save('actual-second.json',second);
  report.comparisons={originalMembersExact:true,duplicateRequestsOneRawContact:true,measurementVectorsExact:true,losslessReadsExact:true,
    deeplyFrozen:true,deeplyDetached:true,inputUnchanged:true,inputDetached:true,callerStatePreserved:true,authorizerPreserved:true,
    totalChangesUnchanged:true,badRefRejected:true,explicitMissingFormalSelectionRejected:true};
  report.legacyUnavailabilityProven=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    if(bundle)report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion};
    for(const [path,pin]of Object.entries(report.inputPins??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start,'input/harness changed: '+path);}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,producerExercised:report.producerExercised,actualApiReads:report.actualApiReads,badRefReads:report.badRefReads,
  missingFormalSelectionReads:report.missingFormalSelectionReads,legacyUnavailabilityProven:report.legacyUnavailabilityProven,
  joinedPositiveFormalCalendarProven:report.joinedPositiveFormalCalendarProven,sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
