import type { DurableBattedWorldContact } from './SqliteBattedWorldContactStore';

/** The original-contact observation seam grants no downstream field/rule/renewal capability. */
export const assertSupportedBattedWorldConsumer = (world: DurableBattedWorldContact, consumer: string): void => {
  const frame = world.flight?.physicalPitch?.frame;
  if (world.source?.kind === 'owned_runner_contact_v1' || frame?.prePitchRunner
    || world.flight?.physicalPitch?.source?.prePitchRunner || frame?.world?.runners?.length
    || Object.values(frame?.match?.bases ?? {}).some(playerId => playerId !== null)) {
    throw new Error(`unsupported original pre-pitch runner consumer: ${consumer}`);
  }
};
