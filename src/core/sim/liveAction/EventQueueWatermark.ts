export type EventQueueSourceStatus = Readonly<{
  sourceId: string;
  settledThroughTick: number;
  nextPendingTick: number | null;
}>;

export type EventQueueWatermark = Readonly<{
  tick: number;
  settledThroughTick: number;
  sources: readonly EventQueueSourceStatus[];
}>;

const validateCurrentTick = (tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error('event queue current tick must be a non-negative safe integer');
  }
};

const validateSettledTick = (tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < -1) {
    throw new Error('event queue settled-through tick must be a safe integer >= -1');
  }
};

const validatePendingTick = (tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error('event queue pending tick must be a non-negative safe integer');
  }
};

const validateId = (id: string): void => {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('event queue source id must not be empty');
  }
};

export const resolveEventQueueWatermark = (
  currentTick: number,
  inputSources: readonly EventQueueSourceStatus[],
): EventQueueWatermark => {
  validateCurrentTick(currentTick);
  const seen = new Set<string>();
  const sources = inputSources.map((source) => {
    validateId(source.sourceId);
    if (seen.has(source.sourceId)) {
      throw new Error('event queue source ids must be unique');
    }
    seen.add(source.sourceId);
    validateSettledTick(source.settledThroughTick);
    if (source.nextPendingTick !== null) {
      validatePendingTick(source.nextPendingTick);
      if (source.nextPendingTick <= source.settledThroughTick) {
        throw new Error('next pending event must be later than the settled-through watermark');
      }
    }
    return Object.freeze({ ...source });
  });
  const settledThroughTick = sources.reduce(
    (settled, source) => Math.min(settled, source.settledThroughTick),
    currentTick,
  );
  return Object.freeze({
    tick: currentTick,
    settledThroughTick,
    sources: Object.freeze(sources),
  });
};
