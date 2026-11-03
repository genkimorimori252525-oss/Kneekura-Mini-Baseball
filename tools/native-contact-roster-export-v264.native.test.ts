import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {createWorldBoundOriginalContactsV190} from '../src/host/world/WorldBoundOriginalContactsV190.test-support';
import {openSqliteManagerRosterDecisionStore} from '../src/host/world/SqliteManagerRosterDecisionStore';
import {openSqliteNationalRosterSnapshotStore} from '../src/host/world/SqliteNationalRosterSnapshotStore';
import {readNativeBattingContactObservationSnapshotV189FromSqlite} from '../src/host/world/SqliteNativeBattingContactObservationStoreV188';
import {assertNativeContactReportSubjectV192FromSqlite,collectNativeContactReportObservationsV192} from './native-contact-report-runtime-v192';
import {readNativeContactRosterExportV264FromSqlite} from './native-contact-roster-export-v264';
const {DatabaseSync:Sqlite}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
it('matches Owner identity, accepted raw contacts and roster scope in one Native read snapshot',()=>{
 const dir=mkdtempSync(join(process.cwd(),'work','line-drive-next-20261101','native-export-v264-')),path=join(dir,'world.sqlite');
 const fixture=createWorldBoundOriginalContactsV190(path),roster=openSqliteManagerRosterDecisionStore(path),snapshots=openSqliteNationalRosterSnapshotStore(path,{roster});let checkpoint;
 try{checkpoint=snapshots.capture(fixture.scope.careerId,'club-b')}finally{snapshots.close();roster.close()}
 const collected=collectNativeContactReportObservationsV192(path,{scope:fixture.scope,careerCalendarEditionId:fixture.careerCalendarEditionId});expect(collected.registeredReferenceCount).toBe(2);
 const beforeFile=sha(path),db=new Sqlite(path,{readOnly:true});
 try{
  const before={changes:db.prepare('SELECT total_changes() n').get(),schema:db.prepare('PRAGMA schema_version').get()};db.exec('PRAGMA query_only=1; BEGIN');
  try{
   const output=readNativeContactRosterExportV264FromSqlite(db,{careerId:fixture.scope.careerId,rosterSnapshotId:checkpoint.snapshotId});
   const link=assertNativeContactReportSubjectV192FromSqlite(db,fixture.scope),raw=readNativeBattingContactObservationSnapshotV189FromSqlite(db,fixture.scope);
   expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);expect(raw).not.toBeNull();
   expect(output.batch).toMatchObject({populationBoundary:'EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY',producerCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY',asOfSemantics:'ROSTER_CHECKPOINT_AND_LATEST_REGISTERED_CONTACT_AT_SAME_DB_SNAPSHOT',physicsEffects:'NONE',roster:{snapshotId:checkpoint.snapshotId,effectiveDay:checkpoint.effectiveDay}});
   expect(output.batch.rows?.map(x=>x.playerId)).toEqual(checkpoint.roster.players.map(x=>x.playerId));expect(output.subjectLinks?.map(x=>x.playerId)).toEqual(output.batch.rows?.map(x=>x.playerId));
   const row=output.batch.rows!.find(x=>x.playerId===fixture.scope.playerId)!;
   expect(output.subjectLinks!.find(x=>x.playerId===fixture.scope.playerId)!.identity).toEqual({careerId:link.careerId,playerId:link.playerId,personId:link.personId,sourceId:link.sourceId});
   expect(row.distribution).toMatchObject({status:'OBSERVED',totalContacts:2,source:raw!.source,timeSemantics:'AS_OF_LATEST_REGISTERED_CONTACT',directionStatus:'UNASSESSED',physicsEffects:'NONE'});
   expect(raw!.receipts.map(x=>x.reference)).toEqual(fixture.contacts.map(x=>x.reference));
   expect(row.distribution!.contacts).toEqual(raw!.observations.map(x=>({eventId:x.eventId,episodeId:x.episodeId,time:x.time,launchAngleDeg:Math.atan2(x.exitVelocityMps.y,Math.hypot(x.exitVelocityMps.x,x.exitVelocityMps.z))*180/Math.PI,label:'OUTSIDE'})));
   const unknown=output.batch.rows!.filter(x=>x.status==='UNKNOWN');expect(unknown.length).toBeGreaterThan(0);for(const entry of unknown){if(entry.distribution!==null)expect(entry.distribution).toMatchObject({status:'UNKNOWN',totalContacts:null,contacts:null});}expect(row.producerAvailability).not.toBeNull();
   expect({changes:db.prepare('SELECT total_changes() n').get(),schema:db.prepare('PRAGMA schema_version').get()}).toEqual(before);
   expect(JSON.parse(JSON.stringify(output))).toEqual(output);
  }finally{db.exec('ROLLBACK; PRAGMA query_only=0')}
  expect(db.isTransaction).toBe(false);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
 }finally{db.close()}
 expect(sha(path)).toBe(beforeFile);
});
