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
  type PlayEndBlocker,
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
  completion?: Readonly<{ completedAtTick: number; basisEventId: string }>;
}>;

export type RetiredLivePlaySource = Readonly<{
  sourceId: string;
  revision: number;
}>;

export type LivePlayRegistry = Readonly<{
  playId: number;
  revision: number;
  sources: readonly LivePlaySource[];
  retiredSources?: readonly RetiredLivePlaySource[];
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


const cloneInertData = <T>(input: T, path = 'livePlay'): T => {
  const ancestors = new Set<object>();
  let nodes = 0;

  const visit = (value: unknown, currentPath: string, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error(`${currentPath} exceeds inert-data depth or size limits`);
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`${currentPath} must be finite`);
      return value === 0 ? 0 : value;
    }
    if (typeof value !== 'object') {
      throw new Error(`${currentPath} must contain inert data only`);
    }
    if (ancestors.has(value)) throw new Error(`${currentPath} must not contain cycles`);
    ancestors.add(value);

    let result: unknown;
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new Error(`${currentPath} must be a dense inert array`);
      }
      const array: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active array properties`);
        }
        array.push(visit(descriptor.value, `${currentPath}[${index}]`, depth + 1));
      }
      result = array;
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`${currentPath} must be a plain inert object`);
      }
      const record: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') throw new Error(`${currentPath} must not contain symbol properties`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active properties`);
        }
        Object.defineProperty(record, key, {
          value: visit(descriptor.value, `${currentPath}.${key}`, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      result = record;
    }

    ancestors.delete(value);
    return result;
  };

  return visit(input, path, 0) as T;
};

const readTerminal = (value: unknown): TerminalLiveActionCondition => {
  if (
    value !== 'none'
    && value !== 'dead_ball'
    && value !== 'all_offense_terminal'
    && value !== 'terminal_rule_event'
  ) {
    throw new Error('unknown terminal live-action condition');
  }
  return value;
};

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
  const queue = copyQueue(source.queue, sourceId);
  const completion = source.completion === undefined ? undefined : Object.freeze({
    completedAtTick: safeInteger(source.completion.completedAtTick, 'source completedAtTick'),
    basisEventId: id(source.completion.basisEventId, 'source completion basisEventId'),
  });
  if (completion !== undefined) {
    if (source.physical.length > 0 || source.intents.length > 0 || source.information.length > 0
      || source.decisions.length > 0 || source.ruleWindows.length > 0) {
      throw new Error('completed live-play source still has pending work');
    }
    if (queue !== null && queue.nextPendingTick !== null) {
      throw new Error('completed live-play source still has a pending event');
    }
    if (queue !== null && queue.settledThroughTick < completion.completedAtTick) {
      throw new Error('source completion exceeds its event watermark');
    }
  }
  return Object.freeze({
    sourceId,
    revision,
    queue,
    physical: freezeItems(source.physical),
    intents: freezeItems(source.intents),
    information: freezeItems(source.information),
    decisions: freezeItems(source.decisions),
    ruleWindows: freezeItems(source.ruleWindows),
    ...(completion === undefined ? {} : { completion }),
  });
};

