import assert from 'node:assert/strict';
import { copyFileSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, constants as sqliteConstants } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';
const root=resolve('.'),out=resolve(process.argv[2]??''),rel=relative(root,out);
assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&!existsSync(out),'new workspace output required');
const priorDir='work/native-observed-spin-aim-trial-v226-01',startPath=priorDir+'/start-manifest.json',reportPath=priorDir+'/report.json',resultPath=priorDir+'/records/result.lossless.json',
 receiptPath='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_30a0abefd7e94f88a63f230d82558d35.json',entry='tools/verification/native-spin-trial-motor-evidence-v227.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const start=read(startPath),previous=read(reportPath),stored=read(resultPath),receipt=read(receiptPath),log=readFileSync(receipt.output_path);
pins[resolve(receipt.output_path)]={exists:true,bytes:log.length,sha256:sha(log)};assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
assert(previous.pass&&previous.originalFilesUnchanged&&previous.oldRowsRowidsCatalogAndOtherHeadsUnchanged&&previous.callerStatePreserved&&previous.endPinsProven);
assert(previous.result.trialSelected&&previous.result.actualContact&&previous.result.topspinDirection&&previous.result.qualifiedTransferProven===false);
assert.equal(stored.result.resolutionReference.owner,'pa_physical_v1_resolutions');assert.equal(Object.keys(start.bundle.sourcePins).length,850);
for(const [p,pin] of Object.entries(start.bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256},'V226 Source differs: '+p);
for(const [p,pin] of Object.entries(start.pins))assert.deepEqual(await fileState(p),pin,'V226 retained artifact differs: '+p);
for(const [p,pin] of Object.entries(start.digestBundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256},'V226 digest Source differs: '+p);
for(const bundle of [start.bundle,start.digestBundle])assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});
for(const p of [start.bundle.bundlePath,start.digestBundle.bundlePath,entry,'src/host/world/NativeSpinTrialMotorEvidenceV227.ts',
 'src/host/world/NativeSpinTrialMotorEvidenceV227.test.ts','tools/verification/native-spin-trial-motor-evidence-v227.test.ts',
 'tools/verification/check-native-spin-trial-motor-evidence-v227.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])pins[resolve(p)]=await fileState(resolve(p));
const original=resolve(previous.copyPath),expectedOriginal=resolve(priorDir,'owned-trial.sqlite');assert.equal(original,expectedOriginal);
const data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]])),retained=Object.entries(previous.retainedAfter);
assert.equal(retained.length,8);const retainedBefore={};for(const [p,expected] of retained){const actual=await databaseFiles(p);assert.deepEqual(data(actual),data(expected),'retained database differs: '+p);retainedBefore[p]=actual}
const originalBefore=await databaseFiles(original);assert.deepEqual(data(originalBefore),data(previous.copyAfter));
assert(originalBefore.main.exists&&!originalBefore['-journal'].exists,'retained original pair unavailable');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'}),copyPath=resolve(out,'owned-readonly.sqlite');
const report={pass:false,boundary:'V227_CURRENT_NATIVE_READONLY_TRIAL_EVIDENCE',originalDatabaseOpened:false,retainedDatabasesOpened:0,retainedDatabaseCount:8,
 priorReceipt:'30a0abefd7e94f88a63f230d82558d35',oldSuffixEndPins:'UNKNOWN',newNativeWrites:0,newPractice:0,newContact:0,
 qualifiedTransferProven:false,earnedQualification:false,performancePass:false,originalBefore,retainedBefore};
let db,bundle,copyBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore,'original pair changed during copy');copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore,'owned paired copy differs');
 bundle=await compilePinnedNativeEntry({root,entryPath:entry,outputPath:resolve(out,'current-source-bundle.mjs')});
 const additions=new Set([entry,'src/host/world/NativeSpinTrialMotorEvidenceV227.ts']);
 for(const [p,pin] of Object.entries(bundle.sourcePins)){if(additions.has(p))continue;const expected=start.bundle.sourcePins[p];assert(expected,'Source outside frozen V226 closure: '+p);
  assert.equal(pin.bytes,expected.bytes);assert.equal(pin.sha256,expected.sha256,'Source differs: '+p)}
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_SOURCE_READONLY_OWNED_PAIR',historicalBundleExecuted:false},priorReceipt:receiptPath,
  originalBefore,copyBefore,retainedBefore,bundle,pins,resolutionReference:stored.result.resolutionReference});
 const api=await import(pathToFileURL(bundle.bundlePath).href);db=new DatabaseSync(copyPath,{readOnly:true});db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v227');
 db.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);
 const stamps=()=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,changes:db.prepare('SELECT total_changes() n').get().n,
  mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version});
 const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v227"),/not authorized/);
 const logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-before-with-rowid.json',logicalBefore);
 const result=api.inspectRetainedSpinTrialV227(db,stored.result);save('authenticated-trial-evidence.lossless.json',result);report.summary=result.summary;
 assert.equal(result.summary.hasActualContact,true);assert.equal(result.evidence.independenceKey.policy,'ONE_PER_PHYSICAL_PITCH');
 assert.deepEqual(api.rawNativeSpinNeutralSqlDigestV193(db),logicalBefore);assert.deepEqual(stamps(),before);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v227"),/not authorized/);
 db.exec('ROLLBACK TO caller_v227; RELEASE caller_v227');assert(db.isTransaction);report.logicalRowsRowidsSchemaHeadsUnchanged=true;report.callerStateAndAuthorizerPreserved=true;
 db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.cleanupError=String(e);report.pass=false;process.exitCode=1}
 try{report.originalAfter=await databaseFiles(original);assert.deepEqual(report.originalAfter,originalBefore);report.originalDataUnchanged=true;report.originalFilesUnchanged=true;
  report.retainedAfter={};for(const [p,expected] of Object.entries(retainedBefore)){const after=await databaseFiles(p);assert.deepEqual(after,expected);report.retainedAfter[p]=after}report.retainedDataUnchanged=true;report.retainedFilesUnchanged=true;
  if(copyBefore){report.copyAfter=await databaseFiles(copyPath);assert.deepEqual(data(report.copyAfter),data(copyBefore));report.ownedCopyDataUnchanged=true}
  if(bundle){assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});for(const [p,pin] of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.currentSourceAndBundleEndPins=true}
  for(const [p,pin] of Object.entries(start.bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});
  for(const [p,pin] of Object.entries(start.pins))assert.deepEqual(await fileState(p),pin);
  for(const [p,pin] of Object.entries(start.digestBundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});
  for(const [p,pin] of Object.entries(pins))assert.deepEqual(await fileState(p),pin);report.retainedArtifactsAndHarnessEndPins=true;
  report.shmObservation={originalBefore:originalBefore['-shm'],originalAfter:report.originalAfter['-shm']};
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
