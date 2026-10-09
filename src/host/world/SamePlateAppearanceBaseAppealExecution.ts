import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallWorldAppealComplianceEvidence } from '../../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../../core/rules/PhysicalRuleFacts';
import { evaluateBallWorldTagUpCompliance } from '../../core/rules/BallWorldTagUpCompliance';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import type { BallWorldFieldBoundaryContact } from '../../core/sim/ball/BallWorldContinuation';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields, samePaText } from './SamePlateAppearanceWorkPrefix';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Base = 'first' | 'second' | 'third';
const baseNumber = { first: 1, second: 2, third: 3 } as const;
const fieldReference = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('base appeal original physical evidence or cut differs'); };
const pending = (reason: string) => freeze({ kind: 'pending' as const, reason });
// These original field operations describe physical motion, capture and observed
// responses only. Neither a throw attempt nor another adjudication is admitted.
const supportedActions = new Set(['capture_checkpoint_v1', 'retained_quantizer_checkpoint_v1', 'defender_observation_v1',
  'defender_decision_v1', 'defender_motion_v1', 'defender_catch_response_v1', 'batter_run_motion_v1',
  'batter_catch_response_v1', 'batter_catch_motion_v1', 'occupied_runner_motion_v1',
  'occupied_runner_catch_response_v1', 'occupied_runner_catch_motion_v1']);

/** Physical qualification only, not an authenticated or persisted execution.
 * Native owns original participants, indication delivery, the current cut, and
 * absence of intervening official/time/appeal actions. This bounded original
 * fair-catch prefix admits no throw or unresolved/dead-ball contact. PlayEnd is
 * never used as live-ball evidence. Existing contact plus indicated intent needs
 * no invented movement or latency (OBR 5.09(c)(1), Comment, and TAG definition). */
