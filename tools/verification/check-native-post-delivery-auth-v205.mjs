import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync,createWriteStream,existsSync,mkdirSync,openSync,readFileSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute,relative,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync,backup } from 'node:sqlite';
import { compilePinnedNativeEntry,databaseFiles,fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord,stringifyDebugRecord } from './live-debug-record.mjs';

const root=process.cwd(),retained=resolve(process.argv[2]??''),out=resolve(process.argv[3]??''),rel=relative(root,out);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel));
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-field-delivery-retained-v204-01'));
const inputPaths=['report.json','frontier.lossless.json','start-manifest.json'].map(name=>resolve(retained,name));
const inputBytes=inputPaths.map(path=>readFileSync(path)),inputPins=Object.fromEntries(inputPaths.map((path,i)=>[path,
  {exists:true,bytes:inputBytes[i].length,sha256:createHash('sha256').update(inputBytes[i]).digest('hex')}]));
const[proof,accepted]=inputBytes.map(bytes=>parseDebugRecord(bytes.toString('utf8')));
assert(proof.pass&&proof.originalNativeCasePassed&&proof.deliveryCheckpointProven&&proof.deliveryAfterFenceProven);
assert(proof.originalDataUnchanged&&proof.retainedTargetDataUnchanged&&proof.existingImmutableRowsRowidsSchemaAndHeadsUnchanged);
assert(proof.sourceAndBundleEndPinProven&&proof.harnessAndInputEndPinsProven);assert.equal(proof.nativeRunRepeated,0);
assert.equal(proof.boundary,'NATIVE_FIXTURE_DELIVERY_RETAINED_VERIFICATION_ONLY');assert.deepEqual(accepted,proof.frontier);
assert.equal(accepted.resumeReady,false);assert.equal(accepted.nativeResumeAdapterRequired,true);assert.equal(accepted.fullContinuationComplete,false);
const original=resolve(proof.copyPath),destination=resolve(out,'post-delivery-auth-private.sqlite');
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,accepted[key]]));
assert.equal(Object.keys(input.resumePins).length,7);assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const report={pass:false,boundary:'NATIVE_POST_DELIVERY_ENTRY_AUTHENTICATION_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,fullContinuationComplete:false,newAcceptedOperations:0,
  cut6AdmissionPerformed:false,consumerAdoptionProven:false,officialTerminalProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.originalBefore=await databaseFiles(original);assert.deepEqual(dataPin(report.originalBefore),dataPin(proof.copyAfter));
  report.harnessPins={...inputPins};
  for(const path of['tools/verification/check-native-post-delivery-auth-v205.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  for(const[path,pin]of Object.entries(inputPins))assert.deepEqual(await fileState(path),pin);
  digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-post-delivery-auth-v205.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,input,stopBoundary:'NATIVE_POST_DELIVERY_ENTRY_AUTHENTICATED_BEFORE_CUT6',
    constraints:['NEW_OWNED_SQLITE_BACKUP_ONLY','NO_OLD_SETUP_REGENERATION','NO_ACCEPT_OR_HEAD_OR_SCHEMA_CHANGE','LAN_ENTRY_AND_GUARDS_UNCHANGED','SENTINEL_IDENTITY_ONLY_OTHER_ERRORS_PROPAGATE']});
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');const before=digest(source);save('before-logical-with-rowid.json',before);
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;
  report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-post-delivery-auth-v205.test.ts',
    '--testNamePattern','NP205-S01','--maxWorkers=1','--minWorkers=1'],{cwd:root,windowsHide:true,
    env:{...process.env,BASEBALL_NATIVE_POST_DELIVERY_AUTH_V205_DATABASE:destination,BASEBALL_NATIVE_POST_DELIVERY_AUTH_V205_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_POST_DELIVERY_AUTH_V205_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;
  save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});
  await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'Native post-delivery authentication failed; inspect retained records');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert(report.nativeSummary.pass);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);assert(frontier.nativePostDeliveryEntryAuthenticated&&frontier.nativePostDeliveryConsumerProven&&frontier.resumeReady);
  assert.equal(frontier.nativeResumeAdapterRequired,false);assert.equal(frontier.readPhaseClosedBeforeStage,true);
  assert.equal(frontier.newAcceptedOperations,0);assert.equal(frontier.normalLifecycleAdvances,0);assert.equal(frontier.cut6AdmissionPerformed,false);
  assert.equal(frontier.deliveryAwaitingLifecycleAdmission,true);assert.equal(frontier.finalLifecycleCurrentProven,false);
  assert.equal(frontier.fullContinuationComplete,false);assert.equal(frontier.consumerAdoptionProven,false);
  assert.deepEqual(frontier.finalViewReference,input.finalViewReference);assert.deepEqual(frontier.resumePins,input.resumePins);assert.deepEqual(frontier.eventReferences,input.eventReferences);
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target);assert.deepEqual(after,before);save('after-logical-with-rowid.json',after);
  target.exec('ROLLBACK');target.close();target=null;report.allRowsRowidsSchemaAndHeadsUnchanged=true;report.nativePostDeliveryConsumerProven=true;report.resumeReady=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.originalAfter=await databaseFiles(original);report.copyAfter=await databaseFiles(destination);assert.deepEqual(dataPin(report.originalAfter),dataPin(report.originalBefore));report.originalDataUnchanged=true;
    report.bundles=[];
    for(const pinned of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});const pins={};
      for(const[path,pin]of Object.entries(pinned.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});pins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:pinned===digestBundle,inputCount:pinned.inputCount,sha256:pinned.sha256,sourcePins:pins});}
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,nativePostDeliveryConsumerProven:report.nativePostDeliveryConsumerProven,resumeReady:report.resumeReady,
  allRowsRowidsSchemaAndHeadsUnchanged:report.allRowsRowidsSchemaAndHeadsUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  error:report.error??report.cleanupError??report.pinError??null}));
