import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,constants} from 'node:sqlite';
import {parseDebugRecord,stringifyDebugRecord,firstDebugDifference} from './live-debug-record.mjs';
import {fileState,createPinnedNativeCopy,compilePinnedNativeEntry,assertNativeProbePins} from './native-measurement-probe-support-v183.mjs';

const root=process.cwd(),[preparationArg,outputArg]=process.argv.slice(2),preparationPath=resolve(preparationArg??''),output=resolve(outputArg??''),rel=relative(root,output);
assert(preparationArg&&outputArg&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'existing preparation report and new workspace output required');
await mkdir(output,{recursive:false});
const save=(name,value)=>writeFile(resolve(output,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  frozen=value=>!value||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value).every(frozen),
  state=db=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,
    changes:db.prepare('SELECT total_changes() n').get().n,mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version});
function detached(first,second){
  if(!first||typeof first!=='object')return;
  assert.notEqual(first,second,'two reads must not share object references');
  for(const key of Object.keys(first))detached(first[key],second[key]);
}
// Historical Native JSON canonically orders keys and cannot encode -0 or an
// undefined object property. Preserve these differences; permit no value drift.
function compareRaw(expected,actual,path='$',found=[]){
  if(Object.is(expected,actual))return found;
  if(typeof expected==='number'&&typeof actual==='number'&&expected===0&&actual===0){found.push({path,kind:'negative_zero',expected,actual,allowed:true});return found;}
  if(expected&&actual&&typeof expected==='object'&&typeof actual==='object'&&Array.isArray(expected)===Array.isArray(actual)){
    if(Array.isArray(expected)&&expected.length!==actual.length){found.push({path,kind:'array_length',expected:expected.length,actual:actual.length,allowed:false});return found;}
    const left=Object.keys(expected),right=Object.keys(actual),keys=new Set([...left,...right]);
    if(left.length===right.length&&left.every(key=>Object.hasOwn(actual,key))&&left.some((key,index)=>key!==right[index])){
      found.push({path,kind:'object_key_order',expectedKeys:left,actualKeys:right,allowed:!Array.isArray(expected)});
    }
    for(const key of keys){
      if(Object.hasOwn(expected,key)!==Object.hasOwn(actual,key)&&expected[key]===undefined&&actual[key]===undefined)
        found.push({path:path+'.'+key,kind:'undefined_property_presence',expectedPresent:Object.hasOwn(expected,key),actualPresent:Object.hasOwn(actual,key),allowed:!Array.isArray(expected)});
      else compareRaw(expected[key],actual[key],path+'.'+key,found);
    }
    return found;
  }
  found.push({path,kind:'value_or_identity',expected,actual,allowed:false});return found;
}

const report={pass:false,authority:'CURRENT_NATIVE_INITIAL_JOINT_OWNER_ON_SAVED_EXPLICIT_SCENE_FIXTURE',
  inputDatabaseRole:'PREPARATION_PRIVATE_COPY',actualApiReads:0,badRefReads:0,traitTimeCreated:false,
  recognitionCreated:false,normalAiProven:false,learnedSkillProven:false,calendarResolved:false,naturalCohortProven:false,
  privateArtifactNotForPublication:true};
const harnessInputs=['tools/verification/check-native-initial-joint-contact-v184.mjs','tools/verification/native-measurement-probe-support-v183.mjs',
  'tools/verification/live-debug-record.mjs'];
