import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const [folder,out]=process.argv.slice(2);assert(folder&&out,'private saved folder and new output folder required');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const locatorBytes=await readFile(resolve(folder,'original-database.json')),
  declarationBytes=await readFile(resolve(folder,'partial-declarations.json'));
assert.equal(sha(locatorBytes),'e2bf664682a3bc07683acc65bfa97f9f5dd401c32ce899a87440a98115cad85a');
assert.equal(sha(declarationBytes),'e9b29ed2cce085ecd0978f095ab88f08ba2b28840340df0e10646b1a3f21c863');
const databasePath=JSON.parse(locatorBytes).path,
  declarations=new Map(JSON.parse(declarationBytes)),root=declarations.get('pole-native-v146:field-root');
assert(root&&root.resolutionReference&&root.launchReference);
const databaseBefore=sha(await readFile(databasePath)),db=new DatabaseSync(databasePath,{readOnly:true});
const allowed=new Set(['pa_physical_v1_resolutions','pa_physical_v1_launches','pa_physical_v1_action_plans']);
const inspected=[];
function read(ref){
  assert(allowed.has(ref.owner),'only three explicitly selected owner tables may be read');
  const row=db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM main.'+ref.owner+' WHERE source_id=?').get(ref.sourceId);
  assert(row,'selected saved row missing');assert.equal(row.source_hash,ref.sourceHash);assert.equal(row.snapshot_hash,ref.snapshotHash);
  assert.equal(sha(row.source_json),ref.sourceHash);assert.equal(sha(row.snapshot_json),ref.snapshotHash);
  const record=JSON.parse(row.snapshot_json);assert.equal(record.source.sourceId,ref.sourceId);
  inspected.push({reference:ref,sourceBytes:Buffer.byteLength(row.source_json),snapshotBytes:Buffer.byteLength(row.snapshot_json)});
  return record;
}
let report;
try{
  db.exec('BEGIN');
  const resolution=read(root.resolutionReference),launch=read(root.launchReference),action=read(launch.source.actionReference);
  assert.equal(resolution.kind,'same_pa_physical_resolution_v1');assert.equal(launch.kind,'same_pa_physical_launch_v1');
  assert.deepEqual(resolution.source.launchReference,root.launchReference);
  assert(resolution.contact&&action.actor?.binding);
  assert.deepEqual(resolution.timeline.events.slice(0,launch.timeline.events.length),launch.timeline.events);
  const contacts=resolution.timeline.events.slice(launch.timeline.events.length).filter(event=>event.kind==='BatBallContact');
  assert.equal(contacts.length,1);assert.deepEqual(contacts[0].payload.contact,resolution.contact);
  const contact=resolution.contact,binding=action.actor.binding;
  report={pass:true,authority:'SAVED_ROW_BYTES_ONLY_NOT_CURRENT_NATIVE_OWNER_AUTHENTICATION',
    databasePath,databaseMainSha256:databaseBefore,locatorSha256:sha(locatorBytes),declarationsSha256:sha(declarationBytes),inspected,
    oneOriginalContact:{resolutionReference:root.resolutionReference,launchReference:root.launchReference,
      actionReference:launch.source.actionReference,binding,lineage:resolution.lineage,pitchOrdinal:resolution.pitchOrdinal,
      nativeEvent:{tick:contacts[0].tick,sequence:contacts[0].sequence},contact,
      priorTimelineContactCount:launch.timeline.events.filter(event=>event.kind==='BatBallContact').length},
    physicalFlightsComputed:0,nativeOwnerReauthentication:false,calendarResolved:false,
    traitTimeCreated:false,recognitionModelCreated:false,syntheticNativeFixture:true,privateArtifactNotForPublication:true};
  db.exec('COMMIT');
}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
assert.equal(sha(await readFile(databasePath)),databaseBefore);report.databaseMainUnchanged=true;
await mkdir(out,{recursive:false});await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,rows:inspected.length,originalContacts:1,physicalFlightsComputed:0,
  databaseMainUnchanged:true,nativeOwnerReauthentication:false,calendarResolved:false}));
