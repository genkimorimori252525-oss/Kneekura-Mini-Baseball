import assert from 'node:assert/strict';
import { copyFileSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, constants as sqliteConstants } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';
const root=resolve('.'),out=resolve(process.argv[2]??''),rel=relative(root,out);
assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&!existsSync(out),'new workspace output required');
const priorDir='work/spin-aim-causal-membership-v232-01',priorStart=priorDir+'/start-manifest.json',priorReport=priorDir+'/report.json',
 priorReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_9b82b28a5b894ea58de46b9735bb9808.json',entry='tools/verification/spin-aim-qualified-fallback-v233.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const parent=read(priorStart),previous=read(priorReport),receipt=read(priorReceipt),log=readFileSync(receipt.output_path);pins[resolve(receipt.output_path)]={exists:true,bytes:log.length,sha256:sha(log)};
assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
assert(previous.pass&&previous.originalFilesUnchanged&&previous.retainedFilesUnchanged&&previous.logicalRowsRowidsSchemaHeadsUnchanged&&previous.ownedCopyDataUnchanged&&previous.callerStateAndAuthorizerPreserved&&previous.currentSourceAndBundleEndPins&&previous.retainedArtifactsAndHarnessEndPins);
assert.equal(previous.summary.qualificationApplicable,false);assert.equal(previous.summary.currentDecisionAccepted,false);assert.equal(previous.summary.actualTrialCount,1);
const reverse='work/v233-consumer-baseline-01/reverse-proof.json';assert.equal(sha(readFileSync(reverse)),'d61a7c83093181f7569f315ff17df374fbc66b45cdc39049eaddeb6bb53907e1');const proof=read(reverse);assert.equal(proof.sourceCount,8);
const changed={};for(const item of proof.files){assert(item.reverseBytesExact);const baseline='work/v233-consumer-baseline-01/worktree/'+item.path;
 assert.equal(sha(readFileSync(baseline)),item.baselineSha256);assert.equal(sha(readFileSync(item.path)),item.currentSha256);changed[item.path]={baseline,old:item.baselineSha256,current:item.currentSha256}}
