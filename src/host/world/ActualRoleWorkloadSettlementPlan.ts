import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { advancePlayerWorkloadRecovery, type PlayerWorkloadActivity, type PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type ActualRoleSettlementActor = Readonly<{ playerId: string; personId: string; clubId: string }>;
export type ActualRoleSettlementAssessment = Readonly<{ assessmentSourceId: string; playerId: string; activity: Extract<PlayerWorkloadActivity,{kind:'MATCH'}> }>;
/** Pure calculation after Native authenticates all owners. Captured states are
 * explicitly settlement-time states, never retrospectively labelled play-start. */
export const prepareActualRoleWorkloadSettlement = (rawActors: readonly ActualRoleSettlementActor[], rawAssessments: readonly ActualRoleSettlementAssessment[],
  rawStates: readonly PlayerWorkloadRecoveryState[]) => {
  const actors = cloneInert(rawActors), assessments = cloneInert(rawAssessments), states = cloneInert(rawStates);
  if (!actors.length || new Set(actors.map(p=>p.playerId)).size !== actors.length || new Set(actors.map(p=>p.personId)).size !== actors.length
    || new Set(assessments.map(p=>p.playerId)).size !== assessments.length || new Set(states.map(p=>p.playerId)).size !== states.length
    || assessments.some(p=>!actors.some(a=>a.playerId===p.playerId) || p.activity.playerId !== p.playerId || p.activity.kind !== 'MATCH')
    || states.some(p=>!actors.some(a=>a.playerId===p.playerId))) throw new Error('actual role workload participant/assessment membership differs');
  const missingAssessments = actors.filter(p=>!assessments.some(a=>a.playerId===p.playerId)).map(p=>p.playerId);
  const missingBaselines = actors.filter(p=>!states.some(s=>s.playerId===p.playerId)).map(p=>p.playerId);
  if (missingAssessments.length || missingBaselines.length) return freeze({ kind: 'pending' as const, missingAssessments, missingBaselines });
  return freeze({ kind: 'frozen' as const, capturedAt: 'settlement_freeze' as const, participants: actors.map(actor=>{
    const a = assessments.find(v=>v.playerId===actor.playerId)!, before = states.find(v=>v.playerId===actor.playerId)!;
    return { ...actor, ...a, before, after: advancePlayerWorkloadRecovery(before,before.revision,a.activity) };
  }) });
};
