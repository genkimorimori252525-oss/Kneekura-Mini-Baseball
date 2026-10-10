import { deriveSamePaOccupiedRunnerCatchController } from './SamePlateAppearanceOccupiedRunnerCatchController';
import { deriveSamePaRunnerControllerMotion } from './SamePlateAppearanceRunnerControllerMotion';
import type { RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import type { ExactRunnerMotionTrajectory } from '../../core/sim/running/RunnerMotion';
import type { DatabaseSync } from 'node:sqlite';
import { samePaActorProducerPolicyValid, type SamePaActorProducerPolicy } from './SamePlateAppearanceActorProducerPolicy';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaOccupiedRunnerHoldFromSqlite, type DurableSamePaOccupiedRunnerHold } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { samePaCatchCommunicationObservationAt } from './SamePlateAppearanceCatchCommunication';
import { samePaCaughtOutReception } from './SamePlateAppearanceCatchOperativeRuling';
import { readSamePaLifecycleRecordFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaPhysicalTimelineAtField } from './SamePlateAppearancePhysicalFieldCalculation';
import { samePaPhysicalHasThrowRelease } from './SamePlateAppearancePhysicalFieldThrow';
import { samePaBatterRunForeignCoverage } from './SamePlateAppearanceBatterRunCoverage';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaOccupiedRunnerCatchResponseRequest = Readonly<{ kind: 'occupied_runner_catch_response_v1'; member: SamePaDispatchMember;
  catchWorkReference: SamePaReference<'pa_catch_v1_work'>; holdReference: SamePaReference<'world_same_pa_occupied_runner_holds'>;
  intent: Readonly<{ kind: 'hold'; issuedTick: number }>; endTick: number;
  motionBasis?: Readonly<{kind:'occupied_runner_motion_v1';motionReference:StepReference}>;
  provenance: Readonly<{ sourceRecordId: string; sourceVersion: string }>; actorProducerPolicy?: SamePaActorProducerPolicy }>;
export type SamePaOccupiedRunnerCatchResponse = Readonly<{ kind: 'occupied_runner_catch_response_v1'; playerId: string; personId: string;
  catchWorkReference: SamePaReference<'pa_catch_v1_work'>; holdReference: SamePaReference<'world_same_pa_occupied_runner_holds'>;
  callSourceId: string; reception: NonNullable<ReturnType<typeof samePaCaughtOutReception>>;
  intent: SamePaOccupiedRunnerCatchResponseRequest['intent']; reactionTick: number; endTick: number;
  originalHold: DurableSamePaOccupiedRunnerHold;
  motionBasis?: SamePaOccupiedRunnerCatchResponseRequest['motionBasis'];controller?:RouteFollowingController;exactTrajectory?:ExactRunnerMotionTrajectory }>;
const tick = (n: number) => Number.isSafeInteger(n) && n >= 0;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('occupied received hold original binding differs'); };
export const samePaOccupiedRunnerCatchResponseInput = (a: SamePaOccupiedRunnerCatchResponseRequest) => {
  if (!fields(a, ['kind','member','catchWorkReference','holdReference','intent','endTick','provenance',...('actorProducerPolicy' in a?['actorProducerPolicy']:[]),...('motionBasis' in a?['motionBasis']:[])])
    ||'actorProducerPolicy' in a&&!samePaActorProducerPolicyValid(a.actorProducerPolicy)
    ||'motionBasis' in a&&(!fields(a.motionBasis,['kind','motionReference'])||a.motionBasis?.kind!=='occupied_runner_motion_v1'||!ref(a.motionBasis.motionReference,'pa_physical_v1_field_steps'))
    || a.kind !== 'occupied_runner_catch_response_v1' || !samePaDispatchMemberValid(a.member)
    || !ref(a.catchWorkReference, 'pa_catch_v1_work') || !ref(a.holdReference, 'world_same_pa_occupied_runner_holds')
    || !fields(a.intent, ['kind','issuedTick']) || a.intent.kind !== 'hold' || !tick(a.intent.issuedTick) || !tick(a.endTick) || a.endTick <= a.intent.issuedTick
    || !fields(a.provenance, ['sourceRecordId','sourceVersion']) || !Object.values(a.provenance).every(text))
    throw new Error('invalid original occupied received hold Source');
};
/** This accepted input chooses hold. The real received call does not make that
 * choice for the runner, and an original stationary body is not an adoption. */
