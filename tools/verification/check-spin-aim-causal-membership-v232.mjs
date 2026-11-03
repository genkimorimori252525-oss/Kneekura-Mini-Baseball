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
const priorDir='work/spin-aim-precommit-domain-v231-01',priorStart=priorDir+'/start-manifest.json',priorReport=priorDir+'/report.json',priorRecord='work/native-spin-trial-cohort-v228-01/authenticated-cohort.lossless.json',
 trialDir='work/native-observed-spin-aim-trial-v226-01',trialStart=trialDir+'/start-manifest.json',trialReport=trialDir+'/report.json',
 priorReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_8e46612ac37546b8aa68bc56cda82479.json',
 trialReceipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_30a0abefd7e94f88a63f230d82558d35.json',entry='tools/verification/spin-aim-causal-membership-v232.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=p=>{const b=readFileSync(p);pins[resolve(p)]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const parent=read(priorStart),previous=read(priorReport),retained=read(priorRecord),trial=read(trialStart),trialResult=read(trialReport);
for(const path of [priorReceipt,trialReceipt]){const receipt=read(path),bytes=readFileSync(receipt.output_path);pins[resolve(receipt.output_path)]={exists:true,bytes:bytes.length,sha256:sha(bytes)};
 assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(bytes),receipt.output_sha256)}
assert(previous.pass&&previous.originalFilesUnchanged&&previous.retainedFilesUnchanged&&previous.logicalRowsRowidsSchemaHeadsUnchanged&&previous.ownedCopyDataUnchanged&&previous.callerStateAndAuthorizerPreserved&&previous.currentSourceAndBundleEndPins&&previous.retainedArtifactsAndHarnessEndPins);
assert.equal(previous.summary.qualificationApplicable,false);assert.equal(previous.summary.currentDecisionAccepted,false);assert.equal(previous.summary.actualTrialCount,1);
assert(trialResult.pass&&trialResult.endPinsProven&&trialResult.result.trialSelected&&trialResult.result.actualContact);
assert.equal(Object.keys(trial.bundle.sourcePins).length,850);
const changed={
 'src/host/world/NativeSpinTrialCohortInventoryV228.ts':{baseline:'work/v232-census-baseline-01/NativeSpinTrialCohortInventoryV228.ts.worktree',old:'8093c2d0e3d2cda0e3aae12c27abcf783295b0132dc849a0aef1b3d0dfe248d0',current:'b6cd2c765e7f71f5c97dbe5f87614e7256509c51c8877b71fd8340b0468f159e'},
 'src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite.ts':{baseline:'work/physical-world-membership-v232-wiring-baseline/worktree.ts',old:'ef89a3de51b68185c69e0dcfe68e323d8d4db3370a460c61a0ec3f3d01b0b6d5',current:'1bfc32d987be3b213895a4fa960deba8b2376095535dd56bb67f6f07cf945553'}};
