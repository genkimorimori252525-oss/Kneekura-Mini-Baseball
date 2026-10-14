import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { expect,it } from 'vitest';
import { installRenewalOwnerSchema } from './ActualReceivedUmpireRenewalSchema';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cut={originTick:1000,elapsedSeconds:0.2,tick:1200,ticksPerSecond:1000};
const source={sourceId:'adoption-11',sourceVersion:'fixture-v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'execution-10',action:{kind:'received_renewal_adoption_v1' as const,renewalEnrollmentSourceId:'enroll-a',renewalMotorSourceId:'motor-a'}};
const scope={source,gameId:'game-a',physicalPitchSourceId:'pitch-a',predecessor:{sourceId:'execution-10',revision:10},cut};
const fixture=()=>{
  const db=new DatabaseSync(':memory:');db.exec('BEGIN');installRenewalOwnerSchema(db);db.exec('COMMIT');
  const e={sourceId:'enroll-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_enrollment_v1',receivedEnrollmentSourceId:'received-a',receivedReplanSourceId:'replan-2'};
  const d={sourceId:'decision-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_decision_v1',renewalEnrollmentSourceId:'enroll-a'};
  const m={sourceId:'motor-a',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_motor_v1',renewalEnrollmentSourceId:'enroll-a',renewalDecisionSourceId:'decision-a'};
  const cached={game_id:'game-a',play_id:1,physical_pitch_source_id:'pitch-a',player_id:'player-a',runtime_source_id:'runtime-a',received_enrollment_source_id:'received-a',origin_process_source_id:'replan-1',received_replan_source_id:'replan-2',renewal_enrollment_source_id:'enroll-a'};
  const enrollment={source:e,gameId:'game-a',playId:1,physicalPitchSourceId:'pitch-a',playerId:'player-a',cut,anchor:{baseField:{sourceId:'field-a'},physicalPredecessor:{sourceId:'execution-10',revision:10}}};
  for(const [table,s,snapshot] of [['actual_received_umpire_renewal_enrollments',e,enrollment],['actual_received_umpire_renewal_decisions',d,{source:d}],['actual_received_umpire_renewal_motors',m,{source:m}]] as const){
    const row={source_id:s.sourceId,source_version:s.sourceVersion,...cached,...(table.endsWith('_motors')?{renewal_decision_source_id:'decision-a'}:{}),source_json:json(s),source_hash:hash(s),snapshot_json:json(snapshot),snapshot_hash:hash(snapshot)};
    db.prepare(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));
  }
  return {db,enrollment,m};
};
const load=async()=>{
  expect(existsSync(new URL('./ActualReceivedUmpireRenewalPhysicalMetadata.ts',import.meta.url)),'RENEWAL_PHYSICAL_PREFLIGHT_MISSING').toBe(true);
  return import('./ActualReceivedUmpireRenewalPhysicalMetadata');
};
it('RP01 admits the declared same-cut strictly earlier physical predecessor metadata',async()=>{
  const f=fixture();try{const m=await load();expect(()=>m.preflightReceivedRenewalAdoption(f.db,scope)).not.toThrow();}finally{f.db.close();}
});
it('RP02 rejects self and forward physical anchors before Native motor replay',async()=>{
  const f=fixture();try{const m=await load();for(const physicalPredecessor of [{sourceId:source.sourceId,revision:11},{sourceId:'execution-10',revision:11},{sourceId:'other-10',revision:10}]){
    const value={...f.enrollment,anchor:{...f.enrollment.anchor,physicalPredecessor}};f.db.prepare('UPDATE actual_received_umpire_renewal_enrollments SET snapshot_json=?,snapshot_hash=?').run(json(value),hash(value));
    expect(()=>m.preflightReceivedRenewalAdoption(f.db,scope)).toThrow(/predecessor|rank|anchor/);
  }}finally{f.db.close();}
});
it('RP03 rejects a received motor Source rebound away from its declared enrollment',async()=>{
  const f=fixture();try{const m=await load(),value={...f.m,renewalEnrollmentSourceId:'foreign-enrollment'};
    f.db.prepare('UPDATE actual_received_umpire_renewal_motors SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?').run(json(value),hash(value),json({source:value}),hash({source:value}));
    expect(()=>m.preflightReceivedRenewalAdoption(f.db,scope)).toThrow(/binding|enrollment|Source/);
  }finally{f.db.close();}
});
it('RP04 rejects metadata cuts with equal quantized ticks but different elapsed instants',async()=>{
  const f=fixture();try{const m=await load(),value={...f.enrollment,cut:{...cut,elapsedSeconds:0.1999}};
    f.db.prepare('UPDATE actual_received_umpire_renewal_enrollments SET snapshot_json=?,snapshot_hash=?').run(json(value),hash(value));
    expect(()=>m.preflightReceivedRenewalAdoption(f.db,scope)).toThrow(/cut|tuple|integer/);
  }finally{f.db.close();}
});
