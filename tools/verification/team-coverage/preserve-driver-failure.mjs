import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants,copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const [entryArg,runArg,outArg]=process.argv.slice(2);assert.ok(entryArg&&runArg&&outArg);
const entry=JSON.parse(readFileSync(entryArg,'utf8')),run=resolve(runArg),out=resolve(outArg);assert.ok(!existsSync(join(run,'ACTIVE_RUN.json')),'owner must have returned before preservation');
assert.ok(!existsSync(out));mkdirSync(out,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),jsonHash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const inventory=db=>{const schema=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const tables={};for(const row of schema){assert.match(String(row.name),/^[a-zA-Z_][a-zA-Z_0-9]*$/);const rows=db.prepare('SELECT rowid AS proof_rowid,* FROM '+row.name+' ORDER BY rowid').all();tables[row.name]={count:rows.length,hash:jsonHash(rows)};}
  return {schemaHash:jsonHash(schema),tables};};
const original=new DatabaseSync(entry.databasePath,{readOnly:true}),failed=new DatabaseSync(join(run,'team.sqlite'),{readOnly:true});
let before,after;const closedDb=join(out,'checkpoint.sqlite');
try{before=inventory(original);after=inventory(failed);failed.prepare('VACUUM INTO ?').run(closedDb);}finally{original.close();failed.close();}
const changedTables=Object.keys({...before.tables,...after.tables}).filter(k=>JSON.stringify(before.tables[k])!==JSON.stringify(after.tables[k]));
const closed=new DatabaseSync(closedDb,{readOnly:true});try{assert.deepEqual(inventory(closed),after);assert.equal(closed.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{closed.close();}
const mapPath=join(out,'accepted-sources.json');copyFileSync(join(run,'accepted-sources.json'),mapPath,constants.COPYFILE_EXCL);
copyFileSync(join(run,'plan.json'),join(out,'original-plan.json'),constants.COPYFILE_EXCL);
copyFileSync(entryArg,join(out,'original-entry.json'),constants.COPYFILE_EXCL);
assert.equal(sha(entry.databasePath),entry.databaseHash);assert.equal(sha(entry.sourceMapPath),entry.sourceMapHash);
const report={status:'PRESERVED_FAILED_NATIVE_ATTEMPT',failureCause:'OBSERVATION_POSE_BASELINE_CHANGED',databasePath:closedDb,sourceMapPath:mapPath,databaseHash:sha(closedDb),sourceMapHash:sha(mapPath),
  originalDatabaseHash:entry.databaseHash,originalSourceMapHash:entry.sourceMapHash,originalBytesUnchanged:true,before,after,changedTables,schemaUnchanged:before.schemaHash===after.schemaHash,
  allRowsUnchanged:changedTables.length===0,sourceMapIncludesRejectedProposal:true,bodyExecution:false,officialResult:null,pid:process.pid};
writeFileSync(join(out,'manifest.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({status:report.status,changedTables,schemaUnchanged:report.schemaUnchanged,allRowsUnchanged:report.allRowsUnchanged,databaseHash:report.databaseHash,sourceMapHash:report.sourceMapHash}));