for(const [p,item] of Object.entries(changed)){assert.equal(sha(readFileSync(item.baseline)),item.old);assert.equal(sha(readFileSync(p)),item.current)}
const reverseProof='work/physical-world-membership-v232-wiring-baseline/reverse-proof.json',proof=read(reverseProof);assert(proof.pass&&proof.exactBytes&&proof.noDatabaseOpen);assert.equal(proof.baselineSha256,changed['src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite.ts'].old);assert.equal(proof.currentSha256,changed['src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite.ts'].current);
const parentPin=async(p,pin)=>{const entry=Object.entries(changed).find(([key])=>resolve(key)===resolve(p));const actual=await fileState(resolve(entry?entry[1].baseline:p));assert.deepEqual(actual,pin,'parent pin differs: '+p)};
for(const bundle of [trial.bundle,parent.bundle])for(const [p,pin] of Object.entries(bundle.sourcePins))await parentPin(p,{exists:true,bytes:pin.bytes,sha256:pin.sha256});
for(const manifest of [trial,parent])for(const [p,pin] of Object.entries(manifest.pins))await parentPin(p,pin);
for(const bundle of [trial.bundle,trial.digestBundle,parent.bundle])assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256});
const sourcePaths=[entry,'src/host/world/PhysicalCommitmentWorldMembershipV232.ts','src/host/world/PhysicalCommitmentWorldMembershipV232.test.ts',...Object.keys(changed),...Object.values(changed).map(v=>v.baseline),reverseProof,'tools/verification/check-spin-aim-causal-membership-v232.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'];
for(const p of sourcePaths)pins[resolve(p)]=await fileState(resolve(p));
const original=resolve('work/spin-aim-qualification-owned-copy-v230-01/owned-diagnostic.sqlite'),data=files=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,files[k]]));
const originalBefore=await databaseFiles(original);assert.deepEqual(originalBefore,previous.originalAfter,'V230 original files differ');
const retainedBefore={...previous.retainedAfter};for(const [p,expected] of Object.entries(retainedBefore)){const actual=await databaseFiles(p);assert.deepEqual(actual,expected,'retained DB files differ: '+p)}
assert.equal(Object.keys(retainedBefore).length,9);assert(originalBefore.main.exists&&!originalBefore['-journal'].exists);
const historical=read(priorDir+'/authenticated-cohort.lossless.json'),diagnostic=read('work/spin-aim-qualification-owned-copy-v230-01/diagnostic-evaluation.lossless.json');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'}),copyPath=resolve(out,'owned-readonly.sqlite');
const report={pass:false,boundary:'V232_HISTORICAL_CAUSAL_MEMBERSHIP_READONLY',originalDatabaseOpened:false,retainedDatabasesOpened:0,retainedDatabaseCount:9,
 newNativeWrites:0,newPractice:0,newContact:0,qualificationIssued:false,performancePass:false,originalBefore,retainedBefore};let db,bundle,copyBefore;
try{
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copyPath+suffix,constants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore,'original files changed while copying');copyBefore=await databaseFiles(copyPath);assert.deepEqual(copyBefore,originalBefore);
 bundle=await compilePinnedNativeEntry({root,entryPath:entry,outputPath:resolve(out,'current-source-bundle.mjs')});
 const additions=new Set([entry,'src/host/world/PhysicalCommitmentWorldMembershipV232.ts']);
 for(const [p,pin] of Object.entries(bundle.sourcePins)){if(additions.has(p))continue;const expected=trial.bundle.sourcePins[p]??parent.bundle.sourcePins[p];if(changed[p]){assert.equal(pin.sha256,changed[p].current);continue}assert(expected,'Source outside pinned parent closures: '+p);
  assert.equal(pin.bytes,expected.bytes);assert.equal(pin.sha256,expected.sha256,'Source differs: '+p)}
 save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:'CURRENT_SOURCE_READONLY_OWNED_PAIR',historicalBundleExecuted:false},priorReceipt,trialReceipt,
  originalBefore,copyBefore,retainedBefore,bundle,pins,resolutionReference:retained.evidence.resolutionReference});
 const api=await import(pathToFileURL(bundle.bundlePath).href);db=new DatabaseSync(copyPath,{readOnly:true});db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v228');
 db.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);
 const stamps=()=>({transaction:db.isTransaction,queryOnly:db.prepare('PRAGMA query_only').get().query_only,changes:db.prepare('SELECT total_changes() n').get().n,
  mainSchema:db.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:db.prepare('PRAGMA temp.schema_version').get().schema_version});
 const before=stamps();assert.equal(before.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v228"),/not authorized/);
 const logicalBefore=api.rawNativeSpinNeutralSqlDigestV193(db);save('logical-before-with-rowid.json',logicalBefore);
 const result=api.inspectCausalSpinAimMembershipV232(db,retained.evidence,retained,historical,diagnostic.accepted);save('authenticated-membership.lossless.json',result);report.summary=result.summary;
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
