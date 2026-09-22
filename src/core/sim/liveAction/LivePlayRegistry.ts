import {
  createLiveActionFrontier,
  resolvePlayEndFromFrontier,
  type ActorPlayDisposition,
  type LiveActionFrontier,
  type PendingDecisionWork,
  type PendingInformationWork,
  type PendingIntentWork,
  type PendingPhysicalWork,
  type PendingRuleWindow,
  type PlayEndResolution,
  type TerminalLiveActionCondition,
} from './ActionFrontier';
import {
  resolveEventQueueWatermark,
  type EventQueueSourceStatus,
  type EventQueueWatermark,
} from './EventQueueWatermark';

export type LivePlaySource = Readonly<{
  sourceId: string;
  revision: number;
  queue: EventQueueSourceStatus | null;
  physical: readonly PendingPhysicalWork[];
  intents: readonly PendingIntentWork[];
  information: readonly PendingInformationWork[];
  decisions: readonly PendingDecisionWork[];
  ruleWindows: readonly PendingRuleWindow[];
}>;

export type LivePlayRegistry = Readonly<{
  playId: number;
  revision: number;
  sources: readonly LivePlaySource[];
}>;

export type ResolveLivePlayRegistryInput = Readonly<{
  tick: number;
  actors: readonly ActorPlayDisposition[];
  terminal: TerminalLiveActionCondition;
}>;

export type LivePlayRegistryResolution = Readonly<{
  registry: LivePlayRegistry;
  watermark: EventQueueWatermark;
  frontier: LiveActionFrontier;
  resolution: PlayEndResolution;
}>;

