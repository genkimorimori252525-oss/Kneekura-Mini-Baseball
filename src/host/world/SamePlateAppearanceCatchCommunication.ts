import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import type { CommunicationEvent } from '../../core/sim/perception/Communication';
import { resolveExactCommunicationReception, type ExactCommunicationReception } from '../../core/sim/perception/ExactCommunication';
import { actualCommunicationModelInput, type AcceptedActualCommunicationModel } from './ActualCallCommunication';
import type { ActualObservationMoment } from './ActualFieldObservation';
import { actorFreeze as freeze, actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaCatchCommunicationInput, samePaCatchActionInput, samePaCatchAssignmentInput, samePaOfficialPersonInput,
  assertSamePaAcceptedOfficialSource, samePaOfficialSourceReference,
  type AcceptedSamePaCatchCommunication, type AcceptedSamePaCatchAction, type AcceptedSamePaCatchAssignment, type AcceptedSamePaOfficialPerson } from './SamePlateAppearanceCatchCommunicationSource';
import type { SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';

export type SamePaCatchCallContent = Readonly<{ actionSourceId: string; officialId: string; personId: string;
  judgment: 'caught' | 'not_caught'; calledAt: ActualObservationMoment }>;
export type SamePaCatchCommunicationRecipient = Readonly<{ playerId: string; kind: 'pending'; reason: string }>
  | Readonly<{ playerId: string; kind: 'dropped'; reason: 'not_recognizable' }>
  | Readonly<{ playerId: string; kind: 'scheduled'; reception: ExactCommunicationReception<SamePaCatchCallContent>; receiverPosition: null }>
  | Readonly<{ playerId: string; kind: 'received'; reception: ExactCommunicationReception<SamePaCatchCallContent>; receiverPosition: Vec3 }>;
export type SamePaCatchCommunicationScope = Readonly<{ lineage: SamePaExecutionLineage; physicalPitchSourceId: string;
  ruleProfileId: string; matchSeed: number; ticksPerSecond: number; at: ActualObservationMoment;
  actionBasisAt: ActualObservationMoment | null; participantIds: readonly string[];
  segments: readonly BallWorldPlayerBaseContactSegment[] }>;

/** Calculation from separately accepted original action and executed bodies.
 * It never compares the accepted judgment with correct-rule truth. Results are
 * read-only proposals, not admission, observation consumption or an end proof. */
export const deriveSamePaCatchCommunication = (raw: Readonly<{ source: AcceptedSamePaCatchCommunication;
  action: AcceptedSamePaCatchAction | null; assignment: AcceptedSamePaCatchAssignment | null;
  person: AcceptedSamePaOfficialPerson | null; model: AcceptedActualCommunicationModel | null;
  scope: SamePaCatchCommunicationScope }>) => {
  const input = cloneInert(raw), s = samePaCatchCommunicationInput(input.source, input.source.sourceId), scope = input.scope;
  const action = input.action && samePaCatchActionInput(input.action, input.action.sourceId);
  const assignment = input.assignment && samePaCatchAssignmentInput(input.assignment, input.assignment.sourceId);
  const person = input.person && samePaOfficialPersonInput(input.person, input.person.sourceId);
  const model = input.model && actualCommunicationModelInput(input.model, input.model.sourceId);
  const clock = { originTick: scope.at.originTick, ticksPerSecond: scope.ticksPerSecond };
  if (!Number.isSafeInteger(scope.matchSeed) || scope.matchSeed < 0 || scope.matchSeed > 0xffffffff
    || !Number.isSafeInteger(scope.ticksPerSecond) || scope.ticksPerSecond <= 0
    || scope.at.tick !== quantizeEventTick(clock.originTick, scope.at.elapsedSeconds, clock.ticksPerSecond)
    || !scope.participantIds.length || new Set(scope.participantIds).size !== scope.participantIds.length
    || scope.participantIds.some(id => typeof id !== 'string' || !id || id !== id.trim())) throw new Error('same-PA communication original clock or participant scope differs');
  if (action) {
    if (!s.actionReference) throw new Error('same-PA communication has an unrequested action');
    assertSamePaAcceptedOfficialSource(action, s.actionReference);
  }
  if (assignment) {
    if (!action) throw new Error('same-PA communication assignment lacks its original action');
    assertSamePaAcceptedOfficialSource(assignment, action.assignmentReference);
    if (json(assignment.enrollmentReference) !== json(scope.lineage.enrollmentReference)
      || assignment.gameId !== scope.lineage.gameId || assignment.playId !== scope.lineage.playId
      || assignment.physicalPitchSourceId !== scope.physicalPitchSourceId
      || action.officialId !== assignment.officialId || action.personId !== assignment.personId
      || assignment.policy && assignment.policy.ruleProfileId !== scope.ruleProfileId) throw new Error('same-PA communication original assignment differs');
  }
  if (person) {
    if (!assignment) throw new Error('same-PA communication Person lacks its assignment');
    assertSamePaAcceptedOfficialSource(person, assignment.personReference);
    if (person.careerId !== scope.lineage.careerId || person.officialId !== assignment.officialId || person.personId !== assignment.personId)
      throw new Error('same-PA communication original umpire Person differs');
  }
  if (model) {
    if (!s.modelReference) throw new Error('same-PA communication has an unrequested model');
    assertSamePaAcceptedOfficialSource(model, s.modelReference);
    if (model.gameId !== scope.lineage.gameId || model.physicalPitchSourceId !== scope.physicalPitchSourceId
      || model.parameters?.receivers.some(r => !scope.participantIds.includes(r.playerId))) throw new Error('same-PA communication receiver model scope differs');
  }
  let pendingReason = !action ? 'accepted_original_catch_action_missing' : !assignment ? 'accepted_original_assignment_missing'
    : !person ? 'accepted_original_umpire_person_missing' : !assignment.policy ? 'accepted_original_action_policy_missing' : null;
  let emitted: CommunicationEvent<SamePaCatchCallContent> | null = null;
  if (action) {
    const at = action.calledAt, basis = scope.actionBasisAt;
    if (!basis || at.originTick !== clock.originTick || basis.originTick !== clock.originTick
      || at.tick !== quantizeEventTick(clock.originTick, at.elapsedSeconds, clock.ticksPerSecond)
      || basis.tick !== quantizeEventTick(clock.originTick, basis.elapsedSeconds, clock.ticksPerSecond)
      || at.elapsedSeconds < basis.elapsedSeconds || at.elapsedSeconds > scope.at.elapsedSeconds)
      throw new Error('same-PA communication original action availability differs');
    if (!pendingReason) {
      const pose = assignment!.pose;
      if (!pose || pose.validFromElapsedSeconds > at.elapsedSeconds || pose.validThroughElapsedSeconds < at.elapsedSeconds) pendingReason = 'sender_pose_interval_unavailable';
      else emitted = { sourceId: action.officialId, targetScope: { kind: 'nearby' }, kind: 'callout', issuedAt: at.tick,
        content: { actionSourceId: action.sourceId, officialId: action.officialId, personId: action.personId, judgment: action.judgment, calledAt: at } };
    }
  }
  const bodyAt = (playerId: string, elapsed: number): Vec3 | null => {
    const segment = scope.segments.filter(s => s.startElapsedSeconds <= elapsed && s.endElapsedSeconds >= elapsed).at(-1);
    if (!segment) return null;
    const bodies = segment.actors.filter(a => a.playerId === playerId && a.primitive.role === 'body');
    if (bodies.length !== 1) return null;
    const actor = bodies[0], p = actor.primitive;
    if (segment.originTick !== clock.originTick || p.ticksPerSecond !== clock.ticksPerSecond
      || elapsed > (p.endTick - clock.originTick) / clock.ticksPerSecond) throw new Error('same-PA communication receiver body coverage differs');
    const dt = (clock.originTick - p.startTick) / clock.ticksPerSecond + elapsed - (actor.startElapsedSeconds ?? 0);
    if (dt < 0) throw new Error('same-PA communication receiver body starts in the future');
    const position = { x: 0, y: 0, z: 0 };
    for (const axis of ['x', 'y', 'z'] as const) position[axis] = p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt;
    if (!Object.values(position).every(Number.isFinite)) throw new Error('same-PA communication body arithmetic overflow');
    return position;
  };
  const seed = new SeedRoot(scope.matchSeed);
  const recipients: SamePaCatchCommunicationRecipient[] = [...scope.participantIds].sort().map(playerId => {
    if (!emitted || !action) return { playerId, kind: 'pending', reason: pendingReason! };
    if (!model?.parameters) return { playerId, kind: 'pending', reason: 'reception_model_unavailable' };
    const receiver = model.parameters.receivers.find(r => r.playerId === playerId);
    if (!receiver) return { playerId, kind: 'pending', reason: 'receiver_conditions_unavailable' };
    const rng = seed.streamRng(scope.lineage.playId, 'perception', json(['same_pa_explicit_catch_communication_v1',
      scope.physicalPitchSourceId, action.sourceId, model.sourceId, playerId]));
    const reception = resolveExactCommunicationReception(emitted, action.calledAt.elapsedSeconds, clock, receiver.conditions, rng);
    if (!reception) return { playerId, kind: 'dropped', reason: 'not_recognizable' };
    if (reception.receivedAtElapsedSeconds > scope.at.elapsedSeconds) return { playerId, kind: 'scheduled', reception, receiverPosition: null };
    const receiverPosition = bodyAt(playerId, reception.receivedAtElapsedSeconds);
    return receiverPosition ? { playerId, kind: 'received', reception, receiverPosition }
      : { playerId, kind: 'pending', reason: 'receiver_pose_coverage_unavailable' };
  });
  return freeze({ kind: 'same_pa_catch_communication_proposal_v1' as const, source: s, lineage: scope.lineage,
    physicalPitchSourceId: scope.physicalPitchSourceId, clock, evaluatedThrough: scope.at,
    acceptedSources: { action: action && samePaOfficialSourceReference(action), assignment: assignment && samePaOfficialSourceReference(assignment),
      person: person && samePaOfficialSourceReference(person), model: model && samePaOfficialSourceReference(model) },
    emitted, senderPosition: emitted ? assignment!.pose!.position : null, pendingReason, recipients,
    sourceSnapshotHash: hash({ source: s, action, assignment, person, model }),
    canonicalAdmission: null, consumedRecipients: [] as readonly string[], physicalEnd: null });
};
export type SamePaCatchCommunicationProposal = ReturnType<typeof deriveSamePaCatchCommunication>;
/** Observers cannot see future content or claim that a scheduled call was heard. */
export const samePaCatchCommunicationObservationAt = (p: SamePaCatchCommunicationProposal, playerId: string, at: ActualObservationMoment) => {
  if (at.originTick !== p.clock.originTick || at.tick !== quantizeEventTick(at.originTick, at.elapsedSeconds, p.clock.ticksPerSecond)
    || at.elapsedSeconds > p.evaluatedThrough.elapsedSeconds) throw new Error('same-PA catch reception query is outside the proved clock');
  const r = p.recipients.find(r => r.playerId === playerId);
  if (!r) throw new Error('same-PA catch receiver is outside the original play');
  if (p.emitted && at.elapsedSeconds < p.emitted.content.calledAt.elapsedSeconds) return freeze({ playerId, kind: 'pending' as const, reason: 'communication_not_emitted_yet' });
  if (r.kind !== 'scheduled' && r.kind !== 'received') return r;
  const receivedAt = { originTick: p.clock.originTick, elapsedSeconds: r.reception.receivedAtElapsedSeconds, tick: r.reception.received.receivedAt };
  return r.kind === 'scheduled' || receivedAt.elapsedSeconds > at.elapsedSeconds
    ? freeze({ playerId, kind: 'scheduled' as const, dueAt: receivedAt })
    : freeze({ playerId, kind: 'received' as const, receivedAt, received: r.reception.received, receiverPosition: r.receiverPosition });
};
