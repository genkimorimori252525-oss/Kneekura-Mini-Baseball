import { afterEach, expect, it, vi } from 'vitest';
import { enrollmentFixture,native,count } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore as open } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqlitePlayerWorkloadRecoveryStore,playerWorkloadRecoveryStoreFromSqlite } from './SqlitePlayerWorkloadRecoveryStore';
import { beginActualLivePlayWrite,beginActualLivePlayRegistration } from './ActualLivePlayFence';
import { assertNoActualRoleWorkloadCharge,assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
const fixtures:ReturnType<typeof enrollmentFixture>[]=[],owners:{close():void}[]=[];
afterEach(()=>{owners.splice(0).reverse().forEach(o=>o.close());fixtures.splice(0).reverse().forEach(f=>f.close());vi.restoreAllMocks();});
const setup=()=>{const f=enrollmentFixture();fixtures.push(f);const owner=open(f.path,{readAcceptedEnrollment:()=>f.source});owners.push(owner);owner.accept(f.source.sourceId);return f;};
const details=[{kind:'MATCH',effortUnits:1},{kind:'PRACTICE',effortUnits:1,healthAvailability:1},{kind:'TRAVEL',distanceKm:1},{kind:'RECOVERY',durationHours:1,quality:1,medicalAvailability:1}] as const;
for(const route of ['open','connected'])for(const detail of details)it(`SP-G01 ${route} ${detail.kind} mandatory global reservation guard`,()=>{
  const f=setup(),activity={sourceEventId:'fresh',sourceVersion:'fixture-v1',evidenceId:'accepted-fixture',careerId:'career-a',playerId:'away-2',atDay:2,...detail};f.activities.set('fresh',activity);
  const writer=route==='open'?openSqlitePlayerWorkloadRecoveryStore(f.path,f.personLinks,f.authority):playerWorkloadRecoveryStoreFromSqlite(native(f.path),f.personLinks,f.authority);owners.push(writer);
  expect(()=>writer.apply('fresh',0)).toThrow(/same-PA|reservation/);expect(count(f.db,'world_player_workload_activities')).toBe(0);expect(writer.readHead('career-a','away-2')!.revision).toBe(0);
});
it('SP-G01 authentic pre-reservation activity and baseline retries remain unchanged',()=>{
  const f=enrollmentFixture();fixtures.push(f);const activity={sourceEventId:'prior',sourceVersion:'fixture-v1',evidenceId:'prior-pa',careerId:'career-a',playerId:'away-2',atDay:2,kind:'MATCH' as const,effortUnits:1};
  f.activities.set('prior',activity);const prior=f.workload.apply('prior',0);
  const {actorHash:hash}=requireActor();const source={...f.source,participantBaselineReferences:f.source.participantBaselineReferences.map(p=>p.playerId==='away-2'?{...p,revision:1,stateHash:hash(prior)}:p)};
  const owner=open(f.path,{readAcceptedEnrollment:()=>source});owners.push(owner);owner.accept(source.sourceId);
  expect(f.workload.apply('prior',0)).toEqual(prior);expect(f.workload.initialize('baseline-away-2')).toEqual(prior);expect(count(f.db,'world_player_workload_activities')).toBe(1);
});
import * as actor from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const requireActor=()=>actor;
it.each(['legacy','total'] as const)('SP-G02 reservation blocks %s charge for enrolled PA but preserves prior PA scope',kind=>{
  const f=setup(),guard=kind==='legacy'?assertNoActualRoleWorkloadCharge:assertNoLegacyPitchWorkloadCharge;
  expect(()=>guard(f.db,{careerId:'career-a',gameId:'game',playId:1,playerId:'away-2'})).toThrow(/same-PA|reservation/);
  expect(()=>guard(f.db,{careerId:'career-a',gameId:'game',playId:0,playerId:'away-2'})).not.toThrow();
});
it.each(['actor','pitch','runtime'] as const)('SP-G03 %s admission cannot enter a reserved PA',kind=>{
  const f=setup();f.db.exec('BEGIN IMMEDIATE');try{
    expect(()=>kind==='runtime'?beginActualLivePlayRegistration(f.db,{gameId:'game',playId:1,physicalPitchSourceId:'first-pitch'}):beginActualLivePlayWrite(f.db,{gameId:'game',playId:1},{owner:kind==='actor'?'physical_plate_appearance_actors':'physical_pitch_progress_actions',sourceId:'alias'})).toThrow(/same-PA|reservation/);
  }finally{f.db.exec('ROLLBACK');}
});

import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import type { AcceptedSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollment';
import * as physicalOwner from './PhysicalPitchEvidenceFromSqlite';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { openSqliteActualLivePlayRuntimeStore } from './SqliteActualLivePlayRuntimeStore';
it('SP-G03 real Native initial actor enrollment rejects pitch before real physical execution and preserves exact actor retry',()=>{
  // These are the existing explicit synthetic calibration inputs, accepted for
  // this isolated fixture only. They never become a genuine donor baseline.
  const a=physicalPlateAppearanceActorFixture();
  try{
    const actual=a.actors.accept(a.source.sourceId),bindings=[actual.binding,...actual.defenderBindings];
    for(const binding of bindings)if(!readActualRoleWorkloadState(a.f.db,binding.careerId,binding.playerId)){
      const baseline={...a.f.baseline,sourceId:'fixture-baseline-'+binding.playerId,playerId:binding.playerId,personLinkSourceId:binding.personLinkSourceId};
      a.f.track(openSqlitePlayerWorkloadRecoveryStore(a.f.path,a.f.links,{readAcceptedBaseline:()=>baseline,readAcceptedActivity:()=>null})).initialize(baseline.sourceId);
    }
    const source:AcceptedSamePlateAppearanceEnrollment={sourceId:'native-initial-enrollment',sourceVersion:'fixture-v1',capability:'reserved_same_pa_enrollment_v1',
      actorReference:{owner:'physical_plate_appearance_actors',sourceId:a.source.sourceId,sourceHash:actor.actorHash(actual.source),snapshotHash:actor.actorHash(actual)},firstPhysicalPitchSourceId:'pitch-0',executionBasis:'reserved_cumulative_actual_role_total_v1',
      participantBaselineReferences:bindings.map(b=>({playerId:b.playerId,baselineSourceId:String(a.f.db.prepare('SELECT source_id FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(b.careerId,b.playerId)!.source_id),revision:0,stateHash:actor.actorHash(readActualRoleWorkloadState(a.f.db,b.careerId,b.playerId))}))};
    const owner=a.f.track(open(a.f.path,{readAcceptedEnrollment:()=>source}));expect(owner.accept(source.sourceId).kind).toBe('reserved');
    const execute=vi.spyOn(physicalOwner,'executePhysicalPitchAction');a.actions.set('pitch-0',continuousPitchAction(a.f,0,0));
    expect(()=>a.pitches.accept('pitch-0',0)).toThrow(/same-PA reservation/);expect(execute).not.toHaveBeenCalled();
    expect(count(a.f.db,'physical_pitch_progress_actions')).toBe(0);expect(a.actors.accept(a.source.sourceId)).toEqual(actual);
    a.accepted.set('batter-alias',{...a.source,sourceId:'batter-alias'});expect(()=>a.actors.accept('batter-alias')).toThrow(/same-PA reservation/);
    const runtime=a.f.track(openSqliteActualLivePlayRuntimeStore(a.f.path,{readAcceptedRuntime:()=>({sourceId:'v1-runtime',sourceVersion:'fixture-v1',capability:'causal_original_live_play_runtime_v1',physicalPitchSourceId:'pitch-0'})}));
    expect(()=>runtime.accept('v1-runtime')).toThrow(/same-PA reservation/);expect(count(a.f.db,'actual_live_play_runtimes')).toBe(0);
  }finally{a.f.close();}
});

import { createHash } from 'node:crypto';
it.each(['official-physical-pitch-workload','actual-total-play-workload'] as const)('SP-G02 surviving canonical %s archive prevents enrollment after producer loss',prefix=>{
  const f=enrollmentFixture();fixtures.push(f);const sourceEventId=prefix+':'+createHash('sha256').update(JSON.stringify(['career-a','game',1,'away-2'])).digest('hex');
  f.activities.set(sourceEventId,{sourceEventId,sourceVersion:prefix+'-v1',evidenceId:'original-evidence',careerId:'career-a',playerId:'away-2',atDay:2,kind:'MATCH',effortUnits:1});
  const state=f.workload.apply(sourceEventId,0),source={...f.source,participantBaselineReferences:f.source.participantBaselineReferences.map(p=>p.playerId==='away-2'?{...p,revision:state.revision,stateHash:actor.actorHash(state)}:p)};
  const owner=open(f.path,{readAcceptedEnrollment:()=>source});owners.push(owner);expect(()=>owner.accept(source.sourceId)).toThrow(/charge already exists/);
  expect(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='same_pa_enrollments'").get()).toBeUndefined();
});

import { samePaSchema } from './SamePlateAppearanceReservationGuard';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';
it.each(['fresh','retry'] as const)('SP-G02 real legacy producer %s respects a surviving career/player reservation claim',mode=>{
  const f=officialPitchWorkloadFixture();
  try{
    const policy={sourceId:'pitch-effort-policy',sourceVersion:'fixture-v1',policyId:'fixture-effort',version:'v1',availableAtDay:1,effortUnitsPerPhysicalPitch:2};
    const request={scoringApplicationId:'scoring-2',activationApplicationId:'application-1',policySourceId:policy.sourceId};
    const producer=f.track(openSqliteOfficialPitchWorkloadStore(f.path,{scoring:f.scoring,participation:f.participation},{readAcceptedPolicy:()=>policy}));
    const prior=mode==='retry'?producer.accept(request):null;
    for(const sql of Object.values(samePaSchema))f.db.exec(sql);
    // A surviving member after root loss is still exclusion, never freedom.
    f.db.prepare('INSERT INTO same_pa_participant_reservations VALUES(?,?,?,?,?,?,?)').run('other-pa','career-a','p2','original',0,'a'.repeat(64),actor.actorJson({enrollmentSourceId:'other-pa',careerId:'career-a',playerId:'p2'}));
    if(prior)expect(producer.accept(request)).toEqual(prior);
    else expect(()=>producer.accept(request)).toThrow(/same-PA reservation/);
    expect(count(f.db,'official_pitch_workload_sources')).toBe(prior?1:0);
  }finally{f.close();}
});

it.each(['state','actor','baseline'] as const)('SP-G01 surviving %s authority cannot be hidden by moved career mirrors and a deleted member',authority=>{
  const f=setup(),row=f.db.prepare('SELECT * FROM same_pa_enrollments').get()!,snapshot=JSON.parse(String(row.snapshot_json));
  f.db.prepare("DELETE FROM same_pa_participant_reservations WHERE player_id='away-2'").run();
  snapshot.careerId='moved';for(const p of snapshot.participants){p.binding.careerId='moved';if(authority!=='state')p.state.careerId='moved';}
  if(authority==='baseline'){
    snapshot.source.actorReference.sourceId='moved';
    // The untouched accepted Source still contains exact baseline references.
    f.db.prepare("UPDATE physical_plate_appearance_actors SET source_id='moved',source_json='{}',snapshot_json='{}'").run();
  }
  f.db.prepare("UPDATE same_pa_enrollments SET career_id='moved',snapshot_json=?,snapshot_hash=?").run(actor.actorJson(snapshot),actor.actorHash(snapshot));
  const sourceBefore=f.db.prepare('SELECT source_json FROM same_pa_enrollments').get()!.source_json;
  f.activities.set('fresh',{sourceEventId:'fresh',sourceVersion:'fixture-v1',evidenceId:'actual',careerId:'career-a',playerId:'away-2',atDay:2,kind:'TRAVEL',distanceKm:1});
  expect(()=>f.workload.apply('fresh',0)).toThrow(/same-PA reservation/);expect(count(f.db,'world_player_workload_activities')).toBe(0);
  expect(f.db.prepare('SELECT source_json FROM same_pa_enrollments').get()!.source_json).toBe(sourceBefore);
});

it('SP-G01 null cached root identity cannot hide its immutable participant claim',()=>{
  const f=setup();f.db.exec("UPDATE same_pa_enrollments SET source_id=NULL; DELETE FROM same_pa_participant_reservations WHERE player_id='away-2'");
  f.activities.set('fresh',{sourceEventId:'fresh',sourceVersion:'fixture-v1',evidenceId:'actual',careerId:'career-a',playerId:'away-2',atDay:2,kind:'TRAVEL',distanceKm:1});
  expect(()=>f.workload.apply('fresh',0)).toThrow(/same-PA reservation/);expect(count(f.db,'world_player_workload_activities')).toBe(0);
});
it('SP-G04 an orphan slot with null cached root keeps its raw scope blocked and its missing root corrupt',()=>{
  const f=setup();f.db.exec('DELETE FROM same_pa_enrollments; DELETE FROM same_pa_participant_reservations; UPDATE same_pa_successor_rights SET enrollment_source_id=NULL');
  expect(()=>beginReservedProbe(f)).toThrow(/same-PA reservation/);
  const reader=open(f.path);owners.push(reader);expect(()=>reader.read(f.source.sourceId)).toThrow(/same-PA reservation/);
});
import { assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
const beginReservedProbe=(f:ReturnType<typeof enrollmentFixture>)=>assertNoSamePaWorkReservation(f.db,{gameId:'game',playId:1,physicalPitchSourceId:'first-pitch'});
