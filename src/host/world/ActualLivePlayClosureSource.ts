import type { GameCompletionPolicy } from '../../core/world/competition/OfficialGameCompletion';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLiveFinalScoringInput, type AcceptedActualLiveFinalScoring } from './ActualLiveFinalScoringSource';
export type ActualLivePostPlayReviewReference = Readonly<{
  sessionSourceId: string; revision: number; headSourceId: string; headHash: string;
}>;
type Common = Readonly<{ sourceId: string; sourceVersion: string; adjudicationSourceId: string;
  applicationId: string; closureTick: number; controllerReset: 'rule_system_retire_original_play';
  postPlayReviewReference?: ActualLivePostPlayReviewReference }>;
export type AcceptedActualLivePlayClosure = Common & (
  | Readonly<{ nextStartedAtTick: number; worldSetup: BetweenPlayWorldSetup; gamePolicy?: GameCompletionPolicy; finalScoring?: never }>
  | Readonly<{ nextStartedAtTick: null; worldSetup: null; gamePolicy: GameCompletionPolicy; finalScoring?: AcceptedActualLiveFinalScoring }>
);
const tick = (v: number) => Number.isSafeInteger(v) && v >= 0;
const point = (v: { x: number; z: number }) => fields(v, ['x', 'z']) && Number.isFinite(v.x) && Number.isFinite(v.z);
export const actualLivePlayClosureInput = (raw: AcceptedActualLivePlayClosure, sourceId: string): AcceptedActualLivePlayClosure => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'adjudicationSourceId', 'applicationId', 'closureTick', 'nextStartedAtTick', 'controllerReset', 'worldSetup',
    ...(Object.hasOwn(s, 'gamePolicy') ? ['gamePolicy'] : []), ...(Object.hasOwn(s, 'finalScoring') ? ['finalScoring'] : []),
    ...(Object.hasOwn(s, 'postPlayReviewReference') ? ['postPlayReviewReference'] : [])])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.adjudicationSourceId, s.applicationId].every(id)
    || !tick(s.closureTick) || s.controllerReset !== 'rule_system_retire_original_play') throw new Error('invalid accepted actual live closure/setup Source');
  if (Object.hasOwn(s, 'postPlayReviewReference')) {
    const reference = s.postPlayReviewReference;
    if (!fields(reference, ['sessionSourceId', 'revision', 'headSourceId', 'headHash'])
      || !id(reference!.sessionSourceId) || !id(reference!.headSourceId) || !tick(reference!.revision)
      || typeof reference!.headHash !== 'string' || !/^[a-f0-9]{64}$/.test(reference!.headHash)) {
      throw new Error('invalid accepted post-play review closure reference');
    }
  }
  if (Object.hasOwn(s, 'gamePolicy') && (!fields(s.gamePolicy, ['version', 'minimumInnings', 'tiesAllowed',
    ...(s.gamePolicy && Object.hasOwn(s.gamePolicy, 'maximumInnings') ? ['maximumInnings'] : [])])
    || !id(s.gamePolicy!.version))) throw new Error('invalid accepted actual live game policy');
  if (s.worldSetup === null) {
    if (s.nextStartedAtTick !== null || !s.gamePolicy) throw new Error('actual live final closure requires explicit policy without a next setup');
    if (Object.hasOwn(s, 'finalScoring')) return freeze({ ...s, finalScoring: actualLiveFinalScoringInput(s.finalScoring!) });
    return freeze(s);
  }
  if (Object.hasOwn(s, 'finalScoring') || !tick(s.nextStartedAtTick) || s.nextStartedAtTick < s.closureTick
    || !fields(s.worldSetup, ['baseCenters', 'defenders', 'activePreviousPlayControllerIds'])
    || !Array.isArray(s.worldSetup.activePreviousPlayControllerIds) || s.worldSetup.activePreviousPlayControllerIds.length
    || !fields(s.worldSetup.baseCenters, ['first', 'second', 'third']) || !Object.values(s.worldSetup.baseCenters).every(point)
    || !Array.isArray(s.worldSetup.defenders) || s.worldSetup.defenders.some(d => !fields(d, ['playerId', 'registeredPosition', 'position'])
      || !id(d.playerId) || !point(d.position))) throw new Error('invalid accepted actual live closure/setup Source');
  return freeze(s);
};
