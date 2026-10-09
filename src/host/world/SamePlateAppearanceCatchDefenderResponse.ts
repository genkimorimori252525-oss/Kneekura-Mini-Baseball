import type { DatabaseSync } from 'node:sqlite';
import { deriveReceivedUmpireDefenderReplan, type ReceivedUmpireDefenderReplan, type ReceivedUmpireCaughtOutContent, type ReceivedUmpireDefenderReplanInput } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { buildPlayerPerceivedWorldState } from '../../core/sim/perception/PlayerPerceivedWorldState';
import { readSamePaLifecycleCalibrationFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { receivedUmpireDefenderPolicyDataEvidenceFromSqlite } from './SqliteReceivedUmpireDefenderPolicyDataStore';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type StepRef = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaCatchDefenderResponse = Readonly<{ kind: 'defender_catch_response_v1'; playerId: string; observationReference: StepRef;
  replan: ReceivedUmpireDefenderReplan<ReceivedUmpireCaughtOutContent>; issuedBySourceId: string | null; fieldingModelHash: string }>;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA caught response original dependency differs'); };
const result = (f: Field) => f.kind === 'same_pa_physical_field_step_v1' ? f.actionResult : undefined;

/** The existing received-OUT kernel receives only the genuinely heard legal
 * meaning of an independently accepted caught action. Accepted policy data is
 * made available at this actual Source cut, never at its calendar acceptance. */
export const deriveSamePaCatchDefenderResponse = (db: DatabaseSync, source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, basis: SamePaLifecycleViewBasis, prefix: readonly Field[]): SamePaCatchDefenderResponse => {
  const request = source.action;
  if (request?.kind !== 'defender_catch_response_v1' || source.throughTick !== previous.evaluationTick) throw new Error('caught response is zero-time field work');
  same(request.member, basis.members.find(m => m.playerId === request.member.playerId));
  const binding = basis.actor.defenderBindings.find(d => d.playerId === request.member.playerId);
  if (!binding) throw new Error('caught response requires the original defender');
  const linked = (ref: StepRef): SamePaPhysicalFieldStep => {
    const f = prefix.find(f => f.kind === 'same_pa_physical_field_step_v1' && f.source.sourceId === ref.sourceId);
    if (!f || f.kind !== 'same_pa_physical_field_step_v1') throw new Error('caught response prerequisite is outside the original field prefix');
    same(reference('pa_physical_v1_field_steps', f), ref); return f;
  };
  const observation = linked(request.observationReference), observed = observation.actionResult;
  if (observed?.kind !== 'defender_observation_v1' || observed.playerId !== binding.playerId || !observed.catchCommunication
    || observed.catchCommunication.operativeReception?.kind !== 'received') throw new Error('caught response requires an actually observed original OUT meaning');
  same(observation, [...prefix].reverse().find(f => { const r = result(f); return r?.kind === 'defender_observation_v1' && r.playerId === binding.playerId; }));
  const recent = [...prefix].reverse().find(f => { const r = result(f); return r?.kind === 'defender_catch_response_v1' && r.playerId === binding.playerId; });
  same(request.previousResponseReference, recent ? reference('pa_physical_v1_field_steps', recent) : null);
  const prior = recent?.kind === 'same_pa_physical_field_step_v1' ? recent : null;
  const priorResult = prior?.actionResult?.kind === 'defender_catch_response_v1' ? prior.actionResult : null;
  let first = prior;
  while (first?.source.action?.kind === 'defender_catch_response_v1' && first.source.action.previousResponseReference) first = linked(first.source.action.previousResponseReference);
  const originSource = first?.source ?? source, originRequest = originSource.action;
  if (originRequest?.kind !== 'defender_catch_response_v1') throw new Error('caught response origin Source differs');
  for (const key of ['observationReference', 'predecessorDecisionReference', 'predecessorMotionReference'] as const) same(request[key], originRequest[key]);
  const decision = linked(request.predecessorDecisionReference), d = decision.actionResult;
  if (d?.kind !== 'defender_decision_v1' || d.playerId !== binding.playerId || decision.source.action?.kind !== 'defender_decision_v1'
    || prefix.indexOf(decision) >= prefix.indexOf(observation)) throw new Error('caught response original incumbent decision missing');
  same(decision, [...prefix].reverse().find(f => { const r = result(f); return r?.kind === 'defender_decision_v1' && r.playerId === binding.playerId; }));
  const c = readSamePaLifecycleCalibrationFromSqlite(db, decision.source.action.calibrationReference);
  if (c.source.route !== 'defender_decision' || c.source.member.playerId !== binding.playerId) throw new Error('caught response decision calibration differs');
  same(c.source.viewReference, decision.source.viewReference); same(c.lineage, root.lineage);
  const model = playerDecisionModelEvidenceFromSqlite(db).read(c.source.nominalReference.sourceId);
  if (!model) throw new Error('caught response original decision model missing');
  same(reference('world_player_decision_models', model), c.source.nominalReference);
  if (model.source.careerId !== binding.careerId || model.source.playerId !== binding.playerId || model.source.personLinkSourceId !== binding.personLinkSourceId
    || model.fieldingModel.person.personId !== binding.personId || model.source.acceptedAtDay > binding.gameDay) throw new Error('caught response original Player/Person model differs');
  const oldObservation = linked(d.observationReference), old = oldObservation.actionResult;
  if (old?.kind !== 'defender_observation_v1' || old.playerId !== binding.playerId) throw new Error('caught response incumbent information missing');
  const adoption = linked(request.predecessorMotionReference), adopted = adoption.actionResult;
  if (adopted?.kind !== 'defender_motion_v1' || adoption.source.action?.kind !== 'defender_motion_v1' || prefix.indexOf(adoption) >= prefix.indexOf(observation)
    || !adoption.source.action.selections.some(s => s.member.playerId === binding.playerId && json(s.decisionReference) === json(request.predecessorDecisionReference)))
    throw new Error('caught response requires an actually adopted original incumbent motor');
  const motor = adopted.motors.find(m => m.self.playerId === binding.playerId);
  if (!motor || motor.self.personId !== binding.personId || motor.command.playerId !== binding.playerId) throw new Error('caught response original incumbent motor identity differs');
  // A different intervening owner must not be silently replaced by a stale incumbent.
  if (prefix.slice(prefix.indexOf(adoption) + 1).some(f => {
    const r = result(f); return r?.kind === 'defender_motion_v1' && r.motors.some(m => m.self.playerId === binding.playerId);
  })) throw new Error('caught response incumbent was replaced before reception');
  same(d.fieldingModelHash, hash(model.fieldingModel)); same(observed.fieldingModelHash, hash(model.fieldingModel));
  const m = previous.field.motion.world.moment, at = { originTick: m.originTick, elapsedSeconds: m.elapsedSeconds, tick: m.ball.tick };
  const work = readSamePaCatchWorkFromSqlite(db, observed.catchCommunication.workReference);
  let originWork = work;
  while (originWork.source.priorWorkReference) originWork = readSamePaCatchWorkFromSqlite(db, originWork.source.priorWorkReference);
  const reception = observed.catchCommunication.operativeReception;
  const perceived = buildPlayerPerceivedWorldState({ ...observed.receipt.perceived,
    communications: [...observed.receipt.perceived.communications, reception.received] });
  let policy: ReceivedUmpireDefenderReplanInput['policy'] = null;
  if (request.policyDataReference) {
    const value = receivedUmpireDefenderPolicyDataEvidenceFromSqlite(db).read(request.policyDataReference.sourceId);
    if (!value) throw new Error('caught response referenced policy data missing'); same(reference('world_received_umpire_defender_policy_data', value), request.policyDataReference);
    if (value.source.careerId !== binding.careerId || value.source.playerId !== binding.playerId || value.source.personLinkSourceId !== binding.personLinkSourceId
      || value.source.acceptedAtDay > binding.gameDay) throw new Error('caught response policy Player/Person/day differs');
    same(value.fieldingModel, model.fieldingModel);
    policy = { sourceId: value.source.sourceId, hash: hash(value), availableAt: priorResult?.replan.policyBinding?.policy.availableAt ?? at, profiles: value.source.profiles };
  }
  const replan = deriveReceivedUmpireDefenderReplan({ processSourceId: originSource.sourceId, physicalPitchSourceId: root.physicalPitchSourceId,
    playerId: binding.playerId, receiverRole: 'defender', ticksPerSecond: root.response.world.parameters.ticksPerSecond, currentCut: at,
    communication: { sourceId: work.source.sourceId, hash: hash(work), originCommunicationSourceId: originWork.source.sourceId, callSourceId: work.originalInputs.action!.sourceId },
    observation: { sourceId: observation.source.sourceId, hash: hash(observation), at: observed.receipt.at, perceived, reception },
    predecessor: { originDecisionSourceId: decision.source.sourceId, originObservationSourceId: oldObservation.source.sourceId, originObservationHash: hash(oldObservation),
      availability: d.availability, informationOrder: null,
      observationSourceId: oldObservation.source.sourceId, observationHash: hash(oldObservation), observedThrough: old.receipt.at,
      decisionTick: d.calculation.scheduling.decisionTick, issuedAt: motor.issuedAt,
      command: { sourceId: decision.source.sourceId, hash: hash(d.calculation), selected: d.calculation.selected, target: d.target },
      motor: { sourceId: adoption.source.sourceId, hash: hash(motor), adoptionSourceId: adoption.source.sourceId, adoptedAt: motor.startAt } },
    model: { sourceId: c.source.sourceId, hash: hash(c), situationalAwareness: model.fieldingModel.source.ratings.situationalAwareness,
      firstStepAbility: model.fieldingModel.source.ratings.firstStep, ...c.source.response.values },
    contextualPlan: { sourceId: decision.source.sourceId, hash: hash(decision.source.action.priorities), priorities: decision.source.action.priorities },
    policy, previous: priorResult?.replan ?? null });
  if (replan.trigger !== 'communication_received') throw new Error('caught response did not establish a new received cause');
  return freeze({ kind: 'defender_catch_response_v1', playerId: binding.playerId, observationReference: request.observationReference, replan,
    issuedBySourceId: replan.selectedAt ? priorResult?.issuedBySourceId ?? source.sourceId : null, fieldingModelHash: hash(model.fieldingModel) });
};