export const deriveSamePaBaseAppealExecution = (raw: Readonly<{
  indication: Readonly<{ defenderId: string; runnerId: string; base: Base }>;
  match: CanonicalMatchState; root: SamePaPhysicalFieldRoot; fields: readonly Field[];
  evidence: ReturnType<typeof deriveSamePaFieldRuleEvidence>;
}>) => {
  const { indication, match, root, fields, evidence } = cloneInert(raw);
  const ball = evidence?.physical?.field?.evidence;
  if (!samePaFields(indication, ['defenderId', 'runnerId', 'base']) || !samePaText(indication.defenderId)
    || !samePaText(indication.runnerId) || !Object.hasOwn(baseNumber, indication.base)
    || !ball || !root || root.kind !== 'same_pa_physical_field_root_v1' || !Array.isArray(fields) || !fields.length
    || match.bases[indication.base] !== indication.runnerId || !ball.defenderIds.includes(indication.defenderId)
    || root.timeline.playId !== match.playId || root.lineage.playId !== match.playId
    || !Number.isSafeInteger(match.outs) || match.outs < 0 || match.outs > 2)
    throw new Error('base appeal original membership or scope differs');
  same(fields[0], root);
  const occupied = Object.values(match.bases).filter((id): id is string => id !== null);
  if (new Set([ball.batterRunnerId, ...ball.defenderIds, ...occupied]).size !== 1 + ball.defenderIds.length + occupied.length)
    throw new Error('base appeal original membership is ambiguous');
  for (const f of fields) {
    if (f.kind !== 'same_pa_physical_field_root_v1' && f.kind !== 'same_pa_physical_field_step_v1')
      throw new Error('base appeal original physical prefix differs');
    if (f.timeline.status.kind !== 'batted_ball_pending') return pending('uninterrupted_fair_catch_prefix_required');
    if (f.kind === 'same_pa_physical_field_step_v1') {
      const requested = f.source.action?.kind, executed = f.actionResult?.kind;
      if (requested && !supportedActions.has(requested) || executed && !supportedActions.has(executed))
        return pending('uninterrupted_fair_catch_prefix_required');
      if (requested !== executed) throw new Error('base appeal original action result differs');
    }
  }
  const original = deriveSamePaFieldRuleEvidence({ fields, batterRunnerId: ball.batterRunnerId, defenderIds: ball.defenderIds,
    occupiedRunnerIds: occupied, outsAtStart: match.outs });
  same(evidence, original);
  const final = fields.at(-1)!, motion = final.field.motion, horizon = ball.horizon;
  same(motion.world.moment, horizon);
  if (ball.originTick !== root.response.world.flight.initialBall.tick || ball.ticksPerSecond !== root.response.world.parameters.ticksPerSecond
    || horizon.originTick !== ball.originTick || horizon.ball.tick !== final.evaluationTick
    || quantizeEventTick(ball.originTick, horizon.elapsedSeconds, ball.ticksPerSecond) !== horizon.ball.tick)
    throw new Error('base appeal original clock differs');
  const caught = evidence.rule.ballEvidence;
  if (caught.kind !== 'fly_catch' || evidence.rule.fieldTerritory.kind !== 'resolved'
    || evidence.rule.fieldTerritory.territory !== 'fair') return pending('actual_fair_catch_required');
  const firstFrame = ball.contacts[0], firstContact = firstFrame?.contacts[0];
  if (!firstFrame || firstFrame.contacts.length !== 1 || firstContact?.kind !== 'actor' || firstContact.role !== 'glove'
    || !ball.defenderIds.includes(firstContact.playerId) || ball.contacts.length !== 1
    || evidence.rule.pendingContacts.length || evidence.rule.possessionEvidence.pending.length
    || ball.acquisitions.length !== 1 || ball.acquisitions[0].kind !== 'secured')
    return pending('uninterrupted_fair_catch_prefix_required');
  const firstSource = fields.find(f => f.field.motion.world.kind === 'boundary'
    && json(f.field.motion.world.moment) === json(firstFrame.moment)
    && f.field.motion.world.contacts.some((c: BallWorldFieldBoundaryContact) => c.kind === 'actor' && c.playerId === firstContact.playerId && c.role === firstContact.role));
  if (!firstSource) throw new Error('base appeal original first-fielder physical source missing');
  const firstTouch = { fact: createFlyBallFirstFielderTouchFact(firstContact.playerId, firstFrame.moment.ball.tick),
    originTick: firstFrame.moment.originTick, elapsedSeconds: firstFrame.moment.elapsedSeconds };
  same(caught.firstFielderTouch, { fielderId: firstContact.playerId, tick: firstTouch.fact.tick, ballCenter: firstFrame.moment.ball.position });
  if (!motion.cursor || motion.carrierPlayerId !== indication.defenderId)
    return pending('current_defender_controlled_base_contact_required');
  same(motion.cursor.moment, horizon);
  if (motion.response.kind !== 'carried') throw new Error('base appeal current carried custody differs');
  same(motion.response.cursor, motion.cursor);
  const bag = root.geometry.baseGeometry.bases[indication.base];
  const historyFor = (playerId: string) => deriveBallWorldPlayerBaseContactHistory({ segments: evidence.physical.segments,
    playerId, base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
  const defenderHistory = historyFor(indication.defenderId), history = historyFor(indication.runnerId);
  for (const h of [defenderHistory, history]) if (h.originTick !== ball.originTick || h.ticksPerSecond !== ball.ticksPerSecond
    || h.startElapsedSeconds !== 0 || h.endElapsedSeconds !== horizon.elapsedSeconds) throw new Error('base appeal original contact history clock differs');
  const controlWindows = evidence.physical.controlWindows.filter(w => w.playerId === indication.defenderId)
    .map(({ playerId: _, ...window }) => window);
  // Validate all owned intervals, then intersect the exact current point. The
  // kernel otherwise returns interval starts, which are not execution timestamps.
  findBallWorldControlledBaseContacts({ history: defenderHistory, controlWindows });
  const currentControl = controlWindows.find(w => w.startElapsedSeconds <= horizon.elapsedSeconds
    && (w.endElapsedSeconds > horizon.elapsedSeconds || w.endElapsedSeconds === horizon.elapsedSeconds && w.endInclusive));
  if (!currentControl || !defenderHistory.contactAtHorizon) return pending('current_defender_controlled_base_contact_required');
  const currentContact = findBallWorldControlledBaseContacts({ history: defenderHistory,
    controlWindows: [{ startElapsedSeconds: horizon.elapsedSeconds, endElapsedSeconds: horizon.elapsedSeconds, endInclusive: true }] });
  if (currentContact.length !== 1) return pending('current_defender_controlled_base_contact_required');
  const complianceEvidence: BallWorldAppealComplianceEvidence = { kind: 'ball_world_tag_up_history_v1', history,
    originBase: indication.base, firstTouch };
  const compliance = evaluateBallWorldTagUpCompliance(complianceEvidence);
  if (compliance.kind === 'pending') return pending(compliance.reason);
  const moment = { originTick: ball.originTick, elapsedSeconds: horizon.elapsedSeconds, tick: horizon.ball.tick };
  return freeze({ kind: 'ready' as const, attempt: createDefensiveAppealAttemptFact(indication.defenderId, indication.runnerId,
    baseNumber[indication.base], 'tag_up_early_departure', moment.tick), moment, complianceEvidence, compliance,
    physicalPitchSourceId: root.physicalPitchSourceId, fieldRootReference: fieldReference(root), fieldReference: fieldReference(final),
    firstFielderTouchReference: fieldReference(firstSource), firstFielderTouchMoment: firstFrame.moment,
    defenderHistory, currentControl, currentContact: currentContact[0],
    livePrefixBasis: 'original_uninterrupted_fair_catch_v1' as const });
};
