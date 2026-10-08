import { afterEach, expect, it, vi } from 'vitest';
import { enrollmentFixture, native, count } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore as openEnrollment } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqlitePlayerWorkloadRecoveryStore, playerWorkloadRecoveryStoreFromSqlite } from './SqlitePlayerWorkloadRecoveryStore';
import { assertNoSamePaOriginalPitchReservation, assertNoSamePaPlayerReservation, assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Exact reviewed storage contract; no owner acceptance or genuine fixture is
// simulated by these synthetic guard rows. Only the actor boundary is mocked.
const schemas = {
  reserved_pa_work_prefixes: 'CREATE TABLE reserved_pa_work_prefixes(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL,physical_revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(enrollment_source_id,physical_revision))',
  reserved_pa_total_assessments: 'CREATE TABLE reserved_pa_total_assessments(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL,prefix_source_id TEXT NOT NULL,player_id TEXT NOT NULL,baseline_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(enrollment_source_id,prefix_source_id,player_id))',
  reserved_pa_execution_views: 'CREATE TABLE reserved_pa_execution_views(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,actor_source_id TEXT NOT NULL,first_pitch_source_id TEXT NOT NULL,prefix_source_id TEXT NOT NULL,assessment_set_hash TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(enrollment_source_id,prefix_source_id,assessment_set_hash))',
} as const;
type Table = keyof typeof schemas;
const tables = Object.keys(schemas) as Table[];
const fixtures: ReturnType<typeof enrollmentFixture>[] = [], owners: { close(): void }[] = [];
afterEach(() => { owners.splice(0).reverse().forEach(o => o.close()); fixtures.splice(0).reverse().forEach(f => f.close()); vi.restoreAllMocks(); });
const setup = () => {
  const f = enrollmentFixture(); fixtures.push(f);
  const owner = openEnrollment(f.path, { readAcceptedEnrollment: () => f.source }); owners.push(owner);
  const result = owner.accept(f.source.sourceId); if (result.kind !== 'reserved') throw new Error('fixture reservation missing');
  const reference = (table: string, source: unknown, snapshot: unknown) => ({ owner: table, sourceId: (source as {sourceId:string}).sourceId, sourceHash: hash(source), snapshotHash: hash(snapshot) });
  const enrollmentReference = reference('same_pa_enrollments', f.source, result);
  const participantReferences = result.participants.map(p => ({ playerId: p.binding.playerId, bindingHash: hash(p.binding), personHash: p.personHash, baselineSourceId: p.baselineSourceId, revision: p.state.revision, stateHash: hash(p.state) }));
  const lineage = { enrollmentReference, actorReference: f.source.actorReference, careerId: result.careerId, gameId: result.gameId, playId: result.playId, firstPhysicalPitchSourceId: f.source.firstPhysicalPitchSourceId, participantReferences };
  const source = { sourceId: 'prefix', sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_empty_prefix_v1', enrollmentReference };
  const prefix = { source, lineage, kind: 'empty_prefix', physicalRevision: 0, endpoint: null, episodes: [], resumes: [], participantWork: participantReferences.map(p => ({playerId:p.playerId,work:[]})), coverageHash: hash([]), timeline: {} };
  const prefixReference = reference('reserved_pa_work_prefixes', source, prefix);
  const totals = participantReferences.map(participantReference => {
    const source = { sourceId: 'total:' + participantReference.playerId, sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_cumulative_total_v1', enrollmentReference, prefixReference, participantReference, effortUnits: 0,
      provenance: { assessmentVersion: 'fixture-only-zero-total-v1', calibrationSourceId: 'fixture-only-zero', calibrationVersion: 'fixture-only-zero-total-v1', assessmentSourceId: 'assessment:' + participantReference.playerId } };
    return { source, lineage, kind: 'cumulative_total', effortUnits: 0 };
  });
  const participantTotalReferences = totals.map(total => ({playerId:total.source.participantReference.playerId,assessmentReference:reference('reserved_pa_total_assessments',total.source,total)}));
  const viewSource = { sourceId:'view',sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference,prefixReference,participantTotalReferences };
  const view = { source:viewSource,lineage,kind:'basis_prepared' };
  const insert = (table:Table, snapshot: typeof prefix | typeof totals[number] | typeof view) => {
    const s = snapshot.source, common = [s.sourceId, f.source.sourceId, result.careerId,result.gameId,result.playId,f.source.actorReference.sourceId,f.source.firstPhysicalPitchSourceId];
    const extra = table === tables[0] ? [0] : table === tables[1] ? ['prefix',(s as typeof totals[number]['source']).participantReference.playerId,(s as typeof totals[number]['source']).participantReference.baselineSourceId] : ['prefix',hash(participantTotalReferences)];
    const values = [...common,...extra,json(s),hash(s),json(snapshot),hash(snapshot)];
    f.db.prepare(`INSERT INTO ${table} VALUES(${values.map(()=>'?').join(',')})`).run(...values);
  };
  const install = (kind: 'prefix'|'total'|'view'|'full' = 'full') => {
    Object.values(schemas).forEach(sql=>f.db.exec(sql));
    if(kind==='prefix'||kind==='full')insert(tables[0],prefix);
    if(kind==='total'||kind==='full')for(const total of kind==='total'?[totals[0]]:totals)insert(tables[1],total);
    if(kind==='view'||kind==='full')insert(tables[2],view);
  };
  return {...f,owner,result,install,insert,prefix,totals,view,lineage};
};
const dropEnrollment = (f:ReturnType<typeof setup>) => f.db.exec('DROP TABLE same_pa_successor_rights; DROP TABLE same_pa_participant_reservations; DROP TABLE same_pa_enrollments');
const scope = {gameId:'game',playId:1,physicalPitchSourceId:'first-pitch'};
const player = {careerId:'career-a',playerId:'away-2'};
for(const kind of ['prefix','total','view'] as const) for(const route of ['open','connected'] as const) it(`EV08 ${kind} survives absent original namespace through ${route} workload writer`,()=>{
  const f=setup();f.install(kind);dropEnrollment(f);
  f.activities.set('fresh',{sourceEventId:'fresh',sourceVersion:'fixture-v1',evidenceId:'accepted',...player,atDay:2,kind:'MATCH',effortUnits:1});
  const writer=route==='open'?openSqlitePlayerWorkloadRecoveryStore(f.path,f.personLinks,f.authority):playerWorkloadRecoveryStoreFromSqlite(native(f.path),f.personLinks,f.authority);owners.push(writer);
  const before=f.db.prepare('SELECT * FROM sqlite_master').all();
  expect(()=>writer.apply('fresh',0)).toThrow(/same-PA.*(claim|reservation)/);
  expect(()=>assertNoSamePaWorkReservation(f.db,scope)).toThrow(/same-PA.*(claim|reservation)/);
  expect(()=>assertNoSamePaOriginalPitchReservation(f.db,'first-pitch')).toThrow(/same-PA.*(claim|reservation)/);
  expect(count(f.db,'world_player_workload_activities')).toBe(0);expect(writer.readHead('career-a','away-2')!.revision).toBe(0);
  expect(f.db.prepare('SELECT * FROM sqlite_master').all()).toEqual(before);
});
it('EV08 surviving prefix blocks fresh initialization before missing original namespace return',()=>{
  const f=setup();f.install('prefix');dropEnrollment(f);
  f.db.exec("DELETE FROM world_player_workload_heads WHERE player_id='away-2'; DELETE FROM world_player_workload_baselines WHERE player_id='away-2'");
  expect(()=>f.workload.initialize('baseline-away-2')).toThrow(/same-PA.*(claim|reservation)/);
  expect(f.workload.readHead('career-a','away-2')).toBeNull();
});
for(const fault of ['root','member','root-index','actor-index','baseline-index','prefix-index','null-index','duplicate-source','escaped-source','null-lineage'] as const) it(`EV08 ${fault} corruption rejects even disjoint causal scope without repairing storage`,()=>{
  const f=setup();f.install();
  if(fault==='root')f.db.exec('DELETE FROM same_pa_enrollments');
  if(fault==='member')f.db.exec("DELETE FROM same_pa_participant_reservations WHERE player_id='away-2'");
  if(fault==='root-index')f.db.exec("UPDATE same_pa_enrollments SET source_id='moved'");
  if(fault==='actor-index')f.db.exec("UPDATE physical_plate_appearance_actors SET source_id='moved',game_id='moved',play_id=99,player_id='moved'");
  if(fault==='baseline-index')f.db.exec("UPDATE world_player_workload_baselines SET source_id='moved',career_id='moved',player_id='moved' WHERE player_id='away-2'");
  if(fault==='prefix-index')f.db.exec("UPDATE reserved_pa_work_prefixes SET source_id='moved',enrollment_source_id='moved',career_id='moved',game_id='moved',play_id=99,actor_source_id='moved',first_pitch_source_id='moved'");
  if(fault==='null-index')f.db.exec('UPDATE reserved_pa_work_prefixes SET source_id=NULL');
  if(fault==='duplicate-source'||fault==='escaped-source'){
    const key=fault==='escaped-source'?'sourc\\u0065Id':'sourceId';
    f.db.prepare('UPDATE reserved_pa_work_prefixes SET source_json=?').run('{"'+key+'":"hidden",'+json(f.prefix.source).slice(1));
  }
  if(fault==='null-lineage')f.db.prepare('UPDATE reserved_pa_work_prefixes SET snapshot_json=?,snapshot_hash=?').run(json({...f.prefix,lineage:null}),hash({...f.prefix,lineage:null}));
  const before=f.db.prepare('SELECT * FROM reserved_pa_work_prefixes').all();
  expect(()=>assertNoSamePaWorkReservation(f.db,{gameId:'disjoint',playId:99})).toThrow(/same-PA.*(claim|reservation)/);
  expect(()=>assertNoSamePaPlayerReservation(f.db,player,f.source.sourceId)).toThrow(/same-PA.*(claim|reservation)/);
  expect(f.db.prepare('SELECT * FROM reserved_pa_work_prefixes').all()).toEqual(before);
});
for(const orphan of ['total','view'] as const)it(`EV08 orphan ${orphan} cannot borrow an own-enrollment dependency exemption`,()=>{
  const f=setup();f.install(orphan);
  expect(()=>assertNoSamePaWorkReservation(f.db,scope,f.source.sourceId)).toThrow(/same-PA.*(claim|reservation)/);
});
for(const fault of ['partial','view','case','temp','trigger'] as const)it(`EV08 ${fault} reserved namespace fails before absent original namespace return`,()=>{
  const f=setup();dropEnrollment(f);
  if(fault==='partial')f.db.exec(schemas.reserved_pa_work_prefixes);
  if(fault==='view')f.db.exec('CREATE VIEW reserved_pa_work_prefixes AS SELECT 1 AS source_id');
  if(fault==='case')f.db.exec(schemas.reserved_pa_work_prefixes.replaceAll('reserved_pa_work_prefixes','RESERVED_PA_WORK_PREFIXES'));
  if(fault==='temp')f.db.exec('CREATE TEMP TABLE reserved_pa_work_prefixes(source_id TEXT)');
  if(fault==='trigger'){Object.values(schemas).forEach(sql=>f.db.exec(sql));f.db.exec('CREATE TRIGGER hidden AFTER INSERT ON reserved_pa_work_prefixes BEGIN SELECT 1; END');}
  const before=f.db.prepare('SELECT * FROM sqlite_master').all();
  expect(()=>assertNoSamePaWorkReservation(f.db,scope)).toThrow(/same-PA.*(claim|reservation)/);
  expect(()=>assertNoSamePaPlayerReservation(f.db,player)).toThrow(/same-PA.*(claim|reservation)/);
  expect(f.db.prepare('SELECT * FROM sqlite_master').all()).toEqual(before);
});
it('EV09 valid provisional graph grants exact dependency reads while fresh writers remain blocked',()=>{
  const f=setup();f.install();
  expect(()=>assertNoSamePaWorkReservation(f.db,scope,f.source.sourceId)).not.toThrow();
  expect(()=>assertNoSamePaPlayerReservation(f.db,player,f.source.sourceId)).not.toThrow();
  expect(f.owner.read(f.source.sourceId)).toEqual(f.result);
  expect(()=>assertNoSamePaWorkReservation(f.db,scope)).toThrow(/same-PA/);
  expect(()=>assertNoSamePaPlayerReservation(f.db,player)).toThrow(/same-PA/);
  expect(count(f.db,'world_player_workload_activities')).toBe(0);
});
it('EV09 valid disjoint causal work never joins through a shared Player or untyped string',()=>{
  const f=setup();f.install();
  expect(()=>assertNoSamePaWorkReservation(f.db,{gameId:'game',playId:2,physicalPitchSourceId:'away-2'})).not.toThrow();
  expect(()=>assertNoSamePaWorkReservation(f.db,{gameId:'other',playId:1,physicalPitchSourceId:'total:away-2'})).not.toThrow();
  expect(()=>assertNoSamePaPlayerReservation(f.db,{careerId:'other',playerId:'away-2'})).not.toThrow();
  expect(()=>assertNoSamePaPlayerReservation(f.db,player)).toThrow(/same-PA/);
});
it('EV09 all-absent provisional namespace stays pristine on both read guards',()=>{
  const f=setup();dropEnrollment(f);const before=f.db.prepare('SELECT * FROM sqlite_master').all();
  expect(()=>assertNoSamePaWorkReservation(f.db,scope)).not.toThrow();expect(()=>assertNoSamePaPlayerReservation(f.db,player)).not.toThrow();
  expect(f.db.prepare('SELECT * FROM sqlite_master').all()).toEqual(before);
});

import { assertReservedPaClaims } from './SamePlateAppearanceProvisionalClaimGuard';
for(const fault of ['effort','provenance'] as const)it(`EV08 malformed TOTAL ${fault} cannot borrow an exact dependency read exemption`,()=>{
  const f=setup();f.install('prefix');f.insert(tables[1],f.totals[0]);
  const total=f.totals[0],source={...total.source,...(fault==='effort'?{effortUnits:1}:{provenance:null})};
  const snapshot={...total,source,...(fault==='effort'?{effortUnits:1}:{})};
  f.db.prepare('UPDATE reserved_pa_total_assessments SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?').run(json(source),hash(source),json(snapshot),hash(snapshot));
  expect(()=>assertReservedPaClaims(f.db)).toThrow(/same-PA provisional claim/);
  expect(()=>assertNoSamePaWorkReservation(f.db,scope,f.source.sourceId)).toThrow(/same-PA provisional claim/);
});
for(const table of ['reserved_pa_work_prefixes','reserved_pa_execution_views'] as const)it(`EV09 ${table} moved-index alias preserves its original raw owner claim`,()=>{
  const f=setup();f.install();
  f.db.exec(`UPDATE ${table} SET source_id='moved',enrollment_source_id='moved'`);
  const before=f.db.prepare(`SELECT * FROM ${table}`).all();
  expect(()=>assertReservedPaClaims(f.db)).toThrow(/same-PA provisional claim/);
  expect(()=>assertNoSamePaWorkReservation(f.db,scope,f.source.sourceId)).toThrow(/same-PA provisional claim/);
  expect(f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
});