let copy,bundle,db;
try{
  report.harnessInputs=Object.fromEntries(await Promise.all(harnessInputs.map(async path=>[path,{start:await fileState(resolve(root,path))}])));
  report.preparationInput={path:relative(root,preparationPath),start:await fileState(preparationPath)};
  const prep=parseDebugRecord(await readFile(preparationPath,'utf8'));
  assert.equal(prep.pass,true);assert.equal(prep.authority,'RAW_SELECTED_ARCHIVE_ROWS_NOT_CURRENT_NATIVE_OWNER_AUTHENTICATION');
  assert.equal(prep.nativeApiCalls,0);assert.equal(prep.copyMainUnchanged,true);
  copy=await createPinnedNativeCopy({originalPath:prep.copy.copyPath,outputPath:resolve(output,'private-copy.sqlite'),expectedMainSha256:prep.copyAfter.main.sha256});
  assert.notEqual(copy.originalPath,resolve(prep.copy.originalPath),'the saved V144 original must never be opened by this probe');
  report.copy=copy;
  bundle=await compilePinnedNativeEntry({root,entryPath:'src/host/world/NativeMeasuredInitialJointContactV184.ts',outputPath:resolve(output,'initial-joint-contact-bundle.mjs')});
  const {readNativeMeasuredInitialJointContactV184FromSqlite:read}=await import(pathToFileURL(bundle.bundlePath).href),execution=prep.execution.value;
  assert.equal(execution.calculation.result.kind,'bat_contact');
  const expected={reference:prep.execution.reference,launchReference:execution.launchReference,source:execution.source,lineage:execution.lineage,
    actorBinding:prep.actor.value.binding,contactEvent:prep.event,contact:prep.event.payload.contact,
    rigidContact:execution.calculation.result.contact,contactMoment:execution.calculation.result.moment,
    scope:{careerId:execution.lineage.careerId,gameId:execution.lineage.gameId,playId:execution.lineage.playId,
      physicalPitchSourceId:execution.launchReference.sourceId,batterPlayerId:execution.calculation.input.batterPlayerId}};
  db=new DatabaseSync(copy.copyPath);let denied=0;
  db.setAuthorizer((code,table)=>{
    if(code===constants.SQLITE_DELETE&&table==='pa_initial_joint_v1_executions'
      ||code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH){denied++;return constants.SQLITE_DENY;}
    return constants.SQLITE_OK;
  });
  db.exec('BEGIN');db.exec('SAVEPOINT caller_owned_initial_joint');
  const before=state(db),input=structuredClone(prep.execution.reference),first=read(db,input);report.actualApiReads++;
  assert(first);assert.deepEqual(state(db),before);assert(frozen(first));
  const selected={reference:first.reference,launchReference:first.launchReference,source:first.source,lineage:first.lineage,
    actorBinding:first.actor.binding,contactEvent:first.contactEvent,contact:first.contact,rigidContact:first.rigidContact,
    contactMoment:first.contactMoment,scope:first.scope};
  const rawDifferences=compareRaw(expected,selected);
  await save('raw-selected-comparison.json',{contract:'SELECTED_NATIVE_JSON_MEMBERS_NOT_FULL_ARCHIVE_BIT_IDENTITY',expected,actual:selected,differences:rawDifferences});
  report.rawSelectedComparison={contract:'NATIVE_CANONICAL_JSON_SERIALIZATION_EFFECTS_RECORDED_ONLY',differences:rawDifferences,
    selectedLosslessExact:rawDifferences.length===0,fullArchiveBitIdentityClaimed:false};
  assert(rawDifferences.every(item=>item.allowed),'unpermitted raw Native value/identity/moment drift');
  assert.equal(first.contactMoment.originTick,execution.calculation.result.moment.originTick);
  assert.equal(first.contactMoment.elapsedSeconds,execution.calculation.result.moment.elapsedSeconds);
  assert.notEqual(first.contactMoment.originTick+first.contactMoment.elapsedSeconds*1e6,first.contactEvent.tick,'this saved case must retain a real fractional tick');
  const firstText=stringifyDebugRecord(first);assert.notEqual(first.reference,input);
  input.snapshotHash='0'.repeat(64);assert.deepEqual(first.reference,prep.execution.reference);
  assert.equal(Reflect.set(first.contact.exitVelocity,'x',12345),false);assert.equal(Reflect.set(first.contactMoment,'elapsedSeconds',0),false);
  db.exec('PRAGMA query_only=1');const secondBefore=state(db),second=read(db,prep.execution.reference);report.actualApiReads++;
  assert(second);assert.deepEqual(state(db),secondBefore);assert(frozen(second));detached(first,second);
  assert.equal(firstDebugDifference(first,second),null);assert.equal(stringifyDebugRecord(second),firstText);
  const deniedBefore=denied;assert.throws(()=>db.prepare('DELETE FROM main.pa_initial_joint_v1_executions WHERE 0'),/authorized/i);assert(denied>deniedBefore);
  const badBefore=state(db);report.badRefReads++;assert.throws(()=>read(db,input));assert.deepEqual(state(db),badBefore);
  db.exec('RELEASE caller_owned_initial_joint');assert.equal(db.isTransaction,true);db.exec('ROLLBACK');assert.equal(state(db).changes,before.changes);
  db.setAuthorizer(null);db.close();db=null;
  await writeFile(resolve(output,'actual-first.json'),firstText+'\n',{flag:'wx'});await save('actual-second.json',second);
  report.comparisons={selectedRawMembersNoValueDrift:true,losslessReadsExact:true,deeplyFrozen:true,deeplyDetached:true,
    inputDetached:true,exactSubTickMomentRetained:true,callerStatePreserved:true,authorizerPreserved:true,totalChangesUnchanged:true,badRefRejected:true};
  report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    if(bundle)report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion};
    for(const [path,pin]of Object.entries(report.harnessInputs??{})){pin.end=await fileState(resolve(root,path));assert.deepEqual(pin.end,pin.start,'harness input changed: '+path);}
    if(report.preparationInput){report.preparationInput.end=await fileState(preparationPath);assert.deepEqual(report.preparationInput.end,report.preparationInput.start,'preparation report changed');}
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,actualApiReads:report.actualApiReads,badRefReads:report.badRefReads,
  sourceInputs:report.bundle?.inputCount??0,recordedSerializationDifferences:report.rawSelectedComparison?.differences.length??null,
  error:report.error??report.pinError??null}));
