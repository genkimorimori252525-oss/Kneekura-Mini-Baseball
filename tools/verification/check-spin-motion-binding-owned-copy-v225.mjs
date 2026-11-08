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
const oldDir='work/motor-evidence-readonly-gate-v224-01',oldStart=oldDir+'/start-manifest.json',oldReport=oldDir+'/report.json',
 oldReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_d6cc23733bcd47b6be14cdc4eff79a10.json',
 v193Report='docs/verification/realism-debug-20261027/native-spin-neutral-v193-recovery-01/report.json',
 entry='tools/verification/spin-motion-binding-owned-copy-v225.ts',table='world_spin_motion_bindings_v225';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const start=read(oldStart),previous=read(oldReport),originalRecovery=read(v193Report),receipt=read(oldReceipt),log=readFileSync(receipt.output_path);
pins[resolve(receipt.output_path)]={exists:true,bytes:log.length,sha256:sha(log)};assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
assert(previous.pass&&previous.logicalRowsRowidsSchemaHeadsUnchanged&&previous.callerStateAndAuthorizerPreserved&&previous.originalDataUnchanged&&previous.baselineDataUnchanged&&previous.ownedCopyDataUnchanged&&previous.currentSourceAndBundleEndPins&&previous.retainedArtifactsAndHarnessEndPins);
assert.equal(previous.summary.retainedOriginalContacts,6);assert.equal(previous.summary.futurePitchBindingProven,false);
for(const [p,pin] of Object.entries(start.bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256},'V224 Source differs: '+p);
for(const [p,pin] of Object.entries(start.pins))assert.deepEqual(await fileState(p),pin,'V224 retained artifact differs: '+p);
for(const p of [start.bundle.bundlePath,oldDir+'/authenticated-motor-evidence.lossless.json',entry,'tools/verification/spin-motion-binding-owned-copy-v225.test.ts',
 'tools/verification/check-spin-motion-binding-owned-copy-v225.mjs','src/host/world/SpinMotionBindingV225.test.ts','src/host/world/SqliteSpinMotionBindingV225.test.ts',
 'tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])pins[resolve(p)]=await fileState(resolve(p));
assert.deepEqual(await fileState(start.bundle.bundlePath),{exists:true,bytes:start.bundle.bytes,sha256:start.bundle.sha256});
const original=resolve(originalRecovery.originalPath),baseline=resolve(originalRecovery.baselinePath),copyPath=resolve(out,'owned-binding.sqlite'),data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const originalBefore=await databaseFiles(original),baselineBefore=await databaseFiles(baseline);assert.deepEqual(data(originalBefore),data(previous.originalAfter));assert.deepEqual(data(baselineBefore),data(previous.baselineAfter));
assert(originalBefore.main.exists&&originalBefore['-wal'].exists&&!originalBefore['-journal'].exists,'original main/WAL pair required');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'});
const report={pass:false,boundary:'V225_OWNED_COPY_ORIGINAL_DRILL_BINDING_ONLY',originalDatabaseOpened:false,baselineDatabaseOpened:false,previousGate:'d6cc23733bcd47b6be14cdc4eff79a10',
 oldSuffixEndPins:'UNKNOWN',newPractice:0,newContact:0,newMasteryWrites:0,futureTransferProven:false,performancePass:false,stages:[],originalBefore,baselineBefore};
let db,bundle,copyBefore,logicalBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore);copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore);
 bundle=await compilePinnedNativeEntry({root,entryPath:entry,outputPath:resolve(out,'current-source-bundle.mjs')});
 const additions=new Set([entry,'src/host/world/SpinMotionBindingV225.ts','src/host/world/SqliteSpinMotionBindingV225.ts']);
 for(const [p,pin] of Object.entries(bundle.sourcePins)){if(additions.has(p))continue;const expected=start.bundle.sourcePins[p];assert(expected,'Source outside V224 closure: '+p);
  assert.equal(pin.bytes,expected.bytes);assert.equal(pin.sha256,expected.sha256,'Source differs: '+p)}
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_SOURCE_FRESH_OWNED_COPY_WITH_ONE_NEW_TABLE',oldBundleExecuted:false},
  previousReceipt:oldReceipt,originalBefore,baselineBefore,copyBefore,bundle,pins,gateInput:start.gateInput,allowedNewTable:table});
 const api=await import(pathToFileURL(bundle.bundlePath).href);
 function openRead(){const connection=new DatabaseSync(copyPath,{readOnly:true});connection.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v225_probe');
  connection.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);return connection}
 function closeRead(connection){connection.exec('ROLLBACK TO caller_v225_probe; RELEASE caller_v225_probe');assert(connection.isTransaction);connection.exec('ROLLBACK');connection.setAuthorizer(null);connection.close()}
 const stamps=connection=>({transaction:connection.isTransaction,queryOnly:connection.prepare('PRAGMA query_only').get().query_only,changes:connection.prepare('SELECT total_changes() n').get().n,
  mainSchema:connection.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:connection.prepare('PRAGMA temp.schema_version').get().schema_version});
 db=openRead();let before=stamps(db);assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v225"),/not authorized/);
 logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);assert(!Object.hasOwn(logicalBefore.tables,table));save('logical-before-with-rowid.json',logicalBefore);
 assert.deepEqual(stamps(db),before);closeRead(db);db=null;
 const emit=(stage,value)=>{const item={stage,at:new Date().toISOString(),value};report.stages.push(item);save('stage-'+report.stages.length+'.json',item)};
 const result=api.acceptOriginalSpinBindingsV225(copyPath,start.gateInput,emit);save('accepted-bindings.lossless.json',result);report.summary=result.summary;
 assert.equal(result.summary.bindingCount,2);assert.deepEqual(result.summary.techniques,['BACKSPIN','TOPSPIN']);assert.equal(result.summary.providerlessReread,true);assert.equal(result.summary.futureTransferProven,false);
 db=openRead();before=stamps(db);assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v225"),/not authorized/);
 const after=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-after-with-rowid.json',after);
 assert.equal(after.tables[table]?.rows,2);const filtered=after.catalog.filter(row=>row.name!==table&&row.tbl_name!==table);
 assert.deepEqual(filtered,logicalBefore.catalog,'old catalog changed');for(const [name,pin] of Object.entries(logicalBefore.tables))assert.deepEqual(after.tables[name],pin,'old table rows or rowids changed: '+name);
 assert.deepEqual(Object.keys(after.tables).filter(name=>!Object.hasOwn(logicalBefore.tables,name)),[table]);assert.deepEqual(stamps(db),before);
 assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v225"),/not authorized/);closeRead(db);db=null;
 report.oldRowsRowidsSchemaHeadsUnchanged=true;report.onlyNewTableAndTwoRows=true;report.callerStateAndAuthorizerPreserved=true;report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.cleanupError=String(e);report.pass=false;process.exitCode=1}
 try{report.originalAfter=await databaseFiles(original);report.baselineAfter=await databaseFiles(baseline);assert.deepEqual(report.originalAfter,originalBefore,'original files changed');assert.deepEqual(report.baselineAfter,baselineBefore,'baseline files changed');
  report.originalFilesUnchanged=true;report.baselineFilesUnchanged=true;if(copyBefore)report.copyAfter=await databaseFiles(copyPath);
  if(bundle){assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});for(const [p,pin] of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.currentSourceAndBundleEndPins=true}
  for(const [p,pin] of Object.entries(start.bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});
  for(const [p,pin] of Object.entries(start.pins))assert.deepEqual(await fileState(p),pin);for(const [p,pin] of Object.entries(pins))assert.deepEqual(await fileState(p),pin);report.retainedArtifactsAndHarnessEndPins=true;
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
