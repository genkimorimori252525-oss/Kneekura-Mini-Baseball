import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { readSamePlateAppearanceEnrollment } from '../../../src/host/world/SamePlateAppearanceEnrollmentFromSqlite';
import { readActualRoleWorkloadState } from '../../../src/host/world/ActualRoleWorkloadState';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { playerBattingModelEvidenceFromSqlite } from '../../../src/host/world/PlayerBattingModelEvidence';

const [databasePath,expectedPath,reportPath]=process.argv.slice(2);
if(!databasePath||!expectedPath||!reportPath)throw new Error('requires database expected-reservation report');
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
  const before=audit(),expected=JSON.parse(readFileSync(expectedPath,'utf8')) as {
    source:{sourceId:string};enrollment:unknown;battingModel:{source:{sourceId:string}};
    workloads:{baselineSourceId:string;state:{careerId:string;playerId:string;revision:number}}[]};
  db.exec('BEGIN');
  const enrollment=withBattedWorldPhysicalReadTraversal(db,()=>readSamePlateAppearanceEnrollment(db,expected.source.sourceId));
  deepStrictEqual(JSON.parse(JSON.stringify(enrollment)),expected.enrollment);
  const battingModel=playerBattingModelEvidenceFromSqlite(db).read(expected.battingModel.source.sourceId);
  deepStrictEqual(JSON.parse(JSON.stringify(battingModel)),expected.battingModel);
  for(const w of expected.workloads){
    const state=readActualRoleWorkloadState(db,w.state.careerId,w.state.playerId);
    deepStrictEqual(JSON.parse(JSON.stringify(state)),w.state);
  }
  db.exec('COMMIT');deepStrictEqual(audit(),before);
  const afterFileHash=sha(readFileSync(databasePath));strictEqual(afterFileHash,beforeFileHash);
  const report={status:'PASS_INDEPENDENT_NATIVE_RESERVATION_REOPEN',ownerMocks:false,authorCallbacks:false,readonly:true,
    schemasAndAllRowsUnchanged:true,beforeFileHash,afterFileHash,tableCount:before.rows.length,logicalSha256:sha(JSON.stringify(before)),
    expectedSha256:sha(readFileSync(expectedPath)),workloads:expected.workloads.length,participants:enrollment!.participants.length,
    firstPitchState:enrollment!.firstPitch.state,measuredBattingModelInSameDatabase:true,nativePitchLaunched:false,fullMatchVerified:false};
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({status:report.status,tables:report.tableCount,participants:report.participants})+'\n');
}finally{db.close();}
