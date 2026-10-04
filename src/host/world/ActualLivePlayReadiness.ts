import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { ActualRolePhysicalEndReference, ActualRoleWholeHistoryReference } from './ActualRoleWorkloadAssessment';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type ActualLiveReadinessScope = Readonly<{ closureSourceId: string; closureApplicationId: string; closureProposalHash: string;
  careerId: string; gameId: string; playId: number; gameDay: number;
  physicalEndReference: ActualRolePhysicalEndReference; wholeHistoryReference: ActualRoleWholeHistoryReference;
  actors: readonly Readonly<{ playerId: string; personId: string; clubId: string; personLinkSourceId: string }>[] }>;
export type ActualLiveReadinessReference = Readonly<{ version: 'actual_live_next_play_readiness_v1'; closureSourceId: string; applicationId: string;
  gameId: string; previousPlayId: number; closureProposalHash: string; settlementHash: string; controllerResetHash: string;
  physicalEndReference: ActualRolePhysicalEndReference; wholeHistoryReference: ActualRoleWholeHistoryReference }>;
type Settlement = Omit<ActualLiveReadinessScope, 'actors'> & Readonly<{ kind: 'complete';
  participants: readonly Readonly<{ playerId: string; personId: string; clubId: string; after: PlayerWorkloadRecoveryState; applied: boolean }>[] }>;
/** Pure binding check only; Native authenticates all archived effects and current heads. */
export const assertActualLiveReadyEffects = (rawScope: ActualLiveReadinessScope, rawSettlement: Settlement,
  rawCurrent: readonly PlayerWorkloadRecoveryState[]): void => {
  const scope = cloneInert(rawScope), settlement = cloneInert(rawSettlement), current = cloneInert(rawCurrent);
  const { actors, ...expected } = scope;
  if (settlement.kind !== 'complete' || Object.entries(expected).some(([key, value]) =>
    json(settlement[key as keyof Settlement]) !== json(value))) throw new Error('actual live readiness settlement scope differs');
  if (actors.length !== 10 || new Set(actors.map(a => a.playerId)).size !== 10 || new Set(actors.map(a => a.personId)).size !== 10
    || settlement.participants.length !== actors.length || new Set(settlement.participants.map(p => p.playerId)).size !== actors.length
    || settlement.participants.some(p => !p.applied || !actors.some(a => a.playerId === p.playerId && a.personId === p.personId && a.clubId === p.clubId)
      || p.after.playerId !== p.playerId || p.after.careerId !== scope.careerId)) throw new Error('actual live readiness participants differ');
  if (current.length !== actors.length || new Set(current.map(s => s.playerId)).size !== actors.length) throw new Error('actual live readiness current head membership differs');
  for (const participant of settlement.participants) {
    const head = current.find(s => s.playerId === participant.playerId);
    if (!head || head.careerId !== scope.careerId || head.effectiveDay > scope.gameDay || head.revision < participant.after.revision
      || head.revision === participant.after.revision && json(head) !== json(participant.after)) throw new Error('actual live readiness current head differs');
  }
};
