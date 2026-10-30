import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, constants } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord, firstDebugDifference } from './live-debug-record.mjs';

const root=process.cwd(),retained=resolve(process.argv[2]??''),baseline=resolve(process.argv[3]??''),out=resolve(process.argv[4]??''),rel=relative(root,out);
assert(process.argv.length===5&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V195, frozen V200 baseline and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-spin-neutral-cut11-v195-01'));
assert.equal(baseline,resolve('docs/verification/realism-debug-20261027/native-lifecycle-read-profile-v200-01'));
const paths=[resolve(retained,'report.json'),resolve(retained,'frontier.lossless.json'),resolve(baseline,'report.json'),resolve(baseline,'start-manifest.json'),resolve(baseline,'current.lossless.json')];
const inputBytes=paths.map(p=>readFileSync(p)),inputPins=Object.fromEntries(paths.map((p,i)=>[p,{exists:true,bytes:inputBytes[i].length,sha256:createHash('sha256').update(inputBytes[i]).digest('hex')}]));
const[accepted,frontier,oldProof,oldManifest,archivedCurrent]=inputBytes.map(bytes=>parseDebugRecord(bytes.toString('utf8')));
assert(accepted.pass&&frontier.currentCoverageProven&&oldProof.pass&&oldProof.sourceAndBundleEndPinProven);
assert.equal(oldProof.normalGetterInvocations,1);assert.deepEqual(accepted.frontier,frontier);
const original=resolve(accepted.copyPath),oldBundlePath=resolve(baseline,'lifecycle-read-bundle.mjs');
assert.equal(original,resolve(retained,'cut11-private.sqlite'));assert.equal(resolve(oldProof.originalPath),original);
const oldBundlePin={exists:true,bytes:oldManifest.bundle.bytes,sha256:oldManifest.bundle.sha256};
assert.deepEqual(await fileState(oldBundlePath),oldBundlePin);
mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const changesAllowed=new Set(['src/host/world/SamePlateAppearanceLifecycleFromSqlite.ts','src/host/world/SamePaLifecycleIdentityCandidatesV202.ts']);
const report={pass:false,boundary:'NORMAL_CURRENT_OLD_NEW_PRODUCTION_IDENTITY_COMPARISON_ONLY',originalPath:original,
  changeReason:'NEW_PRODUCTION_IDENTITY_LOOKUP_SOURCE_COMPATIBILITY_AND_TIMING_COMPARISON',execution:'PINNED_NODE_BASELINE_AND_NEW_ENTRY',
  normalGetterInvocations:{baseline:0,current:0},newWriterCalls:0,newPhysicalOperationsAccepted:0,newPracticeAccepted:0,newTakeAccepted:0,
  performancePass:false,wholeGoalComplete:false,oldFailedAndUnknownEvidencePreserved:true,privateArtifactNotForPublication:true,measurements:[]};
let bundle,db,before,stamps,activeVariant;
try{
  report.originalBefore=await databaseFiles(original);assert.deepEqual(dataPin(report.originalBefore),dataPin(accepted.copyAfter));
  report.harnessPins={};
  for(const p of [...paths,'tools/verification/check-native-lifecycle-identity-v202.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs']){
    report.harnessPins[p]=await fileState(resolve(root,p));if(inputPins[p])assert.deepEqual(report.harnessPins[p],inputPins[p],'input bytes changed after parsing');}
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-lifecycle-read-profile-v200.ts',outputPath:resolve(out,'new-lifecycle-read-bundle.mjs')});
  const allPaths=new Set([...Object.keys(oldManifest.bundle.sourcePins),...Object.keys(bundle.sourcePins)]);
  report.changedSourcePaths=[...allPaths].filter(p=>oldManifest.bundle.sourcePins[p]?.sha256!==bundle.sourcePins[p]?.sha256);
  assert(report.changedSourcePaths.includes('src/host/world/SamePlateAppearanceLifecycleFromSqlite.ts'));
  assert(report.changedSourcePaths.every(p=>changesAllowed.has(p)),'unrelated Source change would confound this comparison');
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution},bundle,baselineBundle:{path:oldBundlePath,pin:oldBundlePin,sourcePins:oldManifest.bundle.sourcePins},
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,input:{viewReference:frontier.viewReference,expectedResolutionReference:frontier.resolutionReference},
    changedSourcePaths:report.changedSourcePaths,timing:{variantOrder:['baseline','current'],trialsPerVariant:1,freshConnectionPerVariant:true,
      interval:'SINGLE_NORMAL_GETTER_ONLY_NO_INSPECTOR',cacheCondition:'RAW_DIGEST_BEFORE_EACH_GETTER_SHARED_PROCESS_OS_CACHE_BASELINE_THEN_CURRENT',
      interpretation:'ONE_ORDERED_COMPARISON_NOT_FULL_MATCH_SPEEDUP'},constraints:['OS_READONLY_QUERY_ONLY','ALL_OLD_ROWS_ROWIDS_SCHEMA_HEADS_AND_CALLER_PRESERVED','NO_WRITER_PHYSICS_PRACTICE_TAKE_OR_CALIBRATION_ACCEPTANCE']});
  const oldApi=await import(pathToFileURL(oldBundlePath).href),newApi=await import(pathToFileURL(bundle.bundlePath).href),results={};
  for(const[variant,api]of[['baseline',oldApi],['current',newApi]]){
    activeVariant=variant;db=new DatabaseSync(original,{readOnly:true});db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v202');
    db.setAuthorizer(code=>code===constants.SQLITE_ATTACH||code===constants.SQLITE_DETACH?constants.SQLITE_DENY:constants.SQLITE_OK);
    stamps=()=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,totalChanges:db.prepare('SELECT total_changes() n').get().n,
      mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version});
    const callerBefore=stamps();before=api.rawNativeSpinNeutralSqlDigestV193(db);save(variant+'-logical-before.json',before);
    const started=process.hrtime.bigint();report.normalGetterInvocations[variant]++;
    const current=api.readNativeLifecycleOnceV200(db,frontier.viewReference),elapsed=process.hrtime.bigint()-started;
    results[variant]=current;save(variant+'-current.lossless.json',current);
    assert.equal(firstDebugDifference(archivedCurrent,current),null,'normal current differs from the preserved V200 result');
    assert.equal(current.view.cut.stage,'resolved');assert.deepEqual(current.view.cut.physicalOperationReference,frontier.resolutionReference);
    const after=api.rawNativeSpinNeutralSqlDigestV193(db);save(variant+'-logical-after.json',after);assert.deepEqual(after,before);assert.deepEqual(stamps(),callerBefore);
    assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v202"),/not authorized/);
    db.exec('ROLLBACK TO caller_v202; RELEASE caller_v202');assert.equal(db.isTransaction,true);db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;
    report.measurements.push({variant,normalGetterInvocations:1,elapsedNanoseconds:String(elapsed),elapsedMilliseconds:Number(elapsed)/1e6,
      allRowsRowidsSchemaHeadsExact:true,callerTransactionQueryOnlySavepointAuthorizerPreserved:true});before=null;stamps=null;activeVariant=null;
  }
  assert.equal(firstDebugDifference(results.baseline,results.current),null,'old/new full normal current records differ');
  assert.deepEqual(report.normalGetterInvocations,{baseline:1,current:1});report.normalCurrentFullRecordExact=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){
    try{if(before){const digest=(await import(pathToFileURL(oldBundlePath).href)).rawNativeSpinNeutralSqlDigestV193;assert.deepEqual(digest(db),before);report.failedVariantRowsUnchanged=true;}}
    catch(error){report.cleanupError=String(error.stack??error);report.failedVariant=activeVariant;report.pass=false;process.exitCode=1;}
    finally{try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;}
      catch(error){report.connectionCleanupError=String(error.stack??error);report.pass=false;process.exitCode=1;}}
  }
  try{
    report.originalAfter=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfter),dataPin(report.originalBefore));report.allDataFilesUnchanged=true;
    report.shmObservation={before:report.originalBefore['-shm'],after:report.originalAfter['-shm']};assert.deepEqual(await fileState(oldBundlePath),oldBundlePin);
    if(bundle){assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});report.sourcePins={};
      for(const[p,pin]of Object.entries(bundle.sourcePins)){const end=await fileState(resolve(root,p));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.sourcePins[p]={...pin,endSha256:end.sha256};}
      report.sourceAndBundleEndPinProven=true;report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256};}
    for(const[p,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,p)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,normalCurrentFullRecordExact:report.normalCurrentFullRecordExact,measurements:report.measurements,
  allDataFilesUnchanged:report.allDataFilesUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  error:report.error??report.cleanupError??report.pinError??null}));
