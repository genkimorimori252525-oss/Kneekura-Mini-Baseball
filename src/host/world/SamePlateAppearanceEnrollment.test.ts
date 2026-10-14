import { afterEach, expect, it, vi } from 'vitest';
import { deriveSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollmentFromSqlite';
import { enrollmentFixture } from './SamePlateAppearanceEnrollment.test-support';
const fixtures: ReturnType<typeof enrollmentFixture>[]=[];
afterEach(()=>{owners.splice(0).reverse().forEach(o=>o.close());fixtures.splice(0).reverse().forEach(f=>f.close());vi.restoreAllMocks();});
it('SP-E01 small Native workload prerequisites reach the reservation owner (actor mocked)',()=>{
  const f=enrollmentFixture();fixtures.push(f);
  expect(deriveSamePlateAppearanceEnrollment(f.db,f.source).kind).toBe('reserved');
});

import { openSqliteSamePlateAppearanceEnrollmentStore as open } from './SqliteSamePlateAppearanceEnrollmentStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { count, native } from './SamePlateAppearanceEnrollment.test-support';
import { assertNoSamePaPlayerReservation, assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
const owners:{close():void}[]=[];
const setup=()=>{const f=enrollmentFixture();fixtures.push(f);const owner=open(f.path,{readAcceptedEnrollment:()=>f.source});owners.push(owner);return {...f,owner};};
const pristine=(db:ReturnType<typeof native>)=>expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'same_pa_%'").all()).toEqual([]);
it('SP-E01 acceptance atomically freezes ten baselines and one blocked slot without physical or workload writes',()=>{
  const f=setup(),before=f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY player_id').all();
  const saved=f.owner.accept(f.source.sourceId);expect(saved.kind).toBe('reserved');
  expect(count(f.db,'same_pa_enrollments')).toBe(1);expect(count(f.db,'same_pa_participant_reservations')).toBe(10);expect(count(f.db,'same_pa_successor_rights')).toBe(1);
  expect(count(f.db,'physical_pitch_progress_actions')).toBe(0);expect(count(f.db,'world_player_workload_activities')).toBe(0);
  expect(f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY player_id').all()).toEqual(before);
  expect(f.db.prepare('SELECT state,predecessor_resume_source_id,consuming_source_id FROM same_pa_successor_rights').get()).toEqual({state:'blocked_execution_basis',predecessor_resume_source_id:null,consuming_source_id:null});
});
it('SP-E02 absent actual new batter baseline is pending and never substitutes the prior batter',()=>{
  const f=setup();f.db.prepare('DELETE FROM world_player_workload_baselines WHERE player_id=?').run('away-2');f.db.prepare('DELETE FROM world_player_workload_heads WHERE player_id=?').run('away-2');
  expect(f.owner.accept(f.source.sourceId)).toEqual({kind:'pending',missingBaselinePlayerIds:['away-2']});pristine(f.db);
});
it.each(['orphan','malformed'] as const)('SP-E02 %s baseline history rejects rather than becoming pending',fault=>{
  const f=setup();if(fault==='orphan')f.db.prepare('DELETE FROM world_player_workload_baselines WHERE player_id=?').run('away-2');
  else f.db.prepare("UPDATE world_player_workload_baselines SET source_json='{}' WHERE player_id='away-2'").run();
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow();pristine(f.db);
});
it.each(['actor','actor_hash','world','membership','revision','state_hash'] as const)('SP-E03 %s mismatch rejects with no reservation namespace',fault=>{
  const f=setup(),s=structuredClone(f.source) as any;
  if(fault==='actor')s.actorReference.sourceId='foreign';if(fault==='actor_hash')s.actorReference.snapshotHash='f'.repeat(64);
  if(fault==='world'){(f.actor.world as any).tick=900;f.persistActor();}
  if(fault==='membership')s.participantBaselineReferences[0].playerId='prior-batter';
  if(fault==='revision')s.participantBaselineReferences[0].revision++;if(fault==='state_hash')s.participantBaselineReferences[0].stateHash='f'.repeat(64);
  const owner=open(f.path,{readAcceptedEnrollment:()=>s});owners.push(owner);expect(()=>owner.accept(s.sourceId)).toThrow();pristine(f.db);
});
it.each(['indexed','hidden','head'] as const)('SP-E04 prior unreserved pitch %s claim rejects',fault=>{
  const f=setup(),source={sourceId:f.source.firstPhysicalPitchSourceId,gameId:f.actor.source.gameId},snapshot={source,frame:{gameId:f.actor.source.gameId,match:{playId:1}}};
  if(fault==='head')f.db.prepare('INSERT INTO physical_pitch_progress_heads VALUES(?,?,?,?)').run('game',1,1,'different-pitch');
  else f.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?,?,?,?)').run(fault==='hidden'?'moved':source.sourceId,fault==='hidden'?'other':'game',fault==='hidden'?8:1,1,json(source),hash(source),json(snapshot),hash(snapshot));
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow(/before|work|pitch/i);pristine(f.db);
});
it('SP-E05 exact retry and authority-free reopen reproduce the archive; aliases reject',()=>{
  const f=setup(),saved=f.owner.accept(f.source.sourceId),before=f.db.prepare('SELECT total_changes() AS n').get();
  expect(f.owner.accept(f.source.sourceId)).toEqual(saved);f.owner.close();
  const reopened=open(f.path);owners.push(reopened);expect(reopened.read(f.source.sourceId)).toEqual(saved);expect(reopened.accept(f.source.sourceId)).toEqual(saved);
  expect(f.db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
  const alias=open(f.path,{readAcceptedEnrollment:()=>({...f.source,sourceId:'alias'})});owners.push(alias);expect(()=>alias.accept('alias')).toThrow();
  const changed=open(f.path,{readAcceptedEnrollment:()=>({...f.source,sourceVersion:'changed'})});owners.push(changed);expect(()=>changed.accept(f.source.sourceId)).toThrow(/frozen/);
});
it.each(['delete','move'] as const)('SP-E06 %s member cannot unlock a root participant; disjoint scopes remain unreserved',fault=>{
  const f=setup();f.owner.accept(f.source.sourceId);expect(()=>assertNoSamePaPlayerReservation(f.db,{careerId:'career-a',playerId:'unrelated'})).not.toThrow();
  if(fault==='delete')f.db.prepare("DELETE FROM same_pa_participant_reservations WHERE player_id='away-2'").run();
  else f.db.prepare("UPDATE same_pa_participant_reservations SET player_id='moved',enrollment_source_id='moved' WHERE player_id='away-2'").run();
  expect(()=>assertNoSamePaPlayerReservation(f.db,{careerId:'career-a',playerId:'away-2'})).toThrow();
});
it.each(['partial','view','case_alias','temp_shadow','trigger'] as const)('SP namespace %s is rejected without installation or repair',fault=>{
  const f=setup();
  if(fault==='partial')f.db.exec('CREATE TABLE same_pa_enrollments(source_id TEXT)');
  if(fault==='view')f.db.exec("CREATE VIEW same_pa_enrollments AS SELECT 'x' AS source_id");
  if(fault==='case_alias')f.db.exec('CREATE TABLE SAME_PA_ENROLLMENTS(source_id TEXT)');
  if(fault==='temp_shadow')f.db.exec('CREATE TEMP TABLE same_pa_enrollments(source_id TEXT)');
  if(fault==='trigger')f.db.exec('CREATE TRIGGER same_pa_enrollments AFTER INSERT ON physical_pitch_progress_actions BEGIN SELECT 1; END');
  const before=f.db.prepare('SELECT * FROM sqlite_master').all();
  if(fault==='temp_shadow')expect(()=>deriveSamePlateAppearanceEnrollment(f.db,f.source)).toThrow();
  else expect(()=>f.owner.accept(f.source.sourceId)).toThrow();expect(f.db.prepare('SELECT * FROM sqlite_master').all()).toEqual(before);
});
it.each(['ready','consumer','resume'] as const)('SP-G04 fabricated first slot %s never admits physical work',fault=>{
  const f=setup();f.owner.accept(f.source.sourceId);
  f.db.exec(fault==='ready'?"UPDATE same_pa_successor_rights SET state='ready'":fault==='consumer'?"UPDATE same_pa_successor_rights SET consuming_source_id='alias'":"UPDATE same_pa_successor_rights SET predecessor_resume_source_id='fake'");
  expect(()=>assertNoSamePaWorkReservation(f.db,{gameId:'game',playId:1})).toThrow();expect(()=>f.owner.read(f.source.sourceId)).toThrow();
});

import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
it('SP-E06 second PA sharing participants rejects atomically and a disjoint second PA reserves independently',()=>{
  const f=setup();f.owner.accept(f.source.sourceId);
  const shared=structuredClone(f.actor) as any;shared.source={...shared.source,sourceId:'actor-other',gameId:'other-game'};
  shared.binding={...shared.binding,gameId:'other-game'};shared.defenderBindings=shared.defenderBindings.map((b:any)=>({...b,gameId:'other-game'}));
  const d=enrollmentFixture('-disjoint');fixtures.push(d);
  f.db.prepare('ATTACH DATABASE ? AS other_fixture').run(d.path);
  for(const table of ['world_player_person_links','world_player_workload_baselines','world_player_workload_heads','physical_plate_appearance_actors'])f.db.exec(`INSERT INTO main.${table} SELECT * FROM other_fixture.${table}`);
  f.db.exec('DETACH DATABASE other_fixture');
  f.db.prepare('INSERT INTO physical_plate_appearance_actors VALUES(?,?,?,?,?,?,?,?,?)').run(shared.source.sourceId,shared.source.sourceVersion,shared.source.gameId,shared.match.playId,shared.source.playerId,json(shared.source),hash(shared.source),json(shared),hash(shared));
  vi.spyOn(actorOwner,'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((_db,id)=>[f.actor,shared,d.actor].find(a=>a.source.sourceId===id)??null);
  const s={...f.source,sourceId:'other-enrollment',actorReference:{...f.source.actorReference,sourceId:shared.source.sourceId,sourceHash:hash(shared.source),snapshotHash:hash(shared)},firstPhysicalPitchSourceId:'other-pitch'};
  const rejected=open(f.path,{readAcceptedEnrollment:()=>s});owners.push(rejected);expect(()=>rejected.accept(s.sourceId)).toThrow(/reservation/);expect(count(f.db,'same_pa_enrollments')).toBe(1);
  const separate=open(f.path,{readAcceptedEnrollment:()=>d.source});owners.push(separate);expect(separate.accept(d.source.sourceId).kind).toBe('reserved');expect(count(f.db,'same_pa_enrollments')).toBe(2);expect(count(f.db,'same_pa_participant_reservations')).toBe(20);
});

import { inspectQualifiedSamePaActorCopy } from './SamePlateAppearanceEnrollment.test-support';
import { writeFileSync,mkdtempSync } from 'node:fs';
import { join } from 'node:path';
it.runIf(!!process.env.SAME_PA_QUALIFIED_ACTOR_INPUT)('SP-E00 genuine qualified actor checkpoint authenticates actual baseline inventory without enrollment',()=>{
  const directory=mkdtempSync(join(process.env.SAME_PA_GENUINE_OUTPUT_DIRECTORY!,'same-pa-prerequisites-'));
  const receipt=inspectQualifiedSamePaActorCopy({manifestPath:process.env.SAME_PA_QUALIFIED_ACTOR_INPUT!,manifestSha256:process.env.SAME_PA_QUALIFIED_ACTOR_INPUT_SHA256!,destinationPath:join(directory,'actor-copy.sqlite')});
  writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2));expect(receipt.kind).toBe('authenticated_actor_prerequisites');expect(receipt.reservationAttempted).toBe(false);
});

it('SP-E05 immutable enrollment retains the original accepted baseline provenance as well as state',()=>{
  const f=setup();f.owner.accept(f.source.sourceId);
  const row=f.db.prepare("SELECT source_json FROM world_player_workload_baselines WHERE player_id='away-2'").get()!;
  const source=JSON.parse(String(row.source_json));source.sourceVersion='changed-provenance';
  f.db.prepare("UPDATE world_player_workload_baselines SET source_json=? WHERE player_id='away-2'").run(json(source));
  expect(()=>f.owner.read(f.source.sourceId)).toThrow(/same-PA/);
});

it.each(['actor_snapshot','initial_reference'] as const)('SP-E04 different old pitch ID retains original PA through %s after copied scope moves',proof=>{
  const f=setup(),source={sourceId:'old-different-pitch',gameId:'game',...(proof==='initial_reference'?{initialWorldSourceId:'initial'}:{})},
    snapshot={source,frame:{gameId:'moved',match:{playId:99},...(proof==='actor_snapshot'?{batterActor:f.actor}:{})}};
  f.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?,?,?,?)').run(source.sourceId,'moved',99,1,json(source),hash(source),json(snapshot),hash(snapshot));
  expect(()=>f.owner.accept(f.source.sourceId)).toThrow(/before|work|pitch/i);pristine(f.db);
});
