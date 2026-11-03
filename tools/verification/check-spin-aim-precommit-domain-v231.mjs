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
const priorDir='work/spin-aim-qualification-owned-copy-v230-01',priorStart=priorDir+'/start-manifest.json',priorReport=priorDir+'/report.json',priorRecord='work/native-spin-trial-cohort-v228-01/authenticated-cohort.lossless.json',
 trialDir='work/native-observed-spin-aim-trial-v226-01',trialStart=trialDir+'/start-manifest.json',trialReport=trialDir+'/report.json',
 priorReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_34ae8fbf79d34c3188dbe36439f5dea4.json',
 trialReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_30a0abefd7e94f88a63f230d82558d35.json',entry='tools/verification/spin-aim-precommit-domain-v231.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const parent=read(priorStart),previous=read(priorReport),retained=read(priorRecord),trial=read(trialStart),trialResult=read(trialReport);
for(const path of [priorReceipt,trialReceipt]){const receipt=read(path),bytes=readFileSync(receipt.output_path);pins[resolve(receipt.output_path)]={exists:true,bytes:bytes.length,sha256:sha(bytes)};
 assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(bytes),receipt.output_sha256)}
assert(previous.pass&&previous.originalFilesUnchanged&&previous.retainedFilesUnchanged&&previous.oldRowsRowidsSchemaHeadsUnchanged&&previous.onlyNewTableAndOneRow&&previous.callerStateAndAuthorizerPreserved&&previous.currentSourceAndBundleEndPins&&previous.retainedArtifactsAndHarnessEndPins);
assert.equal(previous.summary.applicable,false);assert.equal(previous.summary.qualificationIssued,false);assert.equal(previous.summary.trialCount,1);
assert(trialResult.pass&&trialResult.endPinsProven&&trialResult.result.trialSelected&&trialResult.result.actualContact);
assert.equal(Object.keys(trial.bundle.sourcePins).length,850);
const changed='src/host/world/NativeSpinTrialCohortInventoryV228.ts',baseline='work/v231-domain-seam-baseline-01/NativeSpinTrialCohortInventoryV228.worktree.ts',seam='src/host/world/SpinAimObservedDomainConditionsV231.ts';
const oldBytes=readFileSync(baseline),old=oldBytes.toString('utf8').replace(/\r\n/g,'\n'),currentBytes=readFileSync(changed),current=currentBytes.toString('utf8').replace(/\r\n/g,'\n'),seamText=readFileSync(seam,'utf8').replace(/\r\n/g,'\n');
assert.equal(old.replace(/\n/g,'\r\n'),oldBytes.toString('utf8'),'old CRLF bytes differ');
assert.equal(sha(oldBytes),'57e96d546c7a4229f7ad312a3e2ce3770ecc669304bf93c5b6d3cb3ef7e42619');
assert.equal(sha(currentBytes),'8093c2d0e3d2cda0e3aae12c27abcf783295b0132dc849a0aef1b3d0dfe248d0');
const bodyStart=old.indexOf(' if(capture.kind!',old.indexOf('export function deriveSpinTrialDomainFromRecordsV228')),
 bodyEnd=old.indexOf('\n}\nfunction readDomainFromCommitmentV228',bodyStart);assert(bodyStart>0&&bodyEnd>bodyStart);
