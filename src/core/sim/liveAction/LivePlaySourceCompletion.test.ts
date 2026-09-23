import { describe, expect, it } from 'vitest';
import {
  createLivePlayRegistry,
  retireCompletedLivePlaySources,
  resolveLivePlayRegistry,
  upsertLivePlaySource,
  type LivePlaySource,
} from './LivePlayRegistry';

const source = (sourceId: string, revision: number): LivePlaySource => ({
  sourceId, revision,
  queue: { sourceId, settledThroughTick: 100, nextPendingTick: null },
  physical: [], intents: [], information: [], decisions: [], ruleWindows: [],
});

describe('live-play source completion', () => {
  it('retires only explicitly completed empty sources while preserving their revision tombstones', () => {
    const completed: LivePlaySource = {
      ...source('completed', 2),
      completion: { completedAtTick: 100, basisEventId: 'source-finished' },
    };
    const registry = createLivePlayRegistry({
      playId: 7, revision: 5, sources: [completed, source('still-open', 1)],
    });
    const retired = retireCompletedLivePlaySources(registry, 5, 100);
    expect(retired).toMatchObject({ revision: 6 });
    expect(retired.sources.map((item) => item.sourceId)).toEqual(['still-open']);
    expect(retired.retiredSources).toContainEqual({ sourceId: 'completed', revision: 2 });
    expect(() => upsertLivePlaySource(retired, 6, source('completed', 2)))
      .toThrow('live-play source revision must increase monotonically');
    const unresolved = resolveLivePlayRegistry(retired, { tick: 100, actors: [], terminal: 'none' });
    expect(unresolved.resolution).toMatchObject({
      kind: 'continues', blockers: [{ kind: 'pending_source', sourceId: 'still-open' }],
    });
  });

  it('does not retire a completion before its event tick or change revision on a no-op', () => {
    const completed = { ...source('later', 1), queue: null,
      completion: { completedAtTick: 110, basisEventId: 'later-finished' } };
    const registry = createLivePlayRegistry({ playId: 7, revision: 0, sources: [completed] });
    expect(retireCompletedLivePlaySources(registry, 0, 100)).toEqual(registry);
    expect(retireCompletedLivePlaySources(registry, 0, 110).retiredSources)
      .toContainEqual({ sourceId: 'later', revision: 1 });
    expect(() => retireCompletedLivePlaySources(registry, 1, 110))
      .toThrow('stale live-play registry revision');
    expect(() => upsertLivePlaySource(registry, 0, source('later', 2)))
      .toThrow('completed live-play source cannot reopen');
  });

  it('rejects completion while physical work, an event or a decision remains pending', () => {
    const completion = { completedAtTick: 100, basisEventId: 'done' };
    expect(() => createLivePlayRegistry({ playId: 7, revision: 0, sources: [{
      ...source('physical', 1), completion,
      physical: [{ workId: 'runner-motion', kind: 'runner_motion', actorId: 'runner',
        throughTick: 101, actionKey: 'runner-action' }],
    }] })).toThrow('completed live-play source still has pending work');
    expect(() => createLivePlayRegistry({ playId: 7, revision: 0, sources: [{
      ...source('event', 1), completion,
      queue: { sourceId: 'event', settledThroughTick: 100, nextPendingTick: 101 },
    }] })).toThrow('completed live-play source still has a pending event');
    expect(() => createLivePlayRegistry({ playId: 7, revision: 0, sources: [{
      ...source('decision', 1), completion,
      decisions: [{ workId: 'choice', kind: 'actor_decision', actorId: 'runner', dueTick: 102 }],
    }] })).toThrow('completed live-play source still has pending work');
  });

  it('requires the source watermark to cover completion and keeps settlement independent', () => {
    expect(() => createLivePlayRegistry({ playId: 7, revision: 0, sources: [{
      ...source('early-watermark', 1),
      completion: { completedAtTick: 101, basisEventId: 'done' },
    }] })).toThrow('source completion exceeds its event watermark');
    const registry = createLivePlayRegistry({ playId: 7, revision: 0, sources: [{
      ...source('complete', 1), completion: { completedAtTick: 100, basisEventId: 'done' },
    }] });
    const retired = retireCompletedLivePlaySources(registry, 0, 100);
    expect(resolveLivePlayRegistry(retired, {
      tick: 100, actors: [{ actorId: 'runner', kind: 'acting' }], terminal: 'none',
    }).resolution.kind).toBe('continues');
  });
});
