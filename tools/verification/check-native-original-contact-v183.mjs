import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,constants} from 'node:sqlite';
import {stringifyDebugRecord,firstDebugDifference} from './live-debug-record.mjs';
import {fileState,createPinnedNativeCopy,compilePinnedNativeEntry,assertNativeProbePins} from './native-measurement-probe-support-v183.mjs';

const root=process.cwd(),output=resolve(process.argv[2]??''),rel=relative(root,output);
assert(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');
await mkdir(output,{recursive:false});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),
  save=(name,value)=>writeFile(resolve(output,name),stringifyDebugRecord(value)+'\n',{flag:'wx'}),
  frozen=value=>!value||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value).every(frozen),
  state=db=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,
    changes:db.prepare('SELECT total_changes() n').get().n,mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version});
const script=resolve('tools/verification/check-native-original-contact-v183.mjs'),scriptSha=sha(await readFile(script));
const report={pass:false,authority:'CURRENT_NATIVE_ORIGINAL_PITCH_OWNER_ON_EXPLICIT_BUNT_FIXTURE',
  actualApiReads:0,badRefReads:0,traitTimeCreated:false,recognitionCreated:false,privateArtifactNotForPublication:true};
let bundle,copy,db;
try{
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-original-contact-case-v183.ts',
    outputPath:resolve(output,'original-contact-bundle.mjs')});
  const api=await import(pathToFileURL(bundle.bundlePath).href),originalPath=resolve(output,'authored-original.sqlite'),
    fixture=api.createCase(originalPath),original=await fileState(originalPath);
  assert(original.exists);await save('fixture-reference-expected.json',fixture);
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(output,'private-copy.sqlite'),expectedMainSha256:original.sha256});
  db=new DatabaseSync(copy.copyPath);
  let denied=0;
  db.setAuthorizer(code=>{
    if([constants.SQLITE_INSERT,constants.SQLITE_UPDATE,constants.SQLITE_DELETE,constants.SQLITE_ATTACH,constants.SQLITE_DETACH].includes(code)){
      denied++;return constants.SQLITE_DENY;
    }return constants.SQLITE_OK;
  });
  db.exec('BEGIN');db.exec('SAVEPOINT caller_owned_original');
  const before=state(db),input=structuredClone(fixture.reference),first=api.read(db,input);report.actualApiReads++;
  assert(first);assert.deepEqual(state(db),before);assert(frozen(first));
  const selected={source:first.source,actor:first.actor,contactEvent:first.contactEvent,contact:first.contact,
    progressRevision:first.progressRevision,scope:first.scope};
  // Native archive members are compared without rounding; object insertion order
  // is not the historical Native canonical-JSON contract.
  assert.deepEqual(selected,fixture.expected);
  assert.deepEqual(first.reference,fixture.reference);
  const firstText=stringifyDebugRecord(first);
  input.snapshotHash='0'.repeat(64);assert.deepEqual(first.reference,fixture.reference);
  assert.equal(Reflect.set(first.contact.exitVelocity,'x',12345),false);
  db.exec('PRAGMA query_only=1');const secondBefore=state(db),second=api.read(db,fixture.reference);report.actualApiReads++;
  assert(second);assert.deepEqual(state(db),secondBefore);assert(frozen(second));
  assert.equal(firstDebugDifference(first,second),null);assert.equal(stringifyDebugRecord(second),firstText);
  assert.notEqual(first,second);assert.notEqual(first.actor,second.actor);assert.notEqual(first.contact,second.contact);
  const deniedBefore=denied;assert.throws(()=>db.prepare('DELETE FROM main.physical_pitch_progress_actions WHERE 0'),/authorized/i);assert(denied>deniedBefore);
  const badBefore=state(db);report.badRefReads++;assert.throws(()=>api.read(db,input));assert.deepEqual(state(db),badBefore);
  db.exec('RELEASE caller_owned_original');assert.equal(db.isTransaction,true);db.exec('ROLLBACK');
  assert.equal(state(db).changes,before.changes);db.setAuthorizer(null);db.close();db=null;
  await writeFile(resolve(output,'actual-first.json'),firstText+'\n',{flag:'wx'});await save('actual-second.json',second);
  report.comparisons={originalMembersExact:true,losslessReadsExact:true,deeplyFrozen:true,detached:true,
    inputDetached:true,callerStatePreserved:true,authorizerPreserved:true,badRefRejected:true};
  report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    if(copy&&bundle)Object.assign(report,await assertNativeProbePins({copy,bundle}));
    report.bundle=bundle?{inputCount:bundle.inputCount,sha256:bundle.sha256,nodeVersion:bundle.nodeVersion,esbuildVersion:bundle.esbuildVersion}:null;
    report.harnessSha256=scriptSha;assert.equal(sha(await readFile(script)),scriptSha);
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  await save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,actualApiReads:report.actualApiReads,badRefReads:report.badRefReads,
  sourceInputs:report.bundle?.inputCount??0,error:report.error??report.pinError??null}));
