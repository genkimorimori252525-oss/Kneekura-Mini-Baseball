export type EventOccurrencePredicate = (tick: number) => boolean;

const FLOATING_TICK_TOLERANCE = 1e-9;

const assertAuthoritativeTick = (tick: number, name: string): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

/**
 * Converts a non-negative continuous elapsed time into the first authoritative integer tick
 * at or after that event. Values that are already effectively on an integer tick are preserved
 * instead of being pushed one tick later by floating-point root noise.
 */
export const quantizeEventTick = (
  startTick: number,
  elapsedSeconds: number,
  ticksPerSecond: number,
): number => {
  assertAuthoritativeTick(startTick, 'startTick');
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error('elapsedSeconds must be a finite non-negative number');
  }
  if (!Number.isInteger(ticksPerSecond) || ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive integer');
  }

  const rawOffsetTicks = elapsedSeconds * ticksPerSecond;
  const nearestInteger = Math.round(rawOffsetTicks);
  const tolerance = FLOATING_TICK_TOLERANCE +
    Number.EPSILON * Math.max(1, Math.abs(rawOffsetTicks)) * 8;
  const offsetTicks = Math.abs(rawOffsetTicks - nearestInteger) <= tolerance
    ? nearestInteger
    : Math.ceil(rawOffsetTicks);
  const eventTick = startTick + offsetTicks;
  assertAuthoritativeTick(eventTick, 'eventTick');
  return eventTick;
};

/**
 * Finds the first authoritative integer tick at which a monotonic event predicate is true.
 *
 * The predicate must be false before the event and true from the event tick onward inside
 * the supplied interval. This makes refinement deterministic and independent of renderer
 * cadence or floating-point accumulated time.
 */
export const findFirstTrueTick = (
  startTick: number,
  endTick: number,
  hasOccurredBy: EventOccurrencePredicate,
): number | null => {
  assertAuthoritativeTick(startTick, 'startTick');
  assertAuthoritativeTick(endTick, 'endTick');

  if (endTick < startTick) {
    throw new Error('endTick must be greater than or equal to startTick');
  }

  if (hasOccurredBy(startTick)) {
    return startTick;
  }

  if (!hasOccurredBy(endTick)) {
    return null;
  }

  let low = startTick + 1;
  let high = endTick;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (hasOccurredBy(middle)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
};
