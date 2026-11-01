import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {deepStrictEqual} from 'node:assert';
import {expect,it} from 'vitest';
import {measuredBattingBodyReferenceTable,openSqliteMeasuredBattingBodyReferenceStore,
  readMeasuredBattingBodyReferenceFromSqlite,type MeasuredBattingBodyReference} from './SqliteMeasuredBattingBodyReferenceStore';
import {withBattedWorldPhysicalReadTraversal} from './SqliteBattedWorldFieldExecutionStore';
import {withSamePaLifecycleReadPhase} from './SamePlateAppearanceLifecycleFromSqlite';
import {databaseCensusV139} from './InitialQualifiedJointV139.test-support';

const manifest=process.env.BASEBALL_INITIAL_QUALIFIED_MANIFEST_V139;
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
/** Diagnostic of the already committed partial B record. This never retries
 * B, issues an action, supplies a Source provider or claims a physical PASS. */
it.skipIf(!manifest)('IQBR139 authenticates the existing body through q1 and its providerless facade without changing stored records',()=>{
  if(!manifest)throw Error('explicit qualified Native manifest locator required');
  const {path}=JSON.parse(readFileSync(manifest,'utf8')) as {path:string};
  const before=databaseCensusV139(path),db=new Native(path,{readOnly:true});
  let owned;
  try{
    db.exec('PRAGMA query_only=1; BEGIN');
    const row=db.prepare('SELECT source_id,source_hash,snapshot_hash FROM main.'+measuredBattingBodyReferenceTable+' WHERE source_id=?').get('iqj139:body');
    if(!row)throw Error('existing partial body record is required; no repair or new admission');
    const ref:MeasuredBattingBodyReference={owner:measuredBattingBodyReferenceTable,sourceId:String(row.source_id),sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)};
    process.stdout.write('IQBR139-stage q1-body-read-start\n');
    owned=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>readMeasuredBattingBodyReferenceFromSqlite(db,ref)));
    expect(owned.bodyReferenceOwned).toBe(true);expect(owned.motionIssued).toBe(false);expect(owned.source.reference.frames).toHaveLength(137);
    db.exec('COMMIT');process.stdout.write('IQBR139-stage q1-body-read-ready\n');
  }finally{db.close();}
  process.stdout.write('IQBR139-stage providerless-facade-read-start\n');
  const facade=openSqliteMeasuredBattingBodyReferenceStore(path);
  try{deepStrictEqual(facade.read('iqj139:body'),owned);}finally{facade.close();}
  process.stdout.write('IQBR139-stage providerless-facade-read-ready\n');
  deepStrictEqual(databaseCensusV139(path),before);
},60_000);
