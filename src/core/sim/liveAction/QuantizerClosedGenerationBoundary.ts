import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';

export type QuantizerClosedGenerationBoundaryInput = Readonly<{
  originTick: number;
  throughTick: number;
  ticksPerSecond: number;
}>;

export type QuantizerClosedGenerationBoundary = QuantizerClosedGenerationBoundaryInput & Readonly<{
  version: 'quantizer_closed_generation_boundary_v1';
  lastIncludedElapsedSeconds: number;
  firstExcludedElapsedSeconds: number;
  /** Null means the next representable time exceeds the authoritative safe-clock range. */
  firstExcludedTick: number | null;
}>;

/**
 * Arithmetic boundary only: this does not certify generated/consumed events,
 * actual physical coverage, a queue watermark, or PlayEnd.
 *
 * Nonnegative finite IEEE-754 encodings have the same order as their values.
 * The production quantizer is monotone for a fixed positive clock rate: both
 * multiplication and its nearest/ceiling rounding are monotone. Binary search
 * therefore finds adjacent representable times straddling the actual quantizer,
 * including its existing root-noise tolerance without copying or changing it.
 * A physical producer must separately prove its real coverage and consumption.
 */
export const deriveQuantizerClosedGenerationBoundary = (
  raw: QuantizerClosedGenerationBoundaryInput,
): QuantizerClosedGenerationBoundary => {
  const input = cloneInert(raw);
  const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join('|') !== 'originTick|throughTick|ticksPerSecond'
    || !tick(input.originTick) || !tick(input.throughTick) || input.throughTick < input.originTick
    || !Number.isSafeInteger(input.ticksPerSecond) || input.ticksPerSecond <= 0) {
    throw new Error('invalid quantizer-closed generation boundary scope');
  }
  const view = new DataView(new ArrayBuffer(8));
  const seconds = (bits: bigint): number => {
    view.setBigUint64(0, bits);
    return view.getFloat64(0);
  };
  const recordedTick = (elapsedSeconds: number): number | null => {
    try {
      return quantizeEventTick(input.originTick, elapsedSeconds, input.ticksPerSecond);
    } catch (error) {
      // Inputs above are valid and elapsedSeconds is finite/nonnegative. Only a
      // safe-clock overflow is outside the quantizer's authoritative domain.
      if (error instanceof Error && error.message === 'eventTick must be a non-negative safe integer tick') return null;
      throw error;
    }
  };
  let included = 0n;
  let excluded = 0x7fefffffffffffffn; // Largest finite nonnegative double, not an epsilon or physics horizon.
  while (excluded - included > 1n) {
    const middle = (included + excluded) >> 1n;
    const value = recordedTick(seconds(middle));
    if (value !== null && value <= input.throughTick) included = middle;
    else excluded = middle;
  }
  return Object.freeze({ ...input, version: 'quantizer_closed_generation_boundary_v1' as const,
    lastIncludedElapsedSeconds: seconds(included), firstExcludedElapsedSeconds: seconds(excluded),
    firstExcludedTick: recordedTick(seconds(excluded)) });
};
