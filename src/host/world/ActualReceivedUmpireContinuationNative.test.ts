/** Isolated Native continuation over a separately qualified synthetic adoption.
 * Only old received-call ancestry is mocked. All physical/models/C/D/M/A readers
 * and the new three-write continuation owner run on their actual Native DB. */
import {createRequire} from 'node:module';
import {copyFileSync,existsSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const seam=vi.hoisted(()=>({owner:null as null|((db:import('node:sqlite').DatabaseSync)=>unknown)}));
vi.mock('./ActualReceivedUmpireRenewalEvidence',()=>({receivedRenewalEnrollmentEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>seam.owner!(db)}));
import {openSqliteActualReceivedUmpireContinuationStore} from './SqliteActualReceivedUmpireContinuationStore';
import {openSqliteActualReceivedUmpireRenewalAdoptionStore} from './SqliteActualReceivedUmpireRenewalAdoptionStore';
import {actualReceivedUmpireRenewalLiveWorkFromSqlite} from './ActualReceivedUmpireRenewalLiveWork';
import {battedWorldFieldExecutionEvidenceFromSqlite} from './SqliteBattedWorldFieldExecutionStore';
import {battedWorldFieldEvidenceFromSqlite} from './SqliteBattedWorldFieldStore';
import {actualPlayersKinematicsFromPrefix} from './ActualPlayerKinematicsFromPrefix';
import {ownedScheduledMotionArchiveEncoding as encoding} from './OwnedScheduledMotionArchive';
import {receivedGenuineCensus} from './ActualReceivedUmpireDefenderGenuineStages.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const inputPath=process.env.RECEIVED_CONTINUATION_INPUT;
const fixture=async()=>{
  const input=JSON.parse(readFileSync(inputPath!,'utf8')) as {schema:string;released:boolean;databasePath:string;databaseSha256:string};
  expect(input).toMatchObject({schema:'received_continuation_synthetic_input_v1',released:true});
  const digest=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');expect(digest(input.databasePath)).toBe(input.databaseSha256);
  for(const suffix of ['-wal','-shm','-journal'])expect(existsSync(input.databasePath+suffix)).toBe(false);
  const path=join(mkdtempSync(join(process.env.TMPDIR!,'received-continuation-case-')),'state.sqlite');copyFileSync(input.databasePath,path);
  const support=await import('./ActualReceivedUmpireRenewalPhysicalFixtures.test-support');seam.owner=support.receivedRenewalPhysicalEvidenceFromSqlite;
  const f=await support.openPreparedReceivedRenewalPhysicalFixture(path);expect(f.head.stage).toBe(4);
  const source={sourceId:'synthetic-received-positive-step',sourceVersion:'isolated-continuation-v1',baseFieldSourceId:f.adoptionSource.baseFieldSourceId,
    previousExecutionSourceId:f.adoptionSource.sourceId,action:{kind:'received_renewal_continuation_v1' as const,renewalEnrollmentSourceId:f.enrollmentSource.sourceId,renewalAdoptionSourceId:f.adoptionSource.sourceId}};
  let accepted=source,callbacks=0;const store=openSqliteActualReceivedUmpireContinuationStore(path,{readAcceptedContinuation:()=>{callbacks++;return accepted;}});
  const census=()=>receivedGenuineCensus(f.db),before=census();
  return {...f,source,store,before,census,callbacks:()=>callbacks,change:()=>{accepted={...source,sourceVersion:'changed'};},
    close(){store.close();f.close();expect(digest(input.databasePath)).toBe(input.databaseSha256);}};
};
it.runIf(!!inputPath)('RCN01 commits one retained positive step then authenticates old owners and callback-free cold work',async()=>{
  const f=await fixture();try{
    const value=f.store.accept(f.source.sourceId);expect(value.execution.kind).toBe('received_renewal_continuation_v1');
    if(value.execution.kind!=='received_renewal_continuation_v1')throw new Error('continuation missing');
    const x=value.execution;expect(x.executedThrough.elapsedSeconds).toBeGreaterThan(x.at.elapsedSeconds);expect(x.checkpointThroughTick).toBeLessThanOrEqual(x.coverageThroughTick);
    expect(['physical_boundary','coverage_exhausted','decision_boundary']).toContain(x.status);
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_continuations').get()!.n).toBe(1);
    const after=f.census();expect(after.tables).toHaveLength(f.before.tables.length+1);
    for(const prior of f.before.tables){const next=after.tables.find(t=>t.name===prior.name)!;
      if(prior.name==='batted_world_field_executions'){expect(next.rows).toHaveLength(prior.rows.length+1);expect(next.rows).toEqual(expect.arrayContaining(prior.rows));}
      else if(prior.name==='batted_world_field_execution_heads'){expect(f.db.prepare('SELECT source_id,revision FROM batted_world_field_execution_heads').get()).toEqual({source_id:f.source.sourceId,revision:value.revision});}
      else expect(next).toEqual(prior);
    }
    f.db.exec('BEGIN');const fields=battedWorldFieldEvidenceFromSqlite(f.db),base=fields.read(f.source.baseFieldSourceId)!;
    const physical=battedWorldFieldExecutionEvidenceFromSqlite(f.db),oldPrefix={baseField:base,fields:fields.scope(base,base.source.sourceId),executions:physical.scope(base,f.source.previousExecutionSourceId)};
    const ids=value.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!,players=[ids.binding.playerId,...ids.defenderBindings.map(p=>p.playerId)];
    const before=actualPlayersKinematicsFromPrefix(players,oldPrefix),next=actualPlayersKinematicsFromPrefix(players,{...oldPrefix,executions:[...oldPrefix.executions,value]});
    expect(x.field.motion.actors).toEqual(oldPrefix.executions.at(-1)!.execution.field.motion.actors);
    for(const old of before){const current=next.find(p=>p.playerId===old.playerId)!;
      expect(current.at).toEqual({originTick:x.executedThrough.originTick,elapsedSeconds:x.executedThrough.elapsedSeconds,tick:x.executedThrough.tick});
      expect(current.adoptions).toHaveLength(old.adoptions.length);expect(current.ownedMotionCoverage).toEqual(old.ownedMotionCoverage);
      expect(current.activeCommand.sourceId).toBe(old.activeCommand.sourceId);expect(current.activeCommand.adoptedAt).toEqual(old.activeCommand.adoptedAt);
      const dt=current.at.elapsedSeconds-old.at.elapsedSeconds;for(const axis of ['x','y','z'] as const)expect(current.root.position[axis]).toBeCloseTo(old.root.position[axis]+old.root.velocity[axis]*dt+0.5*old.root.acceleration[axis]*dt*dt,10);
    }f.db.exec('COMMIT');
    expect(f.enrollments.read(f.enrollmentSource.sourceId)).toEqual(f.enrollment);expect(f.decisions.read(f.decisionSource.sourceId)).toEqual(f.decision);expect(f.motors.read(f.motorSource.sourceId)).toEqual(f.motor);
    const adoption=openSqliteActualReceivedUmpireRenewalAdoptionStore(f.path);try{expect(adoption.read(f.adoptionSource.sourceId)?.source).toEqual(f.adoptionSource);}finally{adoption.close();}
    f.store.close();const reader=openSqliteActualReceivedUmpireContinuationStore(f.path);const count=f.callbacks();
    try{expect(encoding(reader.read(f.source.sourceId)!).json).toBe(encoding(value).json);expect(encoding(reader.accept(f.source.sourceId)).json).toBe(encoding(value).json);}finally{reader.close();}
    f.db.exec('BEGIN');const changes=f.db.prepare('SELECT total_changes() AS n').get()!.n;
    const work=actualReceivedUmpireRenewalLiveWorkFromSqlite(f.db).read(f.enrollmentSource.receivedEnrollmentSourceId);
    expect(work).toMatchObject({stage:4,work:{...x.liveWork}});expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(f.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);f.db.exec('COMMIT');expect(f.callbacks()).toBe(count);expect(f.census()).toEqual(after);
    expect(f.seamStats().qualificationsAfterAdvance).toBe(0);
  }finally{if(f.db.isTransaction)f.db.exec('ROLLBACK');f.close();}
});
it.runIf(!!inputPath)('RCN02 rolls back all three writes and first schema when the Source changes after physical INSERT',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let reached=false;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO batted_world_field_executions')){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const out=run(...args);reached=true;f.change();return out;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(f.source.sourceId)).toThrow(/Source|callback/);expect(reached).toBe(true);expect(f.census()).toEqual(f.before);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it.runIf(!!inputPath)('RCN03 retains honest partial-commit uncertainty and retires the lost transaction owner',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let reached=false;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql),db=this;if(sql.startsWith('INSERT INTO batted_world_field_executions')){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const out=run(...args);if(!reached){reached=true;db.exec('COMMIT; BEGIN IMMEDIATE');throw new Error('forced real continuation COMMIT');}return out;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(f.source.sourceId)).toThrow(/uncertain.*retired|ownership.*retired/);expect(reached).toBe(true);expect(()=>f.store.read(f.source.sourceId)).toThrow(/retired|closed/);
    expect(f.db.prepare('SELECT source_id FROM batted_world_field_executions WHERE source_id=?').get(f.source.sourceId)!.source_id).toBe(f.source.sourceId);
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_continuations').get()!.n).toBe(0);
    const cold=openSqliteActualReceivedUmpireContinuationStore(f.path);try{expect(()=>cold.read(f.source.sourceId)).toThrow(/orphan|admission/);}finally{cold.close();}
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it.runIf(!!inputPath)('RCN04 checks the accepted Source after actual COMMIT and preserves its uncertain complete endpoint',async()=>{
  const f=await fixture(),exec=DatabaseSync.prototype.exec;let reached=false;
  try{DatabaseSync.prototype.exec=function(this:InstanceType<typeof DatabaseSync>,sql:string){const actual=sql==='COMMIT'&&this.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='actual_received_umpire_continuations'").get()!.n===1&&this.prepare('SELECT count(*) AS n FROM actual_received_umpire_continuations').get()!.n===1;const out=exec.call(this,sql);if(actual&&!reached){reached=true;f.change();}return out;};
    expect(()=>f.store.accept(f.source.sourceId)).toThrow(/uncertain.*retired/);expect(reached).toBe(true);expect(()=>f.store.read(f.source.sourceId)).toThrow(/retired|closed/);
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_continuations').get()!.n).toBe(1);
  }finally{DatabaseSync.prototype.exec=exec;f.close();}
});
