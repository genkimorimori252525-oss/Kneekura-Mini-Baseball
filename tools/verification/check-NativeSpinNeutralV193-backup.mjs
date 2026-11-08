import assert from 'node:assert/strict';
import {closeSync,existsSync,mkdirSync,openSync,writeFileSync} from 'node:fs';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getHeapStatistics} from 'node:v8';
import {DatabaseSync,backup} from 'node:sqlite';
import {fileState,databaseFiles,compilePinnedNativeEntry} from './native-measurement-probe-support-v183.mjs';
import {stringifyDebugRecord} from './live-debug-record.mjs';

const root=process.cwd(),original=resolve(process.argv[2]??''),out=resolve(process.argv[3]??''),rel=relative(root,out);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'original and new workspace output required');
assert(existsSync(original),'the original failed database must already exist');mkdirSync(out,{recursive:false});
const destination=resolve(out,'consistent-private.sqlite');
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
const report={pass:false,backupConsistent:false,ownerAuthenticationComplete:false,consumerAdoptionProven:false,
  practiceRegenerated:false,performancePass:false,originalPath:original,copyPath:destination,stages:[],privateArtifactNotForPublication:true};
const stage=(name,extra={})=>{const value={name,at:new Date().toISOString(),memory:process.memoryUsage(),heapLimitBytes:getHeapStatistics().heap_size_limit,...extra};report.stages.push(value);save('stage-'+report.stages.length+'.json',value);};
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(name=>[name,files[name]]));
let source,target,bundle;
try{
  report.originalBefore=await databaseFiles(original);stage('original-files-pinned');
  report.harnessPins={};for(const path of ['tools/verification/check-NativeSpinNeutralV193-backup.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-frontier.ts',outputPath:resolve(out,'frontier-bundle.mjs')});
  const api=await import(pathToFileURL(bundle.bundlePath).href),rawDigest=api.rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');
  const sourceDigest=rawDigest(source);save('source-logical-digest.json',sourceDigest);stage('original-readonly-snapshot-digested',{tableCount:Object.keys(sourceDigest.tables).length});
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;
  report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  report.originalShmObservation={before:report.originalBefore['-shm'],after:report.originalAfterBackup['-shm']};
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');
  const copyDigest=rawDigest(target);save('copy-logical-digest.json',copyDigest);assert.deepEqual(copyDigest,sourceDigest);report.backupConsistent=true;
  report.copyBeforeAuthentication=await databaseFiles(destination);stage('consistent-copy-logical-match',{tableCount:Object.keys(copyDigest.tables).length});
  const frontier=api.authenticateNativeSpinNeutralV193Frontier(target,(name,value)=>{save('native-'+name+'.lossless.json',value);stage('owner-'+name+'-authenticated');});
  save('frontier.lossless.json',frontier);report.frontier=frontier;report.ownerAuthenticationComplete=true;
  assert.deepEqual(rawDigest(target),copyDigest);target.exec('ROLLBACK');target.close();target=null;
  report.copyAfterAuthentication=await databaseFiles(destination);report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of [source,target])if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  try{
    report.originalAfter=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfter),dataPin(report.originalBefore));report.originalDataFilesUnchanged=true;
    report.originalShmAfter=report.originalAfter['-shm'];
    if(bundle){report.bundle={inputCount:bundle.inputCount,sha256:bundle.sha256};assert.equal((await fileState(bundle.bundlePath)).sha256,bundle.sha256);
      report.sourcePins={};for(const [path,pin]of Object.entries(bundle.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});report.sourcePins[path]={...pin,endSha256:end.sha256};}}
    for(const [path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,backupConsistent:report.backupConsistent,ownerAuthenticationComplete:report.ownerAuthenticationComplete,
  originalDataFilesUnchanged:report.originalDataFilesUnchanged,completedStages:report.stages.map(stage=>stage.name),error:report.error??report.pinError??null}));
