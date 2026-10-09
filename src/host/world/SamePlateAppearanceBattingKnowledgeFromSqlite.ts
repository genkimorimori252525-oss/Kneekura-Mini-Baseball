import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readCurrentSamePaContinuationViewFromSqlite, readHistoricalSamePaContinuationViewFromSqlite, readSamePaContinuationRecordFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import type { DurableBattingScoreAssessment } from './NativeBattingPerception';
import type { SamePaCurrentExecutionViewReference } from './SamePlateAppearanceInvocationView';
import { assertSamePaOriginalMember } from './SamePlateAppearanceInvocationView';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';

/** Complete current assessed knowledge, with one latest explicit assessment per
 * original forecast. No unassessed forecast acquires a zero or neutral score. */
export const readCurrentSamePaBattingKnowledgeFromSqlite = (db: DatabaseSync, viewReference: SamePaCurrentExecutionViewReference) => {
  const b = readCurrentSamePaContinuationViewFromSqlite(db, viewReference), playerId = b.actor.binding.playerId;
  const prefix = readSamePaContinuationRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'nonempty_prefix') throw new Error('batting knowledge current prefix missing');
  const catalog = db.prepare("SELECT type,name FROM main.sqlite_master WHERE lower(name)='batting_score_v1_assessments'").all();
  if (!catalog.length) return [];
  if (catalog.length !== 1 || catalog[0].name !== 'batting_score_v1_assessments' || catalog[0].type !== 'table') throw new Error('batting knowledge namespace differs');
  const rows = db.prepare(`SELECT * FROM main.batting_score_v1_assessments WHERE (enrollment_source_id=$enrollment OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')})
    AND (physical_pitch_source_id=$pitch OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')})
    AND (player_id=$player OR ${claim('source_json', ['member', 'playerId'], '$player')})`).all({ enrollment: b.view.lineage.enrollmentReference.sourceId,
      pitch: b.view.physicalCut.pitchReference.sourceId, player: playerId });
  const selected = new Map<string, { value: DurableBattingScoreAssessment; revision: number }>();
  for (const row of rows) {
    const value = readBattingPerceptionFromSqlite(db, 'assessment', { owner: 'batting_score_v1_assessments', sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) });
    if (value.kind !== 'batting_score_assessment' || value.source.capability !== 'owned_batting_current_score_assessment_v1') throw new Error('batting knowledge original assessment owner differs');
    const priorView = readHistoricalSamePaContinuationViewFromSqlite(db, value.source.viewReference), prior = readSamePaContinuationRecordFromSqlite(db, 'prefix', priorView.view.source.prefixReference.sourceId);
    if (!prior || prior.kind !== 'nonempty_prefix' || json(prior.lineage) !== json(prefix.lineage) || value.physicalPitchSourceId !== b.view.physicalCut.pitchReference.sourceId
      || json(prior.operationReferences) !== json(prefix.operationReferences.slice(0, prior.operationReferences.length))) throw new Error('batting assessment does not belong to the owned knowledge prefix');
    assertSamePaOriginalMember(value.source.member, b.members.find(m => m.playerId === playerId)!);
    if (value.prediction.availableTick > b.view.evaluationTick) throw new Error('batting assessment is not yet available');
    const key = value.source.predictionReference.sourceId, old = selected.get(key), revision = prior.operationReferences.length;
    if (old && old.revision === revision && old.value.source.sourceId !== value.source.sourceId) throw new Error('batting forecast has ambiguous accepted assessment identity');
    if (!old || old.revision < revision) selected.set(key, { value, revision });
  }
  return freeze([...selected.values()].map(r => r.value).sort((a, b) => a.prediction.observedTick - b.prediction.observedTick
    || a.prediction.availableTick - b.prediction.availableTick || a.prediction.predictionId.localeCompare(b.prediction.predictionId))
    .map(value => ({ reference: reference('batting_score_v1_assessments', value), value })));
};

/** Current in-flight knowledge is the assessed part of the same physical
 * pitch's owned prefix. Future/foreign assessments never become defaults. */
export const readCurrentInFlightSamePaBattingKnowledgeFromSqlite = (db: DatabaseSync, viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>) => {
  const b = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference), playerId = b.actor.binding.playerId;
  if (b.view.cut.stage !== 'in_flight' || b.view.cut.physicalPitchReference.owner !== 'pa_physical_v1_launches') throw new Error('batting knowledge requires an in-flight owned pitch');
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('batting lifecycle knowledge prefix missing');
  const catalog = db.prepare("SELECT type,name FROM main.sqlite_master WHERE lower(name)='batting_score_v1_assessments'").all();
  if (!catalog.length) return [];
  if (catalog.length !== 1 || catalog[0].name !== 'batting_score_v1_assessments' || catalog[0].type !== 'table') throw new Error('batting knowledge namespace differs');
  const rows = db.prepare(`SELECT * FROM main.batting_score_v1_assessments WHERE (enrollment_source_id=$enrollment OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')})
    AND (physical_pitch_source_id=$pitch OR ${claim('snapshot_json', ['physicalPitchSourceId'], '$pitch')})
    AND (player_id=$player OR ${claim('source_json', ['member', 'playerId'], '$player')})`).all({ enrollment: b.view.lineage.enrollmentReference.sourceId,
      pitch: b.view.cut.physicalPitchReference.sourceId, player: playerId });
  const selected = new Map<string, { value: DurableBattingScoreAssessment; revision: number }>();
  for (const row of rows) {
    const value = readBattingPerceptionFromSqlite(db, 'assessment', { owner: 'batting_score_v1_assessments', sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) });
    if (value.kind !== 'batting_score_assessment' || value.source.capability !== 'owned_in_flight_batting_score_assessment_v1') throw new Error('batting lifecycle assessment owner differs');
    const old = readHistoricalSamePaLifecycleViewFromSqlite(db, value.source.viewReference), prior = readSamePaLifecycleRecordFromSqlite(db, 'prefix', old.view.source.prefixReference.sourceId);
    if (!prior || prior.kind !== 'same_pa_lifecycle_prefix' || json(prior.lineage) !== json(prefix.lineage)
      || json(prior.source.anchorViewReference) !== json(prefix.source.anchorViewReference)
      || value.physicalPitchSourceId !== b.view.cut.physicalPitchReference.sourceId
      || json(prior.source.eventReferences) !== json(prefix.source.eventReferences.slice(0, prior.source.eventReferences.length))) throw new Error('batting assessment is outside the current owned knowledge prefix');
    assertSamePaOriginalMember(value.source.member, b.members.find(m => m.playerId === playerId)!);
    if (value.prediction.availableTick > b.view.cut.evaluationTick) throw new Error('batting assessment is not yet available');
    const key = value.source.predictionReference.sourceId, previous = selected.get(key), revision = prior.source.eventReferences.length;
    if (previous && previous.revision === revision && previous.value.source.sourceId !== value.source.sourceId) throw new Error('batting forecast has ambiguous assessment identity');
    if (!previous || previous.revision < revision) selected.set(key, { value, revision });
  }
  return freeze([...selected.values()].map(r => r.value).sort((a, b) => a.prediction.observedTick - b.prediction.observedTick
    || a.prediction.availableTick - b.prediction.availableTick || a.prediction.predictionId.localeCompare(b.prediction.predictionId))
    .map(value => ({ reference: reference('batting_score_v1_assessments', value), value })));
};
