import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { readSamePaObservedPitchFromSqlite } from '../../../src/host/world/SqliteSamePlateAppearanceDispatchStore';

// A separate process rederives the saved launch through the production owner.
// No authority callbacks, owner mocks, acceptance or outcome synthesis.
const [databasePath,expectedPath,referencePath,reportPath]=process.argv.slice(2);
if(!databasePath||!expectedPath||!referencePath||!reportPath)throw new Error('requires database expected-pitch reference report');
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const beforeFileHash=sha(readFileSync(databasePath)),db=new Native(databasePath,{readOnly:true});
try{
  const audit=()=>{
    strictEqual(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
    const schemas=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    return {schemas,rows:tables.map(t=>[t.name,db.prepare('SELECT * FROM "'+String(t.name).replaceAll('"','""')+'"').all().map(r=>JSON.stringify(r)).sort()])};
  };
  const before=audit(),expected=JSON.parse(readFileSync(expectedPath,'utf8')),reference=JSON.parse(readFileSync(referencePath,'utf8'));
  db.exec('PRAGMA query_only=1; BEGIN');
  const value=readSamePaObservedPitchFromSqlite(db,reference),pitch=value.pitch;
  deepStrictEqual(JSON.parse(JSON.stringify(pitch)),expected);
  strictEqual(pitch.kind,'same_pa_first_pitch_launched_v1');
  strictEqual('resolution' in pitch.result,false);
  deepStrictEqual(pitch.beforeTimeline.events,[]);
  deepStrictEqual(pitch.beforeTimeline.status,{kind:'active',count:{balls:0,strikes:0}});
  strictEqual(pitch.initialLiveBallBinding.sceneBodyReferences.length,10);
  strictEqual(pitch.initialLiveBallBinding.ownedHandControlThroughTick,pitch.result.delivery.timeline.followThroughEndUs);
  const executionTables=['pa_dispatch_v1_consumer_actions','pa_dispatch_v1_pitch_actions','pa_dispatch_v1_pitch_heads','pa_dispatch_v1_consumptions','pa_dispatch_v1_episode_admissions'];
  const executionRowCounts=executionTables.map(table=>[table,db.prepare('SELECT count(*) AS n FROM '+table).get()!.n]);
  deepStrictEqual(executionRowCounts.map(row=>row[1]),[1,1,1,1,1]);
  db.exec('COMMIT');deepStrictEqual(audit(),before);
  const afterFileHash=sha(readFileSync(databasePath));strictEqual(afterFileHash,beforeFileHash);
  const report={status:'PASS_INDEPENDENT_NATIVE_OBSERVED_LAUNCH_REOPEN',ownerMocks:false,authorCallbacks:false,readonly:true,
    schemasAndAllRowsUnchanged:true,beforeFileHash,afterFileHash,tableCount:before.rows.length,logicalSha256:sha(JSON.stringify(before)),
    expectedSha256:sha(readFileSync(expectedPath)),referenceSha256:sha(readFileSync(referencePath)),executionRowCounts,
    nativePitchLaunched:true,sceneBodies:10,controlThroughTick:pitch.initialLiveBallBinding.ownedHandControlThroughTick,
    outcomesSynthesized:false,fresh18PersonGenesis:false,measuredBattingAdmitted:false,sensorsAfterRelease:false,fullMatchVerified:false};
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({status:report.status,tables:report.tableCount,executionRowCounts})+'\n');
}finally{db.close();}
