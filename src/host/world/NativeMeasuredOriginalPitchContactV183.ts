import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { selectAddedBattingContactV182 } from './NativeMeasuredBattingContactV182';
import { readOriginalPhysicalPitchWithRowsFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';

type ContactEvent = NonNullable<ReturnType<typeof selectAddedBattingContactV182>>;
export type NativeMeasuredOriginalPitchContactV183 = Readonly<{
  kind: 'native_measured_original_pitch_contact_v183';
  reference: SamePaReference<'physical_pitch_progress_actions'>;
  source: AcceptedPhysicalPitchActionSource;
  actor: DurablePhysicalPlateAppearanceActor;
  contactEvent: ContactEvent;
  contact: BatBallContactResult;
  progressRevision: number;
  scope: Readonly<{ careerId: string; gameId: string; playId: number; physicalPitchSourceId: string }>;
}>;

/** Pure selection boundary only; its input/result is not a Native proof. */
export const selectOriginalPitchContactV183 = (
  beforeTimeline: Pick<CanonicalPlateAppearanceTimeline, 'events'>,
  timeline: Pick<CanonicalPlateAppearanceTimeline, 'events'>,
  actor: DurablePhysicalPlateAppearanceActor | undefined,
): Readonly<{ contactEvent: ContactEvent; actor: DurablePhysicalPlateAppearanceActor }> | null => {
  const contactEvent = selectAddedBattingContactV182(beforeTimeline, timeline);
  if (contactEvent === null) return null;
  if (!actor) throw new Error('measured Original PhysicalPitch contact lacks its original batter actor');
  return { contactEvent, actor };
};

/** The original owner authenticates the full prefix and committed head. The
 * supplied endpoint hashes are checked on that same Native read snapshot.
 * Progress revision, local event sequence/tick and actor.binding.gameDay keep
 * their original scopes; they do not define a career/calendar occurrence. */
export const readNativeMeasuredOriginalPitchContactV183FromSqlite = (
  db: DatabaseSync, reference: SamePaReference<'physical_pitch_progress_actions'>,
): NativeMeasuredOriginalPitchContactV183 | null => {
  const ref = cloneInert(reference);
  if (!samePaReferenceValid(ref, 'physical_pitch_progress_actions')) throw new Error('invalid measured Original PhysicalPitch reference');
  return withBattedVenueLegalReadSnapshot(db, () => {
    const pitch = readOriginalPhysicalPitchWithRowsFromSqlite(db, ref.sourceId).prefix.at(-1)!;
    const row = db.prepare('SELECT source_hash,snapshot_hash FROM main.physical_pitch_progress_actions WHERE source_id=?').get(ref.sourceId);
    if (row?.source_hash !== ref.sourceHash || row.snapshot_hash !== ref.snapshotHash) throw new Error('measured Original PhysicalPitch reference differs');
    const selected = selectOriginalPitchContactV183(pitch.beforeTimeline, pitch.result.pitch.resolution.timeline, pitch.frame.batterActor);
    if (selected === null) return null;
    return freeze(cloneInert({ kind: 'native_measured_original_pitch_contact_v183' as const,
      reference: ref, source: pitch.source, actor: selected.actor, contactEvent: selected.contactEvent,
      contact: selected.contactEvent.payload.contact, progressRevision: pitch.progressRevision,
      scope: { careerId: pitch.frame.workload.careerId, gameId: pitch.frame.gameId,
        playId: pitch.frame.match.playId, physicalPitchSourceId: pitch.source.sourceId } }));
  });
};
