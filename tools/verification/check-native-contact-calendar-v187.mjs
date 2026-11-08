import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,constants} from 'node:sqlite';
import {stringifyDebugRecord,firstDebugDifference} from './live-debug-record.mjs';
import {fileState,createPinnedNativeCopy,compilePinnedNativeEntry,assertNativeProbePins} from './native-measurement-probe-support-v183.mjs';

const root=process.cwd(),outArg=process.argv[2],out=resolve(outArg??''),rel=relative(root,out);
assert(outArg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');
await mkdir(out,{recursive:false});
const save=(name,value)=>writeFile(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  frozen=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen),
  state=db=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,
    changes:db.prepare('SELECT total_changes() n').get().n,schema:db.prepare('PRAGMA main.schema_version').get().schema_version});
function detached(a,b){if(!a||typeof a!=='object')return;assert.notEqual(a,b);for(const k of Object.keys(a))detached(a[k],b[k]);}
const report={pass:false,authority:'CURRENT_NATIVE_CONTACT_AND_FORMAL_DOMESTIC_CALENDAR_JOIN_ON_EXPLICIT_FIXTURE',
  actualApiReads:0,rejectedCalls:0,joinedPositiveFormalCalendarProven:false,traitTimeCreated:false,
  recognitionCreated:false,normalAiProven:false,learnedSkillProven:false,naturalCohortProven:false,
  populationComplete:false,privateArtifactNotForPublication:true};
let copy,bundle,db;
try{
  const paths=['tools/verification/check-native-contact-calendar-v187.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
  report.harnessPins=Object.fromEntries(await Promise.all(paths.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-contact-calendar-case-v187.ts',outputPath:resolve(out,'formal-contact-calendar-bundle.mjs')});
  const api=await import(pathToFileURL(bundle.bundlePath).href),originalPath=resolve(out,'formal-original.sqlite'),
    fixture=api.createCase(originalPath),original=await fileState(originalPath);
  assert(original.exists);await save('fixture-reference-expected.json',fixture);
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(out,'private-copy.sqlite'),expectedMainSha256:original.sha256});
  const input={contacts:{scope:structuredClone(fixture.scope),references:[structuredClone(fixture.reference),structuredClone(fixture.reference)]},
    careerCalendarEditionId:fixture.careerCalendarEditionId},inputBefore=stringifyDebugRecord(input);
  db=new DatabaseSync(copy.copyPath);let denied=0;
  db.setAuthorizer((code,table)=>{
    if(code===constants.SQLITE_DELETE&&table==='physical_pitch_progress_actions'||code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH){denied++;return constants.SQLITE_DENY;}
    return constants.SQLITE_OK;
  });
  db.exec('BEGIN; SAVEPOINT caller_owned_formal_contact_calendar');const before=state(db);
  const first=api.read(db,input);report.actualApiReads++;
  assert.deepEqual(state(db),before);assert.equal(stringifyDebugRecord(input),inputBefore);assert(frozen(first));
  assert.equal(first.boundary,'NATIVE_CONTACT_CALENDAR_BINDINGS_ONLY');assert.equal(first.chronology,'UNRESOLVED');assert.equal(first.classification,null);
  assert.deepEqual(first.collection.scope,fixture.scope);assert.equal(first.collection.contacts.length,1);
  assert.equal(first.collection.requests.length,2);assert(first.collection.requests.every(r=>r.status==='CONTACT'&&r.contactIndex===0));
  const item=first.collection.contacts[0],evidence=item.evidence,expected=fixture.expectedPhysical;
  assert.deepEqual(item.reference,fixture.reference);
  assert.deepEqual({source:evidence.source,actor:evidence.actor,contactEvent:evidence.contactEvent,contact:evidence.contact,
    progressRevision:evidence.progressRevision,scope:evidence.scope},expected);
  assert.deepEqual(item.measurement.exitVelocityMps,expected.contact.exitVelocity);assert.deepEqual(item.measurement.exitSpinRadPerSecond,expected.contact.exitSpin);
  assert.equal(first.calendars.length,1);assert.deepEqual(first.calendars[0].reference,fixture.reference);
  const calendar=first.calendars[0].calendar,target=fixture.expectedCalendar;
  assert.equal(calendar.kind,'DOMESTIC');assert.equal(calendar.status,'RESOLVED_DATE');
  for(const field of ['seasonDay','calendarDateISO','careerDay','careerDayOne'])assert.equal(calendar[field],target[field]);
  assert.equal(calendar.calendarYear,Number(target.calendarDateISO.slice(0,4)));assert.equal(calendar.careerDayReason,null);
  assert.notEqual(calendar.careerDay,calendar.seasonDay,'this case must distinguish career and season day');
  assert.equal(calendar.gameId,expected.scope.gameId);assert.equal(calendar.fixtureEventId,expected.actor.binding.fixtureEventId);
  assert.equal(calendar.seasonId,expected.actor.binding.competitionEditionId);
  assert.deepEqual(calendar.origin,fixture.calendarOrigin);assert.deepEqual(calendar.careerCalendarSelection,fixture.careerCalendarSelection);
  const firstText=stringifyDebugRecord(first);assert.notEqual(item.reference,input.contacts.references[0]);
  assert.equal(Reflect.set(item.measurement.exitVelocityMps,'x',12345),false);
  db.exec('PRAGMA query_only=1');const q1=state(db),second=api.read(db,input);report.actualApiReads++;
  assert.deepEqual(state(db),q1);assert.equal(stringifyDebugRecord(input),inputBefore);assert(frozen(second));detached(first,second);
  assert.equal(firstDebugDifference(first,second),null);assert.equal(stringifyDebugRecord(second),firstText);
  const bad=structuredClone(input);for(const reference of bad.contacts.references)reference.snapshotHash='0'.repeat(64);
  for(const invalid of [bad,{...structuredClone(input),careerCalendarEditionId:'explicit-missing-formal-calendar-v187'}]){
    const prior=state(db);report.rejectedCalls++;assert.throws(()=>api.read(db,invalid));assert.deepEqual(state(db),prior);
  }
  const deniedBefore=denied;assert.throws(()=>db.prepare('DELETE FROM main.physical_pitch_progress_actions WHERE 0'),/authorized/i);assert(denied>deniedBefore);
  db.exec('RELEASE caller_owned_formal_contact_calendar');assert.equal(db.isTransaction,true);db.exec('ROLLBACK');assert.equal(state(db).changes,before.changes);
  db.setAuthorizer(null);db.close();db=null;
  await writeFile(resolve(out,'actual-first.json'),firstText+'\n',{flag:'wx'});await save('actual-second.json',second);
  report.comparisons={originalPhysicalMembersExact:true,originalMeasurementVectorsExact:true,formalCalendarAndCareerOriginExact:true,
    seasonDayNotCareerDay:true,duplicateRequestsOneRawContact:true,losslessReadsExact:true,deeplyFrozenAndDetached:true,
    inputUnchangedAndDetached:true,callerStateAndAuthorizerPreserved:true,badRefAndMissingFormalSelectionRejected:true};
  report.joinedPositiveFormalCalendarProven=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    if(bundle)report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion};
    for(const [path,pin]of Object.entries(report.harnessPins??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start);}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,actualApiReads:report.actualApiReads,rejectedCalls:report.rejectedCalls,
  joinedPositiveFormalCalendarProven:report.joinedPositiveFormalCalendarProven,sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