const originalBody=old.slice(bodyStart,bodyEnd),moved=originalBody.replace('const e=record.trialEvidenceV226,context=record.calculation.trialContext,cc=','const {evidence:e,trialContext:context,bindingReference}=input,cc=').replace('record.source.trial.bindingReference','bindingReference');
assert(seamText.includes(moved),'moved domain body differs');
const replacement=' return deriveObservedSpinAimDomainV231({trialContext:record.calculation.trialContext,evidence:record.trialEvidenceV226,bindingReference:record.source.trial.bindingReference,binding,capture,delivery,prediction,captureCalibration:captureCal,deliveryCalibration:deliveryCal});';
const expected=(old.slice(0,bodyStart)+replacement+old.slice(bodyEnd)).replace("import { SPIN_TECHNIQUES_V123 }","import { deriveObservedSpinAimDomainV231 } from './SpinAimObservedDomainConditionsV231';\nimport { SPIN_TECHNIQUES_V123 }");
assert.equal(current,expected,'V228 literal reverse differs');assert.equal(current.replace(/\n/g,'\r\n'),currentBytes.toString('utf8'),'current CRLF bytes differ');
const parentPin=async(p,pin)=>{const actual=resolve(p)===resolve(changed)?await fileState(resolve(baseline)):await fileState(resolve(p));assert.deepEqual(actual,pin,'parent pin differs: '+p)};
for(const bundle of [trial.bundle,parent.bundle])for(const [p,pin] of Object.entries(bundle.sourcePins))await parentPin(p,{exists:true,bytes:pin.bytes,sha256:pin.sha256});
for(const manifest of [trial,parent])for(const [p,pin] of Object.entries(manifest.pins))await parentPin(p,pin);
for(const bundle of [trial.bundle,trial.digestBundle,parent.bundle])assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});
for(const p of [trial.bundle.bundlePath,trial.digestBundle.bundlePath,parent.bundle.bundlePath,entry,changed,baseline,seam,'src/host/world/SpinAimObservedDomainConditionsV231.test.ts','tools/verification/check-spin-aim-precommit-domain-v231.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])pins[resolve(p)]=await fileState(resolve(p));
const original=resolve(priorDir,'owned-diagnostic.sqlite'),data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const originalBefore=await databaseFiles(original);assert.deepEqual(originalBefore,previous.copyAfter,'V230 original files differ');
const retainedBefore={...previous.retainedAfter,[resolve(trialResult.copyPath)]:previous.originalAfter};for(const [p,expected] of Object.entries(retainedBefore)){const actual=await databaseFiles(p);assert.deepEqual(actual,expected,'retained DB files differ: '+p)}
assert.equal(Object.keys(retainedBefore).length,9);assert(originalBefore.main.exists&&!originalBefore['-journal'].exists);
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'}),copyPath=resolve(out,'owned-readonly.sqlite');
const report={pass:false,boundary:'V231_HISTORICAL_PRECOMMIT_DOMAIN_READONLY',originalDatabaseOpened:false,retainedDatabasesOpened:0,retainedDatabaseCount:9,
 newNativeWrites:0,newPractice:0,newContact:0,qualificationIssued:false,performancePass:false,originalBefore,retainedBefore};let db,bundle,copyBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore,'original files changed while copying');copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore);
 bundle=await compilePinnedNativeEntry({root,entryPath:entry,outputPath:resolve(out,'current-source-bundle.mjs')});
 const additions=new Set([entry,seam]);
 for(const [p,pin] of Object.entries(bundle.sourcePins)){if(additions.has(p))continue;const expected=trial.bundle.sourcePins[p]??parent.bundle.sourcePins[p];if(p===changed){assert.equal(pin.sha256,'8093c2d0e3d2cda0e3aae12c27abcf783295b0132dc849a0aef1b3d0dfe248d0');continue}assert(expected,'Source outside pinned parent closures: '+p);
  assert.equal(pin.bytes,expected.bytes);assert.equal(pin.sha256,expected.sha256,'Source differs: '+p)}
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_SOURCE_READONLY_OWNED_PAIR',historicalBundleExecuted:false},priorReceipt,trialReceipt,
  originalBefore,copyBefore,retainedBefore,bundle,pins,resolutionReference:retained.evidence.resolutionReference});
 const api=await import(pathToFileURL(bundle.bundlePath).href);db=new DatabaseSync(copyPath,{readOnly:true});db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v228');
 db.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);
 const stamps=()=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,changes:db.prepare('SELECT total_changes() n').get().n,
  mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version});
 const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v228"),/not authorized/);
 const logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-before-with-rowid.json',logicalBefore);
 const result=api.inspectHistoricalSpinAimPrecommitV231(db,retained.evidence,retained,'spin-aim-v230:diagnostic-top-single-trial');save('authenticated-cohort.lossless.json',result);report.summary=result.summary;
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
  for(const parentBundle of [trial.bundle,parent.bundle])for(const [p,pin] of Object.entries(parentBundle.sourcePins))await parentPin(p,{exists:true,bytes:pin.bytes,sha256:pin.sha256});
  for(const manifest of [trial,parent])for(const [p,pin] of Object.entries(manifest.pins))await parentPin(p,pin);
  for(const [p,pin] of Object.entries(pins))assert.deepEqual(await fileState(p),pin);report.retainedArtifactsAndHarnessEndPins=true;
  report.shmObservation={originalBefore:originalBefore['-shm'],originalAfter:report.originalAfter['-shm']};
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
