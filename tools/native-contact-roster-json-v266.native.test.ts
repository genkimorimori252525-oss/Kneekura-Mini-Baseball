import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {createWorldBoundOriginalContactsV190} from '../src/host/world/WorldBoundOriginalContactsV190.test-support';
import {openSqliteManagerRosterDecisionStore} from '../src/host/world/SqliteManagerRosterDecisionStore';
import {openSqliteNationalRosterSnapshotStore} from '../src/host/world/SqliteNationalRosterSnapshotStore';
import {collectNativeContactReportObservationsV192} from './native-contact-report-runtime-v192';
import {readNativeContactRosterExportV264FromSqlite} from './native-contact-roster-export-v264';
import {serializeContactRosterV266,parseContactRosterV266} from './native-contact-roster-json-v266';
const {DatabaseSync:Sqlite}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('serializes and parses a new synthetic Native roster with two accepted contacts',()=>{
 const path=join(mkdtempSync(join(process.cwd(),'work','line-drive-next-20261101','native-json-v266-')),'world.sqlite');const fixture=createWorldBoundOriginalContactsV190(path),owner=openSqliteManagerRosterDecisionStore(path),snapshots=openSqliteNationalRosterSnapshotStore(path,{roster:owner});let snapshot;
 try{snapshot=snapshots.capture(fixture.scope.careerId,'club-b')}finally{snapshots.close();owner.close()}
 expect(collectNativeContactReportObservationsV192(path,{scope:fixture.scope,careerCalendarEditionId:fixture.careerCalendarEditionId}).registeredReferenceCount).toBe(2);
 const db=new Sqlite(path,{readOnly:true});try{const v=readNativeContactRosterExportV264FromSqlite(db,{careerId:fixture.scope.careerId,rosterSnapshotId:snapshot.snapshotId});const text=serializeContactRosterV266(v),parsed=parseContactRosterV266(text),copy=parsed.payload;expect(parsed.provenance).toBe('NOT_AUTHENTICATED_BY_JSON');expect(copy).toStrictEqual(v);expect(copy.batch.rows?.find(x=>x.playerId===fixture.scope.playerId)?.distribution?.totalContacts).toBe(2);expect(copy.batch.rows?.some(x=>x.status==='UNKNOWN')).toBe(true)}finally{db.close()}
});
