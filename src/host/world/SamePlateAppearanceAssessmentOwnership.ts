import { battingAssessmentOwners } from './BattingAssessmentOwnership';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { memoSamePaContinuationRead, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
type Db = Pick<DatabaseSync,'prepare'>;
type Source = Readonly<{sourceId:string;provenance:Readonly<{assessmentSourceId:string}>}>;
/** Assessment provenance denotes one independently accepted assessment, not a
 * calibration label shared by participants or a recycled prior-PA assessment.
 * Inspect typed raw identity claims without hydrating unrelated old payloads. */
const namespaces=(db:Db)=>{
  const installed:string[]=[];
  for(const table of [...battingAssessmentOwners, 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations','reserved_pa_total_assessments','actual_role_workload_assessments','pa_continuation_v1_total_assessments','pa_continuation_v1_execution_calibrations']){
    const objects=db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(table);
    if(db.prepare('SELECT 1 FROM temp.sqlite_master WHERE lower(name)=lower(?)').get(table))throw new Error('same-PA assessment ownership namespace shadowed');
    if(!objects.length)continue;
    if(objects.length!==1||objects[0].type!=='table'||objects[0].name!==table)throw new Error('same-PA assessment ownership namespace differs');
    installed.push(table);
  }
  return installed;
};
const inspect=(db:Db,source:Source,tables:readonly string[])=>{
  for(const table of tables){
    const rows=db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')}
      OR ${claim('snapshot_json',['source','sourceId'],'$id')} OR ${claim('source_json',['provenance','assessmentSourceId'],'$id')}
      OR ${claim('snapshot_json',['source','provenance','assessmentSourceId'],'$id')}`).all({id:source.provenance.assessmentSourceId});
    if(rows.some(row=>table!=='reserved_pa_total_assessments'||row.source_id!==source.sourceId))throw new Error('same-PA assessment provenance ownership is duplicate or belongs to prior work');
  }
};
export const assertSamePaAssessmentOwnership=(db:Db,source:Source):void=>{
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if(!(db instanceof Native)||!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==1){
    inspect(db,source,namespaces(db));return;
  }
  withSamePaContinuationReadPhase(db,()=>{
    // Original main/TEMP namespace and type checks remain fresh on every hit.
    const tables=namespaces(db);if(!tables.length)return;
    const target={sourceId:source.sourceId,provenance:{assessmentSourceId:source.provenance.assessmentSourceId}};
    if(typeof target.sourceId!=='string'||typeof target.provenance.assessmentSourceId!=='string'){inspect(db,source,tables);return;}
    // Only this complete successful identity proof is shared. The enclosing
    // phase owns mutation, transaction, failure and independent-call expiry.
    memoSamePaContinuationRead(db,'reserved-assessment-ownership:'+json([target.sourceId,target.provenance.assessmentSourceId]),()=>{
      inspect(db,target,tables);return true;
    });
  });
};
