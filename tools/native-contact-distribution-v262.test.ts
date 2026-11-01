import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { classifyLineDriveAngleBandV262 } from '../src/core/world/traits/classifiers/LineDriveAngleBandV262';
import { createWorldBoundOriginalContactsV190 } from '../src/host/world/WorldBoundOriginalContactsV190.test-support';
import * as projection from '../src/host/world/NativeBattingContactTraitProjectionV189';
import * as observation from '../src/host/world/SqliteNativeBattingContactObservationStoreV188';
import * as auth from './native-contact-report-runtime-v192';
import { readNativeContactDistributionV262FromSqlite as read } from './native-contact-distribution-v262';
const {DatabaseSync:Sqlite}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const opened:DatabaseSync[]=[];afterEach(()=>{vi.restoreAllMocks();for(const db of opened.splice(0))db.close()});
const scope={careerId:'career-a',playerId:'away-1'}, db=()=>{const v=new Sqlite(':memory:');opened.push(v);return v};
const time={season:2032,day:7,sequence:0},source={careerId:scope.careerId,subjectId:scope.playerId,owner:'BATTING_CONTACT' as const,sourceKey:'test',revision:1,snapshotId:'test-snapshot',time};
function mock(){
 vi.spyOn(auth,'assertNativeContactReportSubjectV192FromSqlite').mockImplementation(db=>{expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);return {} as never});
 const projected=vi.spyOn(projection,'readNativeBattingContactTraitProjectionV189FromSqlite').mockReturnValue({scope,source,currentInventoryHash:'inventory',reasons:['NO_MEASUREMENT_MODEL']} as never);
 const snap=vi.spyOn(observation,'readNativeBattingContactObservationSnapshotV189FromSqlite').mockReturnValue({scope,source,captureCoverage:{inventoryHash:'inventory'},receipts:[{},{}],observations:[
  {eventId:'one',episodeId:'pa-one',time,exitVelocityMps:{x:1,y:0,z:0}},{eventId:'two',episodeId:'pa-two',time,exitVelocityMps:{x:Math.cos(Math.PI/18),y:Math.sin(Math.PI/18),z:0}}]} as never);
 return {projected,snap};
}
it('uses exactly the existing V249 boundary at 10 and 25 without a trait verdict',()=>{
 expect([9.999,10,24.999,25,25.001].map(classifyLineDriveAngleBandV262)).toEqual(['OUTSIDE','LINE_DRIVE_BAND','LINE_DRIVE_BAND','BOUNDARY_25','OUTSIDE']);
});
it('synthetic read-only adapter describes authenticated-scoped observations without a model',()=>{
 mock();const input=structuredClone(scope),d=db(),before=d.prepare('SELECT total_changes() n').get(),result=read(d,input);
 expect(result).toMatchObject({status:'OBSERVED',totalContacts:2,bandCount:1,boundary25Count:0,fraction:.5,directionStatus:'UNASSESSED',physicsEffects:'NONE',modelAuthority:'NOT_USED'});
 expect(result.contacts?.map(c=>c.label)).toEqual(['OUTSIDE','LINE_DRIVE_BAND']);expect(input).toEqual(scope);expect(d.prepare('SELECT total_changes() n').get()).toEqual(before);expect(Object.isFrozen(result)).toBe(true);
});
it.each(['NO_REGISTERED_CONTACTS','INVENTORY_NOT_CAPTURED','INVENTORY_CHANGED_SINCE_CAPTURE','UNRESOLVED_CONTACT_IDENTITY'])('keeps %s unknown without claiming zero',reason=>{
 const m=mock();m.projected.mockReturnValue({scope,source:null,currentInventoryHash:null,reasons:[reason]} as never);const r=read(db(),scope);expect(r).toMatchObject({status:'UNKNOWN',reasons:[reason],totalContacts:null,bandCount:null,fraction:null,contacts:null});expect(m.snap).not.toHaveBeenCalled();
});
it('keeps a zero-speed or inconsistent snapshot unknown',()=>{
 const m=mock(),value=m.snap.getMockImplementation()!;const d=db();m.snap.mockImplementationOnce((...args)=>{const original=value(...args)!;return {...original,observations:original.observations.map((x,i)=>i?x:{...x,exitVelocityMps:{x:0,y:0,z:0}})} as never});expect(read(d,scope)).toMatchObject({status:'UNKNOWN',reasons:['UNDEFINED_CONTACT_DIRECTION'],totalContacts:null});
 m.snap.mockReturnValueOnce(null);expect(read(d,scope)).toMatchObject({status:'UNKNOWN',reasons:['SNAPSHOT_INCONSISTENT'],totalContacts:null});
});
it('rejects an unauthenticated subject rather than returning zero',()=>{mock();vi.mocked(auth.assertNativeContactReportSubjectV192FromSqlite).mockImplementationOnce(()=>{throw Error('subject absent')});expect(()=>read(db(),scope)).toThrow(/subject absent/)});
it('reads two actual accepted Native contacts without changing their DB state',()=>{
 const directory=mkdtempSync(join(process.cwd(),'work','line-drive-next-20261101','native-v262-')),database=join(directory,'world.sqlite'),fixture=createWorldBoundOriginalContactsV190(database),handle=new Sqlite(database);opened.push(handle);
 const absent=read(handle,fixture.scope);expect(absent).toMatchObject({status:'UNKNOWN',reasons:['NO_REGISTERED_CONTACTS'],totalContacts:null});
 const collected=auth.collectNativeContactReportObservationsV192(database,{scope:fixture.scope,careerCalendarEditionId:fixture.careerCalendarEditionId});expect(collected.registeredReferenceCount).toBe(2);
 const before={changes:handle.prepare('SELECT total_changes() n').get(),schema:handle.prepare('PRAGMA schema_version').get()},r=read(handle,fixture.scope),after={changes:handle.prepare('SELECT total_changes() n').get(),schema:handle.prepare('PRAGMA schema_version').get()};
 expect(r).toMatchObject({status:'OBSERVED',totalContacts:2,bandCount:0,boundary25Count:0,fraction:0,physicsEffects:'NONE',directionStatus:'UNASSESSED'});expect(r.contacts).toHaveLength(2);expect(after).toStrictEqual(before);expect(handle.isTransaction).toBe(false);expect(handle.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
 handle.exec('BEGIN');handle.exec('PRAGMA query_only=1');let raw;try{raw=observation.readNativeBattingContactObservationSnapshotV189FromSqlite(handle,fixture.scope)}finally{handle.exec('ROLLBACK');handle.exec('PRAGMA query_only=0')}
 expect(raw).not.toBeNull();expect(r.source).toStrictEqual(raw!.source);expect(r.contacts).toStrictEqual(raw!.observations.map(x=>({eventId:x.eventId,episodeId:x.episodeId,time:x.time,launchAngleDeg:Math.atan2(x.exitVelocityMps.y,Math.hypot(x.exitVelocityMps.x,x.exitVelocityMps.z))*180/Math.PI,label:'OUTSIDE'})));expect(handle.prepare('SELECT total_changes() n').get()).toEqual(before.changes);
});
