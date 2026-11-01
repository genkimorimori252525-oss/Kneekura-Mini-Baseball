import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {afterEach,expect,it,vi} from 'vitest';
import {createWorldBoundOriginalContactsV190} from '../src/host/world/WorldBoundOriginalContactsV190.test-support';
import {openSqliteManagerRosterDecisionStore} from '../src/host/world/SqliteManagerRosterDecisionStore';
import {openSqliteNationalRosterSnapshotStore} from '../src/host/world/SqliteNationalRosterSnapshotStore';
import {collectNativeContactReportObservationsV192} from './native-contact-report-runtime-v192';
import * as reader from './native-contact-roster-export-v264';
import * as codec from './native-contact-roster-json-v266';
import {readNativeContactRosterBytesV272 as read} from './native-contact-roster-bytes-v272';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
afterEach(()=>vi.restoreAllMocks());
it('reads synthetic native contacts and UNKNOWN into independent lossless bytes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v272-native-')),path=join(dir,'world.sqlite'),fixture=createWorldBoundOriginalContactsV190(path),owner=openSqliteManagerRosterDecisionStore(path),snapshots=openSqliteNationalRosterSnapshotStore(path,{roster:owner});let roster;
 try{roster=snapshots.capture(fixture.scope.careerId,'club-b')}finally{snapshots.close();owner.close()}
 expect(collectNativeContactReportObservationsV192(path,{scope:fixture.scope,careerCalendarEditionId:fixture.careerCalendarEditionId}).registeredReferenceCount).toBe(2);
 const db=new DatabaseSync(path,{readOnly:true}),input={careerId:fixture.scope.careerId,rosterSnapshotId:roster.snapshotId};try{
  const before=db.prepare('SELECT total_changes() n').get(),expected=reader.readNativeContactRosterExportV264FromSqlite(db,input),out=read(db,input),parsed=codec.parseContactRosterV266(new TextDecoder('utf-8',{fatal:true}).decode(out.bytes));
  expect(parsed.payload).toStrictEqual(expected);expect(out.provenance).toBe('NOT_AUTHENTICATED_BY_JSON');expect(parsed.payload.batch.rows!.find(x=>x.playerId===fixture.scope.playerId)!.distribution).toMatchObject({status:'OBSERVED',totalContacts:2});expect(parsed.payload.batch.rows!.some(x=>x.status==='UNKNOWN')).toBe(true);expect(db.isTransaction).toBe(false);expect(db.prepare('SELECT total_changes() n').get()).toEqual(before);expect(db.prepare('SELECT 1 n').get()!.n).toBe(1);
  const signed=structuredClone(expected);(signed.batch.rows!.find(x=>x.playerId===fixture.scope.playerId)!.distribution!.contacts![0] as {launchAngleDeg:number}).launchAngleDeg=-0;vi.spyOn(reader,'readNativeContactRosterExportV264FromSqlite').mockReturnValue(signed);const first=read(db,input),second=read(db,input),decoded=codec.parseContactRosterV266(new TextDecoder().decode(first.bytes)).payload;expect(Object.is(decoded.batch.rows!.find(x=>x.playerId===fixture.scope.playerId)!.distribution!.contacts![0].launchAngleDeg,-0)).toBe(true);expect(decoded).toStrictEqual(signed);const original=second.bytes[0];first.bytes[0]^=1;expect(second.bytes[0]).toBe(original);const oversized=structuredClone(expected);(oversized.subjectLinks!.find(x=>x.playerId===fixture.scope.playerId)!.identity as {sourceId:string}).sourceId='x'.repeat(10_000_001);vi.mocked(reader.readNativeContactRosterExportV264FromSqlite).mockReturnValueOnce(oversized);expect(()=>read(db,input)).toThrow();
 }finally{db.close()}
});
it('rejects uncommitted caller transaction without reading or changing its state',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec("CREATE TABLE t(x); BEGIN; INSERT INTO t VALUES ('pending'); PRAGMA query_only=1");const spy=vi.spyOn(reader,'readNativeContactRosterExportV264FromSqlite'),before=db.prepare('SELECT total_changes() n').get();expect(()=>read(db,{careerId:'x',rosterSnapshotId:'y'})).toThrow('no active transaction');expect(spy).not.toHaveBeenCalled();expect(db.isTransaction).toBe(true);expect(db.prepare('SELECT x FROM t').get()!.x).toBe('pending');expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);expect(db.prepare('SELECT total_changes() n').get()).toEqual(before);db.exec('ROLLBACK; PRAGMA query_only=0');expect(db.prepare('SELECT 1 n').get()!.n).toBe(1)}finally{db.close()}
});
it('propagates reader and serializer exceptions without bytes or connection closure',()=>{
 const db=new DatabaseSync(':memory:'),input={careerId:'x',rosterSnapshotId:'y'};try{vi.spyOn(reader,'readNativeContactRosterExportV264FromSqlite').mockImplementation(()=>{throw Error('reader failed')});expect(()=>read(db,input)).toThrow('reader failed');vi.restoreAllMocks();vi.spyOn(reader,'readNativeContactRosterExportV264FromSqlite').mockReturnValue({} as never);vi.spyOn(codec,'serializeContactRosterV266').mockImplementation(()=>{throw Error('serializer failed')});expect(()=>read(db,input)).toThrow('serializer failed');expect(db.isTransaction).toBe(false);expect(db.prepare('SELECT 1 n').get()!.n).toBe(1)}finally{db.close()}
});
it('retains V266 byte, node and depth limits without returning partial bytes',()=>{
 const db=new DatabaseSync(':memory:'),input={careerId:'x',rosterSnapshotId:'y'},mock=vi.spyOn(reader,'readNativeContactRosterExportV264FromSqlite');try{const deep:any={};let p=deep;for(let i=0;i<70;i++){p.next={};p=p.next}for(const bad of [{x:'x'.repeat(10_000_001)},{x:Array.from({length:100001},()=>null)},deep]){mock.mockReturnValueOnce(bad as never);expect(()=>read(db,input)).toThrow()}expect(db.prepare('SELECT 1 n').get()!.n).toBe(1)}finally{db.close()}
});
