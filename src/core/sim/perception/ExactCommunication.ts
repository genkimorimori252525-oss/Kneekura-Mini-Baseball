import type { CommunicationEvent, CommunicationReceptionConditions, ReceivedCommunication } from './Communication';
import type { DeterministicRng } from '../../rng/DeterministicRng';
import { quantizeEventTick } from '../ExactEventTime';
import { resolveCommunicationReception } from './Communication';
export type ExactCommunicationClock = Readonly<{ originTick: number; ticksPerSecond: number }>;
export type ExactCommunicationReception<T = unknown> = Readonly<{ received: ReceivedCommunication<T>; sentAtElapsedSeconds: number; receivedAtElapsedSeconds: number }>;
/** Versioned host models opt into exact_sent_plus_core_delay_ticks_v1. Core's law is unchanged. */
export const resolveExactCommunicationReception = <T>(event: CommunicationEvent<T>, sentAtElapsedSeconds: number,
  clock: ExactCommunicationClock, conditions: CommunicationReceptionConditions, rng: DeterministicRng): ExactCommunicationReception<T> | null => {
  if (event.issuedAt !== quantizeEventTick(clock.originTick, sentAtElapsedSeconds, clock.ticksPerSecond)) {
    throw new Error('communication issued clock differs from exact sent time');
  }
  const offset = resolveCommunicationReception({ ...event, issuedAt: 0 }, conditions, rng);
  if (!offset) return null;
  const receivedAtElapsedSeconds = sentAtElapsedSeconds + offset.receivedAt / clock.ticksPerSecond;
  const receivedAt = quantizeEventTick(clock.originTick, receivedAtElapsedSeconds, clock.ticksPerSecond);
  return { received: { event, receivedAt, confidence: offset.confidence }, sentAtElapsedSeconds, receivedAtElapsedSeconds };
};
export const isExactCommunicationAvailable = (value: ExactCommunicationReception, elapsedSeconds: number): boolean => {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new Error('invalid exact communication availability');
  return elapsedSeconds >= value.receivedAtElapsedSeconds;
};
