import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { playerBattingModelEvidenceFromSqlite } from '../../../src/host/world/PlayerBattingModelEvidence';
import { withBodyCompositionTransaction } from '../../../src/host/world/BodyMaterializationSqliteOwnership';

// Independent process, readonly original evidence. No author callback or model
// acceptance; use the same saved-row owner as the Native model store.
const [databasePath,expectedPath,reportPath]=process.argv.slice(2);
if(!databasePath||!expectedPath||!reportPath)throw new Error('requires database expected-model report');
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
  const before=audit(),expected=JSON.parse(readFileSync(expectedPath,'utf8'));
  const model=withBodyCompositionTransaction(db,false,()=>playerBattingModelEvidenceFromSqlite(db).read(expected.source.sourceId));
  deepStrictEqual(JSON.parse(JSON.stringify(model)),expected);deepStrictEqual(audit(),before);
  const afterFileHash=sha(readFileSync(databasePath));strictEqual(afterFileHash,beforeFileHash);
  const report={status:'PASS_INDEPENDENT_NATIVE_MEASURED_MODEL_REOPEN',ownerMocks:false,authorCallbacks:false,readonly:true,
    schemasAndAllRowsUnchanged:true,beforeFileHash,afterFileHash,tableCount:before.rows.length,logicalSha256:sha(JSON.stringify(before)),
    expectedModelSha256:sha(readFileSync(expectedPath)),sampledProfiles:model!.repertoire.values.sampledProfiles!.length,
    originalKeys:model!.repertoire.values.sampledProfiles!.reduce((n,p)=>n+p.measured.frames.length,0),
    nativePhysicalCommitmentAdmitted:false,fullMatchVerified:false};
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({status:report.status,tables:report.tableCount,originalKeys:report.originalKeys})+'\n');
}finally{db.close();}
