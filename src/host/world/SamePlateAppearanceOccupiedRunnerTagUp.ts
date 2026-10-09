import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRunnerBaseFactsFromBallWorldHistory } from '../../core/rules/BallWorldBaseContactPhysicalAdapter';
import { createFlyBallFirstFielderTouchFact } from '../../core/rules/PhysicalRuleFacts';
import { evaluateBallWorldTagUpCompliance } from '../../core/rules/BallWorldTagUpCompliance';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import type { DurableSamePaOccupiedRunnerHold } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const bases = ['first', 'second', 'third'] as const;
const baseNumber = { first: 1, second: 2, third: 3 } as const;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('occupied tag-up original evidence differs'); };
const pending = (reason: string) => ({ kind: 'pending' as const, reason });

/** Native authenticates original Match, holds and the complete physical prefix
 * together. This read projection preserves physical events and invokes existing
 * exact-history compliance without discarding physical ordering at quantization.
 * It never supplies an appeal, controller response, official ruling or PlayEnd. */
export const deriveSamePaOccupiedRunnerTagUp = (raw: Readonly<{
  match: CanonicalMatchState; root: SamePaPhysicalFieldRoot; holds: readonly DurableSamePaOccupiedRunnerHold[];
  evidence: ReturnType<typeof deriveSamePaFieldRuleEvidence>; fields: readonly Field[];
}>) => {
  const { match, root, holds, evidence, fields } = cloneInert(raw), ball = evidence.physical.field.evidence;
  const occupied = bases.filter(base => match.bases[base] !== null), histories = evidence.occupiedRunnerBaseContacts;
  if (!occupied.length || occupied.length !== holds.length || !histories || histories.length !== occupied.length
    || new Set(holds.map(h => h.source.playerId)).size !== occupied.length
    || new Set(histories.map(h => h.playerId)).size !== occupied.length || !fields.length
    || root.kind !== 'same_pa_physical_field_root_v1') throw new Error('occupied tag-up exact original membership missing');
  same(fields[0], root); same(fields.at(-1)!.field.motion.world.moment, ball.horizon);
  same(ball.originTick, root.response.world.flight.initialBall.tick); same(ball.ticksPerSecond, root.response.world.parameters.ticksPerSecond);
  const firstFrame = ball.contacts.find(f => f.contacts.some(c => c.kind === 'actor' && ball.defenderIds.includes(c.playerId)));
  const firstContact = firstFrame?.contacts.length === 1 ? firstFrame.contacts[0] : null;
  const firstFielderTouch = firstFrame && firstContact?.kind === 'actor' && ball.defenderIds.includes(firstContact.playerId) ? (() => {
    const source = fields.find(f => f.field.motion.world.kind === 'boundary'
      && json(f.field.motion.world.moment) === json(firstFrame.moment)
      && f.field.motion.world.contacts.some(c => c.kind === 'actor' && c.playerId === firstContact.playerId && c.role === firstContact.role));
    if (!source) throw new Error('occupied tag-up original first-fielder physical contact missing');
    return { fieldReference: reference(source.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', source),
      moment: firstFrame.moment, fact: createFlyBallFirstFielderTouchFact(firstContact.playerId, firstFrame.moment.ball.tick) };
  })() : null;
  const caught = evidence.rule.ballEvidence;
  if (caught.kind === 'fly_catch') {
    if (!firstFielderTouch) throw new Error('occupied tag-up caught first-fielder contact is ambiguous');
    same(caught.firstFielderTouch, { fielderId: firstFielderTouch.fact.fielderId, tick: firstFielderTouch.fact.tick,
      ballCenter: firstFielderTouch.moment.ball.position });
  }
  const runners = occupied.map(startingBase => {
    const playerId = match.bases[startingBase]!, hold = holds.find(h => h.source.playerId === playerId), original = histories.find(h => h.playerId === playerId);
    if (!hold || !original || hold.startingBase !== baseNumber[startingBase] || hold.body.actor.playerId !== playerId
      || hold.body.actor.personId !== hold.source.personId || playerId === ball.batterRunnerId
      || hold.source.coverageThroughTick < ball.horizon.ball.tick) throw new Error('occupied tag-up original runner, base or body differs');
    same(hold.source.enrollmentReference, root.lineage.enrollmentReference);
    const bag = root.geometry.baseGeometry.bases[startingBase]; same(hold.setup.position, bag.region.center);
    for (const segment of evidence.physical.segments) {
      const actors = segment.actors.filter(a => a.playerId === playerId);
      if (actors.length !== 5 || new Set(actors.map(a => a.primitive.role)).size !== 5
        || actors.some(a => hold.body.actor.primitives.find(p => p.role === a.primitive.role)?.radius !== a.primitive.radius))
        throw new Error('occupied tag-up original five-part body differs');
    }
    const history = deriveBallWorldPlayerBaseContactHistory({ segments: evidence.physical.segments, playerId,
      base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
    same(original.bases.find(b => b.base === startingBase)?.history, history);
    if (history.originTick !== ball.originTick || history.ticksPerSecond !== ball.ticksPerSecond
      || history.startElapsedSeconds !== 0 || history.endElapsedSeconds !== ball.horizon.elapsedSeconds)
      throw new Error('occupied tag-up original base history coverage differs');
    const physicalRuleFacts = createRunnerBaseFactsFromBallWorldHistory({ history, base: startingBase });
    // Earlier excursions remain in history. Only the latest actual departure
    // and its actual subsequent origin-base touch form this current pair.
    let departureIndex = -1;
    history.events.forEach((event, index) => { if (event.kind === 'departure') departureIndex = index; });
    const departure = departureIndex < 0 ? null : history.events[departureIndex];
    const retouch = departure === null ? null : history.events.slice(departureIndex + 1).find(e => e.kind === 'touch') ?? null;
    const compliance = caught.kind !== 'fly_catch' || !firstFielderTouch
      ? pending('actual_fly_catch_first_touch_required')
      : evaluateBallWorldTagUpCompliance({ history, originBase: startingBase,
        firstTouch: { fact: firstFielderTouch.fact, originTick: firstFielderTouch.moment.originTick,
          elapsedSeconds: firstFielderTouch.moment.elapsedSeconds } });
    return { playerId, personId: hold.source.personId, startingBase, holdReference: reference('world_same_pa_occupied_runner_holds', hold),
      history, physicalRuleFacts, departure, retouch, compliance };
  });
  return freeze({ kind: 'same_pa_occupied_runner_tag_up_evidence_v1' as const, physicalPitchSourceId: root.physicalPitchSourceId,
    evaluatedThrough: { originTick: ball.originTick, elapsedSeconds: ball.horizon.elapsedSeconds, tick: ball.horizon.ball.tick },
    firstFielderTouch, runners, appeal: pending('original_defensive_appeal_action_required'), physicalEnd: null, officialRuling: null });
};
