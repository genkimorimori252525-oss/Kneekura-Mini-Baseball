import type { DatabaseSync } from 'node:sqlite';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { applyPitchFatigueToExecution, type PitchFatigueExecutionPolicy } from '../../core/sim/pitch/PitchFatigueExecution';
import { resolveCanonicalPitchDelivery, type CanonicalPitchDeliveryInput } from '../../core/sim/pitch/CanonicalPitchDelivery';
import { createPitchTrajectoryFromRelease } from '../../core/sim/pitch/CanonicalPitchRelease';
import { resolveTakenPitchPhysicalResult } from '../../core/sim/pitching/TakenPitchPhysicalResult';
import { inFlightBattingFixtureTiming } from './InFlightBattingFixtureTiming.test-support';
import { selectPlayerPitchTimingProfileFromSqlitePrefix } from './SqlitePlayerPitchTimingStore';
import { readPlayerReleaseGeometryPrefixFromSqlite } from './SqlitePlayerReleaseGeometryStore';
import { readPitchFatiguePolicyFromSqlite } from './SqlitePitchFatiguePolicyStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedSamePaFirstPitchAction } from './SamePlateAppearanceDispatchSource';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';

/** Bounded source consistency only: the existing Core delivery/TAKE math checks
 * LAN's two TAKEs and third pitch against a separately declared finite hold.
 * It accepts no pitch, posture, workload, contact, field or official result. */
export const checkSamePaOccupiedPhysicalTiming = (input: CanonicalPitchDeliveryInput,
  nominal: AcceptedSamePaFirstPitchAction['nominalPitch'], firstFatigue: number, laterFatigue: number,
  policy: PitchFatigueExecutionPolicy, gameDay: number, holdThroughTick: number) => {
  let ready = input.readyAtUs;
  const takes = [firstFatigue, laterFatigue].map((fatigue, pitchIndex) => {
    const effective = applyPitchFatigueToExecution(input.timingProfile, nominal.delivery.physics, fatigue, policy, gameDay);
    const delivery = resolveCanonicalPitchDelivery({ ...input, ...effective, readyAtUs: ready, pitchIndex });
    const trajectory = createPitchTrajectoryFromRelease(delivery.release, nominal.flight.acceleration, delivery.release.releaseAtUs + nominal.flight.durationUs);
    const physical = resolveTakenPitchPhysicalResult({ ...nominal.batter, trajectory });
    if (!physical) throw new Error('occupied fixture declared TAKE does not reach the plate');
    const completedAtTick = Math.max(physical.crossing.tick, delivery.timeline.followThroughEndUs);
    const validUntilTick = Math.min(ready + 20_000_000, holdThroughTick);
    if (completedAtTick > validUntilTick) throw new Error('occupied fixture TAKE exceeds declared hold horizon');
    ready = completedAtTick;
    return { delivery, completedAtTick, validUntilTick };
  });
  const effective = applyPitchFatigueToExecution(input.timingProfile,
    { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } }, laterFatigue, policy, gameDay);
  const swing = inFlightBattingFixtureTiming({ ...input, ...effective, readyAtUs: ready, pitchIndex: 2 }, Math.min(ready + 20_000_000, holdThroughTick));
  // The original declared trajectory, two-second field search, max transfer
  // (300+10) and reception search (100,000) must all fit. Actual contact/capture
  // and appeal results remain exclusively the later Native owners' work.
  const fieldSearchThroughTick = swing.delivery.release.releaseAtUs + nominal.flight.durationUs + 2_000_000 + 310 + 100_000;
  if (fieldSearchThroughTick > swing.geometry.validUntilTick) throw new Error('occupied fixture field search exceeds declared hold horizon');
  return { takes, swing, fieldSearchThroughTick, holdThroughTick };
};

export const checkSamePaOccupiedPhysicalTimingFromSqlite = (db: DatabaseSync, actor: DurablePhysicalPlateAppearanceActor,
  original: AcceptedSamePaFirstPitchAction, view: SamePaExecutionView, holdThroughTick: number) => withSqliteReadTransaction(db, () => {
  const pitcher = view.participants.find(p => p.playerId === original.pitcherPlayerId);
  if (!pitcher) throw new Error('occupied fixture original pitcher state missing');
  if (pitcher.activity.kind !== 'MATCH') throw new Error('occupied fixture requires the original MATCH workload activity');
  const day = actor.binding.gameDay, nominal = original.nominalPitch;
  const profile = selectPlayerPitchTimingProfileFromSqlitePrefix(db, original.timingReference, day);
  const release = readPlayerReleaseGeometryPrefixFromSqlite(db, original.releaseReference);
  const geometry = release.changes.filter(c => c.effectiveDay <= day).at(-1) ?? release.baseline;
  const { sourceId: _id, sourceVersion: _version, ...policy } = readPitchFatiguePolicyFromSqlite(db, original.pitchResponseReference);
  // The fixture declares cumulative effort 2 at the anchor and every later cut,
  // always projected from the same reservation, never added repeatedly.
  const later = advancePlayerWorkloadRecovery(pitcher.reservedState, pitcher.reservedState.revision, { ...pitcher.activity, effortUnits: 2 });
  return checkSamePaOccupiedPhysicalTiming({ root: new SeedRoot(nominal.delivery.matchSeed), outingId: nominal.delivery.outingId,
    playId: actor.match.playId, pitchIndex: 0, readyAtUs: actor.world.tick, timingProfile: profile,
    timingIntent: nominal.delivery.timingIntent, body: { ...geometry.body, moundReference: nominal.delivery.moundReference },
    releaseProfile: geometry.profile, physics: nominal.delivery.physics }, nominal, pitcher.projectedState.fatigue, later.fatigue, policy, day, holdThroughTick);
});
