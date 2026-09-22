import { describe, expect, it } from 'vitest';
import type { ActorPlayDisposition } from './ActionFrontier';
import {
  createLivePlayRegistry,
  removeLivePlaySource,
  resolveLivePlayRegistry,
  upsertLivePlaySource,
  type LivePlaySource,
} from './LivePlayRegistry';

const settledActors = (tick: number): ActorPlayDisposition[] => [
  { actorId: 'runner', kind: 'settled_for_play', settledAt: tick, basisEventId: 'runner-settled' },
  { actorId: 'defender', kind: 'settled_for_play', settledAt: tick, basisEventId: 'defender-settled' },
];

const runnerSource = (revision = 1): LivePlaySource => ({
  sourceId: 'runner-action',
  revision,
  queue: {
    sourceId: 'runner-action',
    settledThroughTick: 100,
    nextPendingTick: 110,
  },
  physical: [{
    workId: 'runner-motion',
    kind: 'runner_motion',
    actorId: 'runner',
    throughTick: 150,
    actionKey: 'runner-key',
  }],
  intents: [{
    workId: 'runner-intent',
    kind: 'issued_intent',
    actorId: 'runner',
    dueTick: 110,
    actionKey: 'runner-key',
  }],
  information: [],
  decisions: [],
  ruleWindows: [],
});

