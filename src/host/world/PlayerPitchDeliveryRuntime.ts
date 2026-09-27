import type { Vec3 } from '../../core/model/geometry';
import { resolveCanonicalPitchDelivery,
  type CanonicalPitchDelivery,
  type CanonicalPitchDeliveryInput } from
  '../../core/sim/pitch/CanonicalPitchDelivery';
import type { SqlitePlayerPitchTimingStore } from
  './SqlitePlayerPitchTimingStore';
import type { SqlitePlayerReleaseGeometryStore } from
  './SqlitePlayerReleaseGeometryStore';

export type PlayerPitchDeliveryRequest = Readonly<{
  careerId: string; playerId: string; gameDay: number;
  moundReference: Vec3;
}> & Omit<CanonicalPitchDeliveryInput,
  'timingProfile' | 'body' | 'releaseProfile'>;

/** Match samples timing per pitch, while release geometry comes from Career history. */
export const resolvePlayerPitchDeliveryFromWorld = (
  stores: Readonly<{
    timing: Pick<SqlitePlayerPitchTimingStore, 'selectProfile'>;
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
  const timingProfile = stores.timing.selectProfile(input.careerId,
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
