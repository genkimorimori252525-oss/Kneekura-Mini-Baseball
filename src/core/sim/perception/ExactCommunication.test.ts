import { expect, it } from 'vitest';
import { DeterministicRng } from '../../rng/DeterministicRng';
import { quantizeEventTick } from '../ExactEventTime';
import { resolveCommunicationReception } from './Communication';
import { isExactCommunicationAvailable, resolveExactCommunicationReception } from './ExactCommunication';

const clock = { originTick: 100, ticksPerSecond: 1000 };
const conditions = { propagationDelayTicks: 2, recognitionBaseDelayTicks: 3, maxAdditionalRecognitionDelayTicks: 9,
  audibility: 0.9, recognition: 0.8, attention: 0.7, minimumRecognizableQuality: 0.1 };
const sent = 0.1000001;
const event = { sourceId: 'owned-call', kind: 'callout' as const, targetScope: { kind: 'nearby' as const },
  issuedAt: quantizeEventTick(clock.originTick, sent, clock.ticksPerSecond), content: { call: 'safe', originalCallId: 'call-1' } };

it('adds the existing Core reception delay to the exact sent time without losing its fractional residue or content', () => {
  const core = resolveCommunicationReception({ ...event, issuedAt: 0 }, conditions, new DeterministicRng(41))!;
  const exact = resolveExactCommunicationReception(event, sent, clock, conditions, new DeterministicRng(41));
  expect(exact).toEqual({ received: { event, confidence: core.confidence,
    receivedAt: quantizeEventTick(clock.originTick, sent + core.receivedAt / clock.ticksPerSecond, clock.ticksPerSecond) },
  sentAtElapsedSeconds: sent, receivedAtElapsedSeconds: sent + core.receivedAt / clock.ticksPerSecond });
});

it('does not leak a later reception within the same recorded tick', () => {
  const exact = resolveExactCommunicationReception(event, sent, clock, { ...conditions, propagationDelayTicks: 0,
    recognitionBaseDelayTicks: 0, maxAdditionalRecognitionDelayTicks: 0 }, new DeterministicRng(41))!;
  expect(isExactCommunicationAvailable(exact, sent - 0.00000001)).toBe(false);
  expect(isExactCommunicationAvailable(exact, sent)).toBe(true);
});

it('preserves actual nondetection rather than substituting perfect hearing', () => {
  expect(resolveExactCommunicationReception(event, sent, clock, { ...conditions, audibility: 0 }, new DeterministicRng(41))).toBeNull();
});

it('rejects divergent clocks and unsafe exact-time arithmetic', () => {
  expect(() => resolveExactCommunicationReception({ ...event, issuedAt: event.issuedAt + 1 }, sent, clock, conditions, new DeterministicRng(1))).toThrow();
  expect(() => resolveExactCommunicationReception(event, -1, clock, conditions, new DeterministicRng(1))).toThrow();
  expect(() => resolveExactCommunicationReception(event, sent, { ...clock, ticksPerSecond: 0 }, conditions, new DeterministicRng(1))).toThrow();
  expect(() => isExactCommunicationAvailable({ received: { event, receivedAt: event.issuedAt, confidence: 1 },
    sentAtElapsedSeconds: sent, receivedAtElapsedSeconds: sent }, NaN)).toThrow();
});
