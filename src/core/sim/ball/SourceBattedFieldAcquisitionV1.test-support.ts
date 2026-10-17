import type { BattedWorldFieldMotionAdoptionInput } from './BattedWorldFieldMotion';
import { sourceFieldV3Fixture } from './SourceBattedFieldMotionV3.test-support';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
/** Declared synthetic glove energy/geometry, never a calibrated person. */
export const sourceGloveFixture = (capacityJ = 100): BattedWorldFieldMotionAdoptionInput => {
  const x = sourceFieldV3Fixture(), actor = { ...x.actors[0], primitive: { ...x.actors[0].primitive, role: 'glove' as const, startCenter: v(2, 1) } };
  const profile = { role: 'glove' as const, pocketCenterOffset: v(-.1366), bodyStability: 1,
    parameters: { ticksPerSecond: 1_000_000, ballMassKg: .145, ballRadiusMeters: .0366, pocketRadiusMeters: .08,
      centerRetentionCapacityJ: capacityJ, captureDissipationPowerW: 1000, failedContactRestitution: .5, failedTangentialDamping: .1, failedSpinDamping: .1 } };
  return { ...x, response: { ...x.response, world: { ...x.response.world, actors: [actor], surfaces: [] },
    actors: [{ playerId: actor.playerId, profile }], surfaces: [] }, actors: [actor],
    commands: [{ playerId: actor.playerId, role: 'glove', acceleration: v() }] };
};
