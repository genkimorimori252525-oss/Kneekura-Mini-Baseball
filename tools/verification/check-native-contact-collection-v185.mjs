import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,constants} from 'node:sqlite';
import {parseDebugRecord,stringifyDebugRecord,firstDebugDifference} from './live-debug-record.mjs';
import {fileState,createPinnedNativeCopy,compilePinnedNativeEntry,assertNativeProbePins} from './native-measurement-probe-support-v183.mjs';

// New collector contract/input, reusing the saved fixture and common filesystem
// probe support. This does not replay preparation, acceptance or the old probe.
const root=process.cwd(),[prepArg,outArg]=process.argv.slice(2),prepPath=resolve(prepArg??''),out=resolve(outArg??''),rel=relative(root,out);
assert(prepArg&&outArg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'preparation report and new workspace output required');
await mkdir(out,{recursive:false});
const save=(name,value)=>writeFile(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  frozen=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen),
  state=db=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,
    changes:db.prepare('SELECT total_changes() n').get().n,schema:db.prepare('PRAGMA main.schema_version').get().schema_version});
function detached(a,b){if(!a||typeof a!=='object')return;assert.notEqual(a,b);for(const k of Object.keys(a))detached(a[k],b[k]);}
const report={pass:false,authority:'CURRENT_NATIVE_RAW_COLLECTION_ON_SAVED_EXPLICIT_SCENE_FIXTURE',
  producerExercised:'pa_initial_joint_v1_executions',actualApiReads:0,rejectedCalls:0,
  populationComplete:false,independentContactIdentityResolved:false,calendarResolved:false,
  classificationCreated:false,privateArtifactNotForPublication:true};
let copy,bundle,db;
try{
  const paths=['tools/verification/check-native-contact-collection-v185.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
  report.harnessPins=Object.fromEntries(await Promise.all(paths.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  report.preparationPin={start:await fileState(prepPath)};
  const prep=parseDebugRecord(await readFile(prepPath,'utf8'));
  assert.equal(prep.pass,true);assert.equal(prep.nativeApiCalls,0);assert.equal(prep.copyMainUnchanged,true);
  assert.equal(prep.authority,'RAW_SELECTED_ARCHIVE_ROWS_NOT_CURRENT_NATIVE_OWNER_AUTHENTICATION');
  copy=await createPinnedNativeCopy({originalPath:prep.copy.copyPath,outputPath:resolve(out,'private-copy.sqlite'),expectedMainSha256:prep.copyAfter.main.sha256});
  assert.notEqual(copy.originalPath,resolve(prep.copy.originalPath));
  bundle=await compilePinnedNativeEntry({root,entryPath:'src/host/world/NativeMeasuredBattingContactCollectionV185.ts',outputPath:resolve(out,'contact-collection-bundle.mjs')});
  const {readNativeMeasuredBattingContactCollectionV185FromSqlite:read}=await import(pathToFileURL(bundle.bundlePath).href);
  const input={scope:{careerId:prep.actor.value.binding.careerId,playerId:prep.actor.value.binding.playerId},
    references:[structuredClone(prep.execution.reference),structuredClone(prep.execution.reference)]};
  const inputBefore=stringifyDebugRecord(input);
  db=new DatabaseSync(copy.copyPath);let denied=0;
  db.setAuthorizer((code,table)=>{
    if(code===constants.SQLITE_DELETE&&table==='pa_initial_joint_v1_executions'||code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH){denied++;return constants.SQLITE_DENY;}
    return constants.SQLITE_OK;
  });
  db.exec('BEGIN; SAVEPOINT caller_owned_contact_collection');const before=state(db);
  const first=read(db,input);report.actualApiReads++;
  assert.deepEqual(state(db),before);assert.equal(stringifyDebugRecord(input),inputBefore);assert(frozen(first));
  assert.equal(first.boundary,'NATIVE_RAW_CONTACT_COLLECTION_ONLY');assert.equal(first.populationCompleteness,'EXPLICIT_REFERENCES_ONLY');
  assert.equal(first.contactIdentityResolution,'OWNER_REFERENCE_ONLY');assert.equal(first.chronology,'UNRESOLVED');assert.equal(first.classification,null);
  assert.deepEqual(first.scope,input.scope);assert.equal(first.requests.length,2);assert.equal(first.contacts.length,1);
  assert(first.requests.every(r=>r.status==='CONTACT'&&r.contactIndex===0));
  const item=first.contacts[0],raw=prep.event.payload.contact,moment=prep.execution.value.calculation.result.moment;
  assert.deepEqual(item.reference,prep.execution.reference);assert.deepEqual(item.evidence.contact,raw);
  assert.deepEqual(item.evidence.actor.binding,prep.actor.value.binding);assert.deepEqual(item.evidence.contactMoment,moment);
  assert.deepEqual(item.measurement.exitVelocityMps,raw.exitVelocity);assert.deepEqual(item.measurement.exitSpinRadPerSecond,raw.exitSpin);
  assert.equal(item.measurement.launchAngleDeg,Math.atan2(raw.exitVelocity.y,Math.hypot(raw.exitVelocity.x,raw.exitVelocity.z))*180/Math.PI);
  assert.notEqual(moment.originTick+moment.elapsedSeconds*1e6,item.evidence.contactEvent.tick);
  const firstText=stringifyDebugRecord(first);assert.notEqual(item.reference,input.references[0]);
  input.references[0].snapshotHash='0'.repeat(64);assert.deepEqual(item.reference,prep.execution.reference);
  assert.equal(Reflect.set(item.measurement.exitVelocityMps,'x',12345),false);
  db.exec('PRAGMA query_only=1');const q1=state(db);
  const second=read(db,parseDebugRecord(inputBefore));report.actualApiReads++;
  assert.deepEqual(state(db),q1);assert(frozen(second));detached(first,second);
  assert.equal(firstDebugDifference(first,second),null);assert.equal(stringifyDebugRecord(second),firstText);
  for(const bad of [{scope:first.scope,references:[input.references[0]]},
    {scope:{...first.scope,playerId:first.scope.playerId+':wrong-subject'},references:[prep.execution.reference]}]){
    const prior=state(db);report.rejectedCalls++;assert.throws(()=>read(db,bad));assert.deepEqual(state(db),prior);
  }
  const deniedBefore=denied;assert.throws(()=>db.prepare('DELETE FROM main.pa_initial_joint_v1_executions WHERE 0'),/authorized/i);assert(denied>deniedBefore);
  db.exec('RELEASE caller_owned_contact_collection');assert.equal(db.isTransaction,true);db.exec('ROLLBACK');assert.equal(state(db).changes,before.changes);
  db.setAuthorizer(null);db.close();db=null;
  await writeFile(resolve(out,'actual-first.json'),firstText+'\n',{flag:'wx'});await save('actual-second.json',second);
  report.comparisons={duplicateRequestsRetained:true,oneUniqueReferenceRecord:true,rawContactAndMeasurementValueExact:true,
    originalActorAndSubTickRetained:true,losslessReadsExact:true,deeplyFrozenAndDetached:true,inputDetachedAndUnchanged:true,
    callerStateAndAuthorizerPreserved:true,badRefAndWrongSubjectRejected:true};report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    if(bundle)report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion};
    for(const [path,pin]of Object.entries(report.harnessPins??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start);}
    if(report.preparationPin){report.preparationPin.end=await fileState(prepPath);assert.deepEqual(report.preparationPin.end,report.preparationPin.start);}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,actualApiReads:report.actualApiReads,rejectedCalls:report.rejectedCalls,sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
