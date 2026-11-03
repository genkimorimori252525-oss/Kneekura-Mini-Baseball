import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileState,databaseFiles,createPinnedNativeCopy} from './native-measurement-probe-support-v183.mjs';
import {stringifyDebugRecord} from './live-debug-record.mjs';

const [originalPath,out]=process.argv.slice(2),root=process.cwd(),output=resolve(out??''),rel=relative(root,output);
assert(originalPath&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'original path and new workspace output required');
await mkdir(output,{recursive:false});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),
  script=resolve('tools/verification/prepare-native-initial-joint-contact-v184.mjs'),scriptSha=sha(await readFile(script)),
  main=await fileState(originalPath);
assert(main.exists);
const report={pass:false,authority:'RAW_SELECTED_ARCHIVE_ROWS_NOT_CURRENT_NATIVE_OWNER_AUTHENTICATION',
  nativeApiCalls:0,physicalFlightsComputed:0,privateArtifactNotForPublication:true};
let copy,db;
try{
  copy=await createPinnedNativeCopy({originalPath,outputPath:resolve(output,'private-saved-copy.sqlite'),expectedMainSha256:main.sha256});
  db=new DatabaseSync(copy.copyPath);db.exec('PRAGMA query_only=1; BEGIN');
  const read=(owner,sourceId)=>{
    assert(['pa_initial_joint_v1_executions','physical_plate_appearance_actors'].includes(owner));
    const row=db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM main.'+owner+' WHERE source_id=?').get(sourceId);
    assert(row,'known row missing: '+owner+'/'+sourceId);
    assert.equal(sha(row.source_json),row.source_hash);assert.equal(sha(row.snapshot_json),row.snapshot_hash);
    return {reference:{owner,sourceId,sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)},value:JSON.parse(row.snapshot_json)};
  };
  const execution=read('pa_initial_joint_v1_executions','iqj141:execution');
  assert.equal(execution.value.kind,'initial_joint_physical_execution_v1');
  assert.equal(execution.value.calculation.result.kind,'bat_contact');
  const actor=read('physical_plate_appearance_actors',execution.value.lineage.actorReference.sourceId);
  assert.deepEqual(actor.reference,execution.value.lineage.actorReference);
  const contact=execution.value.calculation.result.contact,
    events=execution.value.timeline.events.filter(event=>event.kind==='BatBallContact'&&event.tick===contact.tick);
  assert.equal(events.length,1);
  report.execution=execution;report.actor=actor;report.event=events[0];report.copy=copy;
  db.exec('COMMIT');db.close();db=null;
  assert.equal((await fileState(copy.copyPath)).sha256,copy.copyDatabaseBefore.main.sha256);
  assert.deepEqual(await databaseFiles(copy.originalPath),copy.originalDatabaseBefore);
  report.originalDatabaseUnchanged=true;report.copyMainUnchanged=true;
  report.copyAfter=await databaseFiles(copy.copyPath);report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  if(db){try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}}
  if(copy){report.originalAfter=await databaseFiles(copy.originalPath);
    if(JSON.stringify(report.originalAfter)!==JSON.stringify(copy.originalDatabaseBefore)){report.pass=false;process.exitCode=1;}}
  assert.equal(sha(await readFile(script)),scriptSha);report.scriptSha256=scriptSha;
  await writeFile(resolve(output,'report.json'),stringifyDebugRecord(report)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({pass:report.pass,nativeApiCalls:0,physicalFlightsComputed:0,
  selectedExecutionPresent:!!report.execution,actorPresent:!!report.actor,error:report.error??null}));
