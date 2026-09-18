import { describe, expect, it } from 'vitest';
import { SeedRoot } from '../../rng/SeedRoot';
import { createObservationSample, type AttentionState } from './Observation';
import { predictPlanarObservationMemory, predictSpatialObservationMemory } from './ObservationMemory';
import { resolveCommunicationReception, type CommunicationEvent } from './Communication';
import {
  buildPlayerPerceivedWorldState,
  type PlayerPerceivedWorldInput,
} from './PlayerPerceivedWorldState';

const memoryParameters = {
  ticksPerSecond: 1_000_000,
  confidenceLossPerSecond: 0.2,
  confidenceFloor: 0.1,
} as const;

const attention: AttentionState = {
  target: { kind: 'ball' },
  focusedSinceTick: 1_500_000,
};

describe('PlayerPerceivedWorldState', () => {
  it('builds a perceived world from observations, memory, communication, and known context only', () => {
    const ball = predictSpatialObservationMemory(
      createObservationSample({
        position: { x: 0, y: 2, z: 12 },
        velocity: { x: 1, y: 0, z: -4 },
      }, 1_900_000, 0.9),
      2_000_000,
      memoryParameters,
    );

    const shortstop = predictPlanarObservationMemory(
      createObservationSample({
        position: { x: 8, z: 20 },
        velocity: { x: -1, z: 0 },
      }, 1_000_000, 0.8),
      2_000_000,
      memoryParameters,
    );

    const signal: CommunicationEvent<{ signal: 'hold' }> = {
      sourceId: 'third-base-coach',
      targetScope: { kind: 'player', playerId: 'runner-3' },
      kind: 'coach_signal',
      issuedAt: 1_800_000,
      content: { signal: 'hold' },
    };
    const received = resolveCommunicationReception(signal, {
      propagationDelayTicks: 10_000,
      recognitionBaseDelayTicks: 20_000,
      maxAdditionalRecognitionDelayTicks: 0,
      audibility: 1,
      recognition: 1,
      attention: 1,
      minimumRecognizableQuality: 0.2,
    }, new SeedRoot(11).streamRng(3, 'perception', 'coach-signal'));

    expect(received).not.toBeNull();

    const state = buildPlayerPerceivedWorldState({
      observerId: 'runner-3',
      observationTime: 2_000_000,
      attention,
      ball,
      players: [{ playerId: 'ss-6', memory: shortstop }],
      communications: [received!],
      knownContext: { outs: 1, scoreDifference: -1 },
    });

    expect(state.observerId).toBe('runner-3');
    expect(state.ball?.predictedAt).toBe(2_000_000);
    expect(state.players[0]?.memory.confidence).toBeCloseTo(0.6, 12);
    expect(state.communications).toEqual([received]);
    expect(state.knownContext).toEqual({ outs: 1, scoreDifference: -1 });
    expect(state).not.toHaveProperty('intent');
  });

  it('does not expose communication before its receive tick', () => {
    const event: CommunicationEvent<{ text: string }> = {
      sourceId: 'fielder-4',
      targetScope: { kind: 'team' },
      kind: 'callout',
      issuedAt: 1_990_000,
      content: { text: 'two' },
    };
    const future = resolveCommunicationReception(event, {
      propagationDelayTicks: 10_000,
      recognitionBaseDelayTicks: 20_000,
      maxAdditionalRecognitionDelayTicks: 0,
      audibility: 1,
      recognition: 1,
      attention: 1,
      minimumRecognizableQuality: 0.2,
    }, new SeedRoot(11).streamRng(3, 'perception', 'fielder-call'));

    expect(future).not.toBeNull();
    expect(future!.receivedAt).toBe(2_020_000);

    const state = buildPlayerPerceivedWorldState({
      observerId: 'runner-3',
      observationTime: 2_000_000,
      attention,
      ball: null,
      players: [],
      communications: [future!],
      knownContext: { outs: 1 },
    });

    expect(state.communications).toEqual([]);
  });

  it('has no CanonicalWorldSnapshot input key', () => {
    type InputHasCanonicalWorld =
      'canonicalWorld' extends keyof PlayerPerceivedWorldInput<unknown> ? true : false;
    const hasCanonicalWorld: InputHasCanonicalWorld = false;
    expect(hasCanonicalWorld).toBe(false);
  });
});
