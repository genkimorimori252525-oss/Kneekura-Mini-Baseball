import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameplayRuling } from '../../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';

/** Correct-rule input only. The Native reader authenticates the original match,
 * timeline and complete physical prefix together. This cannot supply an umpire
 * action, reception, producer completion, physical end or official closure. */
export const deriveSamePaFairCatchRuleBasis = (raw: Readonly<{
  originalMatch: CanonicalMatchState;
  originalTimeline: CanonicalPlateAppearanceTimeline;
  evidence: ReturnType<typeof deriveSamePaFieldRuleEvidence>;
}>) => {
  const { originalMatch: match, originalTimeline: timeline, evidence } = cloneInert(raw);
  const ball = evidence.physical.field.evidence, rule = evidence.rule;
  if (match.playId !== timeline.playId || !Number.isSafeInteger(match.outs) || match.outs < 0 || match.outs > 2
    || Object.values(match.bases).some(runner => runner !== null)
    || timeline.status.kind !== 'batted_ball_pending' || timeline.status.contactTick !== ball.originTick
    || timeline.lastEventTick !== ball.originTick || timeline.events.at(-1)?.kind !== 'BatBallContact'
    || timeline.events.at(-1)?.tick !== ball.originTick) throw new Error('same-PA fair catch original empty-base contact scope differs');
  if (rule.ballEvidence.kind !== 'fly_catch' || rule.fieldTerritory.kind !== 'resolved'
    || rule.fieldTerritory.territory !== 'fair') return freeze({ kind: 'pending' as const, reason: 'actual_fair_catch_required' as const });
  const caught = rule.ballEvidence.correctRuleResult;
  if (!rule.ballDecisionMoment || caught.batterRunnerId !== ball.batterRunnerId
    || caught.outTick !== rule.ballDecisionMoment.ball.tick) throw new Error('same-PA fair catch rule chronology differs');
  const correctRuling: OfficialGameplayRuling = { outsAfter: match.outs + 1,
    basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [] };
  return freeze({ kind: 'same_pa_fair_catch_rule_basis_v1' as const, batterRunnerId: ball.batterRunnerId,
    catchMoment: rule.ballDecisionMoment, territoryMoment: rule.fieldTerritory.moment, correctRuling,
    pendingContacts: rule.pendingContacts, pendingPossession: rule.possessionEvidence.pending,
    physicalEnd: null, operativeCall: null });
};
