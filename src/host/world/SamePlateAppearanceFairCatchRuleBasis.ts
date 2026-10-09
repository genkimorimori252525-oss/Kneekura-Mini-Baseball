import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameplayRuling } from '../../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { SamePaStationaryOccupiedRunners } from './SamePlateAppearanceStationaryOccupiedRunners';
import { validateActualFairCatchStationaryRunners } from '../../core/adjudication/ActualFairCatchScoring';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';

/** Correct-rule input only. The Native reader authenticates the original match,
 * timeline and complete physical prefix together. This cannot supply an umpire
 * action, reception, producer completion, physical end or official closure. */
export const deriveSamePaFairCatchRuleBasis = (raw: Readonly<{
  originalMatch: CanonicalMatchState;
  originalTimeline: CanonicalPlateAppearanceTimeline;
  evidence: ReturnType<typeof deriveSamePaFieldRuleEvidence>;
  occupiedRunners?: SamePaStationaryOccupiedRunners;
}>) => {
  const { originalMatch: match, originalTimeline: timeline, evidence, occupiedRunners } = cloneInert(raw);
  const ball = evidence.physical.field.evidence, rule = evidence.rule;
  if (match.playId !== timeline.playId || !Number.isSafeInteger(match.outs) || match.outs < 0 || match.outs > 2
    || timeline.status.kind !== 'batted_ball_pending' || timeline.status.contactTick !== ball.originTick
    || timeline.lastEventTick !== ball.originTick || timeline.events.at(-1)?.kind !== 'BatBallContact'
    || timeline.events.at(-1)?.tick !== ball.originTick) throw new Error('same-PA fair catch original contact scope differs');
  if (Object.values(match.bases).some(playerId => playerId !== null) && !occupiedRunners)
    return freeze({ kind: 'pending' as const, reason: 'occupied_runner_original_base_contact_history_required' as string });
  validateActualFairCatchStationaryRunners({ originalMatch: match, batterRunnerId: ball.batterRunnerId,
    originTick: ball.originTick, ticksPerSecond: ball.ticksPerSecond, endElapsedSeconds: ball.horizon.elapsedSeconds, occupiedRunners });
  if (rule.ballEvidence.kind !== 'fly_catch' || rule.fieldTerritory.kind !== 'resolved'
    || rule.fieldTerritory.territory !== 'fair') return freeze({ kind: 'pending' as const, reason: 'actual_fair_catch_required' as string });
  const caught = rule.ballEvidence.correctRuleResult;
  if (!rule.ballDecisionMoment || caught.batterRunnerId !== ball.batterRunnerId
    || caught.outTick !== rule.ballDecisionMoment.ball.tick) throw new Error('same-PA fair catch rule chronology differs');
  const correctRuling: OfficialGameplayRuling = { outsAfter: match.outs + 1,
    basesAfter: { ...match.bases }, scoredRunnerIds: [] };
  return freeze({ kind: 'same_pa_fair_catch_rule_basis_v1' as const, batterRunnerId: ball.batterRunnerId,
    catchMoment: rule.ballDecisionMoment, territoryMoment: rule.fieldTerritory.moment, correctRuling,
    pendingContacts: rule.pendingContacts, pendingPossession: rule.possessionEvidence.pending,
    physicalEnd: null, operativeCall: null });
};
