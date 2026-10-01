import type { Vec3 } from '../../core/model/geometry';
import { resolveCanonicalPitchDelivery,
  type CanonicalPitchDelivery,
  type CanonicalPitchDeliveryInput } from
  '../../core/sim/pitch/CanonicalPitchDelivery';
import type { SqlitePlayerPitchTimingStore } from
  './SqlitePlayerPitchTimingStore';
import type { SqlitePlayerReleaseGeometryStore } from
  './SqlitePlayerReleaseGeometryStore';
import { createPitchTrajectoryFromRelease } from
  '../../core/sim/pitch/CanonicalPitchRelease';
import { resolveAndRecordPitchAgainstBatter,
  type PitchAgainstBatterResolution,
  type TakePitchAgainstBatterInput,
  type SwingPitchAgainstBatterInput } from
  '../../core/sim/pitching/PitchAgainstBatter';
import type { PitchTrajectorySegment } from
  '../../core/sim/pitching/PitchTrajectory';
import type { CanonicalPlateAppearanceTimeline } from
  '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';

export type PlayerPitchDeliveryRequest = Readonly<{
  careerId: string; playerId: string; gameDay: number;
  moundReference: Vec3;
}> & Omit<CanonicalPitchDeliveryInput,
  'timingProfile' | 'body' | 'releaseProfile'>;

/** Match samples timing per pitch, while release geometry comes from Career history. */
export const resolvePlayerPitchDeliveryFromWorld = (
  stores: Readonly<{
    timing: Pick<SqlitePlayerPitchTimingStore, 'selectProfileAtDay'>;
    release: Pick<SqlitePlayerReleaseGeometryStore, 'selectAtDay'>;
  }>,
  input: PlayerPitchDeliveryRequest,
): CanonicalPitchDelivery => {
  if (!input || typeof input.careerId !== 'string'
    || input.careerId.length === 0
    || typeof input.playerId !== 'string'
    || input.playerId.length === 0
    || !Number.isSafeInteger(input.gameDay) || input.gameDay < 0) {
    throw new Error('invalid Player pitch delivery scope');
  }
  const timingProfile = stores.timing.selectProfileAtDay(input.careerId,
    input.playerId, input.gameDay);
  const geometry = stores.release.selectAtDay(input.careerId,
    input.playerId, input.gameDay);
  return resolveCanonicalPitchDelivery({
    root: input.root, outingId: input.outingId,
    playId: input.playId, pitchIndex: input.pitchIndex,
    readyAtUs: input.readyAtUs, timingIntent: input.timingIntent,
    timingProfile, body: { ...geometry.body,
      moundReference: input.moundReference },
    releaseProfile: geometry.profile, physics: input.physics,
  });
};

export type PlayerPitchAgainstBatterRequest = Readonly<{
  /** Canonical timeline ticks at this boundary are microseconds. */
  timeline: CanonicalPlateAppearanceTimeline;
  delivery: PlayerPitchDeliveryRequest;
  flight: Readonly<{ durationUs: number; acceleration: Vec3 }>;
  batter: Omit<TakePitchAgainstBatterInput, 'trajectory'>
    | Omit<SwingPitchAgainstBatterInput, 'trajectory'>;
}>;

export type PlayerPitchAgainstBatterResult = Readonly<{
  delivery: CanonicalPitchDelivery;
  trajectory: PitchTrajectorySegment;
  resolution: PitchAgainstBatterResolution;
}>;

/** Accepted Career histories determine when/where; Core physics determines what happens. */
export const resolvePlayerPitchAgainstBatterFromWorld = (
  stores: Parameters<typeof resolvePlayerPitchDeliveryFromWorld>[0],
  input: PlayerPitchAgainstBatterRequest,
): PlayerPitchAgainstBatterResult => {
  if (input.timeline.playId !== input.delivery.playId) {
    throw new Error('Player pitch playId must match the canonical timeline');
  }
  if (input.timeline.status.kind !== 'active') {
    throw new Error('Player pitch requires an active plate appearance');
  }
  if (!Number.isSafeInteger(input.delivery.readyAtUs)
    || input.delivery.readyAtUs < input.timeline.lastEventTick) {
    throw new Error('Player pitch ready time must not precede the previous event');
  }
  if (!Number.isSafeInteger(input.flight.durationUs) || input.flight.durationUs <= 0) {
    throw new Error('Player pitch flight duration must be a positive safe integer microsecond duration');
  }
  const delivery = resolvePlayerPitchDeliveryFromWorld(stores, input.delivery);
  const trajectory = createPitchTrajectoryFromRelease(delivery.release,
    input.flight.acceleration, delivery.release.releaseAtUs + input.flight.durationUs);
  const resolution = resolveAndRecordPitchAgainstBatter(input.timeline,
    { ...input.batter, trajectory });
  return Object.freeze({ delivery, trajectory, resolution });
};
