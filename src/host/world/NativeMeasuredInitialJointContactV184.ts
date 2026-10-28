import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import type { RigidBatBallContactResult } from '../../core/sim/contact/RigidBatBallContact';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { initialJointExecutionTable } from './InitialJointPhysicalExecutionMetadata';
import { selectAddedBattingContactV182 } from './NativeMeasuredBattingContactV182';
import { actorFreeze as freeze, actorJson as json, readPhysicalPlateAppearanceActorFromSqlite,
  type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readInitialJointPhysicalExecutionFromSqlite } from './SqliteInitialJointPhysicalExecutionStore';
import { readSamePaObservedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

type Execution = ReturnType<typeof readInitialJointPhysicalExecutionFromSqlite>;
type JointResult = Execution['calculation']['result'];
type SelectionInput = Pick<Extract<JointResult, { kind: 'bat_contact' }>, 'kind' | 'contact' | 'moment'>
  | Pick<Exclude<JointResult, { kind: 'bat_contact' }>, 'kind'>;
type ContactEvent = Extract<CanonicalPlateAppearanceTimeline['events'][number], { kind: 'BatBallContact' }>;
type Selection = Readonly<{ contactEvent: ContactEvent; rigidContact: RigidBatBallContactResult; contactMoment: BallWorldMoment }>;
export type NativeMeasuredInitialJointContactV184 = Readonly<{
  kind: 'native_measured_initial_joint_contact_v184';
  reference: SamePaReference<typeof initialJointExecutionTable>;
  launchReference: Execution['launchReference'];
  source: Execution['source'];
  lineage: Execution['lineage'];
  actor: DurablePhysicalPlateAppearanceActor;
  contactEvent: ContactEvent;
  contact: BatBallContactResult;
  rigidContact: RigidBatBallContactResult;
  contactMoment: BallWorldMoment;
  scope: Readonly<{ careerId: string; gameId: string; playId: number; physicalPitchSourceId: string; batterPlayerId: string }>;
}>;

/** Pure selection only. Synthetic inputs/results confer no Native authority. */
export const selectInitialJointContactV184 = (beforeTimeline: Pick<CanonicalPlateAppearanceTimeline, 'events'>,
  timeline: Pick<CanonicalPlateAppearanceTimeline, 'events'>, result: SelectionInput): Selection | null => {
  if (result.kind !== 'bat_contact') return null;
  const contactEvent = selectAddedBattingContactV182(beforeTimeline, timeline);
  if (!contactEvent) throw new Error('measured initial joint execution lacks its added canonical contact event');
  return { contactEvent, rigidContact: result.contact, contactMoment: result.moment };
};

/** Reads adopted execution only. The original rigid impulse and continuous
 * moment remain alongside the canonical event; event tick/sequence and game
 * day keep their original scopes and do not define a career/calendar time. */
export const readNativeMeasuredInitialJointContactV184FromSqlite = (
  db: DatabaseSync, reference: SamePaReference<typeof initialJointExecutionTable>,
): NativeMeasuredInitialJointContactV184 | null => {
  const ref = cloneInert(reference);
  if (!samePaReferenceValid(ref, initialJointExecutionTable)) throw new Error('invalid measured initial joint execution reference');
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const execution = readInitialJointPhysicalExecutionFromSqlite(db, ref), result = execution.calculation.result;
    if (result.kind !== 'bat_contact') return null;
    const launch = readSamePaObservedPitchFromSqlite(db, execution.launchReference);
    if (json(launch.pitch.lineage) !== json(execution.lineage)) throw new Error('measured initial joint launch lineage differs');
    const actor = readPhysicalPlateAppearanceActorFromSqlite(db, execution.lineage.actorReference.sourceId);
    if (!actor || json(samePaExecutionReference('physical_plate_appearance_actors', actor)) !== json(execution.lineage.actorReference)) {
      throw new Error('measured initial joint original batter actor reference differs');
    }
    if (actor.binding.careerId !== execution.lineage.careerId || actor.binding.gameId !== execution.lineage.gameId
      || actor.match.playId !== execution.lineage.playId || actor.binding.playerId !== execution.calculation.input.batterPlayerId) {
      throw new Error('measured initial joint original batter scope differs');
    }
    const selected = selectInitialJointContactV184(launch.pitch.beforeTimeline, execution.timeline, result)!;
    return freeze(cloneInert({ kind: 'native_measured_initial_joint_contact_v184' as const,
      reference: ref, launchReference: execution.launchReference, source: execution.source, lineage: execution.lineage, actor,
      contactEvent: selected.contactEvent, contact: selected.contactEvent.payload.contact,
      rigidContact: selected.rigidContact, contactMoment: selected.contactMoment,
      scope: { careerId: execution.lineage.careerId, gameId: execution.lineage.gameId, playId: execution.lineage.playId,
        physicalPitchSourceId: execution.launchReference.sourceId, batterPlayerId: execution.calculation.input.batterPlayerId } }));
  }));
};
