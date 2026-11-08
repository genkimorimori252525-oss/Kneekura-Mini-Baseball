import type { DurableBattedWorldContact } from './SqliteBattedWorldContactStore';
import { assertLegacyBallPhysicsConsumer } from '../../core/sim/ball/VersionedBattedBallPhysics';

/** The original-contact observation seam grants no downstream field/rule/renewal capability. */
export const assertSupportedBattedWorldConsumer = (world: DurableBattedWorldContact, consumer: string): void => {
  if (world.flight?.source) assertLegacyBallPhysicsConsumer(world.flight.source.sourceVersion, world.flight.source.execution.ballPhysics, consumer);
  const frame = world.flight?.physicalPitch?.frame;
  if (world.source?.kind === 'owned_runner_contact_v1' || frame?.prePitchRunner
    || world.flight?.physicalPitch?.source?.prePitchRunner || frame?.world?.runners?.length
    || Object.values(frame?.match?.bases ?? {}).some(playerId => playerId !== null)) {
    throw new Error(`unsupported original pre-pitch runner consumer: ${consumer}`);
  }
};
