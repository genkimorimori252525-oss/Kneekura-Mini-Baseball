import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type AcceptedActualLivePlayClosure = Readonly<{ sourceId: string; sourceVersion: string; adjudicationSourceId: string;
  applicationId: string; closureTick: number; nextStartedAtTick: number;
  controllerReset: 'rule_system_retire_original_play'; worldSetup: BetweenPlayWorldSetup }>;
const tick = (v: number) => Number.isSafeInteger(v) && v >= 0;
const point = (v: { x: number; z: number }) => fields(v, ['x', 'z']) && Number.isFinite(v.x) && Number.isFinite(v.z);
export const actualLivePlayClosureInput = (raw: AcceptedActualLivePlayClosure, sourceId: string): AcceptedActualLivePlayClosure => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'adjudicationSourceId', 'applicationId', 'closureTick', 'nextStartedAtTick', 'controllerReset', 'worldSetup'])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.adjudicationSourceId, s.applicationId].every(id)
    || !tick(s.closureTick) || !tick(s.nextStartedAtTick) || s.nextStartedAtTick < s.closureTick
    || s.controllerReset !== 'rule_system_retire_original_play'
    || !fields(s.worldSetup, ['baseCenters', 'defenders', 'activePreviousPlayControllerIds'])
    || !Array.isArray(s.worldSetup.activePreviousPlayControllerIds) || s.worldSetup.activePreviousPlayControllerIds.length
    || !fields(s.worldSetup.baseCenters, ['first', 'second', 'third']) || !Object.values(s.worldSetup.baseCenters).every(point)
    || !Array.isArray(s.worldSetup.defenders) || s.worldSetup.defenders.some(d => !fields(d, ['playerId', 'registeredPosition', 'position'])
      || !id(d.playerId) || !point(d.position))) throw new Error('invalid accepted actual live closure/setup Source');
  return freeze(s);
};
