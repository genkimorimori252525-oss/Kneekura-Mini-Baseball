import { actualLivePlayClosureEvidenceFromSqlite } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualRoleWorkloadEvidenceFromSqlite } from './ActualRoleWorkloadEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertActualLiveReadyEffects, type ActualLiveReadinessScope, type ActualLiveReadinessReference } from './ActualLivePlayReadiness';
import type { ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** Readiness is a connection of independently owned effects. Unsupported official
 * scoring is retained and is never used as a substitute workload/setup authority. */
export const actualLivePlayReadinessFromSqlite = (db: ActualAdjudicationDb) => {
  const read = (closureSourceId: string, currentHeads: boolean) => {
    const closure = actualLivePlayClosureEvidenceFromSqlite(db).read(closureSourceId);
    if (!closure) throw new Error('actual live readiness closure is missing');
    if (!closure.officialApplied || !closure.result) return freeze({ kind: 'pending' as const, reason: 'official_application_pending' as const, closureSourceId });
    const p = closure.proposal, settlement = actualRoleWorkloadEvidenceFromSqlite(db).readSettlement(closureSourceId);
    if (settlement.kind !== 'complete') return freeze({ kind: 'pending' as const, reason: 'actual_role_workload_pending' as const, closureSourceId, settlement });
    const first = p.actors[0].binding;
    const scope: ActualLiveReadinessScope = { closureSourceId, closureApplicationId: p.application.applicationId, closureProposalHash: hash(p),
      careerId: first.careerId, gameId: p.gameId, playId: p.playId, gameDay: first.gameDay,
      physicalEndReference: p.physicalEndReference, wholeHistoryReference: p.wholeHistoryReference,
      actors: p.actors.map(a => ({ playerId: a.binding.playerId, personId: a.person.personId, clubId: a.binding.clubId,
        personLinkSourceId: a.binding.personLinkSourceId })) };
    const current = currentHeads ? scope.actors.map(a => {
      const head = readActualRoleWorkloadState(db, scope.careerId, a.playerId, undefined, a.personLinkSourceId);
      if (!head) throw new Error('actual live readiness current workload head missing');
      return head;
    }) : settlement.participants.map(p => p.after);
    assertActualLiveReadyEffects(scope, { ...settlement, kind: 'complete' }, current);
    // Stable original effects only: later authorized recovery cannot rewrite a frozen actor's origin.
    const reference: ActualLiveReadinessReference = { version: 'actual_live_next_play_readiness_v1' as const, closureSourceId, applicationId: p.application.applicationId,
      gameId: p.gameId, previousPlayId: p.playId, closureProposalHash: hash(p), settlementHash: hash(settlement),
      controllerResetHash: hash(p.controllerReset), physicalEndReference: p.physicalEndReference, wholeHistoryReference: p.wholeHistoryReference };
    return freeze({ kind: 'ready' as const, closure, settlement, reference });
  };
  return { read: (sourceId: string) => read(sourceId, true), readHistorical: (sourceId: string) => read(sourceId, false) };
};
