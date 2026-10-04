import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { resolveCommunicationReception, type CommunicationEvent, type CommunicationReceptionConditions, type ReceivedCommunication } from '../../core/sim/perception/Communication';
import { resolveExactCommunicationReception, type ExactCommunicationReception } from '../../core/sim/perception/ExactCommunication';
import { DeterministicRng } from '../../core/rng/DeterministicRng';
import { umpireFields as fields, umpireId as id, type DurableActualFirstBaseUmpireCall } from './ActualFirstBaseUmpire';
import type { ActualObservationMoment } from './ActualFieldObservation';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFirstBaseUmpirePhysicalPrefixIdentity } from './ActualFirstBaseUmpirePhysicalIdentity';

export type AcceptedActualCommunicationModel = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; physicalPitchSourceId: string;
  parameters: Readonly<{ version: 'fixed_receiver_conditions_v1'; timing: 'exact_sent_plus_core_delay_ticks_v1';
    receivers: readonly Readonly<{ playerId: string; conditions: CommunicationReceptionConditions }>[] }> | null;
}>;
export type DurableActualCommunicationModel = Readonly<{ source: AcceptedActualCommunicationModel; physicalPitchHash: string;
  originalPlayerIds: readonly string[] }>;
export type AcceptedActualCallCommunication = Readonly<{
  sourceId: string; sourceVersion: string; callSourceId: string; modelSourceId: string | null;
  currentExecutionSourceId: string; previousCommunicationSourceId: string | null;
}>;
export type ActualCallCommunicationContent = Readonly<{ callSourceId: string; call: 'out' | 'safe';
  calledAt: ActualObservationMoment; onFieldCall: NonNullable<DurableActualFirstBaseUmpireCall['onFieldCall']> }>;
export type ActualCommunicationRecipient = Readonly<{ playerId: string; kind: 'pending'; reason: string }>
  | Readonly<{ playerId: string; kind: 'dropped'; reason: 'not_recognizable' }>
  | Readonly<{ playerId: string; kind: 'scheduled'; reception: ExactCommunicationReception<ActualCallCommunicationContent>; receiverPosition: null }>
  | Readonly<{ playerId: string; kind: 'received'; reception: ExactCommunicationReception<ActualCallCommunicationContent>; receiverPosition: Vec3 }>;
