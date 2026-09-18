import { describe, expect, it } from 'vitest';
import { SeedRoot } from '../../rng/SeedRoot';
import {
  isCommunicationAvailable,
  resolveCommunicationReception,
  type CommunicationEvent,
  type CommunicationReceptionConditions,
} from './Communication';

const event: CommunicationEvent<{ signal: 'hold' }> = {
  sourceId: 'third-base-coach',
  targetScope: { kind: 'player', playerId: 'runner-3' },
  kind: 'coach_signal',
  issuedAt: 1_000_000,
  content: { signal: 'hold' },
};

const clearConditions: CommunicationReceptionConditions = {
  propagationDelayTicks: 10_000,
  recognitionBaseDelayTicks: 20_000,
  maxAdditionalRecognitionDelayTicks: 0,
  audibility: 0.9,
  recognition: 0.8,
  attention: 0.75,
  minimumRecognizableQuality: 0.2,
};

describe('Communication', () => {
  it('produces perceived information with a receive tick and confidence, not an intent', () => {
    const rng = new SeedRoot(51).streamRng(
      8,
      'perception',
      'listener:runner-3|communication:third-base-coach:1000000',
    );

    const received = resolveCommunicationReception(event, clearConditions, rng);

    expect(received).toEqual({
      event,
      receivedAt: 1_030_000,
      confidence: 0.54,
    });
    expect(received).not.toHaveProperty('intent');
  });

  it('keeps information unavailable until its receive tick', () => {
    const rng = new SeedRoot(51).streamRng(
      8,
      'perception',
      'listener:runner-3|communication:third-base-coach:1000000',
    );
    const received = resolveCommunicationReception(event, clearConditions, rng);
    expect(received).not.toBeNull();

    expect(isCommunicationAvailable(received!, 1_029_999)).toBe(false);
    expect(isCommunicationAvailable(received!, 1_030_000)).toBe(true);
  });

  it('does not recognize communication whose combined quality is below threshold', () => {
    const rng = new SeedRoot(51).streamRng(8, 'perception', 'quiet-message');

    expect(resolveCommunicationReception(event, {
      ...clearConditions,
      audibility: 0.1,
      recognition: 0.5,
      attention: 0.5,
      minimumRecognizableQuality: 0.2,
    }, rng)).toBeNull();
  });

  it('replays recognition delay deterministically from its named stream', () => {
    const conditions: CommunicationReceptionConditions = {
      ...clearConditions,
      maxAdditionalRecognitionDelayTicks: 80_000,
    };
    const root = new SeedRoot(72);
    const streamKey = 'listener:runner-3|communication:third-base-coach:1000000';

    const a = resolveCommunicationReception(
      event,
      conditions,
      root.streamRng(8, 'perception', streamKey),
    );
    const b = resolveCommunicationReception(
      event,
      conditions,
      root.streamRng(8, 'perception', streamKey),
    );

    expect(a).toEqual(b);
  });
});
