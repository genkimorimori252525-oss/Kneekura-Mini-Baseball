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
const priorDir='work/native-spin-trial-cohort-v228-01',priorStart=priorDir+'/start-manifest.json',priorReport=priorDir+'/report.json',priorRecord=priorDir+'/authenticated-cohort.lossless.json',
 trialDir='work/native-observed-spin-aim-trial-v226-01',trialStart=trialDir+'/start-manifest.json',trialReport=trialDir+'/report.json',
 priorReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_e594878fc1004bdebc5b085032f88977.json',
 trialReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_30a0abefd7e94f88a63f230d82558d35.json',entry='tools/verification/spin-aim-qualification-owned-copy-v230.ts',table='world_spin_aim_qualifications_v230';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const parent=read(priorStart),previous=read(priorReport),retained=read(priorRecord),trial=read(trialStart),trialResult=read(trialReport);
for(const path of [priorReceipt,trialReceipt]){const receipt=read(path),bytes=readFileSync(receipt.output_path);pins[resolve(receipt.output_path)]={exists:true,bytes:bytes.length,sha256:sha(bytes)};
 assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(bytes),receipt.output_sha256)}
assert(previous.pass&&previous.originalFilesUnchanged&&previous.retainedFilesUnchanged&&previous.ownedCopyDataUnchanged&&previous.logicalRowsRowidsSchemaHeadsUnchanged&&previous.callerStateAndAuthorizerPreserved&&previous.currentSourceAndBundleEndPins&&previous.retainedArtifactsAndHarnessEndPins);
assert.equal(previous.summary.qualificationIssued,false);assert.equal(previous.summary.qualifiedTransferProven,false);assert.equal(previous.summary.actualTrialCount,1);
assert(trialResult.pass&&trialResult.endPinsProven&&trialResult.result.trialSelected&&trialResult.result.actualContact);
assert.equal(Object.keys(trial.bundle.sourcePins).length,850);
for(const bundle of [trial.bundle,parent.bundle])for(const [p,pin] of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256},'parent Source differs: '+p);
for(const manifest of [trial,parent])for(const [p,pin] of Object.entries(manifest.pins))assert.deepEqual(await fileState(p),pin,'retained artifact differs: '+p);
for(const bundle of [trial.bundle,trial.digestBundle,parent.bundle])assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});
for(const p of [trial.bundle.bundlePath,trial.digestBundle.bundlePath,parent.bundle.bundlePath,entry,'src/host/world/SpinAimQualificationV228.ts','src/host/world/NativeSpinTrialCohortInventoryV228.ts',
 'tools/verification/check-spin-aim-qualification-owned-copy-v230.mjs','src/host/world/SqliteSpinAimQualificationV230.ts','src/host/world/SqliteSpinAimQualificationV230.test.ts','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])pins[resolve(p)]=await fileState(resolve(p));
const original=resolve(trialResult.copyPath);assert.equal(original,resolve(trialDir,'owned-trial.sqlite'));const data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const retainedBefore={};for(const [p,expected] of Object.entries(previous.retainedAfter)){const actual=await databaseFiles(p);assert.deepEqual(actual,expected,'retained DB files differ: '+p);retainedBefore[p]=actual}
assert.equal(Object.keys(retainedBefore).length,8);const originalBefore=await databaseFiles(original);assert.deepEqual(originalBefore,previous.originalAfter,'original trial files differ');
assert(originalBefore.main.exists&&!originalBefore['-journal'].exists,'original main unavailable or journal present');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'}),copyPath=resolve(out,'owned-diagnostic.sqlite');
const report={pass:false,boundary:'V230_DIAGNOSTIC_INSUFFICIENT_EVALUATION_ONLY',originalDatabaseOpened:false,retainedDatabasesOpened:0,retainedDatabaseCount:8,
 newOwnerRowsAllowed:1,newPractice:0,newContact:0,qualificationIssued:false,performancePass:false,originalBefore,retainedBefore};let db,bundle,copyBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore,'original files changed while copying');copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore);
 bundle=await compilePinnedNativeEntry({root,entryPath:entry,outputPath:resolve(out,'current-source-bundle.mjs')});
 const additions=new Set([entry,'src/host/world/SqliteSpinAimQualificationV230.ts']);
 for(const [p,pin] of Object.entries(bundle.sourcePins)){if(additions.has(p))continue;const expected=trial.bundle.sourcePins[p]??parent.bundle.sourcePins[p];assert(expected,'Source outside pinned parent closures: '+p);
  assert.equal(pin.bytes,expected.bytes);assert.equal(pin.sha256,expected.sha256,'Source differs: '+p)}
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_SOURCE_FRESH_OWNED_COPY_WITH_ONE_DIAGNOSTIC_ROW',historicalBundleExecuted:false},priorReceipt,trialReceipt,
  originalBefore,copyBefore,retainedBefore,bundle,pins,resolutionReference:retained.evidence.resolutionReference});
 const api=await import(pathToFileURL(bundle.bundlePath).href);
 const openRead=()=>{const c=new DatabaseSync(copyPath,{readOnly:true});c.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v230');c.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);return c};
 const closeRead=c=>{c.exec('ROLLBACK TO caller_v230; RELEASE caller_v230');assert(c.isTransaction);c.exec('ROLLBACK');c.setAuthorizer(null);c.close()};
 const stamps=c=>({transaction:c.isTransaction,queryOnly:c.prepare('PRAGMA query_only').get().query_only,changes:c.prepare('SELECT total_changes() n').get().n,mainSchema:c.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:c.prepare('PRAGMA temp.schema_version').get().schema_version});
 db=openRead();let before=stamps(db);assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v230"),/not authorized/);
 const logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);assert(!Object.hasOwn(logicalBefore.tables,table));save('logical-before-with-rowid.json',logicalBefore);assert.deepEqual(stamps(db),before);closeRead(db);db=null;
 report.stages=[];const emit=(stage,value)=>{const item={stage,at:new Date().toISOString(),value};report.stages.push(item);save('stage-'+report.stages.length+'.json',item)};
 const result=api.acceptDiagnosticSpinAimV230(copyPath,retained.evidence.resolutionReference,retained.evidence,retained,emit);save('diagnostic-evaluation.lossless.json',result);report.summary=result.summary;
 assert.equal(result.summary.status,'INELIGIBLE');assert.equal(result.summary.trialCount,1);assert.equal(result.summary.applicable,false);assert.equal(result.summary.qualificationIssued,false);assert.equal(result.summary.providerlessReread,true);
 db=openRead();before=stamps(db);assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v230"),/not authorized/);
 const after=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-after-with-rowid.json',after);assert.equal(after.tables[table]?.rows,1);
 assert.deepEqual(after.catalog.filter(row=>row.name!==table&&row.tbl_name!==table),logicalBefore.catalog,'old catalog changed');
 for(const [name,pin] of Object.entries(logicalBefore.tables))assert.deepEqual(after.tables[name],pin,'old table rows or rowids changed: '+name);
 assert.deepEqual(Object.keys(after.tables).filter(name=>!Object.hasOwn(logicalBefore.tables,name)),[table]);assert.deepEqual(stamps(db),before);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v230"),/not authorized/);closeRead(db);db=null;
 report.oldRowsRowidsSchemaHeadsUnchanged=true;report.onlyNewTableAndOneRow=true;report.callerStateAndAuthorizerPreserved=true;report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.cleanupError=String(e);report.pass=false;process.exitCode=1}
 try{report.originalAfter=await databaseFiles(original);assert.deepEqual(report.originalAfter,originalBefore);report.originalFilesUnchanged=true;
  report.retainedAfter={};for(const [p,expected] of Object.entries(retainedBefore)){const after=await databaseFiles(p);assert.deepEqual(after,expected);report.retainedAfter[p]=after}report.retainedFilesUnchanged=true;
  if(copyBefore)report.copyAfter=await databaseFiles(copyPath);
  if(bundle){assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});for(const [p,pin] of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.currentSourceAndBundleEndPins=true}
  for(const parentBundle of [trial.bundle,parent.bundle])for(const [p,pin] of Object.entries(parentBundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});
  for(const manifest of [trial,parent])for(const [p,pin] of Object.entries(manifest.pins))assert.deepEqual(await fileState(p),pin);
  for(const [p,pin] of Object.entries(pins))assert.deepEqual(await fileState(p),pin);report.retainedArtifactsAndHarnessEndPins=true;
  report.shmObservation={originalBefore:originalBefore['-shm'],originalAfter:report.originalAfter['-shm']};
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
