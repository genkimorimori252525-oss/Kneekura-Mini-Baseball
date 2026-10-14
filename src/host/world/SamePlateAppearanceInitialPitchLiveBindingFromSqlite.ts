import type { DatabaseSync } from 'node:sqlite';
import { readSamePaExecutedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
import { assertPaDispatchStorage } from './SamePlateAppearanceDispatchStorage';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { readPaDispatchPhysicalClaimRows } from './SamePlateAppearanceDispatchClaimGuard';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
/** Replays the actual consumer and its initial prerequisites in one original
 * owned read proof. Old first-pitch sources deliberately supply no initial Play. */
export const readSamePaInitialPitchLiveBindingFromSqlite = (db: DatabaseSync, firstPitchSourceId: string) => {
  if (!samePaText(firstPitchSourceId)) throw new Error('invalid initial pitch identity');
  if (!assertPaDispatchStorage(db)) return null;
  const rows = db.prepare(`SELECT source_id,source_hash,snapshot_hash FROM main.pa_dispatch_v1_pitch_actions WHERE source_id=$id
    OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id:firstPitchSourceId});
  if (rows.length>1 || rows.length===1 && rows[0].source_id!==firstPitchSourceId) throw new Error('initial pitch Source alias differs');
  const row=rows[0];
  if (!row) { if (readPaDispatchPhysicalClaimRows(db,firstPitchSourceId).length) throw new Error('initial pitch missing with surviving claims'); return null; }
  const { pitch } = readSamePaExecutedPitchFromSqlite(db, { owner: 'pa_dispatch_v1_pitch_actions', sourceId: firstPitchSourceId,
    sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) });
  if (!pitch || !pitch.initialLiveBallBinding) return null;
  return freeze({ ...pitch.initialLiveBallBinding, lineage: pitch.lineage,
    physicalPitchReference: reference('pa_dispatch_v1_pitch_actions', pitch) });
};