const copyRegistry = (input: LivePlayRegistry): LivePlayRegistry => {
  const request = cloneInertData(input, 'livePlay.registry');
  const playId = safeInteger(request.playId, 'playId');
  const revision = safeInteger(request.revision, 'registry revision');
  if (!Array.isArray(request.sources)) {
    throw new Error('registry sources must be an array');
  }
  const seen = new Set<string>();
  const sources = request.sources.map((source) => {
    const copied = copySource(source);
    if (seen.has(copied.sourceId)) {
      throw new Error('live-play source ids must be unique');
    }
    seen.add(copied.sourceId);
    return copied;
  });
  const retiredInput = request.retiredSources ?? [];
  if (!Array.isArray(retiredInput)) {
    throw new Error('retiredSources must be an array');
  }
  const retiredSeen = new Set<string>();
  const retiredSources = retiredInput.map((retired) => {
    const sourceId = id(retired.sourceId, 'retired sourceId');
    const retiredRevision = safeInteger(retired.revision, 'retired source revision');
    if (retiredRevision === 0) {
      throw new Error('retired source revision must be positive');
    }
    if (retiredSeen.has(sourceId)) {
      throw new Error('retired live-play source ids must be unique');
    }
    retiredSeen.add(sourceId);
    const active = sources.find((source) => source.sourceId === sourceId);
    if (active !== undefined && active.revision <= retiredRevision) {
      throw new Error('active source revision must exceed its retired revision');
    }
    return Object.freeze({ sourceId, revision: retiredRevision });
  });
  return Object.freeze({
    playId,
    revision,
    sources: Object.freeze(sources),
    retiredSources: Object.freeze(retiredSources),
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
  const source = copySource(
    cloneInertData(sourceInput, 'livePlay.source'),
  );
  const existingIndex = registry.sources.findIndex(
    (candidate) => candidate.sourceId === source.sourceId,
  );
  if (existingIndex >= 0 && registry.sources[existingIndex].completion !== undefined
    && source.completion === undefined) {
    throw new Error('completed live-play source cannot reopen');
  }
  const retiredRevision = registry.retiredSources
    ?.find((candidate) => candidate.sourceId === source.sourceId)
    ?.revision ?? 0;
  const revisionFloor = existingIndex >= 0
    ? Math.max(registry.sources[existingIndex].revision, retiredRevision)
    : retiredRevision;
  if (source.revision <= revisionFloor) {
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
    retiredSources: registry.retiredSources ?? Object.freeze([]),
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
  const removed = registry.sources[index];
  const sources = registry.sources.filter(
    (candidate) => candidate.sourceId !== sourceId,
  );
  const retiredSources = [
    ...(registry.retiredSources ?? []).filter(
      (candidate) => candidate.sourceId !== sourceId,
    ),
    Object.freeze({ sourceId, revision: removed.revision }),
  ];
  return Object.freeze({
    playId: registry.playId,
    revision: nextRevision(registry.revision, 'registry revision'),
    sources: Object.freeze(sources),
    retiredSources: Object.freeze(retiredSources),
  });
};

export const retireCompletedLivePlaySources = (
  registryInput: LivePlayRegistry,
  expectedRevision: number,
  currentTickInput: number,
): LivePlayRegistry => {
  const registry = copyRegistry(registryInput);
  requireRegistryRevision(registry, expectedRevision);
  const currentTick = safeInteger(currentTickInput, 'live-play tick');
  const completed = registry.sources.filter((source) => source.completion !== undefined
    && source.completion.completedAtTick <= currentTick);
  if (completed.length === 0) return registry;
  const completedIds = new Set(completed.map((source) => source.sourceId));
  return Object.freeze({
    playId: registry.playId,
    revision: nextRevision(registry.revision, 'registry revision'),
    sources: Object.freeze(registry.sources.filter((source) => !completedIds.has(source.sourceId))),
    retiredSources: Object.freeze([
      ...(registry.retiredSources ?? []),
      ...completed.map((source) => Object.freeze({ sourceId: source.sourceId, revision: source.revision })),
    ]),
  });
};

export const resolveLivePlayRegistry = (
  registryInput: LivePlayRegistry,
  input: ResolveLivePlayRegistryInput,
): LivePlayRegistryResolution => {
  const registry = copyRegistry(registryInput);
  const request = cloneInertData(input, 'livePlay.resolve');
  const currentTick = safeInteger(request.tick, 'live-play tick');
  if (!Array.isArray(request.actors)) {
    throw new Error('actors must be an array');
  }
  const terminal = readTerminal(request.terminal);

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
    actors: [...request.actors],
    eventQueueSettledThroughTick: watermark.settledThroughTick,
  });

  let resolution = resolvePlayEndFromFrontier(
    frontier,
    terminal,
  );
  if (terminal === 'none') {
    const unfinished: PlayEndBlocker[] = registry.sources
      .filter((source) => source.completion === undefined)
      .map((source) => Object.freeze({ kind: 'pending_source' as const, sourceId: source.sourceId }));
    if (unfinished.length > 0) {
      resolution = Object.freeze({
        kind: 'continues', frontier,
        blockers: Object.freeze([
          ...(resolution.kind === 'continues' ? resolution.blockers : []), ...unfinished,
        ]),
      });
    }
  }

  return Object.freeze({
    registry,
    watermark,
    frontier,
    resolution,
  });
};
