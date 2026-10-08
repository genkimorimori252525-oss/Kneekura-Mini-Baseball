import type { DatabaseSync } from 'node:sqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
/** Assessment provenance denotes one independently accepted assessment, not a
 * calibration label shared by participants or a recycled prior-PA assessment.
 * Inspect typed raw identity claims without hydrating unrelated old payloads. */
export const assertSamePaAssessmentOwnership=(db:Pick<DatabaseSync,'prepare'>,source:Readonly<{sourceId:string;provenance:Readonly<{assessmentSourceId:string}>}>)=>{
  for(const table of ['reserved_pa_total_assessments','actual_role_workload_assessments']){
    const objects=db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(table);
    if(db.prepare('SELECT 1 FROM temp.sqlite_master WHERE lower(name)=lower(?)').get(table))throw new Error('same-PA assessment ownership namespace shadowed');
    if(!objects.length)continue;
    if(objects.length!==1||objects[0].type!=='table'||objects[0].name!==table)throw new Error('same-PA assessment ownership namespace differs');
    const rows=db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')}
      OR ${claim('snapshot_json',['source','sourceId'],'$id')} OR ${claim('source_json',['provenance','assessmentSourceId'],'$id')}
      OR ${claim('snapshot_json',['source','provenance','assessmentSourceId'],'$id')}`).all({id:source.provenance.assessmentSourceId});
    if(rows.some(row=>table!=='reserved_pa_total_assessments'||row.source_id!==source.sourceId))throw new Error('same-PA assessment provenance ownership is duplicate or belongs to prior work');
  }
};
