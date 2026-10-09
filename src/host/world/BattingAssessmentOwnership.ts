import type { DatabaseSync } from 'node:sqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';

export const battingAssessmentOwners = Object.freeze(['batting_observation_v1_postures', 'batting_score_v1_assessments',
  'batting_emotion_v1_geneses', 'batting_emotion_execution_v1_executions'] as const);
/** Accepted primitive assessments retain independent identities, including
 * across calibration and cumulative-work domains. Only identity metadata is
 * discovered here; every reached owner still reconstructs its own behavior. */
export const assertBattingAssessmentOwnership = (db: DatabaseSync, owner: string, source: Readonly<{ sourceId: string; provenance: Readonly<{ assessmentSourceId: string }> }>) => {
  assertBodyCompositionNativeConnection(db);
  for (const table of [...battingAssessmentOwners, 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_calibrations', 'pa_dispatch_v1_execution_calibrations', 'pa_continuation_v1_execution_calibrations',
    'reserved_pa_total_assessments', 'pa_continuation_v1_total_assessments', 'actual_role_workload_assessments']) {
    const metadata = db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(table);
    if (!metadata.length) continue;
    if (metadata.length !== 1 || metadata[0].type !== 'table' || metadata[0].name !== table) throw new Error('batting assessment original owner namespace differs');
    const rows = db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}
      OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`)
      .all({ id: source.provenance.assessmentSourceId });
    if (rows.some(row => table !== owner || row.source_id !== source.sourceId)) throw new Error('batting accepted assessment identity belongs to another owner');
  }
};
