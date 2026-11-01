import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import * as rosters from '../src/host/world/SqliteNationalRosterSnapshotStore';
import { openSqliteManagerRosterDecisionStore } from '../src/host/world/SqliteManagerRosterDecisionStore';
import { createWorldBoundOriginalContactsV190 } from '../src/host/world/WorldBoundOriginalContactsV190.test-support';
import { collectNativeContactReportObservationsV192 } from './native-contact-report-runtime-v192';
import * as distribution from './native-contact-distribution-v262';
import * as inventories from '../src/host/world/NativeBattingContactInventoryV188';
import { readNativeContactDistributionBatchV263FromSqlite as read } from './native-contact-distribution-batch-v263';
const {DatabaseSync:Sqlite}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const opened:DatabaseSync[]=[];afterEach(()=>{vi.restoreAllMocks();for(const db of opened.splice(0))db.close()});
const db=()=>{const v=new Sqlite(':memory:');opened.push(v);return v}, request={careerId:'career-a',rosterSnapshotId:'snapshot-a'};
const roster=(ids:string[])=>({snapshotId:'snapshot-a',careerId:'career-a',revision:3,effectiveDay:11,roster:{players:ids.map(playerId=>({playerId}))}} as unknown as rosters.AcceptedNationalRosterSnapshot);
function setup(ids=['p1','p2']){
 const d=db();d.exec('CREATE TABLE world_national_roster_snapshots(id TEXT); CREATE TABLE world_player_person_links(career_id TEXT,player_id TEXT,source_id TEXT)');
 const snap=vi.spyOn(rosters,'readGlobalRosterSnapshotFromSqlite').mockImplementation(conn=>{expect((conn as DatabaseSync).isTransaction).toBe(true);expect(conn.prepare('PRAGMA query_only').get()!.query_only).toBe(1);return roster(ids)});
 vi.spyOn(inventories,'readNativeBattingContactInventoryV188FromSqlite').mockImplementation((conn,scope)=>{expect(conn).toBe(d);expect(conn.isTransaction).toBe(true);expect(conn.prepare('PRAGMA query_only').get()!.query_only).toBe(1);return {scope,inventoryHash:'test-inventory',producerAvailability:{physical_pitch_progress_actions:'PRESENT',pa_physical_v1_resolutions:'ABSENT',pa_initial_joint_v1_executions:'PRESENT'}} as never});
 const dist=vi.spyOn(distribution,'readNativeContactDistributionV262FromSqlite').mockImplementation((conn,scope)=>{expect(conn).toBe(d);expect(conn.isTransaction).toBe(true);expect(conn.prepare('PRAGMA query_only').get()!.query_only).toBe(1);return {scope,inventoryHash:'test-inventory',status:scope.playerId==='p1'?'OBSERVED':'UNKNOWN',reasons:scope.playerId==='p1'?[]:['NO_REGISTERED_CONTACTS']} as never});
 return {d,snap,dist};
}
it('keeps one observed and one unknown row in explicit roster order on the same read snapshot',()=>{
 const {d,dist}=setup();d.prepare('INSERT INTO world_player_person_links VALUES(?,?,?)').run('career-a','p1','source-one');d.prepare('INSERT INTO world_player_person_links VALUES(?,?,?)').run('career-a','p2','source-two');const before=d.prepare('SELECT total_changes() n').get(),input=structuredClone(request),r=read(d,input);
 expect(r).toMatchObject({status:'PARTIAL',populationBoundary:'EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY',producerCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY',physicsEffects:'NONE',roster:{playerCount:2,effectiveDay:11}});expect(r.rows?.map(x=>[x.playerId,x.status])).toEqual([['p1','OBSERVED'],['p2','UNKNOWN']]);expect(r.rows?.[1].reasons).toEqual(['NO_REGISTERED_CONTACTS']);expect(r.rows?.[0].producerAvailability).toEqual({physical_pitch_progress_actions:'PRESENT',pa_physical_v1_resolutions:'ABSENT',pa_initial_joint_v1_executions:'PRESENT'});expect(r.rows?.[0].currentInventoryHash).toBe('test-inventory');expect(dist).toHaveBeenCalledTimes(2);expect(input).toEqual(request);expect(d.prepare('SELECT total_changes() n').get()).toEqual(before);expect(d.isTransaction).toBe(false);expect(d.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
});
it('limits even fully observed output to the explicit roster checkpoint',()=>{
 const {d}=setup(['p1']);d.exec("INSERT INTO world_player_person_links VALUES('career-a','p1','x')");const r=read(d,request);expect(r).toMatchObject({status:'OBSERVED_FOR_SNAPSHOT_ROSTER',populationBoundary:'EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY',producerCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY'});expect(r.rows).toHaveLength(1);
});
it('does not claim missing/ambiguous subject links or stale and duplicate contacts are zero',()=>{
 const {d,dist}=setup(['missing','ambiguous','stale','duplicate']);d.exec("INSERT INTO world_player_person_links VALUES('career-a','ambiguous','x'),('career-a','ambiguous','y'),('career-a','stale','z'),('career-a','duplicate','q')");dist.mockImplementation((_db,scope)=>({scope,inventoryHash:null,status:'UNKNOWN',reasons:[scope.playerId==='stale'?'INVENTORY_CHANGED_SINCE_CAPTURE':'UNRESOLVED_CONTACT_IDENTITY']} as never));const r=read(d,request);
 expect(r.rows?.map(x=>x.reasons[0])).toEqual(['SUBJECT_LINK_MISSING','SUBJECT_LINK_AMBIGUOUS','INVENTORY_CHANGED_SINCE_CAPTURE','UNRESOLVED_CONTACT_IDENTITY']);expect(r.rows?.slice(0,2).every(x=>x.distribution===null)).toBe(true);expect(dist).toHaveBeenCalledTimes(2);
});
it('distinguishes missing namespaces, missing snapshot and empty roster',()=>{
 const a=db();expect(read(a,request)).toMatchObject({status:'UNKNOWN',reasons:['ROSTER_SNAPSHOT_NAMESPACE_ABSENT'],roster:null,rows:null});
 const {d,snap}=setup([]);snap.mockReturnValueOnce(null);expect(read(d,request)).toMatchObject({status:'UNKNOWN',reasons:['ROSTER_SNAPSHOT_NOT_FOUND'],rows:null});expect(read(d,request)).toMatchObject({status:'UNKNOWN',reasons:['EMPTY_ROSTER_SNAPSHOT'],roster:{playerCount:0},rows:[]});
 d.exec('DROP TABLE world_player_person_links');expect(read(d,request)).toMatchObject({status:'UNKNOWN',reasons:['SUBJECT_LINK_NAMESPACE_ABSENT'],rows:null});
});
it('rejects inconsistent inventory identity rather than emitting a row',()=>{
 const {d,dist}=setup(['p1']);d.exec("INSERT INTO world_player_person_links VALUES('career-a','p1','x')");dist.mockReturnValue({scope:{careerId:'career-a',playerId:'p1'},status:'OBSERVED',reasons:[],inventoryHash:'different'} as never);expect(()=>read(d,request)).toThrow(/inventory snapshot differs/);expect(d.isTransaction).toBe(false);
});
it('propagates owner errors rather than inventing an empty result',()=>{
 const {d,dist}=setup(['p1']);d.exec("INSERT INTO world_player_person_links VALUES('career-a','p1','x')");dist.mockImplementation(()=>{throw Error('corrupt owner')});expect(()=>read(d,request)).toThrow(/corrupt owner/);expect(d.isTransaction).toBe(false);
});
it('reads a real Native roster checkpoint with one captured subject and preserves unknown rows',()=>{
 const directory=mkdtempSync(join(process.cwd(),'work','line-drive-next-20261101','native-batch-v263-')),path=join(directory,'world.sqlite'),fixture=createWorldBoundOriginalContactsV190(path),rosterOwner=openSqliteManagerRosterDecisionStore(path),snapshotOwner=rosters.openSqliteNationalRosterSnapshotStore(path,{roster:rosterOwner});let checkpoint;
 try{checkpoint=snapshotOwner.capture(fixture.scope.careerId,'club-b')}finally{snapshotOwner.close();rosterOwner.close()}
 collectNativeContactReportObservationsV192(path,{scope:fixture.scope,careerCalendarEditionId:fixture.careerCalendarEditionId});const handle=new Sqlite(path);opened.push(handle);const before={changes:handle.prepare('SELECT total_changes() n').get(),schema:handle.prepare('PRAGMA schema_version').get()},r=read(handle,{careerId:fixture.scope.careerId,rosterSnapshotId:checkpoint.snapshotId});
 expect(read(handle,{careerId:'other-career',rosterSnapshotId:checkpoint.snapshotId})).toMatchObject({status:'UNKNOWN',reasons:['ROSTER_SNAPSHOT_NOT_FOUND'],rows:null});expect(r.status).toBe('PARTIAL');expect(r.roster?.playerCount).toBe(checkpoint.roster.players.length);expect(r.rows?.map(x=>x.playerId)).toEqual(checkpoint.roster.players.map(x=>x.playerId));expect(r.rows?.find(x=>x.playerId===fixture.scope.playerId)?.distribution).toMatchObject({status:'OBSERVED',totalContacts:2,physicsEffects:'NONE'});expect(r.rows?.some(x=>x.status==='UNKNOWN')).toBe(true);expect({changes:handle.prepare('SELECT total_changes() n').get(),schema:handle.prepare('PRAGMA schema_version').get()}).toEqual(before);expect(handle.isTransaction).toBe(false);expect(handle.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
});
