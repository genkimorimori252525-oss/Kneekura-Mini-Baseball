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
const v223='work/native-spin-motion-binding-gate-v223-01',v223Start=v223+'/start-manifest.json',v223Report=v223+'/report.json',
 v193Report='docs/verification/realism-debug-20261027/native-spin-neutral-v193-recovery-01/report.json',
 receiptPath='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_f74e5e2f7db84e6ab20c63df1b10b7bf.json',
 store='src/host/world/SqliteStandalonePracticeStore.ts',baseline='work/native-standalone-motor-evidence-baseline/source-start.ts.txt',
 entry='tools/verification/motor-evidence-readonly-gate-v224.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const previous=read(v223Report),start=read(v223Start),old=read(v193Report),receipt=read(receiptPath),log=readFileSync(receipt.output_path);
pins[resolve(receipt.output_path)]={exists:true,bytes:log.length,sha256:sha(log)};assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
assert(previous.pass&&previous.originalDataUnchanged&&previous.baselineDataUnchanged&&previous.ownedCopyDataUnchanged&&previous.logicalRowsRowidsSchemaHeadsUnchanged&&previous.currentSourceAndBundleEndPins&&previous.retainedArtifactsAndHarnessEndPins);
assert.equal(previous.summary.status,'UNAVAILABLE');assert.equal(previous.summary.reason,'NO_MOTOR_DISTINCTION');
const beforeBytes=readFileSync(baseline),currentBytes=readFileSync(store),storeOld=start.bundle.sourcePins[store];
assert.equal(sha(beforeBytes),'4fbf10071eac9ca959ec0e69e3d8e4698738fa33692c3a70c4f38e66d88cdcd3');assert.equal(storeOld.sha256,sha(beforeBytes));assert.equal(storeOld.bytes,beforeBytes.length);
assert.equal(sha(currentBytes),'492027b0ac855de442d037558029992c60b5c73779b05da82fa42bb3502974af');assert(currentBytes.subarray(0,beforeBytes.length).equals(beforeBytes),'baseline literal reverse differs');
const added=currentBytes.subarray(beforeBytes.length);assert(added.toString('utf8').includes('export const readNativeStandaloneBattingMotorEvidenceV224 ='));
for(const [p,pin] of Object.entries(start.bundle.sourcePins))if(p!==store)assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256},'V223 Source differs: '+p);
for(const [p,pin] of Object.entries(start.pins))assert.deepEqual(await fileState(p),pin,'V223 retained artifact differs: '+p);
for(const p of [baseline,'work/native-standalone-motor-evidence-baseline/reverse-proof.json',start.bundle.bundlePath,v223+'/authenticated-records.lossless.json',entry,'tools/verification/motor-evidence-readonly-gate-v224.test.ts',
 'tools/verification/check-motor-evidence-readonly-gate-v224.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])pins[resolve(p)]=await fileState(resolve(p));
assert.deepEqual(await fileState(start.bundle.bundlePath),{exists:true,bytes:start.bundle.bytes,sha256:start.bundle.sha256});
const original=resolve(old.originalPath),baselineDb=resolve(old.baselinePath),copyPath=resolve(out,'owned-readonly.sqlite'),data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const originalBefore=await databaseFiles(original),baselineBefore=await databaseFiles(baselineDb);assert.deepEqual(data(originalBefore),data(previous.originalAfter));assert.deepEqual(data(baselineBefore),data(previous.baselineAfter));
assert(originalBefore.main.exists&&originalBefore['-wal'].exists&&!originalBefore['-journal'].exists,'original main/WAL pair required');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'});
const report={pass:false,boundary:'V224_CURRENT_NATIVE_READONLY_ORIGINAL_PRACTICE_MOTOR_EVIDENCE',originalDatabaseOpened:false,baselineDatabaseOpened:false,
 previousGate:'f74e5e2f7db84e6ab20c63df1b10b7bf',oldSuffixEndPins:'UNKNOWN',newNativeWrites:0,regeneratedContacts:0,futurePitchBindingProven:false,performancePass:false,
 sourceExceptions:[previous.sourceException,{path:store,oldHash:sha(beforeBytes),currentHash:sha(currentBytes),literalReverseFullBytesExact:true,appendedBytes:added.length}],originalBefore,baselineBefore};
let db,bundle,copyBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore);copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore);
 bundle=await compilePinnedNativeEntry({root,entryPath:entry,outputPath:resolve(out,'current-source-bundle.mjs')});
 for(const [p,pin] of Object.entries(bundle.sourcePins)){if(p===entry)continue;const expected=start.bundle.sourcePins[p];assert(expected,'Source outside V223 closure: '+p);
  const current=p===store?{bytes:currentBytes.length,sha256:sha(currentBytes)}:expected;assert.equal(pin.bytes,current.bytes);assert.equal(pin.sha256,current.sha256,'new closure differs: '+p)}
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_SOURCE_READONLY_OWNED_PAIR',historicalBundleExecuted:false},previousGate:receiptPath,
  sourceExceptions:report.sourceExceptions,originalBefore,baselineBefore,copyBefore,bundle,pins,gateInput:start.gateInput});
 const api=await import(pathToFileURL(bundle.bundlePath).href);db=new DatabaseSync(copyPath,{readOnly:true});db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v224');
 db.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);
 const stamps=()=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,totalChanges:db.prepare('SELECT total_changes() n').get().n,
  mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version});
 const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v224"),/not authorized/);
 const logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-before-with-rowid.json',logicalBefore);
 const result=api.inspectNativeMotorEvidenceV224(db,start.gateInput);save('authenticated-motor-evidence.lossless.json',result);report.summary=result.summary;
 assert.deepEqual(api.rawNativeSpinNeutralSqlDigestV193(db),logicalBefore);assert.deepEqual(stamps(),before);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v224"),/not authorized/);
 db.exec('ROLLBACK TO caller_v224; RELEASE caller_v224');assert(db.isTransaction);report.logicalRowsRowidsSchemaHeadsUnchanged=true;report.callerStateAndAuthorizerPreserved=true;
 db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.cleanupError=String(e);report.pass=false;process.exitCode=1}
 try{report.originalAfter=await databaseFiles(original);report.baselineAfter=await databaseFiles(baselineDb);assert.deepEqual(data(report.originalAfter),data(originalBefore));assert.deepEqual(data(report.baselineAfter),data(baselineBefore));
  report.originalDataUnchanged=true;report.baselineDataUnchanged=true;if(copyBefore){report.copyAfter=await databaseFiles(copyPath);assert.deepEqual(data(report.copyAfter),data(copyBefore));report.ownedCopyDataUnchanged=true}
  if(bundle){assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});for(const [p,pin] of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.currentSourceAndBundleEndPins=true}
  for(const [p,pin] of Object.entries(pins))assert.deepEqual(await fileState(p),pin);
  for(const [p,pin] of Object.entries(start.pins))assert.deepEqual(await fileState(p),pin,'V223 retained artifact changed: '+p);
  for(const [p,pin] of Object.entries(start.bundle.sourcePins))if(p!==store)assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256},'V223 Source changed: '+p);
  report.retainedArtifactsAndHarnessEndPins=true;
  report.shmObservation={originalBefore:originalBefore['-shm'],originalAfter:report.originalAfter['-shm'],baselineBefore:baselineBefore['-shm'],baselineAfter:report.baselineAfter['-shm']};
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
