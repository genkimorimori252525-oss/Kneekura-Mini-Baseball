export type EventOccurrencePredicate = (tick: number) => boolean;

const assertAuthoritativeTick = (tick: number, name: string): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
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