export const deriveSamePaOccupiedRunnerCatchResponse = (db: DatabaseSync, source: SamePaPhysicalFieldStepSource,
  root: SamePaPhysicalFieldRoot, previous: Field, basis: SamePaLifecycleViewBasis, prefix: readonly Field[]): SamePaOccupiedRunnerCatchResponse => {
  const a = source.action, at = previous.field.motion.world.moment;
  if (a?.kind !== 'occupied_runner_catch_response_v1') throw new Error('occupied received hold Source missing');
  samePaOccupiedRunnerCatchResponseInput(a);
  if (!a.motionBasis && prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'occupied_runner_motion_v1'
    && f.actionResult.playerId === a.member.playerId))
    throw new Error('occupied received hold cannot replace an original moving controller');
  same(a.member, basis.members.find(m => m.playerId === a.member.playerId));
  if (source.throughTick !== previous.evaluationTick || a.intent.issuedTick !== previous.evaluationTick || !previous.field.motion.cursor
    || !a.motionBasis && at.elapsedSeconds !== (a.intent.issuedTick-at.originTick)/root.response.world.parameters.ticksPerSecond)
    throw new Error('occupied received hold requires an exact original physical cut');
  if (prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === a.kind && f.actionResult.playerId === a.member.playerId))
    throw new Error('occupied received hold already owns this runner');
  if(!a.motionBasis){
    const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, source.viewReference, 'historical');
    if (pair.kind !== 'same_pa_field_rule_read_pair_v1' || pair.value.occupiedRunners?.kind !== 'same_pa_stationary_occupied_runners_v1')
      throw new Error('occupied received hold requires original stationary runner history');
    const proof = pair.value.occupiedRunners.runners.find(r => r.playerId === a.member.playerId);
    if (!proof) throw new Error('occupied received hold original runner missing');
    same(proof.holdReference, a.holdReference);
  }
  const hold = readSamePaOccupiedRunnerHoldFromSqlite(db, a.holdReference);
  if (a.endTick > hold.source.coverageThroughTick)
    throw new Error('occupied received hold cannot replace original identity or finite authority');
  same(hold.source.enrollmentReference, root.lineage.enrollmentReference);
  const moving=a.motionBasis?deriveSamePaOccupiedRunnerCatchController(a,root,previous,hold,basis,prefix):null;
  const journal = readSamePaLifecycleRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId);
  if (!journal || journal.kind !== 'same_pa_lifecycle_prefix' || !journal.source.eventReferences.some(r => json(r) === json(a.catchWorkReference)))
    throw new Error('occupied received hold requires an admitted original catch work');
  const work = readSamePaCatchWorkFromSqlite(db, a.catchWorkReference);
  same(work.lineage, root.lineage); same(work.physicalPitchReference, basis.view.cut.physicalPitchReference);
  same(work.communication.evaluatedThrough, { originTick: at.originTick, elapsedSeconds: at.elapsedSeconds, tick: at.ball.tick });
  same(work.physicalOperationReference, basis.view.cut.physicalOperationReference);
  const reception = samePaCaughtOutReception(work.operative, samePaCatchCommunicationObservationAt(work.communication, a.member.playerId, work.communication.evaluatedThrough));
  if (!reception || work.operative.kind !== 'retired' || work.operative.runnerId !== basis.actor.binding.playerId)
    throw new Error('occupied received hold requires actually received original caught OUT');
  const reactionTick = a.intent.issuedTick + hold.model.source.motion.reactionDelayTicks;
  if (!tick(reactionTick) || reactionTick >= a.endTick) throw new Error('occupied received hold has no finite post-reaction coverage');
  return freeze({ kind: a.kind, playerId: a.member.playerId, personId: hold.source.personId, catchWorkReference: a.catchWorkReference,
    holdReference: a.holdReference, callSourceId: work.originalInputs.action!.sourceId, reception, intent: a.intent,
    reactionTick, endTick: a.endTick, originalHold: hold,...(moving??{}) });
};
export const assertSamePaOccupiedRunnerCatchOwnership = (source: SamePaPhysicalFieldStepSource, prefix: readonly Field[]) => {
  for (const response of prefix) {
    if (response.kind !== 'same_pa_physical_field_step_v1' || response.actionResult?.kind !== 'occupied_runner_catch_response_v1') continue;
    const responseReference = reference('pa_physical_v1_field_steps', response);
    const adopted = prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'occupied_runner_catch_motion_v1'
      && json(f.actionResult.responseReference) === json(responseReference));
    const kind = source.action?.kind;
    if (!adopted && source.action?.kind === 'occupied_runner_catch_motion_v1'
      && json(source.action.responseReference) !== json(responseReference))
      throw new Error('occupied received hold requires its own first physical motor');
    if (!adopted && kind !== 'occupied_runner_catch_motion_v1' && kind !== 'defender_observation_v1'
      && kind !== 'defender_decision_v1' && kind !== 'defender_catch_response_v1')
      throw new Error('occupied received hold owns the first physical motor cut');
  }
};
/** Execute the explicitly chosen hold: retain the original stationary command
 * or bind the authenticated incumbent's existing reaction/braking law. */
