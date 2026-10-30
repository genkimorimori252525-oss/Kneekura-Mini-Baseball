import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { initializeAuthoredNativeMatchV1 } from './AuthoredNativeMatchV1';
import { authoredNativeMatchFixture } from './AuthoredNativeMatchV1.test-support';
import { reserveAuthoredNativePlateAppearanceV1, type AuthoredNativeReservationDeclarationV1 } from './AuthoredNativeReservationV1';
import { openSqliteSamePlateAppearanceEnrollmentStore } from '../../host/world/SqliteSamePlateAppearanceEnrollmentStore';
import { openSqlitePlayerWorkloadRecoveryStore } from '../../host/world/SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPersonLinkStore } from '../../host/world/SqlitePlayerPersonLinkStore';
import { acceptAuthoredMeasuredBattingFixture } from './AuthoredMeasuredBattingV1.test-support';
import { actorHash as hash } from '../../host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const audit=(path:string)=>{
  const db=new Native(path,{readOnly:true});
  try{return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(t=>[t.name,db.prepare('SELECT * FROM "'+String(t.name).replaceAll('"','""')+'"').all()]));}finally{db.close();}
};
function fixture(){
  const path=join(mkdtempSync(join(tmpdir(),'baseball-reserved-genesis-')),'state.sqlite'),declaration=authoredNativeMatchFixture();
  const g=initializeAuthoredNativeMatchV1(path,declaration),ns=declaration.clocks[0].namespace;
  const batting=acceptAuthoredMeasuredBattingFixture(path,g,ns,declaration.gameDay);
  const d:AuthoredNativeReservationDeclarationV1={version:'authored_native_reservation_v1',genesisPins:g.readPins,
    battingModelReference:{owner:'world_player_batting_models',sourceId:batting.source.sourceId,sourceHash:hash(batting.source),snapshotHash:hash(batting.model)},
    baselines:declaration.intakes.map((p,i)=>({sourceId:ns+':workload:'+i,sourceVersion:'explicit-synthetic-workload-v1',
      personLinkSourceId:p.sourceId,careerId:p.careerId,playerId:p.playerId,createdAtDay:declaration.gameDay,fatigue:0,recoveryCapacity:.5,
      policy:{policyId:ns+':workload-policy',version:'explicit-synthetic-v1',availableAtDay:0,
        workloadFatiguePerUnit:.1,travelFatiguePerKm:.001,recoveryPerHour:.1}})),
    enrollment:{sourceId:ns+':initial-enrollment',sourceVersion:'explicit-synthetic-enrollment-v1',firstPhysicalPitchSourceId:ns+':initial-pitch'}};
  return {path,d,g};
}

it('reserves actual ten-person first-PA workload on the fresh eighteen-player Native world without manufacturing pitch history',()=>{
  const {path,d,g}=fixture(),before=audit(path),original=JSON.stringify(d);
  const r=reserveAuthoredNativePlateAppearanceV1(path,d),rows=audit(path);
  expect(r.workloads).toHaveLength(18);expect(r.enrollment.participants).toHaveLength(10);
  expect(r.battingModel.repertoire.values.sampledProfiles![0].measured.frames.length).toBe(137);
  expect(r.battingModel.source.playerId).toBe(g.actor.binding.playerId);
  expect(new Set(r.enrollment.participants.map(p=>p.binding.playerId))).toEqual(new Set([g.actor.binding.playerId,...g.actor.defenderBindings.map(p=>p.playerId)]));
  expect(r.enrollment.firstPitch).toMatchObject({physicalPitchSourceId:d.enrollment.firstPhysicalPitchSourceId,state:'blocked_execution_basis',consumingSourceId:null});
  expect(r.nativePitchLaunched).toBe(false);expect(r.officialResult).toBeNull();expect(JSON.stringify(d)).toBe(original);
  for(const [table,prior] of Object.entries(before))expect(rows[table]).toEqual(prior);
  expect(rows.world_player_workload_baselines).toHaveLength(18);expect(rows.world_player_workload_heads).toHaveLength(18);
  expect(rows.same_pa_enrollments).toHaveLength(1);expect(rows.same_pa_participant_reservations).toHaveLength(10);
  expect(rows.physical_pitch_progress_actions??[]).toEqual([]);expect(rows.pa_physical_v1_launches??[]).toEqual([]);
  expect(reserveAuthoredNativePlateAppearanceV1(path,d)).toEqual(r);expect(audit(path)).toEqual(rows);
  const reader=openSqliteSamePlateAppearanceEnrollmentStore(path);
  try{expect(reader.read(r.source.sourceId)).toEqual(r.enrollment);}finally{reader.close();}
  expect(audit(path)).toEqual(rows);
  const links=openSqlitePlayerPersonLinkStore(path),workload=openSqlitePlayerWorkloadRecoveryStore(path,links);
  try{for(const s of r.workloads)expect(workload.selectAtRevision(s.state.careerId,s.state.playerId,0)).toEqual(s.state);}finally{workload.close();links.close();}
  expect(audit(path)).toEqual(rows);
  const participant=r.enrollment.participants[0],activity={sourceEventId:d.enrollment.sourceId+':rejected-recovery',sourceVersion:'synthetic-v1',
    evidenceId:'explicit-recovery-attempt',careerId:participant.binding.careerId,playerId:participant.binding.playerId,
    atDay:participant.binding.gameDay,kind:'RECOVERY' as const,durationHours:1,quality:1,medicalAvailability:1};
  const guardedLinks=openSqlitePlayerPersonLinkStore(path),guarded=openSqlitePlayerWorkloadRecoveryStore(path,guardedLinks,{
    readAcceptedBaseline:()=>null,readAcceptedActivity:id=>id===activity.sourceEventId?activity:null});
  try{expect(()=>guarded.apply(activity.sourceEventId,0)).toThrow(/reserved|reservation/);}finally{guarded.close();guardedLinks.close();}
  expect(audit(path)).toEqual(rows);
  const output=process.env.BASEBALL_NATIVE_RESERVATION_EVIDENCE;
  if(output){mkdirSync(output,{recursive:false});const db=new Native(path,{readOnly:true});
    try{db.prepare('VACUUM INTO ?').run(join(output,'reservation.sqlite'));}finally{db.close();}
    for(const [name,value] of Object.entries({declaration:d,expected:r,genesisDeclaration:authoredNativeMatchFixture()}))
      writeFileSync(join(output,name+'.json'),JSON.stringify(value),{flag:'wx'});
  }
},120_000);

it('rejects foreign membership and missing baselines before installing workload or reservation storage',()=>{
  const {path,d}=fixture(),before=audit(path);
  for(const bad of [{...d,baselines:d.baselines.slice(1)},
    {...d,baselines:d.baselines.map((b,i)=>i===0?{...b,personLinkSourceId:d.baselines[1].personLinkSourceId}:b)},
    {...d,baselines:d.baselines.map((b,i)=>i===0?{...b,playerId:'foreign'}:b)},
    {...d,battingModelReference:{...d.battingModelReference,snapshotHash:hash('unaccepted-model')}}]){
    expect(()=>reserveAuthoredNativePlateAppearanceV1(path,bad)).toThrow();expect(audit(path)).toEqual(before);
  }
},120_000);
