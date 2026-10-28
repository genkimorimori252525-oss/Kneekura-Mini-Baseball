import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import type { CanonicalPlateAppearanceEvent, CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalLaunchReference, SamePaPhysicalResolutionSource } from './SamePlateAppearancePhysicalEpisode';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaReferenceValid, type SamePaExecutionLineage, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

type ContactEvent = Extract<CanonicalPlateAppearanceEvent, { kind: 'BatBallContact' }>;
export type NativeMeasuredBattingContactV182 = Readonly<{
  kind: 'native_measured_batting_contact_v182';
  resolutionReference: SamePaReference<'pa_physical_v1_resolutions'>;
  physicalPitchReference: SamePaPhysicalLaunchReference;
  source: SamePaPhysicalResolutionSource;
  lineage: SamePaExecutionLineage;
  actor: DurablePhysicalPlateAppearanceActor;
  contactEvent: ContactEvent;
  contact: BatBallContactResult;
  resolutionEvaluationTick: number;
  scope: Readonly<{ careerId: string; gameId: string; playId: number; physicalPitchSourceId: string; pitchOrdinal: number }>;
}>;

/** Pure selection only; neither synthetic timelines nor its result confer Native authority. */
export const selectAddedBattingContactV182 = (
  launch: Pick<CanonicalPlateAppearanceTimeline, 'events'>,
  resolution: Pick<CanonicalPlateAppearanceTimeline, 'events'>,
): ContactEvent | null => resolution.events.slice(launch.events.length)
  .find((event): event is ContactEvent => event.kind === 'BatBallContact') ?? null;

/** Authenticates both original records in one Native snapshot. Event sequence,
 * pitch ordinal, game day (in actor.binding), and ticks retain their original
 * scopes; none is a career/calendar occurrence time or a recognition result. */
export const readNativeMeasuredBattingContactV182FromSqlite = (
  db: DatabaseSync, resolutionReference: SamePaReference<'pa_physical_v1_resolutions'>,
): NativeMeasuredBattingContactV182 | null => {
  const ref = cloneInert(resolutionReference);
  if (!samePaReferenceValid(ref, 'pa_physical_v1_resolutions')) throw new Error('invalid measured batting contact resolution reference');
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const proof = readSamePaPhysicalOperationFromSqlite(db, ref), resolution = proof.record;
    if (resolution.kind !== 'same_pa_physical_resolution_v1') throw new Error('measured batting contact requires an original resolution');
    const launch = readSamePaPhysicalOperationFromSqlite(db, proof.physicalPitchReference).record;
    if (launch.kind !== 'same_pa_physical_launch_v1') throw new Error('measured batting contact requires its original launch');
    const contactEvent = selectAddedBattingContactV182(launch.timeline, resolution.timeline);
    if (contactEvent === null) return null;
    return freeze(cloneInert({ kind: 'native_measured_batting_contact_v182' as const,
      resolutionReference: ref, physicalPitchReference: proof.physicalPitchReference,
      source: resolution.source, lineage: proof.lineage, actor: proof.actor,
      contactEvent, contact: contactEvent.payload.contact, resolutionEvaluationTick: resolution.evaluationTick,
      scope: { careerId: proof.lineage.careerId, gameId: proof.lineage.gameId, playId: proof.lineage.playId,
        physicalPitchSourceId: resolution.physicalPitchSourceId, pitchOrdinal: resolution.pitchOrdinal } }));
  }));
};