describe('LivePlayRegistry', () => {
  it('ends only when the registry is empty, actors are settled, and event sources are settled', () => {
    const registry = createLivePlayRegistry({ playId: 7, revision: 0, sources: [] });
    const result = resolveLivePlayRegistry(registry, {
      tick: 100,
      actors: settledActors(100),
      terminal: 'none',
    });
    expect(result.watermark.settledThroughTick).toBe(100);
    expect(result.resolution.kind).toBe('ended');
  });

  it('keeps a scheduled runner action visible to the shared ActionFrontier', () => {
    let registry = createLivePlayRegistry({ playId: 7, revision: 0, sources: [] });
    registry = upsertLivePlaySource(registry, 0, runnerSource());
    expect(registry.revision).toBe(1);
    const result = resolveLivePlayRegistry(registry, {
      tick: 100,
      actors: settledActors(100),
      terminal: 'none',
    });
    expect(result.resolution.kind).toBe('continues');
    expect(result.frontier.physical.map((item) => item.workId)).toContain('runner-motion');
    expect(result.frontier.intents.map((item) => item.workId)).toContain('runner-intent');
    expect(result.watermark.sources.map((item) => item.sourceId)).toEqual(['runner-action']);
  });

  it('replaces an adopted intent with remaining physical motion without ending the play early', () => {
    let registry = createLivePlayRegistry({ playId: 7, revision: 0, sources: [runnerSource()] });
    registry = upsertLivePlaySource(registry, 0, {
      ...runnerSource(2),
      queue: { sourceId: 'runner-action', settledThroughTick: 110, nextPendingTick: null },
      intents: [],
      physical: [{
        workId: 'runner-motion',
        kind: 'runner_motion',
        actorId: 'runner',
        throughTick: 150,
        actionKey: 'runner-key',
      }],
    });
    const result = resolveLivePlayRegistry(registry, {
      tick: 110,
      actors: settledActors(110),
      terminal: 'none',
    });
    expect(result.resolution.kind).toBe('continues');
    expect(result.watermark.settledThroughTick).toBe(110);
  });

  it('removes completed work and then permits PlayEnd from the same registry chain', () => {
    let registry = createLivePlayRegistry({ playId: 7, revision: 0, sources: [runnerSource()] });
    registry = removeLivePlaySource(registry, 0, 'runner-action');
    expect(registry.revision).toBe(1);
    const result = resolveLivePlayRegistry(registry, {
      tick: 150,
      actors: settledActors(150),
      terminal: 'none',
    });
    expect(result.resolution.kind).toBe('ended');
  });

  it('rejects stale registry updates and non-monotonic source replacement', () => {
    const registry = createLivePlayRegistry({ playId: 7, revision: 4, sources: [runnerSource(3)] });
    expect(() => removeLivePlaySource(registry, 3, 'runner-action')).toThrow();
    expect(() => upsertLivePlaySource(registry, 4, runnerSource(3))).toThrow();
    expect(() => upsertLivePlaySource(registry, 4, runnerSource(2))).toThrow();
  });

  it('does not resurrect a removed source at an old source revision', () => {
    let registry = createLivePlayRegistry({
      playId: 7,
      revision: 0,
      sources: [runnerSource(3)],
    });
    registry = removeLivePlaySource(registry, 0, 'runner-action');
    expect(() => upsertLivePlaySource(registry, 1, runnerSource(3))).toThrow();

    registry = upsertLivePlaySource(registry, 1, runnerSource(4));
    expect(registry.sources[0].revision).toBe(4);
  });

  it('combines multiple event-source watermarks and keeps the lowest bound', () => {
    const registry = createLivePlayRegistry({
      playId: 7,
      revision: 0,
      sources: [
        runnerSource(),
        {
          sourceId: 'tag-event',
          revision: 1,
          queue: { sourceId: 'tag-event', settledThroughTick: 98, nextPendingTick: 99 },
          physical: [{ workId: 'tag-contact', kind: 'tag', actorId: 'defender', throughTick: 99, actionKey: 'tag-key' }],
          intents: [],
          information: [],
          decisions: [],
          ruleWindows: [],
        },
      ],
    });
    const result = resolveLivePlayRegistry(registry, {
      tick: 100,
      actors: settledActors(100),
      terminal: 'none',
    });
    expect(result.watermark.settledThroughTick).toBe(98);
    expect(result.frontier.eventQueueSettledThroughTick).toBe(98);
  });

  it('keeps unresolved event evidence open even without a known next event tick', () => {
    const registry = createLivePlayRegistry({
      playId: 7,
      revision: 0,
      sources: [{
        sourceId: 'unresolved-flight',
        revision: 1,
        queue: { sourceId: 'unresolved-flight', settledThroughTick: 80, nextPendingTick: null },
        physical: [],
        intents: [],
        information: [],
        decisions: [],
        ruleWindows: [],
      }],
    });
    const result = resolveLivePlayRegistry(registry, {
      tick: 100,
      actors: settledActors(100),
      terminal: 'none',
    });
    expect(result.resolution.kind).toBe('continues');
    expect(result.watermark.settledThroughTick).toBe(80);
  });

  it('keeps in-flight information and actor decisions as normal-play blockers', () => {
    const registry = createLivePlayRegistry({
      playId: 7,
      revision: 0,
      sources: [{
        sourceId: 'perception',
        revision: 1,
        queue: null,
        physical: [],
        intents: [],
        information: [{
          workId: 'info-1',
          kind: 'in_flight_information',
          actorId: 'runner',
          dueTick: 105,
          causeEventId: 'throw-start',
        }],
        decisions: [{
          workId: 'decision-1',
          kind: 'actor_decision',
          actorId: 'runner',
          dueTick: 110,
        }],
        ruleWindows: [],
      }],
    });
    const result = resolveLivePlayRegistry(registry, {
      tick: 100,
      actors: settledActors(100),
      terminal: 'none',
    });
    expect(result.resolution.kind).toBe('continues');
    if (result.resolution.kind !== 'continues') return;
    expect(result.resolution.blockers.map((item) => item.kind)).toContain('pending_information');
    expect(result.resolution.blockers.map((item) => item.kind)).toContain('pending_decision');
  });

  it('terminal dead ball ignores irrelevant scheduled motion but still waits for same-tick event settlement', () => {
    const source = runnerSource();
    const unsettled = createLivePlayRegistry({
      playId: 7,
      revision: 0,
      sources: [{
        ...source,
        queue: { sourceId: source.sourceId, settledThroughTick: 99, nextPendingTick: 100 },
      }],
    });
    expect(resolveLivePlayRegistry(unsettled, {
      tick: 100,
      actors: [{ actorId: 'runner', kind: 'acting' }],
      terminal: 'dead_ball',
    }).resolution.kind).toBe('continues');

    const settled = upsertLivePlaySource(unsettled, 0, {
      ...source,
      revision: 2,
      queue: { sourceId: source.sourceId, settledThroughTick: 100, nextPendingTick: null },
    });
    const result = resolveLivePlayRegistry(settled, {
      tick: 100,
      actors: [{ actorId: 'runner', kind: 'acting' }],
      terminal: 'dead_ball',
    });
    expect(result.resolution.kind).toBe('ended');
  });

  it('rejects a contribution whose queue identity disagrees with its registry source', () => {
    expect(() => createLivePlayRegistry({
      playId: 7,
      revision: 0,
      sources: [{
        ...runnerSource(),
        queue: { sourceId: 'different', settledThroughTick: 100, nextPendingTick: 110 },
      }],
    })).toThrow();
  });

  it('lets ActionFrontier reject duplicate work ids across separate sources', () => {
    const registry = createLivePlayRegistry({
      playId: 7,
      revision: 0,
      sources: [
        runnerSource(),
        {
          sourceId: 'other',
          revision: 1,
          queue: null,
          physical: [{
            workId: 'runner-motion',
            kind: 'throw',
            actorId: 'defender',
            throughTick: 120,
            actionKey: 'other-key',
          }],
          intents: [],
          information: [],
          decisions: [],
          ruleWindows: [],
        },
      ],
    });
    expect(() => resolveLivePlayRegistry(registry, {
      tick: 100,
      actors: settledActors(100),
      terminal: 'none',
    })).toThrow();
  });
});
