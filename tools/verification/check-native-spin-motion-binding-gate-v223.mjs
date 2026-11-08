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
const oldDir='docs/verification/realism-debug-20261027/native-spin-neutral-v193-recovery-01',oldManifestPath=oldDir+'/start-manifest.json',oldReportPath=oldDir+'/report.json',
 v220Path='docs/verification/realism-debug-20261027/native-lifecycle-current-profile-v220-01/start-manifest.json',
 oldReceiptPath='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_0f10069df77e4cb98141d6a52e920c3c.json',
 v202ReceiptPath='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_7b16b92db7ef4ddbad8f517c31d0e9b9.json',
 v220ReceiptPath='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_58ff906fba67411ab2f0ce0eb0f51520.json',
 sourceException='src/host/world/SamePlateAppearanceLifecycleFromSqlite.ts',oldHash='94f241dfa9d0438b66237d1fddb1b381cc8f9f11d0334de594e9fe1346746365',
 currentHash='f6b46aef82d5bf9bc88322aad4d1235ce58b9a0de01d7c9c4faab231305d1ebc';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
function receipt(path){const r=read(path);assert.equal(r.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(r.result,'PASS');assert.equal(r.exit_code,0);
 const bytes=readFileSync(r.output_path);pins[resolve(r.output_path)]={exists:true,bytes:bytes.length,sha256:sha(bytes)};assert.equal(pins[resolve(r.output_path)].sha256,r.output_sha256);return r}
const old=read(oldManifestPath),previous=read(oldReportPath),v220=read(v220Path);receipt(oldReceiptPath);receipt(v202ReceiptPath);receipt(v220ReceiptPath);
assert(previous.pass&&previous.recoverySourceAndBundleEndPinProven&&previous.allRowsRowidAndCatalogUnchanged);
assert.equal(old.bundle.sourcePins[sourceException].sha256,oldHash);assert.equal(v220.closure.sourcePins[sourceException].sha256,currentHash);
assert.equal(Object.keys(old.bundle.sourcePins).length,792);
for(const [p,pin] of Object.entries(old.bundle.sourcePins)){
 const current=await fileState(resolve(p));if(p===sourceException)assert.deepEqual(current,{exists:true,bytes:v220.closure.sourcePins[p].bytes,sha256:currentHash});
 else assert.deepEqual(current,{exists:true,bytes:pin.bytes,sha256:pin.sha256},'old Source differs: '+p);
}
for(const [p,pin] of Object.entries(old.harnessPins))assert.deepEqual(await fileState(resolve(p)),pin,'old retained artifact differs: '+p);
for(const p of [old.bundle.bundlePath,'tools/verification/check-native-spin-motion-binding-gate-v223.mjs','tools/verification/native-measurement-probe-support-v183.mjs',
 'tools/verification/live-debug-record.mjs','docs/verification/realism-debug-20261027/LIFECYCLE-IDENTITY-LOOKUP-V202.md'])pins[resolve(p)]=await fileState(resolve(p));
assert.deepEqual(await fileState(old.bundle.bundlePath),{exists:true,bytes:old.bundle.bytes,sha256:old.bundle.sha256});
const original=resolve(previous.originalPath),baseline=resolve(previous.baselinePath),copyPath=resolve(out,'owned-readonly.sqlite');
const data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const originalBefore=await databaseFiles(original),baselineBefore=await databaseFiles(baseline);
assert.deepEqual(data(originalBefore),data(previous.originalAfter));assert.deepEqual(data(baselineBefore),data(previous.baselineAfter));
assert(originalBefore.main.exists&&originalBefore['-wal'].exists&&!originalBefore['-journal'].exists,'retained main/WAL pair required');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'});
const report={pass:false,boundary:'V223_CURRENT_NATIVE_READONLY_MOTOR_BINDING_GATE',originalDatabaseOpened:false,baselineDatabaseOpened:false,
 oldRecoveryProof:'0f10069df77e4cb98141d6a52e920c3c',oldSuffixTimeout:'f7d6a03c90074cd48a7addc2f0988ef4',oldSuffixEndPins:'UNKNOWN',
 sourceException:{path:sourceException,oldHash,currentHash,provenance:['7b16b92db7ef4ddbad8f517c31d0e9b9','58ff906fba67411ab2f0ce0eb0f51520'],scope:'ONE_PATH_ONLY_NO_GENERAL_COMPATIBILITY_CLAIM'},
 originalBefore,baselineBefore,newNativeWrites:0,regeneratedContacts:0,nativeTopAdmissionProven:false,performancePass:false};
let db,bundle,copyBefore,logicalBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore,'original files changed while copying');copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore,'fresh copied pair differs');
 bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-spin-motion-binding-gate-v223.ts',outputPath:resolve(out,'current-source-bundle.mjs')});
 for(const [p,pin] of Object.entries(bundle.sourcePins)){
  if(p==='tools/verification/native-spin-motion-binding-gate-v223.ts')continue;
  const expected=old.bundle.sourcePins[p]??v220.closure.sourcePins[p];assert(expected,'new Source outside old/V220 closure: '+p);
  const wanted=p===sourceException?v220.closure.sourcePins[p]:expected;assert.equal(pin.sha256,wanted.sha256,'new closure Source differs: '+p);assert.equal(pin.bytes,wanted.bytes);
 }
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_COMPILED_SOURCE_READONLY_OWNED_PAIR',historicalBundleExecuted:false},
  oldReceiptPath,v202ReceiptPath,v220ReceiptPath,sourceException:report.sourceException,originalBefore,baselineBefore,copyBefore,bundle,pins,gateInput:old.pins});
 const api=await import(pathToFileURL(bundle.bundlePath).href);db=new DatabaseSync(copyPath,{readOnly:true});db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v223');
 db.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);
 const stamps=()=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,totalChanges:db.prepare('SELECT total_changes() n').get().n,
  mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version});
 const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v223"),/not authorized/);
 logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-before-with-rowid.json',logicalBefore);
 const result=api.inspectNativeSpinMotionBindingV223(db,old.pins);save('authenticated-records.lossless.json',result);report.summary=result.summary;
 assert.deepEqual(api.rawNativeSpinNeutralSqlDigestV193(db),logicalBefore);assert.deepEqual(stamps(),before);
 assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v223"),/not authorized/);db.exec('ROLLBACK TO caller_v223; RELEASE caller_v223');assert(db.isTransaction);
 report.logicalRowsRowidsSchemaHeadsUnchanged=true;report.callerStateAndAuthorizerPreserved=true;db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.cleanupError=String(e);report.pass=false;process.exitCode=1}
 try{
  report.originalAfter=await databaseFiles(original);report.baselineAfter=await databaseFiles(baseline);assert.deepEqual(data(report.originalAfter),data(originalBefore));assert.deepEqual(data(report.baselineAfter),data(baselineBefore));
  report.originalDataUnchanged=true;report.baselineDataUnchanged=true;
  if(copyBefore){report.copyAfter=await databaseFiles(copyPath);assert.deepEqual(data(report.copyAfter),data(copyBefore));report.ownedCopyDataUnchanged=true}
  if(bundle){assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});for(const [p,pin] of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.currentSourceAndBundleEndPins=true}
  for(const [p,pin] of Object.entries(pins))assert.deepEqual(await fileState(p),pin);for(const [p,pin] of Object.entries(old.harnessPins))assert.deepEqual(await fileState(resolve(p)),pin);
  report.retainedArtifactsAndHarnessEndPins=true;report.shmObservation={originalBefore:originalBefore['-shm'],originalAfter:report.originalAfter['-shm'],baselineBefore:baselineBefore['-shm'],baselineAfter:report.baselineAfter['-shm']};
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