const parentPin=async(p,pin)=>{const item=Object.entries(changed).find(([key])=>resolve(key)===resolve(p));const actual=await fileState(resolve(item?item[1].baseline:p));assert.deepEqual(actual,pin,'parent pin differs: '+p)};
for(const [p,pin] of Object.entries(parent.bundle.sourcePins))await parentPin(p,{exists:true,bytes:pin.bytes,sha256:pin.sha256});
for(const [p,pin] of Object.entries(parent.pins))await parentPin(p,pin);
assert.deepEqual(await fileState(parent.bundle.bundlePath),{exists:true,bytes:parent.bundle.bytes,sha256:parent.bundle.sha256});
const sources=[entry,'src/host/world/SamePaQualifiedSpinAimV233.ts','src/host/world/SamePaQualifiedSpinAimV233.test.ts','src/core/world/psychology/batting/BattingQualifiedSpinAimExecutionV233.test.ts',...Object.keys(changed),...Object.values(changed).map(v=>v.baseline),reverse,'tools/verification/check-spin-aim-qualified-fallback-v233.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];for(const p of sources)pins[resolve(p)]=await fileState(resolve(p));
const original=resolve('work/spin-aim-qualification-owned-copy-v230-01/owned-diagnostic.sqlite'),data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const originalBefore=await databaseFiles(original);assert.deepEqual(originalBefore,previous.originalAfter,'V230 original files differ');const retainedBefore={...previous.retainedAfter};
for(const [p,expected] of Object.entries(retainedBefore))assert.deepEqual(await databaseFiles(p),expected,'retained DB files differ: '+p);assert.equal(Object.keys(retainedBefore).length,9);
const cohort=read('work/native-spin-trial-cohort-v228-01/authenticated-cohort.lossless.json'),historical=read('work/spin-aim-precommit-domain-v231-01/authenticated-cohort.lossless.json'),diagnostic=read('work/spin-aim-qualification-owned-copy-v230-01/diagnostic-evaluation.lossless.json');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'}),copyPath=resolve(out,'owned-readonly.sqlite');
const report={pass:false,boundary:'V233_HISTORICAL_INSUFFICIENT_FALLBACK_READONLY',originalDatabaseOpened:false,retainedDatabasesOpened:0,retainedDatabaseCount:9,
 newNativeWrites:0,newPractice:0,newContact:0,qualificationIssued:false,performancePass:false,originalBefore,retainedBefore};let db,bundle,copyBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore,'original files changed while copying');copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore);
 bundle=await compilePinnedNativeEntry({root,entryPath:entry,outputPath:resolve(out,'current-source-bundle.mjs')});
 const corePath='src/core/world/psychology/batting/BattingCommitment.ts',oldCore=changed[corePath];assert(oldCore,'old Core baseline missing');
 const oldBundle=await build({stdin:{contents:readFileSync(oldCore.baseline,'utf8'),resolveDir:resolve('src/core/world/psychology/batting'),sourcefile:'v233-old-batting-commitment.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node22',metafile:true});
 assert.equal(oldBundle.outputFiles.length,1);for(const p of Object.keys(oldBundle.metafile.inputs)){if(p==='src/core/world/psychology/batting/v233-old-batting-commitment.ts')continue;const sourcePin=parent.bundle.sourcePins[p];assert(sourcePin,'old Core dependency outside parent closure: '+p);assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:sourcePin.bytes,sha256:sourcePin.sha256})}
 const oldBytes=oldBundle.outputFiles[0].contents,oldApi=await import('data:text/javascript;base64,'+Buffer.from(oldBytes).toString('base64'));assert.equal(typeof oldApi.calculateBattingExecution,'function');
 const additions=new Set([entry,'src/host/world/SamePaQualifiedSpinAimV233.ts']);
 for(const [p,pin] of Object.entries(bundle.sourcePins)){if(additions.has(p))continue;const expected=parent.bundle.sourcePins[p];if(changed[p]){assert.equal(pin.sha256,changed[p].current);continue}assert(expected,'Source outside pinned parent closures: '+p);
  assert.equal(pin.bytes,expected.bytes);assert.equal(pin.sha256,expected.sha256,'Source differs: '+p)}
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_SOURCE_READONLY_OWNED_PAIR',historicalBundleExecuted:false},priorReceipt,
  originalBefore,copyBefore,retainedBefore,bundle,oldCoreBundle:{bytes:oldBytes.length,sha256:sha(oldBytes),inputs:oldBundle.metafile.inputs},pins,resolutionReference:cohort.evidence.resolutionReference});
 const api=await import(pathToFileURL(bundle.bundlePath).href);db=new DatabaseSync(copyPath,{readOnly:true});db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v228');
 db.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);
 const stamps=()=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,changes:db.prepare('SELECT total_changes() n').get().n,
  mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version});
 const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v228"),/not authorized/);
 const logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-before-with-rowid.json',logicalBefore);
 const result=api.inspectQualifiedFallbackV233(db,cohort.evidence,cohort,historical,diagnostic.accepted,oldApi.calculateBattingExecution);save('authenticated-fallback.lossless.json',result);report.summary=result.summary;
 assert.deepEqual(api.rawNativeSpinNeutralSqlDigestV193(db),logicalBefore);assert.deepEqual(stamps(),before);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v228"),/not authorized/);
 db.exec('ROLLBACK TO caller_v228; RELEASE caller_v228');assert(db.isTransaction);report.logicalRowsRowidsSchemaHeadsUnchanged=true;report.callerStateAndAuthorizerPreserved=true;
 db.exec('ROLLBACK');db.setAuthorizer(null);db.close();db=null;report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.cleanupError=String(e);report.pass=false;process.exitCode=1}
 try{report.originalAfter=await databaseFiles(original);assert.deepEqual(report.originalAfter,originalBefore);report.originalFilesUnchanged=true;
  report.retainedAfter={};for(const [p,expected] of Object.entries(retainedBefore)){const after=await databaseFiles(p);assert.deepEqual(after,expected);report.retainedAfter[p]=after}report.retainedFilesUnchanged=true;
  if(copyBefore){report.copyAfter=await databaseFiles(copyPath);assert.deepEqual(data(report.copyAfter),data(copyBefore));report.ownedCopyDataUnchanged=true}
  if(bundle){assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});for(const [p,pin] of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.currentSourceAndBundleEndPins=true}
  for(const [p,pin] of Object.entries(parent.bundle.sourcePins))await parentPin(p,{exists:true,bytes:pin.bytes,sha256:pin.sha256});
  for(const [p,pin] of Object.entries(parent.pins))await parentPin(p,pin);
  for(const [p,pin] of Object.entries(pins))assert.deepEqual(await fileState(p),pin);report.retainedArtifactsAndHarnessEndPins=true;
  report.shmObservation={originalBefore:originalBefore['-shm'],originalAfter:report.originalAfter['-shm']};
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
