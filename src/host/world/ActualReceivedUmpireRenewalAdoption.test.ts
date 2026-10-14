import { createRequire } from 'node:module';
import { existsSync,readFileSync,copyFileSync,mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { expect,it,vi } from 'vitest';
const seam=vi.hoisted(()=>({owner:null as null|((db:import('node:sqlite').DatabaseSync)=>unknown)}));
vi.mock('./ActualReceivedUmpireRenewalEvidence',()=>({receivedRenewalEnrollmentEvidenceFromSqlite:(db:import('node:sqlite').DatabaseSync)=>seam.owner!(db)}));
const inputPath=process.env.RECEIVED_RENEWAL_ADOPTION_INPUT;
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture=async()=>{
  expect(existsSync(new URL('./SqliteActualReceivedUmpireRenewalAdoptionStore.ts',import.meta.url)),'RENEWAL_PHYSICAL_ADOPTION_IMPLEMENTATION_MISSING').toBe(true);
  const m=await import('./SqliteActualReceivedUmpireRenewalAdoptionStore');
  const input=JSON.parse(readFileSync(inputPath!,'utf8')) as {schema:string;released:boolean;databasePath:string;databaseSha256:string};
  if(input.schema!=='received_renewal_adoption_fixture_input_v1'||input.released!==true)throw new Error('isolated renewal adoption fixture input is not released');
  const support=await import('./ActualReceivedUmpireRenewalPhysicalFixtures.test-support');
  seam.owner=support.receivedRenewalPhysicalEvidenceFromSqlite;
  const bytes=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
  expect(bytes(input.databasePath)).toBe(input.databaseSha256);expect(existsSync(input.databasePath+'-wal')).toBe(false);expect(existsSync(input.databasePath+'-shm')).toBe(false);
  const path=join(mkdtempSync(join(process.env.TMPDIR!,'renewal-adoption-case-')),'state.sqlite');copyFileSync(input.databasePath,path);expect(bytes(path)).toBe(input.databaseSha256);
  const f=await support.openPreparedReceivedRenewalPhysicalFixture(path);
  let accepted=f.adoptionSource;
  const store=m.openSqliteActualReceivedUmpireRenewalAdoptionStore(path,{readAcceptedAdoption:()=>accepted});
  return {...f,...m,store,changeSource:(source:typeof accepted)=>{accepted=source;},close(){store.close();f.close();expect(bytes(input.databasePath)).toBe(input.databaseSha256);}};
};
// These opt-in cases consume fresh private copies of a separately qualified
// synthetic stage-3 prefix. They do not rebuild roots or use the genuine donor.
it.skipIf(!inputPath)('RN01 commits exactly four rows and adopts one motor at an unchanged physical cut',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let changes=0;
  try{const original=f.readOriginal();const prior=f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(f.adoptionSource.previousExecutionSourceId)!;
    DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(/^(INSERT INTO batted_world_field_executions|UPDATE batted_world_field_execution_heads|UPDATE actual_received_umpire_renewal_heads|INSERT INTO actual_received_umpire_renewal_admissions)/.test(sql)){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const r=run(...args);changes+=Number(r.changes);return r;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    const value=f.store.accept(f.adoptionSource.sourceId);expect(changes).toBe(4);expect(value.execution.kind).toBe('received_renewal_adoption_v1');
    if(value.execution.kind!=='received_renewal_adoption_v1')throw new Error('renewal adoption');
    expect(value.execution.adoption.adoptedAt).toEqual(f.motor!.receipt.startAt);expect(value.execution.adoption.executedThrough).toEqual(f.motor!.receipt.startAt);
    expect(value.execution.composition.contributors).toHaveLength(10);expect(value.execution.field.motion.actors).toHaveLength(50);
    expect(value.execution.field.motion.world.moment).toEqual(original.execution.execution.field.motion.world.moment);
    expect(f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(f.adoptionSource.previousExecutionSourceId)).toEqual(prior);
    expect(f.db.prepare('SELECT stage,adoption_source_id FROM actual_received_umpire_renewal_heads').get()).toEqual({stage:4,adoption_source_id:f.adoptionSource.sourceId});
    const {actualPlayersKinematicsFromPrefix}=await import('./ActualPlayerKinematicsFromPrefix');
    const {battedWorldFieldPhysicalPrefix}=await import('./BattedWorldFieldPhysicalPrefix');
    const prefix={...original.prefix,executions:[...original.prefix.executions,value]},after=actualPlayersKinematicsFromPrefix(original.selves.map(p=>p.playerId),prefix);
    expect(battedWorldFieldPhysicalPrefix(prefix).field).toEqual(battedWorldFieldPhysicalPrefix(original.prefix).field);
    for(const old of original.selves){const next=after.find(p=>p.playerId===old.playerId)!;
      expect(next.at).toEqual(old.at);expect(next.ticksPerSecond).toBe(old.ticksPerSecond);expect(next.root.position).toEqual(old.root.position);expect(next.root.velocity).toEqual(old.root.velocity);
      expect(next.ownedMotionCoverage!.roleAuthorities).toEqual(old.ownedMotionCoverage!.roleAuthorities);
      for(const role of old.roles){const actual=next.roles.find(p=>p.role===role.role)!;expect(actual.offset).toEqual(role.offset);expect(actual.relativeVelocity).toEqual(role.relativeVelocity);expect(actual.declaredPose).toEqual(role.declaredPose);expect(actual.radiusMeters).toBe(role.radiusMeters);}
      if(old.playerId===f.enrollment.playerId){expect(next.activeCommand.kind).toBe('received_renewal_adoption_v1');expect(next.ownedMotionCoverage!.rootAuthority).toMatchObject({owner:'actual_received_umpire_renewal_motors',sourceId:f.motorSource.sourceId});expect(next.root.acceleration).toEqual(f.motor!.receipt.command.bodyAcceleration);}
      else{expect(next.activeCommand).toEqual(old.activeCommand);expect(next.ownedMotionCoverage!.rootAuthority).toEqual(old.ownedMotionCoverage!.rootAuthority);expect(next.root.acceleration).toEqual(old.root.acceleration);}
    }
    expect(f.seamStats().qualificationsAfterAdvance).toBe(0);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it.skipIf(!inputPath)('RN02 rolls all adoption writes back when the accepted Source changes after physical INSERT',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO batted_world_field_executions')){const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const r=run(...args);f.changeSource({...f.adoptionSource,sourceVersion:'changed-after-insert'});return r;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(f.adoptionSource.sourceId)).toThrow(/Source|callback/);
    expect(f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(f.adoptionSource.sourceId)).toBeUndefined();
    expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(3);
    expect(f.db.prepare('SELECT source_id FROM batted_world_field_execution_heads').get()!.source_id).toBe(f.adoptionSource.previousExecutionSourceId);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it.skipIf(!inputPath)('RN03 reports partial durable uncertainty and retires after a real physical INSERT COMMIT',async()=>{
  const f=await fixture(),prepare=DatabaseSync.prototype.prepare;let injected=false;
  try{DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO batted_world_field_executions')){const run=stmt.run.bind(stmt),db=this;stmt.run=((...args:Parameters<typeof stmt.run>)=>{const r=run(...args);if(!injected){injected=true;db.exec('COMMIT; BEGIN IMMEDIATE');throw new Error('injected committed physical row');}return r;}) as typeof stmt.run;}return stmt;} as typeof prepare;
    expect(()=>f.store.accept(f.adoptionSource.sourceId)).toThrow(/uncertain.*retired|ownership.*retired/);expect(()=>f.store.read(f.adoptionSource.sourceId)).toThrow(/retired|closed/);
    expect(f.db.prepare('SELECT source_id FROM batted_world_field_executions WHERE source_id=?').get(f.adoptionSource.sourceId)!.source_id).toBe(f.adoptionSource.sourceId);
    expect(f.db.prepare('SELECT source_id FROM batted_world_field_execution_heads').get()!.source_id).toBe(f.adoptionSource.previousExecutionSourceId);
    expect(f.db.prepare('SELECT stage FROM actual_received_umpire_renewal_heads').get()!.stage).toBe(3);
  }finally{DatabaseSync.prototype.prepare=prepare;f.close();}
});
it.skipIf(!inputPath)('RN04 reopens the adopted physical row without callbacks and leaves physical continuation pending',async()=>{
  const f=await fixture();try{const value=f.store.accept(f.adoptionSource.sourceId);f.store.close();const reader=f.openSqliteActualReceivedUmpireRenewalAdoptionStore(f.path);
    try{expect(reader.read(f.adoptionSource.sourceId)).toEqual(value);expect(reader.accept(f.adoptionSource.sourceId)).toEqual(value);
      const {actualReceivedUmpireRenewalLiveWorkFromSqlite}=await import('./ActualReceivedUmpireRenewalLiveWork');f.db.exec('BEGIN');expect(actualReceivedUmpireRenewalLiveWorkFromSqlite(f.db).read(f.enrollmentSource.receivedEnrollmentSourceId)).toMatchObject({kind:'received_renewal_work',stage:4,work:{kind:'physical_continuation',sourceId:f.adoptionSource.sourceId}});f.db.exec('COMMIT');
      expect(f.seamStats().qualificationsAfterAdvance).toBe(0);
    }finally{reader.close();}
  }finally{if(f.db.isTransaction)f.db.exec('ROLLBACK');f.close();}
});
it.skipIf(!inputPath)('RN05 keeps earlier renewal owners replayable after the physical head advances',async()=>{
  const f=await fixture();try{f.store.accept(f.adoptionSource.sourceId);expect(f.enrollments.read(f.enrollmentSource.sourceId)).toEqual(f.enrollment);expect(f.decisions.read(f.decisionSource.sourceId)).toEqual(f.decision);expect(f.motors.read(f.motorSource.sourceId)).toEqual(f.motor);expect(f.seamStats().qualificationsAfterAdvance).toBe(0);}finally{f.close();}
});
