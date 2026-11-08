import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { resolveExactCommunicationReception, isExactCommunicationAvailable } from '../../core/sim/perception/ExactCommunication';
import type { CommunicationReceptionConditions } from '../../core/sim/perception/Communication';
import type { SwingInstructionV121 } from '../../core/decision/batting/BatterApproachPolicyV121';

export type LiveManagerCommunicationSourceV122 = Readonly<{
  sourceId: string; sourceVersion: string; eventId: string; sessionId: string; matchId: string;
  senderId: string; receiverId: string; sourceTick: number; sentAtElapsedSeconds: number;
  conditions: CommunicationReceptionConditions; instruction: SwingInstructionV121;
}>;
export type LiveManagerCommunicationInputV122 = Readonly<{
  scope: Readonly<{ sessionId: string; matchId: string; senderId: string; receiverId: string }>;
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>;
  cutoff: Readonly<{ tick: number; elapsedSeconds: number }>;
  seed: number; source: LiveManagerCommunicationSourceV122;
}>;
type Receipt = Readonly<{ nativeAdmission: false; eventId: string; sourceId: string; sourceVersion: string }>;
type Arrival = Readonly<{ receivedAtTick: number; receivedAtElapsedSeconds: number; confidence: number }>;
export type LiveManagerCommunicationResultV122 = Receipt & (
  Readonly<{ status: 'NOT_APPLICABLE'; reason: 'SCOPE_MISMATCH' | 'WRONG_SENDER' | 'WRONG_RECIPIENT' | 'SOURCE_FROM_PREVIOUS_PITCH' }>
  | Readonly<{ status: 'NOT_RECOGNIZED' }>
  | (Arrival & Readonly<{ status: 'NOT_ARRIVED' }>)
  | (Arrival & Readonly<{ status: 'RECEIVED'; instruction: SwingInstructionV121 }>)
);
const fields = (v: unknown, required: readonly string[], optional: readonly string[] = []) => !!v && typeof v === 'object' && !Array.isArray(v)
  && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 200;
const tick = (v: number) => Number.isSafeInteger(v) && v >= 0;
const unit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
const fail = (): never => { throw Error('live manager communication: invalid explicit source, scope or clock'); };

/** Information delivery only. Reception confidence is not soft acceptance or
 * trust. Host owns source identity/history; this pure adapter has no inbox and
 * grants no Native admission. Unavailable results contain no command payload. */
export function resolveLiveManagerCommunicationV122(raw: LiveManagerCommunicationInputV122): LiveManagerCommunicationResultV122 {
  const input = cloneInert(raw), { scope, clock, cutoff, source: s } = input;
  if (!fields(input, ['scope', 'clock', 'cutoff', 'seed', 'source'])
    || !fields(scope, ['sessionId', 'matchId', 'senderId', 'receiverId']) || !Object.values(scope).every(text)
    || !fields(clock, ['originTick', 'ticksPerSecond']) || !tick(clock.originTick) || !tick(clock.ticksPerSecond) || clock.ticksPerSecond === 0
    || !fields(cutoff, ['tick', 'elapsedSeconds']) || !tick(cutoff.tick) || !Number.isFinite(cutoff.elapsedSeconds) || cutoff.elapsedSeconds < 0
    || cutoff.tick !== quantizeEventTick(clock.originTick, cutoff.elapsedSeconds, clock.ticksPerSecond)
    || !tick(input.seed) || input.seed > 0xffffffff
    || !fields(s, ['sourceId', 'sourceVersion', 'eventId', 'sessionId', 'matchId', 'senderId', 'receiverId', 'sourceTick', 'sentAtElapsedSeconds', 'conditions', 'instruction'])
    || ![s.sourceId, s.sourceVersion, s.eventId, s.sessionId, s.matchId, s.senderId, s.receiverId].every(text)
    || !tick(s.sourceTick) || !Number.isFinite(s.sentAtElapsedSeconds) || s.sentAtElapsedSeconds < 0
    || !fields(s.conditions, ['propagationDelayTicks', 'recognitionBaseDelayTicks', 'maxAdditionalRecognitionDelayTicks', 'audibility', 'recognition', 'attention', 'minimumRecognizableQuality'])
    || ![s.conditions.propagationDelayTicks, s.conditions.recognitionBaseDelayTicks, s.conditions.maxAdditionalRecognitionDelayTicks].every(tick)
    || ![s.conditions.audibility, s.conditions.recognition, s.conditions.attention, s.conditions.minimumRecognizableQuality].every(unit)
    || !fields(s.instruction, ['authority', 'effort', 'compactness'], ['acceptance'])
    || !['soft', 'hard'].includes(s.instruction.authority) || ![s.instruction.effort, s.instruction.compactness, s.instruction.acceptance ?? 1].every(unit)) fail();
  const receipt = { nativeAdmission: false as const, sourceId: s.sourceId, sourceVersion: s.sourceVersion, eventId: s.eventId };
  // A raw Source belongs to one release clock. Reusing the command during
  // look-ahead must expire it, never reinterpret it as a newly sent signal.
  // Longer-lived Game Plans/aliases are outside this one-pitch boundary.
  if (s.sourceTick < clock.originTick) return Object.freeze({ ...receipt, status: 'NOT_APPLICABLE', reason: 'SOURCE_FROM_PREVIOUS_PITCH' });
  if (s.sessionId !== scope.sessionId || s.matchId !== scope.matchId) return Object.freeze({ ...receipt, status: 'NOT_APPLICABLE', reason: 'SCOPE_MISMATCH' });
  if (s.senderId !== scope.senderId) return Object.freeze({ ...receipt, status: 'NOT_APPLICABLE', reason: 'WRONG_SENDER' });
  if (s.receiverId !== scope.receiverId) return Object.freeze({ ...receipt, status: 'NOT_APPLICABLE', reason: 'WRONG_RECIPIENT' });
  const rng = new SeedRoot(input.seed).streamRng(0, 'perception', JSON.stringify(['manager_communication_v122', s.sessionId, s.matchId,
    s.sourceId, s.sourceVersion, s.eventId, s.senderId, s.receiverId, s.sourceTick]));
  const reception = resolveExactCommunicationReception({ sourceId: s.senderId, targetScope: { kind: 'player', playerId: s.receiverId },
    kind: 'coach_signal', issuedAt: s.sourceTick, content: s.instruction }, s.sentAtElapsedSeconds, clock, s.conditions, rng);
  if (!reception) return Object.freeze({ ...receipt, status: 'NOT_RECOGNIZED' });
  const arrival = { receivedAtTick: reception.received.receivedAt, receivedAtElapsedSeconds: reception.receivedAtElapsedSeconds,
    confidence: reception.received.confidence };
  if (!isExactCommunicationAvailable(reception, cutoff.elapsedSeconds)) return Object.freeze({ ...receipt, ...arrival, status: 'NOT_ARRIVED' });
  return Object.freeze({ ...receipt, ...arrival, status: 'RECEIVED', instruction: Object.freeze(s.instruction) });
}
