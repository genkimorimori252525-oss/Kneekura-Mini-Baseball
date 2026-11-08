import assert from 'node:assert/strict';
import { copyFileSync, constants as fsConstants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, constants as sql } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
const root=resolve('.'), out=resolve(process.argv[2]??''), reviewed=resolve(process.argv[3]??''), rel=relative(root,out);
assert(process.argv.length===4 && rel && !rel.startsWith('..') && !isAbsolute(rel) && !existsSync(out),'new output and reviewed freeze required');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const report={pass:false,boundary:'READONLY_NATIVE_CONTACT_ENVELOPE_ONLY',originalDatabaseOpened:false,newContact:0,newCollection:0,newPractice:0,physicsEffects:'NONE'};
const retained=resolve('docs/verification/realism-debug-20261027/native-contact-report-cli-v192-02'), original=resolve(retained,'commands.sqlite'), copy=resolve(out,'owned.sqlite');
const receiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_b10820039a81434aacf77354b67435f7.json');
const pins={}, sha=b=>createHash('sha256').update(b).digest('hex');
const read=path=>{const bytes=readFileSync(path);pins[path]={exists:true,bytes:bytes.length,sha256:sha(bytes)};return JSON.parse(bytes.toString('utf8'))};
let beforeFiles,db,entry,runtime;
try{
 const old=read(resolve(retained,'report.json')),oldReport=read(resolve(retained,'no-model.json')),receipt=read(receiptPath),freeze=read(reviewed),log=readFileSync(resolve(receipt.output_path));
 pins[resolve(receipt.output_path)]={exists:true,bytes:log.length,sha256:sha(log)};
 assert(old.pass&&old.originalMainUnchanged&&old.exportMainUnchanged&&old.physicalTablesAndCatalogUnchanged);
 assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
 assert.equal(freeze.boundary,'REVIEWED_V229_SOURCE_FREEZE');assert.equal(freeze.task,'MB-20261027-REALISM-DEBUG-PLAN');
 beforeFiles=await databaseFiles(original);assert.deepEqual(beforeFiles,old.sidecarsAfter);assert(beforeFiles.main.exists&&!beforeFiles['-journal'].exists);
 for(const suffix of ['','-wal','-shm'])if(beforeFiles[suffix||'main'].exists)copyFileSync(original+suffix,copy+suffix,fsConstants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),beforeFiles);assert.deepEqual(await databaseFiles(copy),beforeFiles);
 entry=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-contact-envelope-readonly-v229.ts',outputPath:resolve(out,'entry.mjs')});
 runtime=await compilePinnedNativeEntry({root,entryPath:'tools/native-contact-report-runtime-v192.ts',outputPath:resolve(out,'runtime.mjs')});
 for(const [name,b] of [['entry',entry],['runtime',runtime]]){
  assert.equal(b.sha256,freeze.bundles[name].sha256,'reviewed '+name+' bundle differs');assert.equal(b.inputCount,freeze.bundles[name].inputCount);
  assert.deepEqual(Object.keys(b.sourcePins).sort(),Object.keys(freeze[name+'Sources']).sort());
  for(const [path,p] of Object.entries(b.sourcePins))assert.deepEqual({exists:true,bytes:p.bytes,sha256:p.sha256},freeze[name+'Sources'][path],'frozen '+name+' source differs: '+path);
 }
 for(const path of ['tools/native-contact-report-v192.mjs','tools/verification/check-native-contact-envelope-readonly-v229.mjs','tools/verification/native-measurement-probe-support-v183.mjs']){
  const full=resolve(path),state=await fileState(full);assert.deepEqual(state,freeze.harnessPins[path]);pins[full]=state;
 }
 save('start-manifest.json',{originalBefore:beforeFiles,retainedReceipt:receiptPath,reviewed,entry,runtime,pins});
 pins[resolve(out,'start-manifest.json')]=await fileState(resolve(out,'start-manifest.json'));
 const api=await import(pathToFileURL(entry.bundlePath).href);
 const open=()=>{const d=new DatabaseSync(copy,{readOnly:true});d.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT v229');d.setAuthorizer(c=>c===sql.SQLITE_ATTACH||c===sql.SQLITE_DETACH?sql.SQLITE_DENY:sql.SQLITE_OK);return d};
 const stamps=d=>({transaction:d.isTransaction,queryOnly:d.prepare('PRAGMA query_only').get().query_only,changes:d.prepare('SELECT total_changes() n').get().n,schema:d.prepare('PRAGMA main.schema_version').get().schema_version});
 const close=d=>{d.exec('ROLLBACK TO v229; RELEASE v229');assert(d.isTransaction);d.exec('ROLLBACK');d.setAuthorizer(null);d.close()};
 db=open();const stamp=stamps(db);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v229"),/not authorized/);
 const before=api.rawNativeSpinNeutralSqlDigestV193(db), value=api.inspectContactEnvelopeV229(db,'career-a','away-1');
 assert(value.identity&&value.identity.source&&value.identity.capturedInventoryHash&&value.identity.currentInventoryHash,'nonempty owner-authenticated collection required');
 assert.deepEqual(value.report,oldReport,'retained original report differs');assert.equal(value.identity.source.revision,2);
 assert.equal(value.identity.capturedInventoryHash,value.identity.currentInventoryHash);assert.equal(value.report.status,'UNAVAILABLE');assert(value.report.reasons.includes('NO_MEASUREMENT_MODEL'));
 assert.equal(value.report.physicsEffects,'NONE');assert.equal(value.report.timeSemantics,'AS_OF_LATEST_REGISTERED_CONTACT');
 assert.deepEqual(stamps(db),stamp);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v229"),/not authorized/);close(db);db=null;
 save('before-logical.json',before);save('normal-envelope.json',value);
 const output=resolve(out,'cli-envelope.json');const child=spawnSync(process.execPath,['tools/native-contact-report-v192.mjs','export','--database='+copy,'--career=career-a','--player=away-1','--output='+output,'--envelope'],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,windowsHide:true});
 save('cli-process.json',{status:child.status,signal:child.signal,stdout:child.stdout,stderr:child.stderr,error:child.error?String(child.error):null});
 assert.equal(child.status,0,'CLI envelope failed');const summary=JSON.parse(child.stdout);assert.equal(summary.runtime.sha256,runtime.sha256);assert.equal(summary.runtime.sourceInputs,runtime.inputCount);
 assert.deepEqual(JSON.parse(readFileSync(output,'utf8')),value,'CLI and same-snapshot normal envelope differ');
 db=open();const afterStamp=stamps(db),after=api.rawNativeSpinNeutralSqlDigestV193(db);assert.deepEqual(after,before,'old rows, rowids or catalog changed');
 assert.deepEqual(stamps(db),afterStamp);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v229"),/not authorized/);close(db);db=null;
 save('after-logical.json',after);report.normalSubjectAndCollectionAuthenticated=true;report.identity=value.identity;report.descriptor=value.report;
 report.oldRowsRowidsCatalogHeadsUnchanged=true;report.callerStatePreserved=true;report.cliMatchesNormalReader=true;report.pass=true;
}catch(error){report.pass=false;report.error=String(error.stack??error);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.pass=false;report.cleanupError=String(e);process.exitCode=1}
 try{
  if(beforeFiles){report.originalAfter=await databaseFiles(original);assert.deepEqual(report.originalAfter,beforeFiles);report.originalFilesUnchanged=true;report.copyAfter=await databaseFiles(copy)}
  for(const name of ['before-logical.json','after-logical.json','normal-envelope.json','cli-envelope.json','cli-process.json']){const path=resolve(out,name);if(existsSync(path))pins[path]=await fileState(path)}
  for(const [path,p] of Object.entries(pins))assert.deepEqual(await fileState(path),p,'retained artifact changed: '+path);
  for(const b of [entry,runtime].filter(Boolean)){assert.deepEqual(await fileState(b.bundlePath),{exists:true,bytes:b.bytes,sha256:b.sha256});for(const [path,p] of Object.entries(b.sourcePins))assert.deepEqual(await fileState(resolve(path)),{exists:true,bytes:p.bytes,sha256:p.sha256},'source changed: '+path)}
  report.endPinsProven=!!entry&&!!runtime;
 }catch(error){report.pass=false;report.pinError=String(error.stack??error);process.exitCode=1}
 save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,error:report.error??report.pinError??null}));