const safeInteger = (
  value: number,
  name: string,
  minimum = 0,
): number => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer >= ${minimum}`);
  }
  return value;
};

const id = (value: string, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  return value;
};

const nextRevision = (value: number, name: string): number => {
  safeInteger(value, name);
  const next = value + 1;
  if (!Number.isSafeInteger(next)) {
    throw new Error(`${name} cannot overflow`);
  }
  return next;
};

const freezeItems = <T extends object>(items: readonly T[]): readonly T[] =>
  Object.freeze(items.map((item) => Object.freeze({ ...item })));

const copyQueue = (
  queue: EventQueueSourceStatus | null,
  sourceId: string,
): EventQueueSourceStatus | null => {
  if (queue === null) return null;
  if (queue.sourceId !== sourceId) {
    throw new Error('event queue source id must match live-play source id');
  }
  safeInteger(queue.settledThroughTick, 'queue.settledThroughTick', -1);
  if (queue.nextPendingTick !== null) {
    safeInteger(queue.nextPendingTick, 'queue.nextPendingTick');
    if (queue.nextPendingTick <= queue.settledThroughTick) {
      throw new Error('next pending event must be later than settled-through tick');
    }
  }
  return Object.freeze({ ...queue });
};

const copySource = (source: LivePlaySource): LivePlaySource => {
  const sourceId = id(source.sourceId, 'sourceId');
  const revision = safeInteger(source.revision, 'source revision');
  if (revision === 0) {
    throw new Error('live-play source revision must be positive');
  }
  if (
    !Array.isArray(source.physical)
    || !Array.isArray(source.intents)
    || !Array.isArray(source.information)
    || !Array.isArray(source.decisions)
    || !Array.isArray(source.ruleWindows)
  ) {
    throw new Error('live-play source work collections must be arrays');
  }
  return Object.freeze({
    sourceId,
    revision,
    queue: copyQueue(source.queue, sourceId),
    physical: freezeItems(source.physical),
    intents: freezeItems(source.intents),
    information: freezeItems(source.information),
    decisions: freezeItems(source.decisions),
    ruleWindows: freezeItems(source.ruleWindows),
  });
};

const copyRegistry = (input: LivePlayRegistry): LivePlayRegistry => {
  const playId = safeInteger(input.playId, 'playId');
  const revision = safeInteger(input.revision, 'registry revision');
  if (!Array.isArray(input.sources)) {
    throw new Error('registry sources must be an array');
  }
  const seen = new Set<string>();
  const sources = input.sources.map((source) => {
    const copied = copySource(source);
    if (seen.has(copied.sourceId)) {
      throw new Error('live-play source ids must be unique');
    }
    seen.add(copied.sourceId);
    return copied;
  });
  return Object.freeze({
    playId,
    revision,
    sources: Object.freeze(sources),
  });
};

export const createLivePlayRegistry = (
  input: LivePlayRegistry,
): LivePlayRegistry => copyRegistry(input);

const requireRegistryRevision = (
  registry: LivePlayRegistry,
  expectedRevision: number,
): void => {
  safeInteger(expectedRevision, 'expected registry revision');
  if (registry.revision !== expectedRevision) {
    throw new Error('stale live-play registry revision');
  }
};

export const upsertLivePlaySource = (
  registryInput: LivePlayRegistry,
  expectedRevision: number,
  sourceInput: LivePlaySource,
): LivePlayRegistry => {
  const registry = copyRegistry(registryInput);
  requireRegistryRevision(registry, expectedRevision);
  const source = copySource(sourceInput);
  const existingIndex = registry.sources.findIndex(
    (candidate) => candidate.sourceId === source.sourceId,
  );
  if (
    existingIndex >= 0
    && source.revision <= registry.sources[existingIndex].revision
  ) {
    throw new Error('live-play source revision must increase monotonically');
  }
  const sources = [...registry.sources];
  if (existingIndex >= 0) {
    sources[existingIndex] = source;
  } else {
    sources.push(source);
  }
  return Object.freeze({
    playId: registry.playId,
    revision: nextRevision(registry.revision, 'registry revision'),
    sources: Object.freeze(sources),
  });
};

export const removeLivePlaySource = (
  registryInput: LivePlayRegistry,
  expectedRevision: number,
  sourceIdInput: string,
): LivePlayRegistry => {
  const registry = copyRegistry(registryInput);
  requireRegistryRevision(registry, expectedRevision);
  const sourceId = id(sourceIdInput, 'sourceId');
  const index = registry.sources.findIndex(
    (candidate) => candidate.sourceId === sourceId,
  );
  if (index < 0) {
    throw new Error('live-play source does not exist');
  }
  const sources = registry.sources.filter(
    (candidate) => candidate.sourceId !== sourceId,
  );
  return Object.freeze({
    playId: registry.playId,
    revision: nextRevision(registry.revision, 'registry revision'),
    sources: Object.freeze(sources),
  });
};

export const resolveLivePlayRegistry = (
  registryInput: LivePlayRegistry,
  input: ResolveLivePlayRegistryInput,
): LivePlayRegistryResolution => {
  const registry = copyRegistry(registryInput);
  const currentTick = safeInteger(input.tick, 'live-play tick');
  if (!Array.isArray(input.actors)) {
    throw new Error('actors must be an array');
  }

  const queueSources = registry.sources.flatMap(
    (source) => source.queue === null ? [] : [source.queue],
  );
  const watermark = resolveEventQueueWatermark(
    currentTick,
    queueSources,
  );

  const frontier = createLiveActionFrontier({
    tick: currentTick,
    physical: registry.sources.flatMap((source) => [...source.physical]),
    intents: registry.sources.flatMap((source) => [...source.intents]),
    information: registry.sources.flatMap((source) => [...source.information]),
    decisions: registry.sources.flatMap((source) => [...source.decisions]),
    ruleWindows: registry.sources.flatMap((source) => [...source.ruleWindows]),
    actors: [...input.actors],
    eventQueueSettledThroughTick: watermark.settledThroughTick,
  });

  const resolution = resolvePlayEndFromFrontier(
    frontier,
    input.terminal,
  );

  return Object.freeze({
    registry,
    watermark,
    frontier,
    resolution,
  });
};
