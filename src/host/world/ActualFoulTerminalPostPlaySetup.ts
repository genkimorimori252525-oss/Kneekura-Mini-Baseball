import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { foulOfficialDigest as digest } from './ActualFoulOfficialSource';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type FoulTerminalPostPlayReference = Readonly<{
  owner: 'actual_foul_terminal_applications'; sourceId: string; sourceVersion: string; sourceHash: string; proposalHash: string;
}>;
/** Explicit accepted setup syntax only. This carries no physical, scoring,
 * workload, retirement, or next-play result authority. */
export type AcceptedFoulTerminalPostPlaySetup = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_foul_terminal_post_play_setup_v1';
  terminalReference: FoulTerminalPostPlayReference; nextStartedAtTick: number;
  worldSetup: BetweenPlayWorldSetup; controllerReset: 'rule_system_retire_original_play';
}>;
export type FoulTerminalPostPlaySetupAuthority = Readonly<{
  readAcceptedPostPlaySetup(sourceId: string): unknown;
}>;
const point = (value: { x: number; z: number }): boolean => fields(value, ['x','z'])
  && Number.isFinite(value.x) && Number.isFinite(value.z);
const positions = ['P','C','1B','2B','3B','SS','LF','CF','RF'] as const;

/** Capture before reading any property. Syntactically empty old-controller
 * IDs do not prove retirement: the completion owner must independently derive
 * that authority from the authentic original physical cut before activation. */
export const actualFoulTerminalPostPlaySetupInput = (raw: unknown, sourceId: string): AcceptedFoulTerminalPostPlaySetup => {
  const source = cloneInert(raw) as AcceptedFoulTerminalPostPlaySetup;
  if (!fields(source, ['sourceId','sourceVersion','capability','terminalReference','nextStartedAtTick','worldSetup','controllerReset'])
    || source.sourceId !== sourceId || ![sourceId,source.sourceVersion].every(id)
    || source.capability !== 'actual_foul_terminal_post_play_setup_v1'
    || source.controllerReset !== 'rule_system_retire_original_play'
    || !Number.isSafeInteger(source.nextStartedAtTick) || source.nextStartedAtTick < 0) {
    throw new Error('invalid accepted foul terminal post-play setup Source');
  }
  const reference = source.terminalReference;
  if (!fields(reference, ['owner','sourceId','sourceVersion','sourceHash','proposalHash'])
    || reference.owner !== 'actual_foul_terminal_applications' || ![reference.sourceId,reference.sourceVersion].every(id)
    || ![reference.sourceHash,reference.proposalHash].every(digest)) {
    throw new Error('invalid foul terminal post-play setup terminal reference');
  }
  const setup = source.worldSetup;
  if (!fields(setup, ['baseCenters','defenders','activePreviousPlayControllerIds'])
    || !fields(setup.baseCenters, ['first','second','third']) || !Object.values(setup.baseCenters).every(point)
    || !Array.isArray(setup.defenders) || setup.defenders.some(defender => !fields(defender, ['playerId','registeredPosition','position'])
      || !id(defender.playerId) || !positions.includes(defender.registeredPosition) || !point(defender.position))
    || !Array.isArray(setup.activePreviousPlayControllerIds) || setup.activePreviousPlayControllerIds.length !== 0) {
    throw new Error('invalid foul terminal post-play world setup');
  }
  return freeze(source);
};
