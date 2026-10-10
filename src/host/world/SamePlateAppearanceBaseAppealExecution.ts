import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallWorldAppealComplianceEvidence } from '../../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { createControlledRunnerTagFact, createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../../core/rules/PhysicalRuleFacts';
import { evaluateBallWorldTagUpCompliance } from '../../core/rules/BallWorldTagUpCompliance';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import type { BallWorldFieldBoundaryContact, BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { deriveBallWorldPlayerBaseContactHistory, type BallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import { findAcceleratedSphereContactSeconds } from '../../core/sim/collision/AcceleratedSphereContact';
import { samplePiecewiseFieldActor, validatePiecewiseFieldActors } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
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
  'defender_decision_v1', 'defender_motion_v1', 'defender_catch_response_v1', 'batter_run_motion_v1', 'batter_recovery_motion_v1',
  'batter_catch_response_v1', 'batter_catch_motion_v1', 'occupied_runner_motion_v1',
  'occupied_runner_catch_response_v1', 'occupied_runner_catch_motion_v1']);

/** Physical qualification only, not an authenticated or persisted execution.
 * Native owns original participants, indication delivery, the current cut, and
 * absence of intervening official/time/appeal actions. This bounded original
 * fair-catch prefix admits no throw or unresolved/dead-ball contact. PlayEnd is
 * never used as live-ball evidence. Existing contact plus indicated intent needs
 * no invented movement or latency (OBR 5.09(c)(1), Comment, and TAG definition). */
type AppealInput = Readonly<{
  indication: Readonly<{ defenderId: string; runnerId: string; base: Base }>;
  match: CanonicalMatchState; root: SamePaPhysicalFieldRoot; fields: readonly Field[];
  evidence: ReturnType<typeof deriveSamePaFieldRuleEvidence>;
}>;
type ContactInput = Readonly<{ input: AppealInput; motion: Field['field']['motion']; horizon: BallWorldMoment;
  defenderHistory: BallWorldPlayerBaseContactHistory }>;
// The callbacks are fixed by the two exports below; accepted inputs never
// select a contact kernel or supply a custody/contact result.
const deriveSamePaAppealExecution = <Contact extends object>(raw: AppealInput, missingContact: string,
  contactAtCut: (input: ContactInput) => Contact | null) => {
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
    return pending(missingContact);
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
  if (!currentControl) return pending(missingContact);
  const contact = contactAtCut({ input: { indication, match, root, fields, evidence }, motion, horizon, defenderHistory });
  if (!contact) return pending(missingContact);
  const complianceEvidence: BallWorldAppealComplianceEvidence = { kind: 'ball_world_tag_up_history_v1', history,
    originBase: indication.base, firstTouch };
  const compliance = evaluateBallWorldTagUpCompliance(complianceEvidence);
  if (compliance.kind === 'pending') return pending(compliance.reason);
  const moment = { originTick: ball.originTick, elapsedSeconds: horizon.elapsedSeconds, tick: horizon.ball.tick };
  return freeze({ kind: 'ready' as const, attempt: createDefensiveAppealAttemptFact(indication.defenderId, indication.runnerId,
    baseNumber[indication.base], 'tag_up_early_departure', moment.tick), moment, complianceEvidence, compliance,
    physicalPitchSourceId: root.physicalPitchSourceId, fieldRootReference: fieldReference(root), fieldReference: fieldReference(final),
    firstFielderTouchReference: fieldReference(firstSource), firstFielderTouchMoment: firstFrame.moment,
    ...contact, currentControl,
    livePrefixBasis: 'original_uninterrupted_fair_catch_v1' as const });
};

/** The original base-contact shape remains byte-compatible in canonical archives. */
export const deriveSamePaBaseAppealExecution = (raw: AppealInput) => deriveSamePaAppealExecution(raw,
  'current_defender_controlled_base_contact_required', ({ defenderHistory, horizon }) => {
    if (!defenderHistory.contactAtHorizon) return null;
    const contacts = findBallWorldControlledBaseContacts({ history: defenderHistory,
      controlWindows: [{ startElapsedSeconds: horizon.elapsedSeconds, endElapsedSeconds: horizon.elapsedSeconds, endInclusive: true }] });
    return contacts.length === 1 ? { defenderHistory, currentContact: contacts[0] } : null;
  });

/** A tag of the runner uses the actual ball-holding glove, not any limb of a
 * defender who happens to possess the ball. The existing exact kernel checks
 * only the owned instant; an earlier or forecast contact cannot execute intent. */
export const deriveSamePaRunnerBodyAppealExecution = (raw: AppealInput) => deriveSamePaAppealExecution(raw,
  'current_defender_controlled_runner_body_contact_required', ({ input, motion, horizon }) => {
    validatePiecewiseFieldActors(input.root.response, horizon, motion.actors);
    const gloveActor = motion.actors.find((a: BallWorldMotionActor) => a.playerId === input.indication.defenderId && a.primitive.role === 'glove');
    const bodyActor = motion.actors.find((a: BallWorldMotionActor) => a.playerId === input.indication.runnerId && a.primitive.role === 'body');
    if (!gloveActor || !bodyActor) throw new Error('runner-body appeal original contact primitives missing');
    const glove = { playerId: gloveActor.playerId, role: 'glove' as const, radius: gloveActor.primitive.radius,
      ...samplePiecewiseFieldActor(gloveActor, horizon) };
    const runnerBody = { playerId: bodyActor.playerId, role: 'body' as const, radius: bodyActor.primitive.radius,
      ...samplePiecewiseFieldActor(bodyActor, horizon) };
    const contact = findAcceleratedSphereContactSeconds({ tick: horizon.ball.tick, center: glove.center,
      velocity: glove.velocity, acceleration: gloveActor.primitive.acceleration, radius: glove.radius },
    { tick: horizon.ball.tick, center: runnerBody.center, velocity: runnerBody.velocity,
      acceleration: bodyActor.primitive.acceleration, radius: runnerBody.radius }, 0, 'include');
    if (contact === null) return null;
    return { runnerBodyContact: { kind: 'controlled_runner_body_tag_v1' as const,
      fact: createControlledRunnerTagFact(glove.playerId, runnerBody.playerId, horizon.ball.tick), glove, runnerBody } };
  });