export const deriveSamePaOccupiedRunnerCatchMotion = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, prefix: readonly Field[]) => {
  const a = source.action, at = previous.field.motion.world.moment, motion = previous.field.motion;
  if (a?.kind !== 'occupied_runner_catch_motion_v1' || !motion.cursor || source.throughTick < previous.evaluationTick)
    throw new Error('occupied received motor requires an advancing original physical cut');
  const step = prefix.find(f => f.kind === 'same_pa_physical_field_step_v1' && json(reference('pa_physical_v1_field_steps', f)) === json(a.responseReference));
  if (step?.kind !== 'same_pa_physical_field_step_v1' || step.actionResult?.kind !== 'occupied_runner_catch_response_v1')
    throw new Error('occupied received motor original response missing');
  const r = step.actionResult, hold = r.originalHold;
  if(r.motionBasis){
    if(!r.controller)throw new Error('occupied received moving controller missing');
    const prior=prefix.some(f=>f.kind==='same_pa_physical_field_step_v1'&&f.actionResult?.kind==='occupied_runner_catch_motion_v1'
      &&json(f.actionResult.responseReference)===json(a.responseReference));
    if(!prior&&json(previous.field.motion.world.moment)!==json(step.field.motion.world.moment))throw new Error('occupied received motor cannot adopt behind actual history');
    const value=deriveSamePaRunnerControllerMotion({root,previous,prefix,throughTick:source.throughTick,controller:r.controller,
      runnerMotionParameters:hold.model.source.motion,body:hold.body.actor,rootHeightMeters:hold.body.actor.bodyOriginHeightMeters,
      ...(r.exactTrajectory?{exactTrajectory:r.exactTrajectory}:{})});
    return freeze({field:value.field,evaluationTick:value.evaluationTick,timeline:value.timeline,actionResult:{kind:a.kind,responseReference:a.responseReference,
      playerId:r.playerId,controllerSegmentIndex:value.controllerSegmentIndex,coverageThroughTick:value.coverageThroughTick,planThroughTick:value.planThroughTick,
      ...(value.exactControllerPiece?{exactControllerPiece:value.exactControllerPiece}:{})}});
  }
  if(source.throughTick<=previous.evaluationTick)throw new Error('occupied received stationary motor requires an advancing original physical cut');
  const prior = prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'occupied_runner_catch_motion_v1'
    && json(f.actionResult.responseReference) === json(a.responseReference));
  if (!prior && previous.evaluationTick !== r.intent.issuedTick) throw new Error('occupied received motor cannot adopt behind actual history');
  if (at.elapsedSeconds !== (previous.evaluationTick-at.originTick)/root.response.world.parameters.ticksPerSecond)
    throw new Error('occupied received motor requires exact original clock');
  const actors = motion.actors.filter(actor => actor.playerId === r.playerId);
  if (actors.length !== 5) throw new Error('occupied received motor five-part body missing');
  const close = (x: number, y: number) => Math.abs(x-y) <= Number.EPSILON*Math.max(1,Math.abs(x),Math.abs(y))*32;
  for (const actor of actors) {
    const shape = hold.body.actor.primitives.find(p => p.role === actor.primitive.role), actual = samplePiecewiseFieldActor(actor, at);
    if (!shape || shape.radius !== actor.primitive.radius || !close(actual.center.x, hold.setup.position.x+shape.offset.x)
      || !close(actual.center.y, hold.body.actor.bodyOriginHeightMeters+shape.offset.y) || !close(actual.center.z, hold.setup.position.z+shape.offset.z)
      || Object.values(actual.velocity).some(n => n !== 0) || Object.values(actor.primitive.acceleration).some(n => n !== 0))
      throw new Error('occupied received motor cannot rewrite a moving original body');
  }
  const coverageThroughTick = Math.min(r.endTick, samePaBatterRunForeignCoverage(root, previous, prefix, r.playerId, undefined));
  if (source.throughTick > coverageThroughTick) throw new Error('occupied received motor exceeds original command coverage');
  const field = deriveBattedWorldFieldMotionCheckpoint({ response: root.response, geometry: root.geometry, actors: motion.actors,
    cursor: motion.cursor, carrierPlayerId: motion.carrierPlayerId, availableAtTick: previous.evaluationTick, coverageThroughTick,
    checkpointThroughTick: source.throughTick, commands: motion.actors.map(actor => ({ playerId: actor.playerId,
      role: actor.primitive.role, acceleration: actor.primitive.acceleration })) });
  return freeze({ field, evaluationTick: field.motion.world.moment.ball.tick,
    timeline: samePaPhysicalHasThrowRelease(prefix) ? previous.timeline : samePaPhysicalTimelineAtField(previous.timeline, field, root.response, root.geometry),
    actionResult: { kind: a.kind, responseReference: a.responseReference, playerId: r.playerId, coverageThroughTick, planThroughTick: r.endTick } });
};
export type SamePaOccupiedRunnerCatchMotionRequest = Readonly<{ kind: 'occupied_runner_catch_motion_v1'; responseReference: StepReference }>;