export type DurableActualCallCommunication = Readonly<{
  source: AcceptedActualCallCommunication; revision: number; history: readonly AcceptedActualCallCommunication[];
  originCommunicationSourceId: string; gameId: string; playId: number; physicalPitchSourceId: string;
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>; evaluatedThrough: ActualObservationMoment;
  callHash: string; modelHash: string | null; physicalPrefixHash: string;
  physicalPrefixHashConvention?: 'owned_motion_observation_prefix_manifest_v1';
  emitted: CommunicationEvent<ActualCallCommunicationContent> | null; sentAt: ActualObservationMoment | null;
  senderPosition: Vec3 | null; pendingReason: string | null; recipients: readonly ActualCommunicationRecipient[];
}>;
const sourceKeys = ['sourceId', 'sourceVersion', 'callSourceId', 'modelSourceId', 'currentExecutionSourceId', 'previousCommunicationSourceId'];
export const actualCommunicationInput = (raw: AcceptedActualCallCommunication, sourceId: string): AcceptedActualCallCommunication => {
  const s = cloneInert(raw);
  if (!fields(s, sourceKeys) || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.callSourceId, s.currentExecutionSourceId].every(id)
    || s.modelSourceId !== null && !id(s.modelSourceId) || s.previousCommunicationSourceId !== null
      && (!id(s.previousCommunicationSourceId) || s.previousCommunicationSourceId === sourceId)) throw new Error('invalid actual communication Source');
  return freeze(s);
};
export const actualCommunicationModelInput = (raw: AcceptedActualCommunicationModel, sourceId: string): AcceptedActualCommunicationModel => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'gameId', 'physicalPitchSourceId', 'parameters']) || s.sourceId !== sourceId
    || ![s.sourceId, s.sourceVersion, s.gameId, s.physicalPitchSourceId].every(id)) throw new Error('invalid actual communication model Source');
  if (s.parameters !== null) {
    const p = s.parameters;
    if (!fields(p, ['version', 'timing', 'receivers']) || p.version !== 'fixed_receiver_conditions_v1'
      || p.timing !== 'exact_sent_plus_core_delay_ticks_v1' || !Array.isArray(p.receivers)) throw new Error('invalid explicit communication model parameters');
    const ids = new Set<string>();
    for (const receiver of p.receivers) {
      if (!fields(receiver, ['playerId', 'conditions']) || !id(receiver.playerId) || ids.has(receiver.playerId)
        || !fields(receiver.conditions, ['propagationDelayTicks', 'recognitionBaseDelayTicks', 'maxAdditionalRecognitionDelayTicks',
          'audibility', 'recognition', 'attention', 'minimumRecognizableQuality'])) throw new Error('invalid explicit receiver conditions');
      ids.add(receiver.playerId);
      // Reuse the existing validation; the stream is throwaway and no reception is adopted here.
      resolveCommunicationReception({ sourceId, targetScope: { kind: 'player', playerId: receiver.playerId }, kind: 'callout', issuedAt: 0, content: null },
        receiver.conditions, new DeterministicRng(0));
    }
  }
  return freeze(s);
};
type Prefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];
/** Native sampler. The owner reconstructs every dependency; public requests contain only Source references. */
export const deriveActualCallCommunication = (source: AcceptedActualCallCommunication, call: DurableActualFirstBaseUmpireCall,
  model: DurableActualCommunicationModel | null, prefix: Prefix, previous: DurableActualCallCommunication | null): DurableActualCallCommunication => {
  const physical = battedWorldFieldPhysicalPrefix({ ...prefix, custodyPolicy: 'release_exclusive_v1' }), ball = physical.field.evidence;
  const frame = prefix.baseField.response.touch.worldContact.flight.physicalPitch.frame;
  const clock = call.observation.clock, originCommunicationSourceId = previous?.originCommunicationSourceId ?? source.sourceId;
  const players = [frame.batterActor?.binding.playerId, ...frame.world.runners.map(value => value.playerId), ...frame.world.defenders.map(value => value.playerId)];
  if (players.some(value => !id(value)) || new Set(players).size !== players.length || players[0] !== call.observation.batterRunnerId
    || frame.gameId !== call.observation.gameId || frame.match.playId !== call.observation.playId
    || prefix.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId !== call.observation.physicalPitchSourceId
    || ball.originTick !== clock.originTick || ball.ticksPerSecond !== clock.ticksPerSecond
    || !prefix.executions.some(value => value.source.sourceId === call.source.currentExecutionSourceId)
    || ball.horizon.elapsedSeconds < call.advancedThrough.elapsedSeconds) throw new Error('actual communication original play/call/clock differs');
  const originalPlayers = (players as string[]).sort();
  if (model && (model.source.gameId !== frame.gameId || model.source.physicalPitchSourceId !== call.observation.physicalPitchSourceId
    || json(model.originalPlayerIds) !== json(originalPlayers))) throw new Error('actual communication model original participant scope differs');
  const evaluatedThrough = { originTick: ball.originTick, elapsedSeconds: ball.horizon.elapsedSeconds, tick: ball.horizon.ball.tick };
  if (previous && (source.previousCommunicationSourceId !== previous.source.sourceId || source.callSourceId !== previous.source.callSourceId
    || source.modelSourceId !== previous.source.modelSourceId || previous.callHash !== hash(call) || previous.modelHash !== (model ? hash(model) : null)
    || previous.evaluatedThrough.originTick !== evaluatedThrough.originTick || previous.evaluatedThrough.elapsedSeconds >= evaluatedThrough.elapsedSeconds
    || !prefix.executions.some(value => value.source.sourceId === previous.source.currentExecutionSourceId))) {
    throw new Error('actual communication predecessor/dependencies or exact chronology differs');
  }
  const schedule = call.schedule, pose = call.observation.setup.pose;
  let emitted: DurableActualCallCommunication['emitted'] = null, sentAt: ActualObservationMoment | null = null;
  let senderPosition: Vec3 | null = null, pendingReason: string | null = null;
  if (schedule.kind !== 'called' || !call.onFieldCall) pendingReason = 'operative_call_unavailable';
  else {
    sentAt = { originTick: clock.originTick, elapsedSeconds: schedule.calledAtElapsedSeconds, tick: schedule.tick };
    if (!pose || pose.validFromElapsedSeconds > sentAt.elapsedSeconds || pose.validThroughElapsedSeconds < sentAt.elapsedSeconds) {
      pendingReason = 'sender_pose_interval_unavailable';
    } else {
      senderPosition = pose.position;
      emitted = { sourceId: call.observation.setup.umpireId, targetScope: { kind: 'nearby' }, kind: 'callout', issuedAt: sentAt.tick,
        content: { callSourceId: call.source.sourceId, call: schedule.call, calledAt: sentAt, onFieldCall: call.onFieldCall } };
    }
  }
  const bodyAt = (playerId: string, elapsed: number): Vec3 | null => {
    const segment = physical.segments.filter(value => value.startElapsedSeconds <= elapsed && value.endElapsedSeconds >= elapsed).at(-1);
    if (!segment) return null;
    const bodies = segment.actors.filter(actor => actor.playerId === playerId && actor.primitive.role === 'body');
    if (bodies.length !== 1) return null;
    const actor = bodies[0], p = actor.primitive;
    if (p.ticksPerSecond !== clock.ticksPerSecond) throw new Error('actual communication receiver body clock differs');
    const dt = (clock.originTick - p.startTick) / p.ticksPerSecond + elapsed - (actor.startElapsedSeconds ?? 0);
    const position = { x: 0, y: 0, z: 0 };
    for (const axis of ['x', 'y', 'z'] as const) position[axis] = p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt;
    if (!Object.values(position).every(Number.isFinite)) throw new Error('actual communication receiver pose arithmetic overflow');
    return position;
  };
  const root = new SeedRoot(frame.matchSeed);
  const recipients: ActualCommunicationRecipient[] = originalPlayers.map(playerId => {
    if (!emitted || !sentAt) return { playerId, kind: 'pending', reason: pendingReason! };
    if (!model || !model.source.parameters) return { playerId, kind: 'pending', reason: 'reception_model_unavailable' };
    const profile = model.source.parameters.receivers.find(value => value.playerId === playerId);
    if (!profile) return { playerId, kind: 'pending', reason: 'receiver_conditions_unavailable' };
    const rng = root.streamRng(frame.match.playId, 'perception', json(['actual_call_communication_v1', call.observation.physicalPitchSourceId,
      call.source.sourceId, originCommunicationSourceId, model.source.sourceId, playerId]));
    const reception = resolveExactCommunicationReception(emitted, sentAt.elapsedSeconds, clock, profile.conditions, rng);
    if (!reception) return { playerId, kind: 'dropped', reason: 'not_recognizable' };
    if (reception.receivedAtElapsedSeconds > evaluatedThrough.elapsedSeconds) return { playerId, kind: 'scheduled', reception, receiverPosition: null };
    const receiverPosition = bodyAt(playerId, reception.receivedAtElapsedSeconds);
    return receiverPosition ? { playerId, kind: 'received', reception, receiverPosition }
      : { playerId, kind: 'pending', reason: 'receiver_pose_coverage_unavailable' };
  });
  return freeze(cloneInert({ source, revision: (previous?.revision ?? 0) + 1, history: [...(previous?.history ?? []), source],
    originCommunicationSourceId, gameId: frame.gameId, playId: frame.match.playId, physicalPitchSourceId: call.observation.physicalPitchSourceId,
    clock, evaluatedThrough, callHash: hash(call), modelHash: model ? hash(model) : null,
    ...actualFirstBaseUmpirePhysicalPrefixIdentity(prefix, physical),
    emitted, sentAt, senderPosition, pendingReason, recipients }));
};
export const actualCommunicationAt = (value: DurableActualCallCommunication, playerId: string, at: ActualObservationMoment): ActualCommunicationRecipient => {
  if (!id(playerId) || at.originTick !== value.clock.originTick
    || at.tick !== quantizeEventTick(value.clock.originTick, at.elapsedSeconds, value.clock.ticksPerSecond)) throw new Error('actual communication availability clock differs');
  const recipient = value.recipients.find(r => r.playerId === playerId);
  if (!recipient) throw new Error('actual communication receiver is outside the original play');
  if (value.sentAt !== null && at.elapsedSeconds < value.sentAt.elapsedSeconds) return freeze({ playerId, kind: 'pending', reason: 'communication_not_emitted_yet' });
  if (recipient.kind === 'received' && recipient.reception.receivedAtElapsedSeconds > at.elapsedSeconds) {
    return freeze({ ...recipient, kind: 'scheduled', receiverPosition: null });
  }
  return recipient;
};
export type ActualObservationCallReception = Readonly<{ playerId: string; kind: 'pending'; reason: string }>
  | Readonly<{ playerId: string; kind: 'dropped'; reason: 'not_recognizable' }>
  | Readonly<{ playerId: string; kind: 'scheduled'; dueAt: ActualObservationMoment }>
  | Readonly<{ playerId: string; kind: 'received'; receivedAt: ActualObservationMoment;
    received: ReceivedCommunication<ActualCallCommunicationContent>; receiverPosition: Vec3 }>;
/** Before reception, only canonical work status reaches the receipt. Future call content never does. */
export const actualCommunicationObservationAt = (value: DurableActualCallCommunication, playerId: string,
  at: ActualObservationMoment): ActualObservationCallReception => {
  const result = actualCommunicationAt(value, playerId, at);
  if (result.kind !== 'received' && result.kind !== 'scheduled') return result;
  const receivedAt = { originTick: value.clock.originTick, elapsedSeconds: result.reception.receivedAtElapsedSeconds,
    tick: result.reception.received.receivedAt };
  return result.kind === 'scheduled' ? freeze({ playerId, kind: 'scheduled', dueAt: receivedAt })
    : freeze({ playerId, kind: 'received', receivedAt, received: result.reception.received, receiverPosition: result.receiverPosition });
};
