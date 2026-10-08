import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect,it,vi } from 'vitest';
import { openPreparedReceivedRenewalPhysicalFixture,receivedRenewalPhysicalEvidenceFromSqlite } from './ActualReceivedUmpireRenewalPhysicalFixtures.test-support';
import { openSqliteActualReceivedUmpireRenewalMotorStore } from './SqliteActualReceivedUmpireRenewalMotorStore';
const seam=vi.hoisted(()=>({owner:null as null|typeof receivedRenewalPhysicalEvidenceFromSqlite}));
vi.mock('./ActualReceivedUmpireRenewalEvidence',()=>({receivedRenewalEnrollmentEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>seam.owner!(db)}));
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const inputPath=process.env.RECEIVED_RENEWAL_PREPARED_INPUT;
const digest=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const state=(db:import('node:sqlite').DatabaseSync)=>{
  const schema=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all();
  return {schema,rows:Object.fromEntries(schema.filter(s=>s.type==='table').map(s=>[String(s.name),db.prepare('SELECT * FROM "'+String(s.name).replaceAll('"','""')+'"').all()]))};
};
it.skipIf(!inputPath)('RPM01 issues only the missing Native motor on a closed synthetic stage2 copy with three changes',async()=>{
  const input=JSON.parse(readFileSync(inputPath!,'utf8')) as {schema:string;released:boolean;databasePath:string;databaseSha256:string;terminalPath:string;terminalSha256:string};
  expect(input.schema).toBe('received_renewal_prepared_motor_input_v1');expect(input.released).toBe(true);
  const verify=()=>{expect(digest(input.databasePath)).toBe(input.databaseSha256);expect(digest(input.terminalPath)).toBe(input.terminalSha256);
    expect(existsSync(input.databasePath+'-wal')).toBe(false);expect(existsSync(input.databasePath+'-shm')).toBe(false);};
  verify();const terminal=JSON.parse(readFileSync(input.terminalPath,'utf8'));expect(terminal.status).toBe('passed');expect(terminal.remainingOwnedProcesses).toEqual([]);
  const directory=join(process.env.TMPDIR!,'prepared-stage3');mkdirSync(directory,{mode:0o700});const path=join(directory,'state.sqlite');expect(existsSync(path)).toBe(false);
  copyFileSync(input.databasePath,path);expect(digest(path)).toBe(input.databaseSha256);seam.owner=receivedRenewalPhysicalEvidenceFromSqlite;
  const f=await openPreparedReceivedRenewalPhysicalFixture(path),store=openSqliteActualReceivedUmpireRenewalMotorStore(path,{readAcceptedMotor:id=>id===f.motorSource.sourceId?f.motorSource:null});
  const prepare=DatabaseSync.prototype.prepare;let changes=0,receipt:object|undefined;
  try{
    const before=state(f.db);expect(f.head.stage).toBe(2);expect(f.motor).toBeNull();
    DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(/^(INSERT INTO actual_received_umpire_renewal_motors|UPDATE actual_received_umpire_renewal_heads|INSERT INTO actual_received_umpire_renewal_admissions)/.test(sql)){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const r=run(...args);changes+=Number(r.changes);return r;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    const value=store.accept(f.motorSource.sourceId);expect(changes).toBe(3);expect(value.receipt.lifecycle).toEqual({status:'adoption_pending',executedThrough:null});
    expect(value.receipt.retainedRoles).toHaveLength(5);expect(value.receipt.coverageEndTick).toBeGreaterThan(value.receipt.movementStartTick);
    const after=state(f.db),mutable=['actual_received_umpire_renewal_motors','actual_received_umpire_renewal_heads','actual_received_umpire_renewal_admissions'];
    expect(after.schema).toEqual(before.schema);for(const table of Object.keys(before.rows).filter(t=>!mutable.includes(t)))expect(after.rows[table]).toEqual(before.rows[table]);
    expect(after.rows[mutable[0]]).toHaveLength(1);expect(after.rows[mutable[1]]).toEqual([{...before.rows[mutable[1]][0],stage:3,owner:mutable[0],source_id:f.motorSource.sourceId,renewal_motor_source_id:f.motorSource.sourceId}]);
    expect(after.rows[mutable[2]].slice(0,2)).toEqual(before.rows[mutable[2]]);expect(after.rows[mutable[2]]).toHaveLength(3);
    const stats=f.seamStats();expect(stats.qualificationsAfterAdvance).toBe(0);expect([...stats.connections].map(db=>Number(db.prepare('SELECT total_changes() AS n').get()!.n)).sort()).toEqual([0,3]);
    receipt={schema:'received_renewal_prepared_motor_receipt_v1',stage:3,motorSource:value.source,adoptionSource:f.adoptionSource,changes,schemaChanges:0,
      physicalPredecessor:{sourceId:f.context.executionSourceId,revision:f.context.executionRevision},derivations:stats.derivations,currentQualifications:stats.qualifications,
      beforeRowCount:Object.values(before.rows).reduce((n,r)=>n+r.length,0),afterRowCount:Object.values(after.rows).reduce((n,r)=>n+r.length,0)};
  }finally{DatabaseSync.prototype.prepare=prepare;store.close();f.close();verify();}
  const tuple=['','-wal','-shm'].map(suffix=>({suffix,path:path+suffix,exists:existsSync(path+suffix),...(existsSync(path+suffix)?{sha256:digest(path+suffix),sizeBytes:readFileSync(path+suffix).byteLength}:{})}));
  writeFileSync(join(process.env.TMPDIR!,'prepared-motor-receipt.json'),JSON.stringify({...receipt,closedOutputTuple:tuple},null,2)+'\n');
});
